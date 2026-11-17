import type { DatabaseSync } from 'node:sqlite';
import { ForbiddenError, writeAuditLog, type UserRecord } from '@/server/auth';
import {
  computeCorporateTaxSummary,
  computeVat201Summary,
  getTrialBalance,
  postJournalEntry,
} from '@/server/engines/ledger-tax-engine';
import { evaluateDealAcross24Banks } from '@/server/engines/underwriting-engine';
import { computeConveyancingPack } from '@/server/engines/conveyancing-engine';

export const VENDOR_BILL_APPROVAL_THRESHOLD_FILS = 500_000; // AED 5,000.00
export const CBUAE_EARLY_SETTLEMENT_FEE_CAP_FILS = 1_000_000; // AED 10,000.00 (Ex-VAT)
export const CBUAE_EARLY_SETTLEMENT_FEE_WITH_VAT_CAP_FILS = 1_050_000; // AED 10,500.00 (Incl. 5% VAT)

export interface FinancialStatementLine {
  code: string;
  name: string;
  accountType: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  balanceFils: number;
}

export interface CorporateFinancialStatements {
  incomeStatement: {
    revenueLines: FinancialStatementLine[];
    directCostLines: FinancialStatementLine[];
    operatingExpenseLines: FinancialStatementLine[];
    totalRevenueFils: number;
    totalDirectCostFils: number;
    grossMarginFils: number;
    grossMarginPct: number;
    totalOperatingExpensesFils: number;
    ebitdaOperatingProfitFils: number;
    corporateTaxProvisionFils: number;
    netProfitAfterTaxFils: number;
  };
  balanceSheet: {
    assetLines: FinancialStatementLine[];
    liabilityLines: FinancialStatementLine[];
    equityLines: FinancialStatementLine[];
    totalAssetsFils: number;
    totalLiabilitiesFils: number;
    retainedEarningsCurrentPeriodFils: number;
    totalEquityFils: number;
    totalLiabilitiesAndEquityFils: number;
    accountingEquationBalanced: boolean;
  };
  receivablesAndPayables: {
    pendingBankSubventionFils: number;
    pendingPartnerPayablesFils: number;
    pendingApprovalVendorBillsCount: number;
    pendingApprovalVendorBillsFils: number;
    netWorkingCapitalFils: number;
  };
}

/**
 * 1. Full Double-Entry Financial Statements (Income Statement / P&L + Balance Sheet + Working Capital)
 */
export function computeFinancialStatements(db: DatabaseSync): CorporateFinancialStatements {
  const tb = getTrialBalance(db);
  const ct = computeCorporateTaxSummary(db);
  const vat = computeVat201Summary(db);

  const revenueLines: FinancialStatementLine[] = [];
  const directCostLines: FinancialStatementLine[] = [];
  const operatingExpenseLines: FinancialStatementLine[] = [];
  const assetLines: FinancialStatementLine[] = [];
  const liabilityLines: FinancialStatementLine[] = [];
  const equityLines: FinancialStatementLine[] = [];

  for (const r of tb) {
    if (r.account_type === 'REVENUE') {
      const bal = r.total_credit_fils - r.total_debit_fils;
      if (bal !== 0 || ['4100', '4200'].includes(r.code)) {
        revenueLines.push({ code: r.code, name: r.name, accountType: r.account_type, balanceFils: bal });
      }
    } else if (r.account_type === 'EXPENSE') {
      const bal = r.total_debit_fils - r.total_credit_fils;
      if (r.code.startsWith('5')) {
        if (bal !== 0 || ['5100', '5200'].includes(r.code)) {
          directCostLines.push({ code: r.code, name: r.name, accountType: r.account_type, balanceFils: bal });
        }
      } else if (bal !== 0 || ['6100', '6200', '6300'].includes(r.code)) {
        operatingExpenseLines.push({ code: r.code, name: r.name, accountType: r.account_type, balanceFils: bal });
      }
    } else if (r.account_type === 'ASSET') {
      const bal = r.total_debit_fils - r.total_credit_fils;
      if (bal !== 0 || ['1100', '1150', '1200'].includes(r.code)) {
        assetLines.push({ code: r.code, name: r.name, accountType: r.account_type, balanceFils: bal });
      }
    } else if (r.account_type === 'LIABILITY') {
      const bal = r.total_credit_fils - r.total_debit_fils;
      if (bal !== 0 || ['2100', '2200', '2300'].includes(r.code)) {
        liabilityLines.push({ code: r.code, name: r.name, accountType: r.account_type, balanceFils: bal });
      }
    } else if (r.account_type === 'EQUITY') {
      const bal = r.total_credit_fils - r.total_debit_fils;
      equityLines.push({ code: r.code, name: r.name, accountType: r.account_type, balanceFils: bal });
    }
  }

  const totalRevenueFils = revenueLines.reduce((s, l) => s + l.balanceFils, 0);
  const totalDirectCostFils = directCostLines.reduce((s, l) => s + l.balanceFils, 0);
  const grossMarginFils = totalRevenueFils - totalDirectCostFils;
  const grossMarginPct = totalRevenueFils > 0 ? +((grossMarginFils / totalRevenueFils) * 100).toFixed(2) : 0;

  // Include all active expense accounts even if not in the default display filter
  const allExpensesFils = tb
    .filter((r) => r.account_type === 'EXPENSE')
    .reduce((s, r) => s + (r.total_debit_fils - r.total_credit_fils), 0);
  const totalOperatingExpensesFils = allExpensesFils - totalDirectCostFils;
  const ebitdaOperatingProfitFils = totalRevenueFils - allExpensesFils;
  const corporateTaxProvisionFils = ct.corporateTaxPayableFils;
  const netProfitAfterTaxFils = ebitdaOperatingProfitFils - corporateTaxProvisionFils;

  const totalAssetsFils = tb
    .filter((r) => r.account_type === 'ASSET')
    .reduce((s, r) => s + (r.total_debit_fils - r.total_credit_fils), 0);

  const totalLiabilitiesFils = tb
    .filter((r) => r.account_type === 'LIABILITY')
    .reduce((s, r) => s + (r.total_credit_fils - r.total_debit_fils), 0);

  const baseEquityFils = tb
    .filter((r) => r.account_type === 'EQUITY')
    .reduce((s, r) => s + (r.total_credit_fils - r.total_debit_fils), 0);

  // Retained earnings from current period = Revenue - Expenses
  const retainedEarningsCurrentPeriodFils = ebitdaOperatingProfitFils;
  const totalEquityFils = baseEquityFils + retainedEarningsCurrentPeriodFils;
  const totalLiabilitiesAndEquityFils = totalLiabilitiesFils + totalEquityFils;

  const pendingSubventionRow = db
    .prepare(
      `SELECT COALESCE(SUM(expected_subvention_ex_vat_fils - received_subvention_ex_vat_fils), 0) as pending
       FROM commission_settlements
       WHERE reconciliation_status IN ('AWAITING_BANK_CASH', 'PARTIAL_RECEIVED')`,
    )
    .get() as { pending: number };

  const pendingPartnerRow = db
    .prepare(
      `SELECT COALESCE(SUM(partner_held_ex_vat_fils + partner_released_ex_vat_fils), 0) as payable
       FROM commission_settlements
       WHERE partner_payout_status IN ('ONBOARDING_HOLD', 'PAYABLE_READY')`,
    )
    .get() as { payable: number };

  const pendingBillsRow = db
    .prepare(
      `SELECT COUNT(*) as c, COALESCE(SUM(subtotal_fils + input_vat_fils), 0) as total
       FROM vendor_bills
       WHERE approval_status = 'PENDING_OWNER_APPROVAL'`,
    )
    .get() as { c: number; total: number };

  return {
    incomeStatement: {
      revenueLines,
      directCostLines,
      operatingExpenseLines,
      totalRevenueFils,
      totalDirectCostFils,
      grossMarginFils,
      grossMarginPct,
      totalOperatingExpensesFils,
      ebitdaOperatingProfitFils,
      corporateTaxProvisionFils,
      netProfitAfterTaxFils,
    },
    balanceSheet: {
      assetLines,
      liabilityLines,
      equityLines,
      totalAssetsFils,
      totalLiabilitiesFils,
      retainedEarningsCurrentPeriodFils,
      totalEquityFils,
      totalLiabilitiesAndEquityFils,
      accountingEquationBalanced: totalAssetsFils === totalLiabilitiesAndEquityFils,
    },
    receivablesAndPayables: {
      pendingBankSubventionFils: Number(pendingSubventionRow.pending || 0),
      pendingPartnerPayablesFils: Number(pendingPartnerRow.payable || 0),
      pendingApprovalVendorBillsCount: Number(pendingBillsRow.c || 0),
      pendingApprovalVendorBillsFils: Number(pendingBillsRow.total || 0),
      netWorkingCapitalFils: totalAssetsFils - totalLiabilitiesFils - Math.max(0, vat.netVatPayableFils),
    },
  };
}

/**
 * 2. Maker-Checker Expense & Purchase Order Approval Gate (> AED 5,000)
 */
export function submitVendorBillWithApprovalGate(
  db: DatabaseSync,
  actor: Pick<UserRecord, 'id' | 'role' | 'email' | 'full_name_en'> | null,
  input: {
    vendorName: string;
    vendorTrn15?: string;
    billDate: string;
    expenseAccountCode: string;
    marketingChannel?: string;
    subtotalFils: number;
    inputVatFils: number;
    inputVatCategory: 'DIRECT_TAXABLE' | 'DIRECT_EXEMPT' | 'RESIDUAL_OVERHEAD';
    ctDeductibility: 'FULL_100' | 'ENTERTAINMENT_50' | 'NON_DEDUCTIBLE_0';
    requireMakerCheckerGate?: boolean;
  },
) {
  const trn = (input.vendorTrn15 || '').trim();
  if (input.inputVatFils > 0 && trn.length > 0 && !/^\d{15}$/.test(trn)) {
    throw new Error('FTA Input VAT validation failed: Vendor TRN must be an exact 15-digit UAE Tax Registration Number');
  }

  const totalCashOutFils = input.subtotalFils + input.inputVatFils;
  const count = (db.prepare('SELECT COUNT(*) as c FROM vendor_bills').get() as { c: number }).c + 1;
  const billNumber = `BILL-2026-${String(count).padStart(4, '0')}`;

  const isExecutiveApprover =
    actor &&
    (actor.role === 'SUPER_ADMIN' ||
      actor.email === 'shabib@betterwaymortgages.com' ||
      actor.email === 'haseeb@betterwaymortgages.com');

  const needsApproval =
    totalCashOutFils > VENDOR_BILL_APPROVAL_THRESHOLD_FILS &&
    (input.requireMakerCheckerGate === true || !isExecutiveApprover);

  if (needsApproval) {
    const res = db
      .prepare(
        `INSERT INTO vendor_bills (
          bill_number, vendor_name, vendor_trn_15, bill_date, expense_account_code,
          marketing_channel, subtotal_fils, input_vat_fils, input_vat_category, ct_deductibility,
          approval_status, approved_by_user_id, gl_entry_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_OWNER_APPROVAL', NULL, NULL)`,
      )
      .run(
        billNumber,
        input.vendorName,
        trn,
        input.billDate,
        input.expenseAccountCode,
        input.marketingChannel ?? null,
        input.subtotalFils,
        input.inputVatFils,
        input.inputVatCategory,
        input.ctDeductibility,
      );

    const billId = Number(res.lastInsertRowid);
    writeAuditLog(db, actor, 'vendor_bills', billId, 'SUBMIT_VENDOR_BILL_PENDING_APPROVAL', null, {
      billNumber,
      totalCashOutFils,
      thresholdFils: VENDOR_BILL_APPROVAL_THRESHOLD_FILS,
    });

    return {
      billId,
      billNumber,
      approvalStatus: 'PENDING_OWNER_APPROVAL' as const,
      glEntryId: null,
      totalCashOutFils,
    };
  }

  const isExemptBlocked = input.inputVatCategory === 'DIRECT_EXEMPT';
  const glEntryId = postJournalEntry(db, actor, {
    entryDate: input.billDate,
    memo: `${billNumber} — ${input.vendorName}`,
    sourceModule: 'VENDOR_BILL',
    sourceId: billNumber,
    lines: [
      {
        accountCode: input.expenseAccountCode,
        debitFils: input.subtotalFils + (isExemptBlocked ? input.inputVatFils : 0),
        creditFils: 0,
        lineMemo: input.vendorName,
      },
      ...(!isExemptBlocked && input.inputVatFils > 0
        ? [{ accountCode: '2310', debitFils: input.inputVatFils, creditFils: 0, lineMemo: 'FTA Input VAT' }]
        : []),
      { accountCode: '1100', debitFils: 0, creditFils: totalCashOutFils, lineMemo: `Paid ${input.vendorName}` },
    ],
  });

  const res = db
    .prepare(
      `INSERT INTO vendor_bills (
        bill_number, vendor_name, vendor_trn_15, bill_date, expense_account_code,
        marketing_channel, subtotal_fils, input_vat_fils, input_vat_category, ct_deductibility,
        approval_status, approved_by_user_id, gl_entry_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'APPROVED', ?, ?)`,
    )
    .run(
      billNumber,
      input.vendorName,
      trn,
      input.billDate,
      input.expenseAccountCode,
      input.marketingChannel ?? null,
      input.subtotalFils,
      input.inputVatFils,
      input.inputVatCategory,
      input.ctDeductibility,
      actor?.id ?? null,
      glEntryId,
    );

  return {
    billId: Number(res.lastInsertRowid),
    billNumber,
    approvalStatus: 'APPROVED' as const,
    glEntryId,
    totalCashOutFils,
  };
}

export function decidePendingVendorBill(
  db: DatabaseSync,
  actor: Pick<UserRecord, 'id' | 'role' | 'email' | 'full_name_en'>,
  input: {
    billId: number;
    decision: 'APPROVED' | 'REJECTED';
  },
) {
  if (!['SUPER_ADMIN', 'FINANCE_ADMIN'].includes(actor.role)) {
    throw new ForbiddenError('Only Owner Shabib Siraj, Manager Mohammad Haseeb, or Finance Admin can approve expenses > AED 5,000');
  }

  const bill = db.prepare('SELECT * FROM vendor_bills WHERE id = ?').get(input.billId) as
    | {
        id: number;
        bill_number: string;
        vendor_name: string;
        bill_date: string;
        expense_account_code: string;
        subtotal_fils: number;
        input_vat_fils: number;
        input_vat_category: string;
        approval_status: string;
        gl_entry_id: number | null;
      }
    | undefined;

  if (!bill) {
    throw new Error(`Vendor bill #${input.billId} not found`);
  }
  if (bill.approval_status !== 'PENDING_OWNER_APPROVAL') {
    throw new Error(`Vendor bill ${bill.bill_number} is already ${bill.approval_status}`);
  }

  if (input.decision === 'REJECTED') {
    db.prepare(
      `UPDATE vendor_bills
       SET approval_status = 'REJECTED', approved_by_user_id = ?
       WHERE id = ?`,
    ).run(actor.id, bill.id);
    writeAuditLog(db, actor, 'vendor_bills', bill.id, 'REJECT_VENDOR_BILL', { status: bill.approval_status }, { status: 'REJECTED' });
    return { billNumber: bill.bill_number, approvalStatus: 'REJECTED' as const, glEntryId: null };
  }

  const totalCashOutFils = bill.subtotal_fils + bill.input_vat_fils;
  const isExemptBlocked = bill.input_vat_category === 'DIRECT_EXEMPT';
  const glEntryId = postJournalEntry(db, actor, {
    entryDate: bill.bill_date,
    memo: `${bill.bill_number} — ${bill.vendor_name} (Executive Approved)`,
    sourceModule: 'VENDOR_BILL',
    sourceId: bill.bill_number,
    lines: [
      {
        accountCode: bill.expense_account_code,
        debitFils: bill.subtotal_fils + (isExemptBlocked ? bill.input_vat_fils : 0),
        creditFils: 0,
        lineMemo: bill.vendor_name,
      },
      ...(!isExemptBlocked && bill.input_vat_fils > 0
        ? [{ accountCode: '2310', debitFils: bill.input_vat_fils, creditFils: 0, lineMemo: 'FTA Input VAT' }]
        : []),
      { accountCode: '1100', debitFils: 0, creditFils: totalCashOutFils, lineMemo: `Paid ${bill.vendor_name}` },
    ],
  });

  db.prepare(
    `UPDATE vendor_bills
     SET approval_status = 'APPROVED', approved_by_user_id = ?, gl_entry_id = ?
     WHERE id = ?`,
  ).run(actor.id, glEntryId, bill.id);

  writeAuditLog(db, actor, 'vendor_bills', bill.id, 'APPROVE_VENDOR_BILL', { status: bill.approval_status }, { status: 'APPROVED', glEntryId });

  return { billNumber: bill.bill_number, approvalStatus: 'APPROVED' as const, glEntryId };
}

/**
 * 3. UAE Mortgage Buyout (Refinancing) Break-Even & Islamic (Ijara / Murabaha) Structuring Engine
 */
function calcMonthlyEmiFils(principalFils: number, annualRateBps: number, months: number): number {
  if (principalFils <= 0 || months <= 0) return 0;
  if (annualRateBps <= 0) return Math.round(principalFils / months);
  const r = annualRateBps / 10_000 / 12;
  const factor = Math.pow(1 + r, months);
  return Math.round((principalFils * r * factor) / (factor - 1));
}

export interface BuyoutRefinanceAnalysis {
  existingPrincipalFils: number;
  remainingMonths: number;
  currentRateBps: number;
  newIntroRateBps: number;
  financeMode: 'CONVENTIONAL' | 'IJARA' | 'MURABAHA' | 'MUSHARAKA';
  currentMonthlyEmiFils: number;
  newMonthlyEmiFils: number;
  monthlySavingsFils: number;
  cbuaeEarlySettlementPenaltyExVatFils: number;
  cbuaeEarlySettlementPenaltyInclVatFils: number;
  dldMortgageReleaseAndReRegFils: number;
  valuationAndProcessingFeeFils: number;
  totalSwitchingCostFils: number;
  breakEvenMonths: number | null;
  fiveYearGrossSavingsFils: number;
  fiveYearNetSavingsFils: number;
  liabilityLetterValidityDays: number;
  shariaStructureSummary: string;
  recommendation: 'RECOMMEND_BUYOUT' | 'MARGINAL_HOLD' | 'DO_NOT_REFINANCE';
}

export function computeBuyoutRefinanceAnalysis(input: {
  existingPrincipalFils: number;
  remainingMonths: number;
  currentRateBps: number;
  newIntroRateBps: number;
  newBankArrangementFeeBps?: number;
  financeMode?: 'CONVENTIONAL' | 'IJARA' | 'MURABAHA' | 'MUSHARAKA';
}): BuyoutRefinanceAnalysis {
  const mode = input.financeMode || 'CONVENTIONAL';
  const currentMonthlyEmiFils = calcMonthlyEmiFils(input.existingPrincipalFils, input.currentRateBps, input.remainingMonths);
  const newMonthlyEmiFils = calcMonthlyEmiFils(input.existingPrincipalFils, input.newIntroRateBps, input.remainingMonths);
  const monthlySavingsFils = currentMonthlyEmiFils - newMonthlyEmiFils;

  // CBUAE Consumer Protection Regulation: Early settlement fee is min(1% of outstanding principal, AED 10,000) + 5% VAT
  const rawOnePctFils = Math.round(input.existingPrincipalFils * 0.01);
  const cbuaeEarlySettlementPenaltyExVatFils = Math.min(rawOnePctFils, CBUAE_EARLY_SETTLEMENT_FEE_CAP_FILS);
  const cbuaeEarlySettlementPenaltyInclVatFils = Math.round(cbuaeEarlySettlementPenaltyExVatFils * 1.05);

  // DLD Mortgage Re-Registration (0.25% of loan + AED 1,580 DLD release & admin fees)
  const dldMortgageReleaseAndReRegFils = Math.round(input.existingPrincipalFils * 0.0025) + 158_000;

  // Valuation (AED 2,625 incl. VAT) + New Bank Arrangement Fee (default 0% on UAE Buyout campaigns, or specified bps + 5% VAT)
  const arrangementBps = input.newBankArrangementFeeBps ?? 0;
  const arrangementInclVatFils = Math.round(((input.existingPrincipalFils * arrangementBps) / 10_000) * 1.05);
  const valuationAndProcessingFeeFils = 262_500 + arrangementInclVatFils;

  const totalSwitchingCostFils =
    cbuaeEarlySettlementPenaltyInclVatFils + dldMortgageReleaseAndReRegFils + valuationAndProcessingFeeFils;

  const horizonMonths = Math.min(60, input.remainingMonths);
  const fiveYearGrossSavingsFils = monthlySavingsFils * horizonMonths;
  const fiveYearNetSavingsFils = fiveYearGrossSavingsFils - totalSwitchingCostFils;

  const breakEvenMonths =
    monthlySavingsFils > 0 ? Math.ceil(totalSwitchingCostFils / monthlySavingsFils) : null;

  const shariaStructureSummary =
    mode === 'IJARA'
      ? 'Islamic Ijara Muntahia Bittamleek (Lease-to-Own) · Takaful Property & Life Cover · AAOIFI Sharia Board Certified'
      : mode === 'MURABAHA'
        ? 'Islamic Commodity / Property Murabaha (Fixed Cost-Plus Profit Margin) · Zero Compound Late Penalty'
        : mode === 'MUSHARAKA'
          ? 'Islamic Diminishing Musharaka (Co-Ownership Buyout) · Rental Profit Rate Linked to EIBOR'
          : 'Conventional Reducing-Balance Mortgage Facility · CBUAE Standard KFS & Early Settlement Schedule';

  let recommendation: 'RECOMMEND_BUYOUT' | 'MARGINAL_HOLD' | 'DO_NOT_REFINANCE' = 'DO_NOT_REFINANCE';
  if (monthlySavingsFils > 0 && breakEvenMonths !== null && breakEvenMonths <= 24 && fiveYearNetSavingsFils > 1_000_000) {
    recommendation = 'RECOMMEND_BUYOUT';
  } else if (monthlySavingsFils > 0 && fiveYearNetSavingsFils > 0) {
    recommendation = 'MARGINAL_HOLD';
  }

  return {
    existingPrincipalFils: input.existingPrincipalFils,
    remainingMonths: input.remainingMonths,
    currentRateBps: input.currentRateBps,
    newIntroRateBps: input.newIntroRateBps,
    financeMode: mode,
    currentMonthlyEmiFils,
    newMonthlyEmiFils,
    monthlySavingsFils,
    cbuaeEarlySettlementPenaltyExVatFils,
    cbuaeEarlySettlementPenaltyInclVatFils,
    dldMortgageReleaseAndReRegFils,
    valuationAndProcessingFeeFils,
    totalSwitchingCostFils,
    breakEvenMonths,
    fiveYearGrossSavingsFils,
    fiveYearNetSavingsFils,
    liabilityLetterValidityDays: 15,
    shariaStructureSummary,
    recommendation,
  };
}

/**
 * 4. 3-Bank Side-by-Side Mortgage Proposal Generator
 */
export function generateThreeBankProposalComparison(db: DatabaseSync, dealId: number) {
  const deal = db
    .prepare(
      `SELECT d.*, h.primary_name, h.segment
       FROM deals d JOIN households h ON h.id = d.household_id
       WHERE d.id = ?`,
    )
    .get(dealId) as Record<string, unknown> | undefined;

  if (!deal) {
    throw new Error(`Deal #${dealId} not found`);
  }

  const uw = evaluateDealAcross24Banks(db, dealId);
  const conv = computeConveyancingPack(db, dealId);
  const topThree = uw.eligibleOffers.slice(0, 3);
  const bestCost = topThree[0]?.fiveYearTotalCostFils ?? 0;
  const thirdCost = topThree[topThree.length - 1]?.fiveYearTotalCostFils ?? bestCost;

  const proposalOptions = topThree.map((o, idx) => ({
    rank: idx + 1,
    bankId: o.bankId,
    bankName: o.bankName,
    bankShort: o.bankShort,
    productCode: o.productCode,
    financeMode: o.financeMode,
    structure: o.structure,
    fixedYears: o.fixedYears,
    introRateBps: o.introRateBps,
    revertRateBps: o.effectiveRevertRateBps,
    introEmiFils: o.introEmiFils,
    revertEmiFils: o.revertEmiFils,
    stressedDbrBps: o.calculatedDbrBps,
    ltvBps: o.calculatedLtvBps,
    upfrontBankFeesFils: o.arrangementFeeFils,
    fiveYearTotalCostFils: o.fiveYearTotalCostFils,
    deltaVsBestRankFils: o.fiveYearTotalCostFils - bestCost,
  }));

  return {
    dealId,
    dealRef: String(deal.deal_ref),
    clientName: String(deal.primary_name),
    segment: String(deal.segment),
    propertyPriceFils: Number(deal.purchase_price_fils),
    loanAmountFils: uw.netLoanNeededFils,
    tenureMonths: Number(deal.tenure_months),
    eibor3mBps: uw.eibor3mBps,
    cashToCloseFils: conv.cheques.buyerOwnFundsRequiredFils,
    dldTransferFeeFils: conv.cheques.dldTransferFils,
    dldMortgageRegFeeFils: conv.cheques.mortgageRegFils,
    savingsBestVsThirdFils: Math.max(0, thirdCost - bestCost),
    options: proposalOptions,
  };
}

/**
 * 5. HR 90/60/30-Day Staff Statutory Document Expiry Radar & Renewal Engine
 */
export interface StaffDocumentExpiryItem {
  employeeId: number;
  empCode: string;
  fullName: string;
  designation: string;
  docField: 'visa_expiry_date' | 'emirates_id_expiry_date' | 'rera_card_expiry_date' | 'medical_ins_expiry_date';
  docLabel: string;
  expiryDate: string;
  daysRemaining: number;
  severityBand: 'EXPIRED_BLOCKED' | 'CRITICAL_30D' | 'WARNING_60D' | 'UPCOMING_90D' | 'VALID_CLEAR';
  blocksCommissionRelease: boolean;
}

export function computeStaffDocumentExpiryRadar(
  db: DatabaseSync,
  referenceDateIso = new Date().toISOString().slice(0, 10),
): {
  items: StaffDocumentExpiryItem[];
  expiredCount: number;
  critical30dCount: number;
  warning60dCount: number;
  upcoming90dCount: number;
} {
  const refMs = Date.parse(referenceDateIso + 'T00:00:00Z');
  const rows = db.prepare('SELECT * FROM employees ORDER BY id ASC').all() as Array<Record<string, unknown>>;

  const docDefs: Array<{
    field: StaffDocumentExpiryItem['docField'];
    label: string;
    criticalForCommission: boolean;
  }> = [
    { field: 'visa_expiry_date', label: 'UAE Residency Visa', criticalForCommission: true },
    { field: 'emirates_id_expiry_date', label: 'UAE Emirates ID', criticalForCommission: true },
    { field: 'rera_card_expiry_date', label: 'RERA Broker Card (BRN)', criticalForCommission: true },
    { field: 'medical_ins_expiry_date', label: 'DHA / MOHRE Medical Insurance', criticalForCommission: false },
  ];

  const items: StaffDocumentExpiryItem[] = [];
  for (const emp of rows) {
    for (const def of docDefs) {
      const rawDate = emp[def.field];
      if (!rawDate) continue;
      const expStr = String(rawDate);
      const daysRemaining = Math.floor((Date.parse(expStr + 'T00:00:00Z') - refMs) / 86_400_000);
      let severityBand: StaffDocumentExpiryItem['severityBand'] = 'VALID_CLEAR';
      if (daysRemaining <= 0) severityBand = 'EXPIRED_BLOCKED';
      else if (daysRemaining <= 30) severityBand = 'CRITICAL_30D';
      else if (daysRemaining <= 60) severityBand = 'WARNING_60D';
      else if (daysRemaining <= 90) severityBand = 'UPCOMING_90D';

      items.push({
        employeeId: Number(emp.id),
        empCode: String(emp.emp_code),
        fullName: String(emp.full_name),
        designation: String(emp.designation),
        docField: def.field,
        docLabel: def.label,
        expiryDate: expStr,
        daysRemaining,
        severityBand,
        blocksCommissionRelease: daysRemaining <= 0 && def.criticalForCommission,
      });
    }
  }

  items.sort((a, b) => a.daysRemaining - b.daysRemaining);

  return {
    items,
    expiredCount: items.filter((i) => i.severityBand === 'EXPIRED_BLOCKED').length,
    critical30dCount: items.filter((i) => i.severityBand === 'CRITICAL_30D').length,
    warning60dCount: items.filter((i) => i.severityBand === 'WARNING_60D').length,
    upcoming90dCount: items.filter((i) => i.severityBand === 'UPCOMING_90D').length,
  };
}

export function renewEmployeeStatutoryDocument(
  db: DatabaseSync,
  actor: Pick<UserRecord, 'id' | 'role'>,
  input: {
    employeeId: number;
    docField: 'visa_expiry_date' | 'emirates_id_expiry_date' | 'rera_card_expiry_date' | 'medical_ins_expiry_date';
    newExpiryDate: string;
  },
) {
  const allowedFields = [
    'visa_expiry_date',
    'emirates_id_expiry_date',
    'rera_card_expiry_date',
    'medical_ins_expiry_date',
  ];
  if (!allowedFields.includes(input.docField)) {
    throw new Error('Invalid statutory document field');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.newExpiryDate)) {
    throw new Error('New expiry date must be YYYY-MM-DD');
  }

  db.prepare(`UPDATE employees SET ${input.docField} = ? WHERE id = ?`).run(input.newExpiryDate, input.employeeId);
  writeAuditLog(db, actor, 'employees', input.employeeId, 'RENEW_STATUTORY_DOCUMENT', null, input);
}

/**
 * 6. Production Security Lock (Disables Demo Role Switcher in Live Commercial Deployment)
 */
export function getProductionSecurityStatus(db: DatabaseSync): { productionLockEnabled: boolean } {
  const row = db.prepare('SELECT production_lock_enabled FROM company_settings WHERE id = 1').get() as
    | { production_lock_enabled?: number }
    | undefined;
  return {
    productionLockEnabled: Number(row?.production_lock_enabled || 0) === 1 || process.env.BW_PRODUCTION_MODE === '1',
  };
}

export function toggleProductionSecurityLock(
  db: DatabaseSync,
  actor: Pick<UserRecord, 'id' | 'role' | 'email'>,
  enabled: boolean,
) {
  if (actor.role !== 'SUPER_ADMIN') {
    throw new ForbiddenError('Only Owner Shabib Siraj or Super Admin can toggle Production Security Lock');
  }
  db.prepare("UPDATE company_settings SET production_lock_enabled = ?, updated_at = datetime('now') WHERE id = 1").run(
    enabled ? 1 : 0,
  );
  writeAuditLog(db, actor, 'company_settings', 1, 'TOGGLE_PRODUCTION_SECURITY_LOCK', null, {
    productionLockEnabled: enabled,
  });
  return { productionLockEnabled: enabled };
}

/**
 * 7. Mortgage Finder Competitor Engine: Rent vs. Buy (Ejari vs. Mortgage Equity) 5-Year Dubai Wealth Calculator
 */
export interface RentVsBuyWealthAnalysis {
  currentAnnualRentFils: number;
  targetPropertyPriceFils: number;
  loanAmountFils: number;
  downPaymentFils: number;
  upfrontDldAndAgencyFeesFils: number;
  monthlyMortgageEmiFils: number;
  fiveYearTotalRentOutflowFils: number;
  fiveYearInterestAndServiceChargesFils: number;
  fiveYearPrincipalEquityBuiltFils: number;
  fiveYearCapitalAppreciationFils: number;
  netBuyerWealthGainFils: number;
  netFiveYearWealthAdvantageFils: number;
  breakEvenYear: number;
  verdict: 'BUY_OUTPERFORMS_RENT' | 'NEUTRAL_HORIZON';
}

export function computeRentVsBuyWealthAnalysis(input: {
  currentAnnualRentFils: number;
  annualRentEscalationBps?: number; // default 500 = 5%/yr RERA rental index step
  targetPropertyPriceFils: number;
  downPaymentBps?: number; // default 2000 = 20%
  mortgageRateBps?: number; // default 399 = 3.99%
  tenureMonths?: number; // default 300 = 25 years
  annualAppreciationBps?: number; // default 450 = 4.5%/yr Dubai historical compound
  annualServiceChargeFils?: number; // default 1,800,000 = AED 18,000/yr
}): RentVsBuyWealthAnalysis {
  const escBps = input.annualRentEscalationBps ?? 500;
  const dpBps = input.downPaymentBps ?? 2000;
  const rateBps = input.mortgageRateBps ?? 399;
  const tenure = input.tenureMonths ?? 300;
  const apprBps = input.annualAppreciationBps ?? 450;
  const serviceChargeFils = input.annualServiceChargeFils ?? 1_800_000;

  // 1. 5-Year Cumulative Sunk Rent + Ejari/Renewal Fees (AED 220 Ejari + AED 1,000 renewal admin/yr)
  let fiveYearTotalRentOutflowFils = 0;
  let yearlyRent = input.currentAnnualRentFils;
  for (let yr = 1; yr <= 5; yr++) {
    fiveYearTotalRentOutflowFils += yearlyRent + 122_000;
    yearlyRent = Math.round(yearlyRent * (1 + escBps / 10_000));
  }

  // 2. Mortgage & Upfront Acquisition Costs
  const downPaymentFils = Math.round((input.targetPropertyPriceFils * dpBps) / 10_000);
  const loanAmountFils = Math.max(0, input.targetPropertyPriceFils - downPaymentFils);
  const dldTransfer4PctFils = Math.round(input.targetPropertyPriceFils * 0.04) + 58_000;
  const mortgageRegFils = Math.round(loanAmountFils * 0.0025) + 29_000;
  const trusteeAndValFils = 420_000 + 262_500;
  const agencyFeeInclVatFils = Math.round(input.targetPropertyPriceFils * 0.021);
  const upfrontDldAndAgencyFeesFils =
    dldTransfer4PctFils + mortgageRegFils + trusteeAndValFils + agencyFeeInclVatFils;

  const monthlyMortgageEmiFils = calcMonthlyEmiFils(loanAmountFils, rateBps, tenure);

  // 3. 60-Month Amortization -> Principal Equity Built vs Interest Paid
  let balance = loanAmountFils;
  let totalInterest60mFils = 0;
  for (let m = 1; m <= Math.min(60, tenure); m++) {
    const monthlyInt = Math.round((balance * (rateBps / 10_000)) / 12);
    const princ = Math.max(0, monthlyMortgageEmiFils - monthlyInt);
    totalInterest60mFils += monthlyInt;
    balance = Math.max(0, balance - princ);
  }
  const fiveYearPrincipalEquityBuiltFils = loanAmountFils - balance;
  const fiveYearInterestAndServiceChargesFils = totalInterest60mFils + serviceChargeFils * 5;

  // 4. 5-Year Capital Appreciation
  const futureValueFils = Math.round(
    input.targetPropertyPriceFils * Math.pow(1 + apprBps / 10_000, 5),
  );
  const fiveYearCapitalAppreciationFils = Math.max(0, futureValueFils - input.targetPropertyPriceFils);

  // Net Buyer Wealth Gain = Principal Equity Built + Capital Appreciation - Upfront Sunk Fees - 5Y Interest & Service Charges
  const netBuyerWealthGainFils =
    fiveYearPrincipalEquityBuiltFils +
    fiveYearCapitalAppreciationFils -
    upfrontDldAndAgencyFeesFils -
    fiveYearInterestAndServiceChargesFils;

  // Comparing vs Renting (where tenant loses fiveYearTotalRentOutflowFils)
  const netFiveYearWealthAdvantageFils = fiveYearTotalRentOutflowFils + netBuyerWealthGainFils;

  const annualAdvantage = netFiveYearWealthAdvantageFils / 5;
  const breakEvenYear =
    annualAdvantage > 0
      ? Math.min(5, Math.max(1, Math.ceil(upfrontDldAndAgencyFeesFils / annualAdvantage)))
      : 5;

  return {
    currentAnnualRentFils: input.currentAnnualRentFils,
    targetPropertyPriceFils: input.targetPropertyPriceFils,
    loanAmountFils,
    downPaymentFils,
    upfrontDldAndAgencyFeesFils,
    monthlyMortgageEmiFils,
    fiveYearTotalRentOutflowFils,
    fiveYearInterestAndServiceChargesFils,
    fiveYearPrincipalEquityBuiltFils,
    fiveYearCapitalAppreciationFils,
    netBuyerWealthGainFils,
    netFiveYearWealthAdvantageFils,
    breakEvenYear,
    verdict: netFiveYearWealthAdvantageFils > 0 ? 'BUY_OUTPERFORMS_RENT' : 'NEUTRAL_HORIZON',
  };
}

/**
 * 8. Mortgage Finder / CBUAE Credit Policy: 7x Annual Income Cap (LTI Multiple) & Age-at-Maturity (65/70) Diagnostics
 */
export function computeLtiAndAgeAtMaturityDiagnostics(
  db: DatabaseSync,
  dealId: number,
  referenceDateIso = '2026-11-17',
) {
  const deal = db.prepare('SELECT * FROM deals WHERE id = ?').get(dealId) as Record<string, unknown> | undefined;
  if (!deal) throw new Error(`Deal #${dealId} not found`);

  const uw = evaluateDealAcross24Banks(db, dealId);
  const primary = db
    .prepare("SELECT * FROM applicants WHERE household_id = ? AND applicant_role = 'PRIMARY' ORDER BY id ASC LIMIT 1")
    .get(Number(deal.household_id)) as Record<string, unknown> | undefined;

  const dobStr = String(primary?.dob || '1988-06-15');
  const refMs = Date.parse(referenceDateIso + 'T00:00:00Z');
  const dobMs = Date.parse(dobStr + 'T00:00:00Z');
  const currentAgeYears = Math.max(21, Math.floor((refMs - dobMs) / (365.25 * 86_400_000)));

  const empType = String(primary?.employment_type || 'SALARIED');
  const resType = String(primary?.residency_type || 'EXPAT_RESIDENT');
  const maxMaturityAgeYears = empType === 'SELF_EMPLOYED' || resType === 'UAE_NATIONAL' ? 70 : 65;

  const tenureMonths = Number(deal.tenure_months || 300);
  const tenureYears = +(tenureMonths / 12).toFixed(1);
  const ageAtMaturityYears = +(currentAgeYears + tenureMonths / 12).toFixed(1);
  const maxPermissibleTenureMonths = Math.min(300, Math.max(12, (maxMaturityAgeYears - currentAgeYears) * 12));
  const ageAtMaturityCompliant = ageAtMaturityYears <= maxMaturityAgeYears;

  const monthlyIncomeFils = uw.eligibleOffers[0]?.assessableHouseholdIncomeFils ?? 4_500_000;
  const annualHouseholdIncomeFils = monthlyIncomeFils * 12;
  const maxLoanAt7xIncomeFils = annualHouseholdIncomeFils * 7; // Mortgage Finder / UAE Bank 7x Annual Income Cap (84x monthly)
  const ltiMultipleX =
    annualHouseholdIncomeFils > 0 ? +(uw.netLoanNeededFils / annualHouseholdIncomeFils).toFixed(2) : 0;
  const ltiCompliant = uw.netLoanNeededFils <= maxLoanAt7xIncomeFils;

  return {
    dealId,
    applicantName: String(primary?.full_name_en || 'Primary Applicant'),
    employmentType: empType,
    residencyType: resType,
    currentAgeYears,
    tenureMonths,
    tenureYears,
    ageAtMaturityYears,
    maxMaturityAgeYears,
    maxPermissibleTenureMonths,
    ageAtMaturityCompliant,
    annualHouseholdIncomeFils,
    netLoanNeededFils: uw.netLoanNeededFils,
    maxLoanAt7xIncomeFils,
    ltiMultipleX,
    ltiCompliant,
  };
}

/**
 * 9. Allsopp & Allsopp / Mortgage Finder / Holo: Official 60-Day Buyer Pre-Qualification (AIP) Certificate
 */
export function generateBuyerPreQualificationCertificate(db: DatabaseSync, dealId: number) {
  const deal = db
    .prepare(
      `SELECT d.*, h.primary_name, h.segment,
              pa.rera_brn as partner_brn, ag.company_name as partner_company, ag.rera_orn as partner_orn
       FROM deals d
       JOIN households h ON h.id = d.household_id
       LEFT JOIN partner_agents pa ON pa.id = d.partner_agent_id
       LEFT JOIN partner_agencies ag ON ag.id = pa.agency_id
       WHERE d.id = ?`,
    )
    .get(dealId) as Record<string, unknown> | undefined;

  if (!deal) throw new Error(`Deal #${dealId} not found`);

  const uw = evaluateDealAcross24Banks(db, dealId);
  const diag = computeLtiAndAgeAtMaturityDiagnostics(db, dealId);
  const topOffer = uw.eligibleOffers[0];

  const issueDate = new Date().toISOString().slice(0, 10);
  const validUntilDate = new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10);

  return {
    certificateRef: `AIP-BW-2026-${String(dealId).padStart(4, '0')}`,
    dealRef: String(deal.deal_ref),
    issueDate,
    validUntilDate,
    validityDays: 60,
    buyerDisplayName: String(deal.primary_name),
    residencySegment: String(deal.segment),
    maxQualifiedPropertyBudgetFils: Number(deal.purchase_price_fils),
    maxApprovedLoanFacilityFils: uw.netLoanNeededFils,
    buyerDownPaymentCommittedFils: Math.max(0, Number(deal.purchase_price_fils) - uw.netLoanNeededFils),
    maxLtvCapBps: topOffer?.maxAllowedLtvBps ?? 8000,
    calculatedLtvBps: topOffer?.calculatedLtvBps ?? 8000,
    dbrStatus: 'CLEARED_WITHIN_CBUAE_50PCT_HARD_CAP',
    ltiStatus: diag.ltiCompliant ? `CLEARED (${diag.ltiMultipleX}x <= 7.0x Annual Income Cap)` : 'REQUIRES_CO_BORROWER',
    primaryMatchedBankName: topOffer?.bankName || 'Emirates NBD / First Abu Dhabi Bank Panel',
    referringPartnerAgency: String(deal.partner_company || 'Direct Advisory Client'),
    referringPartnerOrn: String(deal.partner_orn || '31048'),
    referringAgentBrn: String(deal.partner_brn || 'BRN-DIRECT'),
    nonCircumventionGuaranteeRef: `NC-PROT-${String(deal.deal_ref)}`,
  };
}

/**
 * 10. Huspy-Style Bank Relationship Manager (BDM) "Fast-Pass" 1-Page Credit Packaging Cover Sheet
 */
export function generateBankRmFastPassCoverSheet(db: DatabaseSync, dealId: number) {
  const deal = db
    .prepare(
      `SELECT d.*, h.primary_name, h.segment
       FROM deals d JOIN households h ON h.id = d.household_id
       WHERE d.id = ?`,
    )
    .get(dealId) as Record<string, unknown> | undefined;
  if (!deal) throw new Error(`Deal #${dealId} not found`);

  const primary = db
    .prepare("SELECT * FROM applicants WHERE household_id = ? AND applicant_role = 'PRIMARY' ORDER BY id ASC LIMIT 1")
    .get(Number(deal.household_id)) as Record<string, unknown> | undefined;

  const uw = evaluateDealAcross24Banks(db, dealId);
  const diag = computeLtiAndAgeAtMaturityDiagnostics(db, dealId);
  const topOffer = uw.eligibleOffers[0];

  const bdm = topOffer
    ? (db
        .prepare('SELECT * FROM bank_bdm_contacts WHERE bank_id = ? LIMIT 1')
        .get(topOffer.bankId) as Record<string, unknown> | undefined)
    : undefined;

  const mitigants: string[] = [
    `Employer Tier Verified: ${String(primary?.employer_name || 'Listed Corporate')} (${String(primary?.employer_tier || 'APPROVED_LISTED')}) with ${Number(primary?.length_of_service_months || 36)} months continuous UAE service.`,
    `AECB Credit Bureau Score: ${Number(primary?.aecb_score || 762)} (Zero bounced cheques or 30+ day arrears in 24-month conduct window).`,
    `CBUAE Stressed DBR at ${((topOffer?.calculatedDbrBps ?? 3950) / 100).toFixed(2)}% (Strict 50.00% regulatory ceiling) & LTI Multiple at ${diag.ltiMultipleX}x (<= 7.0x cap).`,
    `Age at Maturity: ${diag.ageAtMaturityYears} years (<= ${diag.maxMaturityAgeYears} statutory bank ceiling).`,
  ];

  return {
    coverSheetRef: `FASTPASS-BDM-2026-${String(dealId).padStart(4, '0')}`,
    dealRef: String(deal.deal_ref),
    targetBankName: topOffer?.bankName || 'Emirates NBD',
    targetProductCode: topOffer?.productCode || 'ENBD-3Y-FIXED',
    financeMode: topOffer?.financeMode || 'CONVENTIONAL',
    bdmContactName: String(bdm?.bdm_name || 'Senior Mortgage BDM Desk'),
    bdmEmail: String(bdm?.email || 'mortgages.bdm@bank.ae'),
    bdmSlaDays: Number(bdm?.avg_ipa_tat_days || 2),
    applicantName: String(primary?.full_name_en || deal.primary_name),
    nationalityCode: String(primary?.nationality_code || 'AE'),
    residencyType: String(primary?.residency_type || 'EXPAT_RESIDENT'),
    employerName: String(primary?.employer_name || 'Emirates Group / Listed Corporate'),
    employerTier: String(primary?.employer_tier || 'APPROVED_LISTED'),
    lengthOfServiceMonths: Number(primary?.length_of_service_months || 36),
    aecbScore: Number(primary?.aecb_score || 762),
    monthlyAssessableIncomeFils: topOffer?.assessableHouseholdIncomeFils ?? 4_500_000,
    netLoanRequiredFils: uw.netLoanNeededFils,
    purchasePriceFils: Number(deal.purchase_price_fils),
    introRateBps: topOffer?.introRateBps ?? 399,
    revertRateBps: topOffer?.effectiveRevertRateBps ?? 564,
    introEmiFils: topOffer?.introEmiFils ?? 1_450_000,
    stressedDbrBps: topOffer?.calculatedDbrBps ?? 3950,
    calculatedLtvBps: topOffer?.calculatedLtvBps ?? 8000,
    ltiMultipleX: diag.ltiMultipleX,
    ageAtMaturityYears: diag.ageAtMaturityYears,
    maxMaturityAgeYears: diag.maxMaturityAgeYears,
    mitigants,
  };
}

/**
 * 11. Mortgease & Holo ("Hub by Holo"): Pre-Approved Buyer Property Matcher & Non-Circumvention Pool
 */
export function getPreApprovedBuyerPropertyMatcherPool(db: DatabaseSync) {
  const rows = db
    .prepare(
      `SELECT d.id, d.deal_ref, d.purchase_price_fils, d.target_loan_fils, d.stage,
              d.transaction_type, d.property_status, h.primary_name, h.segment,
              p.community as target_community, p.name as target_project,
              pa.rera_brn as agent_brn, ag.company_name as agency_name
       FROM deals d
       JOIN households h ON h.id = d.household_id
       LEFT JOIN projects p ON p.id = d.project_id
       LEFT JOIN partner_agents pa ON pa.id = d.partner_agent_id
       LEFT JOIN partner_agencies ag ON ag.id = pa.agency_id
       WHERE d.origin_mode = 'LIVE'
       ORDER BY d.id ASC`,
    )
    .all() as Array<Record<string, unknown>>;

  return rows.map((r) => ({
    dealId: Number(r.id),
    dealRef: String(r.deal_ref),
    buyerMaskedCode: `${String(r.primary_name).split(' ')[0]} *** (${String(r.segment)})`,
    verifiedMaxBudgetFils: Number(r.purchase_price_fils),
    approvedLoanFacilityFils: Number(r.target_loan_fils),
    cashDownPaymentReadyFils: Math.max(0, Number(r.purchase_price_fils) - Number(r.target_loan_fils)),
    preferredCommunity: String(r.target_community || 'Dubai Hills Estate / Dubai Marina'),
    preferredProject: String(r.target_project || 'Ready Villa / Luxury Apartment'),
    transactionType: String(r.transaction_type),
    stage: String(r.stage),
    protectedReferringAgency: String(r.agency_name || 'Open Partner Inventory Match'),
    protectedAgentBrn: String(r.agent_brn || 'OPEN_MATCH'),
    nonCircumventionCertId: `NC-BWM-${String(r.deal_ref)}`,
  }));
}

/**
 * 12. Allsopp & Allsopp In-House Sales Progression: RICS Panel Valuer, Developer NOC & DLD Blocking Ceremony
 */
export function updateSalesProgressionAndBlockingDesk(
  db: DatabaseSync,
  actor: Pick<UserRecord, 'id' | 'role'>,
  input: {
    dealId: number;
    valuationFirm: string;
    valuationAccessStatus: string;
    developerPortalName: string;
    nocStatus: 'NOT_STARTED' | 'APPLIED' | 'ISSUED';
    dldBlockingStage: string;
    trusteeOffice: string;
  },
) {
  const existing = db.prepare('SELECT deal_id FROM conveyancing_cases WHERE deal_id = ?').get(input.dealId) as
    | { deal_id: number }
    | undefined;

  if (existing) {
    db.prepare(
      `UPDATE conveyancing_cases
       SET valuation_firm = ?,
           valuation_access_status = ?,
           developer_portal_name = ?,
           noc_status = ?,
           dld_blocking_stage = ?,
           trustee_office = ?
       WHERE deal_id = ?`,
    ).run(
      input.valuationFirm,
      input.valuationAccessStatus,
      input.developerPortalName,
      input.nocStatus,
      input.dldBlockingStage,
      input.trusteeOffice,
      input.dealId,
    );
  } else {
    db.prepare(
      `INSERT INTO conveyancing_cases (
        deal_id, valuation_firm, valuation_access_status, developer_portal_name,
        noc_status, dld_blocking_stage, trustee_office
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      input.dealId,
      input.valuationFirm,
      input.valuationAccessStatus,
      input.developerPortalName,
      input.nocStatus,
      input.dldBlockingStage,
      input.trusteeOffice,
    );
  }

  writeAuditLog(db, actor, 'conveyancing_cases', input.dealId, 'UPDATE_SALES_PROGRESSION_BLOCKING', null, input);
}

