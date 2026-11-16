import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDb } from '@/server/db';
import { evaluateDealAcross24Banks, submitRateCardForApproval, approveRateCard } from './underwriting-engine';
import { computeConveyancingPack, generateFormFSpecialConditions } from './conveyancing-engine';
import type { UserRecord } from '@/server/auth';

test('evaluateDealAcross24Banks enforces 50% CBUAE DBR, differentiates 3% vs 5% card-limit banks, and knocks out resident-only banks for non-residents', () => {
  const db = createTestDb();

  // Deal 1: Khalid & Sara (Joint Expat Resident, AED 3.5M ready purchase, AED 80k credit card limit)
  const resEval = evaluateDealAcross24Banks(db, 1);
  assert.ok(resEval.eligibleOffers.length >= 10, 'Expected multiple eligible UAE banks for joint salaried residents');

  const hsbcOffer = resEval.eligibleOffers.find((o) => o.bankKey === 'hsbc');
  const enbdOffer = resEval.eligibleOffers.find((o) => o.bankKey === 'emirates-nbd');
  assert.ok(hsbcOffer && enbdOffer);
  assert.ok(
    hsbcOffer.calculatedDbrBps < enbdOffer.calculatedDbrBps,
    `3% card-limit bank (HSBC: ${hsbcOffer.calculatedDbrBps} bps) must produce lower DBR than 5% card-limit bank (ENBD: ${enbdOffer.calculatedDbrBps} bps)`,
  );

  // Deal 2: James Thornton (UK Non-Resident in GBP with 15% FX haircut)
  const nrEval = evaluateDealAcross24Banks(db, 2);
  const sibKnockout = nrEval.knockouts.find((k) => k.bankKey === 'sib');
  assert.ok(sibKnockout, 'Resident-only bank (SIB) must be knocked out for UK non-resident');
  assert.match(sibKnockout.reason, /non-resident/i);
});

test('evaluateDealAcross24Banks enforces CBUAE 50% under-construction LTV cap and knocks out BLOCKED tower APL banks', () => {
  const db = createTestDb();
  // Project index 3 (project_id = 4) was seeded with HSBC = BLOCKED and ENBD = APPROVED
  db.prepare(`UPDATE deals SET project_id = 4, property_status = 'HANDOVER_COMPLETION', target_loan_fils = 200_000_000 WHERE id = 1`).run();
  const handoverEval = evaluateDealAcross24Banks(db, 1);
  const hsbcBlocked = handoverEval.knockouts.find((k) => k.bankKey === 'hsbc');
  assert.ok(hsbcBlocked, 'HSBC should be knocked out when tower APL is BLOCKED');
  assert.match(hsbcBlocked.reason, /APL/i);

  // Under construction with 80% LTV target (AED 2.8M on AED 3.5M = 80%) must fail CBUAE 50% cap
  db.prepare(`UPDATE deals SET property_status = 'OFFPLAN_UNDER_CONSTRUCTION', target_loan_fils = 280_000_000 WHERE id = 1`).run();
  const ucEval = evaluateDealAcross24Banks(db, 1);
  assert.equal(ucEval.eligibleOffers.length, 0, '80% LTV under construction must violate statutory 50% CBUAE cap across all banks');
});

test('Maker-Checker rate governance blocks self-approval and non-checker users before activating rate cards', () => {
  const db = createTestDb();
  const maker = db.prepare("SELECT * FROM users WHERE email = 'omar.underwriter@betterwaymortgages.com'").get() as UserRecord;
  const checker = db.prepare("SELECT * FROM users WHERE email = 'layla.credit@betterwaymortgages.com'").get() as UserRecord;
  const advisor = db.prepare("SELECT * FROM users WHERE email = 'tariq.advisor@betterwaymortgages.com'").get() as UserRecord;

  const cardId = submitRateCardForApproval(db, maker, {
    bankId: 1,
    productCode: 'SIB-3Y-PROMO',
    financeMode: 'IJARA',
    residencyScope: 'RESIDENT_ONLY',
    stlRequired: 1,
    fixedYears: 3,
    introRateBps: 395,
    eiborTenor: '3M',
    revertMarginBps: 150,
    floorRateBps: 300,
    effectiveFrom: '2026-11-16',
  });

  // Self-approval even if maker were promoted must fail
  assert.throws(() => approveRateCard(db, cardId, { ...maker, can_approve_rates: 1 }), /maker-checker|self-approv/i);
  // Sales advisor cannot approve
  assert.throws(() => approveRateCard(db, cardId, advisor), /not permitted|checker/i);

  // Distinct Head of Credit approves cleanly
  const approved = approveRateCard(db, cardId, checker);
  assert.equal(approved.status, 'ACTIVE');
  assert.equal(approved.approved_by, checker.id);
});

test('computeConveyancingPack calculates exact fils manager cheque splits, down-valuation gap options, and Form F clauses', () => {
  const db = createTestDb();
  // Deal 1: AED 3,500,000 purchase, AED 2,800,000 loan, Seller payoff AED 1,420,000 + 3 days per-diem @ AED 185/day
  const pack = computeConveyancingPack(db, 1, 3);

  assert.equal(pack.cheques.sellerBankPayoffFils, 142_000_000 + 3 * 18_500);
  assert.equal(pack.cheques.sellerNetFils, 350_000_000 - (142_000_000 + 3 * 18_500));
  // DLD = 4% of 3.5M (AED 140,000 = 14,000,000 fils) + AED 580 (58,000 fils)
  assert.equal(pack.cheques.dldTransferFils, 14_058_000);
  // Mortgage Reg = 0.25% of 2.8M (AED 7,000 = 700,000 fils) + AED 290 (29,000 fils)
  assert.equal(pack.cheques.mortgageRegFils, 729_000);
  // Trustee fee = AED 4,200 (420,000 fils)
  assert.equal(pack.cheques.trusteeFeeFils, 420_000);
  // Agency 2% + 5% VAT = 2.1% of 3.5M = AED 73,500 (7,350,000 fils)
  assert.equal(pack.cheques.agencyFeeInclVatFils, 7_350_000);

  // Simulate AED 300,000 down-valuation (valuation comes in at AED 3.2M instead of AED 3.5M)
  db.prepare('UPDATE conveyancing_cases SET valuation_amount_fils = 320_000_000 WHERE deal_id = 1').run();
  const shortfallPack = computeConveyancingPack(db, 1, 0);
  assert.equal(shortfallPack.valuationShortfall.hasShortfall, true);
  // Max 80% LTV on AED 3.2M = AED 2.56M vs target AED 2.80M -> AED 240,000 cash bridge needed if price unchanged
  assert.equal(shortfallPack.valuationShortfall.buyerCashBridgeFils, 24_000_000);

  const clauses = generateFormFSpecialConditions({
    minValuationFils: 350_000_000,
    ltvPct: 80,
    folDays: 21,
    contractValidityDays: 45,
    sellerHasMortgage: true,
    sellerBankName: 'First Abu Dhabi Bank',
  });
  assert.match(clauses.en, /SPECIAL CONDITION 1/);
  assert.match(clauses.ar, /الشرط الخاص الأول/);
});
