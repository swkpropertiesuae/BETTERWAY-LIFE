import type { DatabaseSync } from 'node:sqlite';

export type StatementLine = {
  date: string;
  description: string;
  debitFils: number;
  creditFils: number;
};

export function analyzeBankStatementLines(lines: StatementLine[]) {
  const salaryCredits: StatementLine[] = [];
  const emiDebits: StatementLine[] = [];
  const bnplDebits: StatementLine[] = [];
  const bouncedItems: StatementLine[] = [];

  for (const line of lines) {
    const u = line.description.toUpperCase();
    if (line.creditFils > 0 && /(SALARY|WPS|PAYROLL|EMOLUMENT)/.test(u)) {
      salaryCredits.push(line);
    }
    if (/(RETURNED CHEQUE|BOUNCED|INSUFFICIENT FUNDS|UNPAID CHQ|REFER TO DRAWER)/.test(u)) {
      bouncedItems.push(line);
      continue;
    }
    if (line.debitFils > 0 && /(TABBY|TAMARA|POSTPAY|CASHEW|BNPL)/.test(u)) {
      bnplDebits.push(line);
    } else if (line.debitFils > 0 && /(EMI|LOAN|MORTGAGE|FINANCE RECOVERY|AUTO FIN)/.test(u)) {
      emiDebits.push(line);
    }
  }

  const salaryMonths = new Set(salaryCredits.map((s) => s.date.slice(0, 7)));
  const totalSalaryFils = salaryCredits.reduce((sum, s) => sum + s.creditFils, 0);
  const avgMonthlySalaryFils = salaryMonths.size > 0 ? Math.round(totalSalaryFils / salaryMonths.size) : 0;

  const emiMonths = Math.max(1, new Set(emiDebits.map((e) => e.date.slice(0, 7))).size);
  const detectedRecurringEmiFils = Math.round(emiDebits.reduce((sum, e) => sum + e.debitFils, 0) / emiMonths);

  const bnplMonths = Math.max(1, new Set(bnplDebits.map((b) => b.date.slice(0, 7))).size);
  const detectedBnplFils = Math.round(bnplDebits.reduce((sum, b) => sum + b.debitFils, 0) / bnplMonths);

  const bouncedChequeCount = bouncedItems.length;
  const underwritingAlertLevel: 'CLEAR' | 'REVIEW_REQUIRED' =
    bouncedChequeCount > 0 || detectedBnplFils > 0 ? 'REVIEW_REQUIRED' : 'CLEAR';

  return {
    salaryMonthsCount: salaryMonths.size,
    avgMonthlySalaryFils,
    detectedRecurringEmiFils,
    detectedBnplFils,
    bouncedChequeCount,
    underwritingAlertLevel,
    flaggedItems: [...bouncedItems, ...bnplDebits, ...emiDebits],
  };
}

export function queryBankPolicyCoPilot(db: DatabaseSync, rawQuery: string) {
  const tokens = rawQuery
    .toLowerCase()
    .split(/[^a-z0-9%]+/)
    .filter((t) => t.length >= 2);

  const articles = db
    .prepare(
      `SELECT w.id, w.slug, w.category, w.title_en, w.body_en, w.policy_version, w.clause_ref, b.name_en as bank_name
       FROM wiki_articles w
       LEFT JOIN banks b ON b.id = w.bank_id`,
    )
    .all() as {
    id: number;
    slug: string;
    category: string;
    title_en: string;
    body_en: string;
    policy_version: string;
    clause_ref: string;
    bank_name: string | null;
  }[];

  const scored = articles
    .map((a) => {
      const hay = `${a.title_en} ${a.body_en} ${a.category} ${a.clause_ref} ${a.bank_name ?? ''}`.toLowerCase();
      let score = 0;
      for (const tok of tokens) {
        if (hay.includes(tok)) score += 10;
      }
      return { article: a, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  const top = (scored.length > 0 ? scored.map((s) => s.article) : articles).slice(0, 3);

  return {
    query: rawQuery,
    deterministicSummary:
      top.length > 0
        ? top.map((c) => `[${c.clause_ref} · ${c.policy_version}] ${c.title_en}: ${c.body_en}`).join('\n\n')
        : 'No matching approved underwriting policy found in the internal repository.',
    citations: top.map((c) => ({
      slug: c.slug,
      title: c.title_en,
      bankName: c.bank_name,
      policyVersion: c.policy_version,
      clauseRef: c.clause_ref,
    })),
  };
}

export function computeExecutiveForecastAndBi(db: DatabaseSync) {
  const stageWeights: Record<string, number> = {
    FACT_FIND: 0.1,
    KFS_PENDING: 0.15,
    DOC_COLLECTION: 0.2,
    UNDERWRITING_READY: 0.3,
    IPA_SUBMITTED: 0.4,
    IPA_APPROVED: 0.55,
    MOU_SIGNED: 0.65,
    VALUATION_ORDERED: 0.7,
    VALUATION_RECEIVED: 0.8,
    FOL_ISSUED: 0.88,
    FOL_SIGNED: 0.94,
    NOC_AND_CLEARANCE: 0.96,
    CHEQUES_READY: 0.98,
    TRANSFERRED_DISBURSED: 1.0,
  };

  const activeDeals = db
    .prepare(
      `SELECT d.id, d.deal_ref, d.stage, d.target_loan_fils, d.direct_client_fee_fils,
              d.partner_agent_id, l.source_channel
       FROM deals d
       LEFT JOIN leads l ON l.id = d.lead_id
       WHERE d.origin_mode = 'LIVE' AND d.stage NOT IN ('DECLINED','WITHDRAWN')`,
    )
    .all() as {
    id: number;
    deal_ref: string;
    stage: string;
    target_loan_fils: number;
    direct_client_fee_fils: number;
    partner_agent_id: number | null;
    source_channel: string | null;
  }[];

  let grossPipelineLoanFils = 0;
  let weightedGrossRevenueFils = 0;
  let weightedNetHouseAfterSplitsAndClawbackFils = 0;

  const byChannel = new Map<string, { dealsCount: number; loanVolumeFils: number }>();

  for (const d of activeDeals) {
    const w = stageWeights[d.stage] ?? 0.1;
    grossPipelineLoanFils += d.target_loan_fils;
    const estSubvention = Math.round(d.target_loan_fils * 0.0078); // 78 bps panel average
    const grossRev = estSubvention + d.direct_client_fee_fils;
    const estPartnerSplit = d.partner_agent_id ? Math.round(estSubvention * 0.28) : 0;
    const estClawbackHold = Math.round(estSubvention * 0.1);
    const netHouse = grossRev - estPartnerSplit - estClawbackHold;

    weightedGrossRevenueFils += Math.round(grossRev * w);
    weightedNetHouseAfterSplitsAndClawbackFils += Math.round(netHouse * w);

    const ch = d.source_channel || 'DIRECT';
    const cur = byChannel.get(ch) ?? { dealsCount: 0, loanVolumeFils: 0 };
    cur.dealsCount += 1;
    cur.loanVolumeFils += d.target_loan_fils;
    byChannel.set(ch, cur);
  }

  return {
    activeDealsCount: activeDeals.length,
    grossPipelineLoanFils,
    weightedGrossRevenueFils,
    weightedNetHouseAfterSplitsAndClawbackFils,
    channelBreakdown: [...byChannel.entries()].map(([channel, stats]) => ({ channel, ...stats })),
  };
}
