import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDb } from '@/server/db';
import type { UserRecord } from '@/server/auth';
import {
  COMPETITOR_AND_OCA_BENCHMARK_MATRIX,
  evaluateCreditRiskAndDunning,
  generateFixedToFloatingAmortizationSchedule,
  registerAndValueRealEstateAsset,
  registerPdcCheque,
  transitionPdcChequeStatus,
  validateUaeStatutoryIdentifiers,
} from '@/server/engines/oca-los-engine';

function getOwnerActor(db: ReturnType<typeof createTestDb>): UserRecord {
  return db
    .prepare("SELECT * FROM users WHERE email = 'shabib@betterwaymortgages.com'")
    .get() as unknown as UserRecord;
}

test('OCA-1: Fixed-to-Floating EIBOR Amortization (account_loan) amortizes principal to 0 fils and enforces CBUAE AED 10k early settlement cap', () => {
  const db = createTestDb();
  const actor = getOwnerActor(db);

  const sched = generateFixedToFloatingAmortizationSchedule(db, actor, {
    dealId: 1,
    principalFils: 280_000_000, // AED 2,800,000
    tenureMonths: 300, // 25 Years
    fixedYears: 3,
    introRateBps: 399, // 3.99% Fixed for 3 Years
    revertEiborBps: 368, // 3.68% 3M EIBOR
    revertMarginBps: 165, // +1.65% Margin -> 5.33% Revert Rate
    floorRateBps: 299,
  });

  assert.equal(sched.annualSummary.length, 25);
  assert.ok(sched.introMonthlyEmiFils > 1_400_000 && sched.introMonthlyEmiFils < 1_600_000);
  assert.ok(sched.revertMonthlyEmiFils > sched.introMonthlyEmiFils);
  assert.equal(sched.annualSummary[24]!.closingBalanceFils, 0);
  // Early settlement fee in Year 1 on AED 2.8M balance (1% = AED 27,300) is strictly capped at AED 10,000 (1,000,000 fils)
  assert.equal(sched.annualSummary[0]!.earlySettlementFeeExVatFils, 1_000_000);
});

test('OCA-2: Credit Risk & Dunning Scorecard (credit-control) assigns AAA_PRIME to prime borrowers and D_BLOCKED + CREDIT_HOLD_30D on >50% DBR or bounced PDCs', () => {
  const db = createTestDb();
  const actor = getOwnerActor(db);

  const prime = evaluateCreditRiskAndDunning(db, actor, {
    dealId: 1,
    aecbScore: 785,
    stressedDbrBps: 3400, // 34.0%
    ltvBps: 6500, // 65.0%
    employerTier: 'GOVERNMENT_GRE',
    bouncedChequesCount: 0,
    overdueDays: 0,
  });

  assert.equal(prime.compositeScore, 100);
  assert.equal(prime.riskGrade, 'AAA_PRIME');
  assert.equal(prime.dunningLevel, 'NONE');
  assert.equal(prime.creditCommitteeDecision, 'AUTO_APPROVED');

  const breached = evaluateCreditRiskAndDunning(db, actor, {
    dealId: 2,
    aecbScore: 690,
    stressedDbrBps: 5250, // 52.5% > 50% CBUAE Cap
    ltvBps: 8000,
    bouncedChequesCount: 1,
    overdueDays: 32,
  });

  assert.equal(breached.riskGrade, 'D_BLOCKED');
  assert.equal(breached.dunningLevel, 'CREDIT_HOLD_30D');
  assert.equal(breached.creditCommitteeDecision, 'DECLINED_HOLD');
});

test('OCA-3: Real Estate Asset Registry (vertical-realestate) computes exact price per sqft, gross yield bps, and net yield after RERA service charges', () => {
  const db = createTestDb();
  const actor = getOwnerActor(db);

  const asset = registerAndValueRealEstateAsset(db, actor, {
    dealId: 1,
    householdId: 1,
    registrationType: 'TITLE_DEED',
    titleDeedOrOqoodNo: 'DLD-TD-2026-77810',
    dldPlotNo: 'PLOT-392-0192',
    makaniNo: '29481 88120',
    communityName: 'Downtown Dubai',
    buildingOrProjectName: 'Burj Vista 1',
    unitNo: 'APT-1802',
    propertyType: 'APARTMENT',
    builtUpAreaSqft: 1500,
    purchasePriceFils: 450_000_000, // AED 4,500,000 (AED 3,000/sqft)
    latestValuationFils: 468_000_000, // AED 4,680,000 (104% coverage)
    annualServiceChargeFils: 3_150_000, // AED 31,500
    ejariAnnualRentFils: 27_000_000, // AED 270,000 (6.00% gross yield)
    firstRankMortgageeBank: 'First Abu Dhabi Bank',
  });

  assert.equal(asset.pricePerSqftAed, 3000);
  assert.equal(asset.grossYieldBps, 600); // 6.00%
  assert.equal(asset.netYieldBps, 530); // (270,000 - 31,500) / 4,500,000 = 5.30%
  assert.equal(asset.valuationCoverageRatioPct, 104);
});

test('OCA-4: UAE Post-Dated Cheque (PDC) Vault (odoo-loans) posts Double-Entry GL on CLEARED and triggers CREDIT_HOLD_30D on BOUNCED_DISHONOURED', () => {
  const db = createTestDb();
  const actor = getOwnerActor(db);

  const c1 = registerPdcCheque(db, actor, {
    dealId: 1,
    chequeType: 'AGENCY_FEE_PDC',
    chequeNumber: 'CHQ-700101',
    drawerName: 'Khalid Al Nuaimi',
    drawerBank: 'Emirates NBD',
    payeeName: 'Betterway Mortgages LLC',
    amountFils: 5_250_000, // AED 52,500
    maturityDate: '2026-12-10',
  });
  assert.equal(c1.vaultStatus, 'IN_SAFE_VAULT');

  const cleared = transitionPdcChequeStatus(db, actor, {
    chequeId: c1.id,
    newStatus: 'CLEARED',
  });
  assert.equal(cleared.newStatus, 'CLEARED');
  assert.ok(cleared.glEntryId && cleared.glEntryId > 0);

  const c2 = registerPdcCheque(db, actor, {
    dealId: 1,
    chequeType: 'INSTALLMENT_PDC',
    chequeNumber: 'CHQ-700102',
    drawerName: 'Khalid Al Nuaimi',
    drawerBank: 'Emirates NBD',
    payeeName: 'Betterway Mortgages LLC',
    amountFils: 1_500_000,
    maturityDate: '2026-12-15',
  });

  transitionPdcChequeStatus(db, actor, {
    chequeId: c2.id,
    newStatus: 'BOUNCED_DISHONOURED',
    bounceReason: 'Insufficient Funds',
  });

  const riskAfterBounce = db
    .prepare('SELECT risk_grade, dunning_level, bounced_cheques_count FROM credit_risk_profiles WHERE deal_id = 1')
    .get() as { risk_grade: string; dunning_level: string; bounced_cheques_count: number };

  assert.equal(riskAfterBounce.risk_grade, 'D_BLOCKED');
  assert.equal(riskAfterBounce.dunning_level, 'CREDIT_HOLD_30D');
  assert.ok(riskAfterBounce.bounced_cheques_count >= 1);
});

test('OCA-5: UAE Statutory Identifiers & Benchmark Matrix validate Emirates ID, 23-char AE IBAN, and 15-digit FTA TRN', () => {
  assert.equal(COMPETITOR_AND_OCA_BENCHMARK_MATRIX.length, 6);

  const valid = validateUaeStatutoryIdentifiers({
    emiratesId: '784-1987-4920184-1',
    uaeIban: 'AE470260001015829401201',
    ftaTrn15: '100482910400003',
  });
  assert.equal(valid.allValid, true);

  const invalid = validateUaeStatutoryIdentifiers({
    emiratesId: '999-1987-4920184-1',
    uaeIban: 'GB470260001015829401201',
    ftaTrn15: '200482910400009',
  });
  assert.equal(invalid.emiratesIdValid, false);
  assert.equal(invalid.uaeIbanValid, false);
  assert.equal(invalid.ftaTrn15Valid, false);
});
