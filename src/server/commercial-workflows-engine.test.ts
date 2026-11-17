import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestDb } from '@/server/db';
import {
  computeBuyoutRefinanceAnalysis,
  computeFinancialStatements,
  computeLtiAndAgeAtMaturityDiagnostics,
  computeRentVsBuyWealthAnalysis,
  computeStaffDocumentExpiryRadar,
  decidePendingVendorBill,
  generateBankRmFastPassCoverSheet,
  generateBuyerPreQualificationCertificate,
  generateThreeBankProposalComparison,
  getPreApprovedBuyerPropertyMatcherPool,
  getProductionSecurityStatus,
  renewEmployeeStatutoryDocument,
  submitVendorBillWithApprovalGate,
  toggleProductionSecurityLock,
  updateSalesProgressionAndBlockingDesk,
} from '@/server/engines/commercial-workflows-engine';

test('COM-1: Full Double-Entry Financial Statements verify Assets = Liabilities + Equity + Current Period Retained Earnings', () => {
  const db = createTestDb(true);
  const fs = computeFinancialStatements(db);

  assert.equal(fs.balanceSheet.accountingEquationBalanced, true, 'Balance sheet fundamental equation must balance');
  assert.equal(
    fs.balanceSheet.totalAssetsFils,
    fs.balanceSheet.totalLiabilitiesAndEquityFils,
    'Total Assets must equal Total Liabilities + Equity',
  );
  assert.ok(fs.incomeStatement.totalRevenueFils >= 0);
});

test('COM-2: Maker-Checker Expense Approval Gate (> AED 5,000) holds GL posting until Owner/Manager sign-off', () => {
  const db = createTestDb(true);
  const advisor = db.prepare("SELECT * FROM users WHERE role = 'SALES_ADVISOR' LIMIT 1").get() as {
    id: number;
    role: 'SALES_ADVISOR';
    email: string;
    full_name_en: string;
  };
  const owner = db.prepare("SELECT * FROM users WHERE email = 'shabib@betterwaymortgages.com'").get() as {
    id: number;
    role: 'SUPER_ADMIN';
    email: string;
    full_name_en: string;
  };

  // Invalid TRN should be rejected when input VAT > 0
  assert.throws(
    () =>
      submitVendorBillWithApprovalGate(db, advisor, {
        vendorName: 'Invalid TRN Supplier',
        vendorTrn15: '999',
        billDate: '2026-11-16',
        expenseAccountCode: '6300',
        subtotalFils: 600_000,
        inputVatFils: 30_000,
        inputVatCategory: 'DIRECT_TAXABLE',
        ctDeductibility: 'FULL_100',
      }),
    /15-digit UAE Tax Registration Number/,
  );

  // Advisor submits AED 10,000 + AED 500 VAT (> AED 5,000 threshold) -> Held in PENDING_OWNER_APPROVAL with no GL entry
  const pending = submitVendorBillWithApprovalGate(db, advisor, {
    vendorName: 'Property Finder FZ-LLC',
    vendorTrn15: '100394857600003',
    billDate: '2026-11-16',
    expenseAccountCode: '6300',
    subtotalFils: 1_000_000,
    inputVatFils: 50_000,
    inputVatCategory: 'DIRECT_TAXABLE',
    ctDeductibility: 'FULL_100',
  });

  assert.equal(pending.approvalStatus, 'PENDING_OWNER_APPROVAL');
  assert.equal(pending.glEntryId, null);

  // Non-executive cannot approve
  assert.throws(
    () =>
      decidePendingVendorBill(db, advisor, {
        billId: pending.billId,
        decision: 'APPROVED',
      }),
    /Only Owner Shabib Siraj/,
  );

  // Owner Shabib Siraj approves -> Posts balanced double-entry journal
  const approved = decidePendingVendorBill(db, owner, {
    billId: pending.billId,
    decision: 'APPROVED',
  });
  assert.equal(approved.approvalStatus, 'APPROVED');
  assert.ok(Number(approved.glEntryId) > 0);

  // Balance Sheet remains balanced after approval
  const fsAfter = computeFinancialStatements(db);
  assert.equal(fsAfter.balanceSheet.accountingEquationBalanced, true);
});

test('COM-3: UAE Mortgage Buyout Break-Even Engine enforces CBUAE AED 10,000 early settlement cap (+5% VAT) and Islamic structure', () => {
  const res = computeBuyoutRefinanceAnalysis({
    existingPrincipalFils: 300_000_000, // AED 3,000,000
    remainingMonths: 240,
    currentRateBps: 565, // 5.65%
    newIntroRateBps: 389, // 3.89%
    financeMode: 'IJARA',
  });

  // 1% of 3M is AED 30,000, but CBUAE caps it at AED 10,000 Ex-VAT (1,000,000 fils) and AED 10,500 Incl. 5% VAT (1,050,000 fils)
  assert.equal(res.cbuaeEarlySettlementPenaltyExVatFils, 1_000_000);
  assert.equal(res.cbuaeEarlySettlementPenaltyInclVatFils, 1_050_000);
  assert.ok(res.monthlySavingsFils > 250_000, 'Monthly savings should exceed AED 2,500/mo');
  assert.ok(res.breakEvenMonths !== null && res.breakEvenMonths <= 10, 'Break-even should be <= 10 months');
  assert.equal(res.recommendation, 'RECOMMEND_BUYOUT');
  assert.match(res.shariaStructureSummary, /Ijara/);
});

test('COM-4: 3-Bank Side-by-Side Mortgage Proposal Generator ranks top 3 offers and calculates 5-year savings', () => {
  const db = createTestDb(true);
  const prop = generateThreeBankProposalComparison(db, 1);

  assert.equal(prop.dealId, 1);
  assert.equal(prop.options.length, 3);
  assert.equal(prop.options[0].rank, 1);
  assert.equal(prop.options[0].deltaVsBestRankFils, 0);
  assert.ok(prop.options[2].fiveYearTotalCostFils >= prop.options[0].fiveYearTotalCostFils);
  assert.equal(
    prop.savingsBestVsThirdFils,
    prop.options[2].fiveYearTotalCostFils - prop.options[0].fiveYearTotalCostFils,
  );
});

test('COM-5: HR 90/60/30-Day Staff Statutory Document Expiry Radar flags expired BRN/Visa and supports renewal', () => {
  const db = createTestDb(true);
  const owner = db.prepare("SELECT * FROM users WHERE email = 'shabib@betterwaymortgages.com'").get() as {
    id: number;
    role: 'SUPER_ADMIN';
  };

  // Set employee #1 RERA card to an expired date relative to 2026-11-17
  renewEmployeeStatutoryDocument(db, owner, {
    employeeId: 1,
    docField: 'rera_card_expiry_date',
    newExpiryDate: '2026-10-01',
  });

  const radarBefore = computeStaffDocumentExpiryRadar(db, '2026-11-17');
  assert.ok(radarBefore.expiredCount >= 1);
  const expiredBrn = radarBefore.items.find(
    (i) => i.employeeId === 1 && i.docField === 'rera_card_expiry_date',
  );
  assert.equal(expiredBrn?.severityBand, 'EXPIRED_BLOCKED');
  assert.equal(expiredBrn?.blocksCommissionRelease, true);

  // Renew to 2028-12-31
  renewEmployeeStatutoryDocument(db, owner, {
    employeeId: 1,
    docField: 'rera_card_expiry_date',
    newExpiryDate: '2028-12-31',
  });

  const radarAfter = computeStaffDocumentExpiryRadar(db, '2026-11-17');
  const renewedBrn = radarAfter.items.find(
    (i) => i.employeeId === 1 && i.docField === 'rera_card_expiry_date',
  );
  assert.equal(renewedBrn?.severityBand, 'VALID_CLEAR');
  assert.equal(renewedBrn?.blocksCommissionRelease, false);
});

test('COM-6: Commercial Production Security Lock toggles strictly under SUPER_ADMIN', () => {
  const db = createTestDb(true);
  const owner = db.prepare("SELECT * FROM users WHERE email = 'shabib@betterwaymortgages.com'").get() as {
    id: number;
    role: 'SUPER_ADMIN';
    email: string;
  };
  const advisor = db.prepare("SELECT * FROM users WHERE role = 'SALES_ADVISOR' LIMIT 1").get() as {
    id: number;
    role: 'SALES_ADVISOR';
    email: string;
  };

  assert.equal(getProductionSecurityStatus(db).productionLockEnabled, false);

  assert.throws(() => toggleProductionSecurityLock(db, advisor, true), /Only Owner Shabib Siraj/);

  toggleProductionSecurityLock(db, owner, true);
  assert.equal(getProductionSecurityStatus(db).productionLockEnabled, true);

  toggleProductionSecurityLock(db, owner, false);
  assert.equal(getProductionSecurityStatus(db).productionLockEnabled, false);
});

test('COM-7: Mortgage Finder Rent vs. Buy 5-Year Wealth Calculator computes Ejari rent outflow vs mortgage principal equity & DLD fees', () => {
  const res = computeRentVsBuyWealthAnalysis({
    currentAnnualRentFils: 22_000_000, // AED 220,000/yr Ejari rent
    targetPropertyPriceFils: 350_000_000, // AED 3,500,000 villa
    downPaymentBps: 2000, // 20%
    mortgageRateBps: 399, // 3.99%
    tenureMonths: 300, // 25 years
    annualAppreciationBps: 450, // 4.5%/yr
  });

  assert.equal(res.downPaymentFils, 70_000_000);
  assert.equal(res.loanAmountFils, 280_000_000);
  assert.ok(res.fiveYearTotalRentOutflowFils > 110_000_000, '5Y escalated Ejari rent exceeds AED 1.1M');
  assert.ok(res.fiveYearPrincipalEquityBuiltFils > 30_000_000, '5Y principal equity built exceeds AED 300k');
  assert.equal(res.verdict, 'BUY_OUTPERFORMS_RENT');
});

test('COM-8: 7x Annual Income Cap (LTI Multiple) & Age-at-Maturity (65/70) Diagnostics + 60-Day Pre-Qual AIP & BDM Cover Sheet', () => {
  const db = createTestDb(true);
  const diag = computeLtiAndAgeAtMaturityDiagnostics(db, 1, '2026-11-17');

  assert.ok(diag.currentAgeYears >= 21);
  assert.equal(diag.maxMaturityAgeYears, 65);
  assert.ok(diag.ltiMultipleX > 0 && diag.ltiMultipleX <= 7.0);
  assert.equal(diag.ltiCompliant, true);

  const aip = generateBuyerPreQualificationCertificate(db, 1);
  assert.equal(aip.validityDays, 60);
  assert.equal(aip.dbrStatus, 'CLEARED_WITHIN_CBUAE_50PCT_HARD_CAP');
  assert.match(aip.certificateRef, /^AIP-BW-2026-/);

  const cs = generateBankRmFastPassCoverSheet(db, 1);
  assert.match(cs.coverSheetRef, /^FASTPASS-BDM-2026-/);
  assert.ok(cs.mitigants.length >= 4);
});

test('COM-9: Mortgease & Holo Pre-Approved Buyer Matcher Pool & Allsopp Sales Progression DLD Blocking Desk', () => {
  const db = createTestDb(true);
  const owner = db.prepare("SELECT * FROM users WHERE email = 'shabib@betterwaymortgages.com'").get() as {
    id: number;
    role: 'SUPER_ADMIN';
  };

  const pool = getPreApprovedBuyerPropertyMatcherPool(db);
  assert.ok(pool.length >= 2);
  assert.match(pool[0].nonCircumventionCertId, /^NC-BWM-/);

  updateSalesProgressionAndBlockingDesk(db, owner, {
    dealId: 1,
    valuationFirm: 'Cavendish Maxwell',
    valuationAccessStatus: 'REPORT_DELIVERED',
    developerPortalName: 'Emaar Sakani Portal',
    nocStatus: 'ISSUED',
    dldBlockingStage: 'READY_FOR_FINAL_TRANSFER',
    trusteeOffice: 'Al Manara Registration Trustee',
  });

  const conv = db.prepare('SELECT * FROM conveyancing_cases WHERE deal_id = 1').get() as Record<string, unknown>;
  assert.equal(conv.valuation_firm, 'Cavendish Maxwell');
  assert.equal(conv.valuation_access_status, 'REPORT_DELIVERED');
  assert.equal(conv.dld_blocking_stage, 'READY_FOR_FINAL_TRANSFER');
  assert.equal(conv.noc_status, 'ISSUED');
});

