import type { DatabaseSync } from 'node:sqlite';
import { writeAuditLog, type UserRecord } from '@/server/auth';
import { postJournalEntry } from '@/server/engines/ledger-tax-engine';

export interface BenchmarkComparisonRow {
  moduleDomain: string;
  referenceRepo: string;
  referenceCapability: string;
  uaeGapInGenericRepo: string;
  betterwayHardcodedLogic: string;
}

export const COMPETITOR_AND_OCA_BENCHMARK_MATRIX: BenchmarkComparisonRow[] = [
  {
    moduleDomain: 'Loan & Amortization Management',
    referenceRepo: 'OCA/account-financial-tools (account_loan)',
    referenceCapability: 'Fixed-rate annuity schedules, principal/interest split, and periodic journal entries.',
    uaeGapInGenericRepo: 'Lacks UAE fixed-to-floating 3M/6M EIBOR reset, floor rate enforcement, and CBUAE 1% / AED 10,000 early settlement cap.',
    betterwayHardcodedLogic:
      'Hardcoded 300-month integer-fils Fixed-to-Floating EIBOR schedule: computes Intro Fixed EMI (Years 1–3/5), recalculates remaining principal at max(Floor, EIBOR + Margin), and caps Early Settlement Fee at min(1% balance, AED 10,000) + 5% VAT.',
  },
  {
    moduleDomain: 'Credit & Risk Control',
    referenceRepo: 'OCA/credit-control (account_financial_risk & account_credit_control)',
    referenceCapability: 'Customer credit limits, risk scoring, and multi-stage overdue dunning letters.',
    uaeGapInGenericRepo: 'Built for trade invoices rather than CBUAE 50% DBR stress testing, AECB bureau scores (300–900), and UAE bounced-cheque lockouts.',
    betterwayHardcodedLogic:
      'Hardcoded 100-point Credit Risk Scorecard combining AECB score (30 pts), +200 bps Stressed DBR (25 pts), LTV tier (20 pts), Employer category (15 pts), and PDC repayment history (10 pts), assigning AAA–D grades and automated Credit Holds.',
  },
  {
    moduleDomain: 'Property & Real Estate Asset Registry',
    referenceRepo: 'OCA/vertical-realestate',
    referenceCapability: 'Property unit hierarchy, ownership links, and lease contract tracking.',
    uaeGapInGenericRepo: 'Does not track DLD Title Deed vs. Oqood pre-title, 10-digit Makani numbers, RERA service charge indices, or First-Rank Mortgagee liens.',
    betterwayHardcodedLogic:
      'Hardcoded DLD Asset Registry linking Title Deed / Oqood, Plot & Makani numbers, BUA sq.ft, RERA service charges, and Ejari annual rent to compute exact Gross & Net Rental Yields (bps) and Valuation-to-Price coverage.',
  },
  {
    moduleDomain: 'Post-Dated Cheque (PDC) & Manager’s Cheque Vault',
    referenceRepo: 'rnrbarbosa/odoo-loans & Michael-devoop/odoo-custom-module',
    referenceCapability: 'Installment tracking and basic post-dated cheque list.',
    uaeGapInGenericRepo: 'No distinction between 10% RERA Form F security cheques, DLD Trustee manager’s cheques, and fee PDCs; no automated GL posting or bounce penalty.',
    betterwayHardcodedLogic:
      'Hardcoded UAE PDC Vault state machine (IN_SAFE_VAULT → PRESENTED_TO_BANK → CLEARED / BOUNCED_DISHONOURED): clearing auto-posts Double-Entry GL (DR 1100 / CR 1210); dishonouring triggers CREDIT_HOLD_30D and a Critical SLA task.',
  },
  {
    moduleDomain: 'UAE Statutory Field & Tax Customization',
    referenceRepo: 'Detalex-GmbH Odoo Addon Skeleton',
    referenceCapability: 'Boilerplate custom field extension structure.',
    uaeGapInGenericRepo: 'Requires manual coding for Emirates ID, UAE 23-char IBAN, 15-digit FTA TRN, DLD 4% + AED 580, and 0.25% + AED 290 mortgage registration.',
    betterwayHardcodedLogic:
      'Hardcoded statutory validators (784-YYYY-NNNNNNN-C Emirates ID, AE 23-char IBAN, 15-digit TRN) and deterministic DLD/CBUAE fee formulas in integer Fils.',
  },
  {
    moduleDomain: 'Mortgage Pipeline CRM & LOS',
    referenceRepo: 'matmill5/open-source-mortgage-crm (Twenty) & FinStack / Sahaay LOS',
    referenceCapability: 'Kanban borrower pipeline, lender opportunities, eKYC, and underwriting rules.',
    uaeGapInGenericRepo: 'US/India-centric workflows; lacks CBUAE Joint KFS hard-gate, Dual-Bank IPA submission, and 50/50 UAE brokerage subvention waterfall.',
    betterwayHardcodedLogic:
      'Hardcoded 12-stage UAE Mortgage Pipeline with mandatory Joint KFS + AML/CDD statutory gate, 24-Bank CBUAE Underwriting Matrix, Dual-Bank IPA, and Pay-When-Paid 50/50 subvention split.',
  },
];

export interface AmortizationInstallmentRow {
  month: number;
  year: number;
  regime: 'FIXED_INTRO' | 'FLOATING_EIBOR';
  annualRateBps: number;
  openingBalanceFils: number;
  emiFils: number;
  interestFils: number;
  principalFils: number;
  closingBalanceFils: number;
  earlySettlementFeeExVatFils: number;
}

export interface AmortizationScheduleResult {
  scheduleId?: number;
  scheduleRef: string;
  principalFils: number;
  tenureMonths: number;
  fixedYears: number;
  introRateBps: number;
  revertRateBps: number;
  introMonthlyEmiFils: number;
  revertMonthlyEmiFils: number;
  totalInterestFils: number;
  totalPayableFils: number;
  firstYearPrincipalFils: number;
  firstYearInterestFils: number;
  annualSummary: {
    year: number;
    regime: string;
    rateBps: number;
    openingBalanceFils: number;
    annualEmiFils: number;
    annualPrincipalFils: number;
    annualInterestFils: number;
    closingBalanceFils: number;
    earlySettlementFeeExVatFils: number;
  }[];
  first24Months: AmortizationInstallmentRow[];
}

function calcAnnuityEmiFils(principalFils: number, annualRateBps: number, remainingMonths: number): number {
  if (remainingMonths <= 0 || principalFils <= 0) return 0;
  const r = annualRateBps / 10_000 / 12;
  if (r <= 0) return Math.round(principalFils / remainingMonths);
  const factor = Math.pow(1 + r, remainingMonths);
  return Math.round((principalFils * r * factor) / (factor - 1));
}

export function generateFixedToFloatingAmortizationSchedule(
  db: DatabaseSync,
  actor: UserRecord,
  input: {
    dealId: number;
    principalFils: number;
    tenureMonths: number;
    fixedYears: number;
    introRateBps: number;
    revertEiborBps: number;
    revertMarginBps: number;
    floorRateBps?: number;
  },
): AmortizationScheduleResult {
  const principalFils = Math.max(10_000_000, Math.round(input.principalFils));
  const tenureMonths = Math.max(12, Math.min(300, Math.round(input.tenureMonths)));
  const fixedYears = Math.max(1, Math.min(10, Math.round(input.fixedYears)));
  const fixedMonths = Math.min(tenureMonths, fixedYears * 12);
  const introRateBps = Math.max(100, Math.round(input.introRateBps));
  const floorRateBps = Math.max(100, Math.round(input.floorRateBps ?? 299));
  const revertRateBps = Math.max(floorRateBps, Math.round(input.revertEiborBps + input.revertMarginBps));

  const introMonthlyEmiFils = calcAnnuityEmiFils(principalFils, introRateBps, tenureMonths);
  let revertMonthlyEmiFils = introMonthlyEmiFils;

  let balance = principalFils;
  let totalInterestFils = 0;
  let firstYearPrincipalFils = 0;
  let firstYearInterestFils = 0;

  const installments: AmortizationInstallmentRow[] = [];
  const annualSummary: AmortizationScheduleResult['annualSummary'] = [];

  for (let m = 1; m <= tenureMonths; m++) {
    const isFloating = m > fixedMonths;
    if (m === fixedMonths + 1) {
      revertMonthlyEmiFils = calcAnnuityEmiFils(balance, revertRateBps, tenureMonths - fixedMonths);
    }

    const activeRateBps = isFloating ? revertRateBps : introRateBps;
    const targetEmi = isFloating ? revertMonthlyEmiFils : introMonthlyEmiFils;
    const monthlyRate = activeRateBps / 10_000 / 12;

    const opening = balance;
    const interest = Math.round(opening * monthlyRate);
    let principal = targetEmi - interest;
    let emi = targetEmi;

    if (m === tenureMonths || principal >= opening) {
      principal = opening;
      emi = opening + interest;
    }

    const closing = Math.max(0, opening - principal);
    balance = closing;
    totalInterestFils += interest;

    if (m <= 12) {
      firstYearPrincipalFils += principal;
      firstYearInterestFils += interest;
    }

    // CBUAE Statutory Early Settlement Cap: min(1% of remaining principal, AED 10,000 = 1,000,000 fils)
    const earlySettlementFeeExVatFils = Math.min(Math.round(closing * 0.01), 1_000_000);

    installments.push({
      month: m,
      year: Math.ceil(m / 12),
      regime: isFloating ? 'FLOATING_EIBOR' : 'FIXED_INTRO',
      annualRateBps: activeRateBps,
      openingBalanceFils: opening,
      emiFils: emi,
      interestFils: interest,
      principalFils: principal,
      closingBalanceFils: closing,
      earlySettlementFeeExVatFils,
    });
  }

  const totalYears = Math.ceil(tenureMonths / 12);
  for (let y = 1; y <= totalYears; y++) {
    const rows = installments.filter((r) => r.year === y);
    if (rows.length === 0) continue;
    const first = rows[0]!;
    const last = rows[rows.length - 1]!;
    annualSummary.push({
      year: y,
      regime: last.regime === 'FLOATING_EIBOR' ? 'Floating (EIBOR + Margin)' : `Fixed (${fixedYears}Y Intro)`,
      rateBps: last.annualRateBps,
      openingBalanceFils: first.openingBalanceFils,
      annualEmiFils: rows.reduce((s, r) => s + r.emiFils, 0),
      annualPrincipalFils: rows.reduce((s, r) => s + r.principalFils, 0),
      annualInterestFils: rows.reduce((s, r) => s + r.interestFils, 0),
      closingBalanceFils: last.closingBalanceFils,
      earlySettlementFeeExVatFils: last.earlySettlementFeeExVatFils,
    });
  }

  const totalPayableFils = principalFils + totalInterestFils;
  const seq = (db.prepare('SELECT COUNT(*) as c FROM loan_amortization_schedules').get() as { c: number }).c + 1;
  const scheduleRef = `SCH-2026-${String(seq).padStart(3, '0')}-${Date.now().toString().slice(-4)}`;

  const res = db
    .prepare(
      `INSERT INTO loan_amortization_schedules (
        schedule_ref, deal_id, principal_fils, tenure_months, fixed_years, intro_rate_bps,
        revert_eibor_bps, revert_margin_bps, floor_rate_bps, intro_monthly_emi_fils,
        revert_monthly_emi_fils, total_interest_fils, total_payable_fils,
        first_year_principal_fils, first_year_interest_fils, schedule_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      scheduleRef,
      input.dealId,
      principalFils,
      tenureMonths,
      fixedYears,
      introRateBps,
      input.revertEiborBps,
      input.revertMarginBps,
      floorRateBps,
      introMonthlyEmiFils,
      revertMonthlyEmiFils,
      totalInterestFils,
      totalPayableFils,
      firstYearPrincipalFils,
      firstYearInterestFils,
      JSON.stringify({ annualSummary, first24Months: installments.slice(0, 24) }),
    );

  writeAuditLog(db, actor, 'loan_amortization_schedules', Number(res.lastInsertRowid), 'GENERATE_AMORTIZATION_SCHEDULE', null, {
    scheduleRef,
    principalFils,
    introMonthlyEmiFils,
    revertMonthlyEmiFils,
    totalInterestFils,
  });

  return {
    scheduleId: Number(res.lastInsertRowid),
    scheduleRef,
    principalFils,
    tenureMonths,
    fixedYears,
    introRateBps,
    revertRateBps,
    introMonthlyEmiFils,
    revertMonthlyEmiFils,
    totalInterestFils,
    totalPayableFils,
    firstYearPrincipalFils,
    firstYearInterestFils,
    annualSummary,
    first24Months: installments.slice(0, 24),
  };
}

export function evaluateCreditRiskAndDunning(
  db: DatabaseSync,
  actor: UserRecord,
  input: {
    dealId: number;
    applicantId?: number;
    aecbScore: number;
    stressedDbrBps: number;
    ltvBps: number;
    employerTier?: string;
    bouncedChequesCount?: number;
    overdueDays?: number;
    overdueAmountFils?: number;
  },
) {
  const aecb = Math.max(300, Math.min(900, Math.round(input.aecbScore)));
  const dbr = Math.max(0, Math.round(input.stressedDbrBps));
  const ltv = Math.max(0, Math.round(input.ltvBps));
  const emp = input.employerTier || 'APPROVED_LISTED';
  const bounced = Math.max(0, Math.round(input.bouncedChequesCount ?? 0));
  const overdueDays = Math.max(0, Math.round(input.overdueDays ?? 0));
  const overdueAmountFils = Math.max(0, Math.round(input.overdueAmountFils ?? 0));

  // 1. AECB Score Component (Max 30 pts)
  const aecbPts = aecb >= 760 ? 30 : aecb >= 710 ? 24 : aecb >= 660 ? 15 : aecb >= 600 ? 6 : 0;

  // 2. CBUAE Stressed DBR Component (Max 25 pts; >5000 bps = 0 pts + hard statutory block)
  const dbrPts = dbr <= 3500 ? 25 : dbr <= 4200 ? 20 : dbr <= 4800 ? 14 : dbr <= 5000 ? 8 : 0;

  // 3. LTV Component (Max 20 pts)
  const ltvPts = ltv <= 6500 ? 20 : ltv <= 7500 ? 16 : ltv <= 8000 ? 12 : ltv <= 8500 ? 8 : 0;

  // 4. Employer Tier Component (Max 15 pts)
  const empPts =
    emp === 'GOVERNMENT_GRE' ? 15 : emp === 'APPROVED_LISTED' ? 13 : emp === 'MNC' ? 11 : 6;

  // 5. Repayment & PDC Behaviour Component (Max 10 pts, -35 penalty per bounced cheque)
  const repaymentPts = bounced === 0 && overdueDays === 0 ? 10 : Math.max(-50, 10 - bounced * 35 - Math.floor(overdueDays / 5) * 5);

  const compositeScore = Math.max(0, Math.min(100, aecbPts + dbrPts + ltvPts + empPts + repaymentPts));

  const hardBlocked = dbr > 5000 || ltv > 8500 || bounced > 0 || aecb < 580 || overdueDays >= 30;
  const riskGrade: 'AAA_PRIME' | 'AA_STANDARD' | 'BBB_WATCH' | 'CCC_HIGH_RISK' | 'D_BLOCKED' = hardBlocked
    ? 'D_BLOCKED'
    : compositeScore >= 85
      ? 'AAA_PRIME'
      : compositeScore >= 72
        ? 'AA_STANDARD'
        : compositeScore >= 58
          ? 'BBB_WATCH'
          : 'CCC_HIGH_RISK';

  const dunningLevel: 'NONE' | 'REMINDER_7D' | 'FORMAL_DEMAND_15D' | 'CREDIT_HOLD_30D' =
    bounced > 0 || overdueDays >= 30
      ? 'CREDIT_HOLD_30D'
      : overdueDays >= 15
        ? 'FORMAL_DEMAND_15D'
        : overdueDays >= 7
          ? 'REMINDER_7D'
          : 'NONE';

  const creditCommitteeDecision: 'AUTO_APPROVED' | 'REFER_COMMITTEE' | 'DECLINED_HOLD' =
    riskGrade === 'D_BLOCKED'
      ? 'DECLINED_HOLD'
      : riskGrade === 'AAA_PRIME' || riskGrade === 'AA_STANDARD'
        ? 'AUTO_APPROVED'
        : 'REFER_COMMITTEE';

  const riskNotes = [
    `Composite Score ${compositeScore}/100 (${riskGrade})`,
    `AECB ${aecb} (${aecbPts}/30)`,
    `Stressed DBR ${(dbr / 100).toFixed(1)}% (${dbrPts}/25)`,
    `LTV ${(ltv / 100).toFixed(1)}% (${ltvPts}/20)`,
    bounced > 0 ? `${bounced} Dishonoured PDC(s) — Credit Hold Active` : 'Zero Dishonoured Cheques',
  ].join(' · ');

  db.prepare(
    `INSERT INTO credit_risk_profiles (
      deal_id, applicant_id, aecb_score, stressed_dbr_bps, ltv_bps, employer_tier,
      bounced_cheques_count, overdue_days, overdue_amount_fils, composite_risk_score,
      risk_grade, dunning_level, credit_committee_decision, risk_notes, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(deal_id) DO UPDATE SET
      aecb_score = excluded.aecb_score,
      stressed_dbr_bps = excluded.stressed_dbr_bps,
      ltv_bps = excluded.ltv_bps,
      employer_tier = excluded.employer_tier,
      bounced_cheques_count = excluded.bounced_cheques_count,
      overdue_days = excluded.overdue_days,
      overdue_amount_fils = excluded.overdue_amount_fils,
      composite_risk_score = excluded.composite_risk_score,
      risk_grade = excluded.risk_grade,
      dunning_level = excluded.dunning_level,
      credit_committee_decision = excluded.credit_committee_decision,
      risk_notes = excluded.risk_notes,
      updated_at = datetime('now')`,
  ).run(
    input.dealId,
    input.applicantId ?? null,
    aecb,
    dbr,
    ltv,
    emp,
    bounced,
    overdueDays,
    overdueAmountFils,
    compositeScore,
    riskGrade,
    dunningLevel,
    creditCommitteeDecision,
    riskNotes,
  );

  writeAuditLog(db, actor, 'credit_risk_profiles', input.dealId, 'EVALUATE_CREDIT_RISK', null, {
    compositeScore,
    riskGrade,
    dunningLevel,
    creditCommitteeDecision,
  });

  return {
    dealId: input.dealId,
    compositeScore,
    riskGrade,
    dunningLevel,
    creditCommitteeDecision,
    riskNotes,
  };
}

export function registerAndValueRealEstateAsset(
  db: DatabaseSync,
  actor: UserRecord,
  input: {
    dealId: number;
    householdId?: number;
    registrationType: 'TITLE_DEED' | 'OQOOD_PRE_TITLE';
    titleDeedOrOqoodNo: string;
    dldPlotNo: string;
    makaniNo: string;
    communityName: string;
    buildingOrProjectName: string;
    unitNo: string;
    propertyType: string;
    builtUpAreaSqft: number;
    purchasePriceFils: number;
    latestValuationFils: number;
    annualServiceChargeFils: number;
    ejariAnnualRentFils: number;
    firstRankMortgageeBank: string;
  },
) {
  const sqft = Math.max(100, Math.round(input.builtUpAreaSqft));
  const priceFils = Math.max(10_000_000, Math.round(input.purchasePriceFils));
  const valFils = Math.max(10_000_000, Math.round(input.latestValuationFils));
  const scFils = Math.max(0, Math.round(input.annualServiceChargeFils));
  const rentFils = Math.max(0, Math.round(input.ejariAnnualRentFils));

  const grossYieldBps = Math.round((rentFils * 10_000) / priceFils);
  const netRentFils = Math.max(0, rentFils - scFils);
  const netYieldBps = Math.round((netRentFils * 10_000) / priceFils);

  const seq = (db.prepare('SELECT COUNT(*) as c FROM real_estate_assets').get() as { c: number }).c + 1;
  const propertyCode = `PROP-DXB-${String(seq).padStart(3, '0')}-${Date.now().toString().slice(-4)}`;

  const res = db
    .prepare(
      `INSERT INTO real_estate_assets (
        property_code, deal_id, household_id, registration_type, title_deed_or_oqood_no,
        dld_plot_no, makani_no, community_name, building_or_project_name, unit_no,
        property_type, built_up_area_sqft, purchase_price_fils, latest_valuation_fils,
        annual_service_charge_fils, ejari_annual_rent_fils, gross_yield_bps, net_yield_bps,
        first_rank_mortgagee_bank, encumbrance_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      propertyCode,
      input.dealId,
      input.householdId ?? null,
      input.registrationType,
      input.titleDeedOrOqoodNo.trim(),
      input.dldPlotNo.trim(),
      input.makaniNo.trim(),
      input.communityName.trim(),
      input.buildingOrProjectName.trim(),
      input.unitNo.trim(),
      input.propertyType.trim(),
      sqft,
      priceFils,
      valFils,
      scFils,
      rentFils,
      grossYieldBps,
      netYieldBps,
      input.firstRankMortgageeBank.trim(),
      input.registrationType === 'OQOOD_PRE_TITLE' ? 'DEVELOPER_ESCROW_LIEN' : 'FIRST_RANK_MORTGAGE',
    );

  writeAuditLog(db, actor, 'real_estate_assets', Number(res.lastInsertRowid), 'REGISTER_REAL_ESTATE_ASSET', null, {
    propertyCode,
    grossYieldBps,
    netYieldBps,
  });

  return {
    assetId: Number(res.lastInsertRowid),
    propertyCode,
    grossYieldBps,
    netYieldBps,
    pricePerSqftAed: Math.round(priceFils / 100 / sqft),
    valuationCoverageRatioPct: Number(((valFils / priceFils) * 100).toFixed(1)),
  };
}

export function registerPdcCheque(
  db: DatabaseSync,
  actor: UserRecord,
  input: {
    dealId: number;
    chequeType: 'SECURITY_DEPOSIT_10PCT' | 'INSTALLMENT_PDC' | 'AGENCY_FEE_PDC' | 'DLD_MANAGER_CHEQUE' | 'SUBVENTION_CHEQUE';
    chequeNumber: string;
    drawerName: string;
    drawerBank: string;
    payeeName: string;
    amountFils: number;
    maturityDate: string;
  },
) {
  const amountFils = Math.max(100, Math.round(input.amountFils));
  const seq = (db.prepare('SELECT COUNT(*) as c FROM pdc_cheque_register').get() as { c: number }).c + 1;
  const chequeRef = `PDC-2026-${String(seq).padStart(3, '0')}-${Date.now().toString().slice(-4)}`;

  const res = db
    .prepare(
      `INSERT INTO pdc_cheque_register (
        cheque_ref, deal_id, cheque_type, cheque_number, drawer_name, drawer_bank,
        payee_name, amount_fils, maturity_date, vault_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'IN_SAFE_VAULT')`,
    )
    .run(
      chequeRef,
      input.dealId,
      input.chequeType,
      input.chequeNumber.trim(),
      input.drawerName.trim(),
      input.drawerBank.trim(),
      input.payeeName.trim(),
      amountFils,
      input.maturityDate,
    );

  writeAuditLog(db, actor, 'pdc_cheque_register', Number(res.lastInsertRowid), 'REGISTER_PDC_CHEQUE', null, {
    chequeRef,
    amountFils,
  });

  return {
    id: Number(res.lastInsertRowid),
    chequeRef,
    vaultStatus: 'IN_SAFE_VAULT' as const,
  };
}

export function transitionPdcChequeStatus(
  db: DatabaseSync,
  actor: UserRecord,
  input: {
    chequeId: number;
    newStatus: 'PRESENTED_TO_BANK' | 'CLEARED' | 'BOUNCED_DISHONOURED' | 'RETURNED_TO_CLIENT';
    bounceReason?: string;
  },
) {
  const row = db.prepare('SELECT * FROM pdc_cheque_register WHERE id = ?').get(input.chequeId) as
    | {
        id: number;
        cheque_ref: string;
        deal_id: number;
        cheque_type: string;
        cheque_number: string;
        amount_fils: number;
        vault_status: string;
      }
    | undefined;
  if (!row) throw new Error(`Cheque #${input.chequeId} not found in PDC Register`);

  let glEntryId: number | null = null;

  if (input.newStatus === 'CLEARED' && row.vault_status !== 'CLEARED') {
    const entryId = postJournalEntry(db, actor, {
      entryDate: new Date().toISOString().slice(0, 10),
      memo: `PDC Cleared (${row.cheque_ref} · Cheque #${row.cheque_number})`,
      sourceModule: 'PDC_VAULT',
      sourceId: row.cheque_ref,
      lines: [
        { accountCode: '1100', debitFils: row.amount_fils, creditFils: 0, lineMemo: 'Cash at UAE Operating Bank' },
        { accountCode: '1210', debitFils: 0, creditFils: row.amount_fils, lineMemo: 'Client / Settlement Receivable Cleared' },
      ],
    });
    glEntryId = typeof entryId === 'number' ? entryId : (entryId as { id: number }).id;
  }

  db.prepare(
    `UPDATE pdc_cheque_register
     SET vault_status = ?, bounce_reason = ?, gl_entry_id = COALESCE(?, gl_entry_id)
     WHERE id = ?`,
  ).run(input.newStatus, (input.bounceReason ?? '').trim(), glEntryId, input.chequeId);

  if (input.newStatus === 'BOUNCED_DISHONOURED') {
    // Automatically escalate Borrower Credit Risk Profile to D_BLOCKED & CREDIT_HOLD_30D
    const existingRisk = db
      .prepare('SELECT * FROM credit_risk_profiles WHERE deal_id = ?')
      .get(row.deal_id) as Record<string, unknown> | undefined;

    evaluateCreditRiskAndDunning(db, actor, {
      dealId: row.deal_id,
      aecbScore: Number(existingRisk?.aecb_score ?? 710),
      stressedDbrBps: Number(existingRisk?.stressed_dbr_bps ?? 4400),
      ltvBps: Number(existingRisk?.ltv_bps ?? 7800),
      bouncedChequesCount: Number(existingRisk?.bounced_cheques_count ?? 0) + 1,
      overdueDays: Math.max(30, Number(existingRisk?.overdue_days ?? 30)),
      overdueAmountFils: row.amount_fils,
    });

    db.prepare(
      `INSERT INTO ops_tasks (deal_id, assigned_role, priority, title, due_at, status)
       VALUES (?, 'FINANCE_ADMIN', 'CRITICAL', ?, datetime('now', '+1 day'), 'OPEN')`,
    ).run(
      row.deal_id,
      `Dishonoured Cheque Alert: ${row.cheque_ref} (#${row.cheque_number}) — Credit Hold Activated`,
    );
  }

  writeAuditLog(db, actor, 'pdc_cheque_register', input.chequeId, `PDC_STATUS_${input.newStatus}`, row, {
    newStatus: input.newStatus,
    glEntryId,
  });

  return {
    chequeId: input.chequeId,
    chequeRef: row.cheque_ref,
    newStatus: input.newStatus,
    glEntryId,
  };
}

export function validateUaeStatutoryIdentifiers(input: {
  emiratesId?: string;
  uaeIban?: string;
  ftaTrn15?: string;
}) {
  const eidValid = input.emiratesId ? /^784-\d{4}-\d{7}-\d$/.test(input.emiratesId.trim()) : true;
  const ibanValid = input.uaeIban ? /^AE\d{21}$/.test(input.uaeIban.replace(/\s+/g, '')) : true;
  const trnValid = input.ftaTrn15 ? /^100\d{9}003$/.test(input.ftaTrn15.trim()) : true;
  return {
    emiratesIdValid: eidValid,
    uaeIbanValid: ibanValid,
    ftaTrn15Valid: trnValid,
    allValid: eidValid && ibanValid && trnValid,
  };
}
