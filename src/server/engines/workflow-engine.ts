// Deal workflow: one stage track, per-scenario paths, guarded moves, exception routes.
// Every deal is classified into scenario tags; tags pick the path, the document list and the playbooks.
import type { DatabaseSync } from 'node:sqlite';
import { assertRole, writeAuditLog, type UserRecord, type UserRole } from '@/server/auth';
import { checkBankSubmissionGate } from './compliance-aml-engine';
import { evaluateDealAcross24Banks } from './underwriting-engine';
import { PLAYBOOKS, type Playbook } from './scenarios';
import { activeRows } from '@/server/data-hub/import';
import { approvedQuote } from './quotes';

export const STAGES = [
  'FACT_FIND', 'KFS_PENDING', 'DOC_COLLECTION', 'UNDERWRITING_READY',
  'IPA_SUBMITTED', 'IPA_APPROVED', 'MOU_SIGNED', 'VALUATION_ORDERED',
  'VALUATION_RECEIVED', 'FOL_ISSUED', 'FOL_SIGNED', 'NOC_AND_CLEARANCE',
  'CHEQUES_READY', 'TRANSFERRED_DISBURSED',
] as const;
export type Stage = (typeof STAGES)[number];
type AnyStage = Stage | 'DECLINED' | 'WITHDRAWN';

export const STAGE_META: Record<Stage, { label: string; owner: UserRole; slaHours: number; action: string }> = {
  FACT_FIND: { label: 'Fact-find', owner: 'SALES_ADVISOR', slaHours: 24, action: 'Capture applicants, income, liabilities, property and loan.' },
  KFS_PENDING: { label: 'KFS and CDD', owner: 'COMPLIANCE_MLRO', slaHours: 24, action: 'Every borrower signs the Key Facts Statement; clear CDD.' },
  DOC_COLLECTION: { label: 'Documents', owner: 'SALES_ADVISOR', slaHours: 72, action: 'Collect and verify the required documents.' },
  UNDERWRITING_READY: { label: 'Underwriting', owner: 'CREDIT_UNDERWRITER', slaHours: 8, action: 'Run bank ranker; submit primary and backup bank.' },
  IPA_SUBMITTED: { label: 'IPA with bank', owner: 'CREDIT_UNDERWRITER', slaHours: 48, action: 'Chase bank for In-Principle Approval; answer queries.' },
  IPA_APPROVED: { label: 'IPA approved', owner: 'PROGRESSION_MANAGER', slaHours: 24, action: 'Client signs Form F / MOU with seller.' },
  MOU_SIGNED: { label: 'MOU signed', owner: 'PROGRESSION_MANAGER', slaHours: 24, action: 'Order bank valuation.' },
  VALUATION_ORDERED: { label: 'Valuation ordered', owner: 'PROGRESSION_MANAGER', slaHours: 72, action: 'Get valuation report.' },
  VALUATION_RECEIVED: { label: 'Valuation received', owner: 'CREDIT_UNDERWRITER', slaHours: 24, action: 'Confirm value vs price; choose action if short; request FOL.' },
  FOL_ISSUED: { label: 'FOL issued', owner: 'PROGRESSION_MANAGER', slaHours: 24, action: 'Audit FOL terms; client signs.' },
  FOL_SIGNED: { label: 'FOL signed', owner: 'PROGRESSION_MANAGER', slaHours: 24, action: 'Start NOC and clearance letters.' },
  NOC_AND_CLEARANCE: { label: 'NOC and clearance', owner: 'PROGRESSION_MANAGER', slaHours: 72, action: 'Seller NOC, liability letter, closure letters.' },
  CHEQUES_READY: { label: 'Cheques ready', owner: 'PROGRESSION_MANAGER', slaHours: 48, action: 'Issue 72-hour trustee cheques; attend transfer.' },
  TRANSFERRED_DISBURSED: { label: 'Disbursed', owner: 'FINANCE_ADMIN', slaHours: 120, action: 'Record disbursal; chase bank bordereau cash.' },
};

// Case_Stages_SLAs_and_Reason_Codes (spec 08) can override SLA hours and owner per stage.
function stageRule(db: DatabaseSync, stage: Stage) {
  const r = activeRows(db, 8).find((x) => x.stage_code === stage && x.sla_hours);
  return { slaHours: r ? Number(r.sla_hours) : STAGE_META[stage].slaHours, owner: (r?.owner_role as UserRole) || STAGE_META[stage].owner };
}
export function reasonCodes(db: DatabaseSync): string[] {
  return [...new Set(activeRows(db, 8).map((r) => r.reason_code).filter(Boolean))];
}

const STAFF: UserRole[] = ['SUPER_ADMIN', 'SALES_ADVISOR', 'CREDIT_UNDERWRITER', 'PROGRESSION_MANAGER'];
const OBLIGATED = ['PRIMARY', 'CO_BORROWER', 'GUARANTOR'];

type Row = Record<string, any>;

// ---------- classification ----------
export function classifyDeal(db: DatabaseSync, dealId: number): string[] {
  const deal = db.prepare('SELECT * FROM deals WHERE id = ?').get(dealId) as Row | undefined;
  if (!deal) throw new Error(`Deal ${dealId} not found`);
  const tags = new Set<string>([deal.transaction_type]);
  const apps = db.prepare('SELECT * FROM applicants WHERE household_id = ?').all(deal.household_id) as Row[];
  const obligated = apps.filter((a) => OBLIGATED.includes(a.applicant_role));

  if (obligated.length > 1) tags.add('JOINT');
  for (const a of obligated) {
    tags.add(a.employment_type === 'INVESTOR' ? 'SELF_EMPLOYED' : a.employment_type);
    if (a.residency_type === 'NON_RESIDENT') tags.add('NON_RESIDENT');
    if (a.residency_type === 'UAE_NATIONAL' || a.residency_type === 'GCC_NATIONAL') tags.add('UAE_NATIONAL');
    if (a.is_pep) tags.add('PEP');
    if (a.currency_code && a.currency_code !== 'AED') tags.add('FX_INCOME');
    if (a.bonus_annual_avg_fils > 0 || a.commission_monthly_avg_fils > 0) tags.add('VARIABLE_INCOME');
    if (a.rental_income_annual_fils > 0) tags.add('RENTAL_INCOME');
  }
  if (!deal.is_first_home) tags.add('SECOND_HOME');
  if (deal.purchase_price_fils > 500_000_000) tags.add('HIGH_VALUE');
  if (deal.property_status !== 'READY') tags.add('OFFPLAN_HANDOVER');
  if (deal.finance_preference === 'ISLAMIC_ONLY') tags.add('ISLAMIC');
  if (deal.housing_grant_program !== 'NONE') tags.add('HOUSING_GRANT');
  if (deal.partner_agent_id) tags.add('PARTNER_LEAD');
  if (deal.origin_mode === 'LEGACY_BACKBOOK') tags.add('LEGACY');
  if (['BLOCKED', 'EDD_REQUIRED'].includes(deal.cdd_status)) tags.add('COMPLIANCE_HOLD');

  const appIds = obligated.map((a) => a.id);
  if (appIds.length) {
    const n = db
      .prepare(`SELECT COUNT(*) c FROM applicant_liabilities WHERE to_be_cleared_before_fol = 1 AND applicant_id IN (${appIds.map(() => '?').join(',')})`)
      .get(...appIds) as { c: number };
    if (n.c > 0) tags.add('LIABILITIES_TO_CLEAR');
  }
  const conv = db.prepare('SELECT * FROM conveyancing_cases WHERE deal_id = ?').get(dealId) as Row | undefined;
  if (conv?.seller_has_mortgage) tags.add('SELLER_MORTGAGED');
  if (conv && conv.valuation_amount_fils > 0 && conv.valuation_amount_fils < deal.purchase_price_fils) tags.add('DOWN_VALUATION');

  if (deal.selected_bank_id && deal.project_id) {
    const apl = db
      .prepare('SELECT apl_status FROM bank_project_apl WHERE bank_id = ? AND project_id = ?')
      .get(deal.selected_bank_id, deal.project_id) as { apl_status: string } | undefined;
    if (apl && apl.apl_status !== 'APPROVED') tags.add('APL_RESTRICTED');
  }
  if (deal.stage === 'DECLINED') tags.add('DECLINED');
  if (deal.stage === 'WITHDRAWN') tags.add('WITHDRAWN');
  if (deal.stage === 'TRANSFERRED_DISBURSED') tags.add('DISBURSED');
  return [...tags];
}

// Stages skipped per transaction type (no seller, so no Form F / MOU).
export function pathFor(transactionType: string): Stage[] {
  const skip = ['BUYOUT', 'EQUITY_RELEASE', 'CONSTRUCTION'].includes(transactionType) ? ['MOU_SIGNED'] : [];
  return STAGES.filter((s) => !skip.includes(s));
}

// ---------- documents ----------
type DocNeed = { category: string; applicantId: number | null; label: string };

export function requiredDocs(db: DatabaseSync, dealId: number, tags: string[], stage: Stage): DocNeed[] {
  const deal = db.prepare('SELECT * FROM deals WHERE id = ?').get(dealId) as Row;
  const apps = (db.prepare('SELECT * FROM applicants WHERE household_id = ?').all(deal.household_id) as Row[]).filter((a) =>
    OBLIGATED.includes(a.applicant_role),
  );
  const needs: DocNeed[] = [];
  for (const a of apps) {
    const add = (category: string) => needs.push({ category, applicantId: a.id, label: `${category} (${a.full_name_en})` });
    add('PASSPORT');
    if (a.residency_type !== 'NON_RESIDENT') {
      add('EMIRATES_ID');
      add('AECB_REPORT');
      if (a.residency_type === 'EXPAT_RESIDENT') add('VISA');
    }
    if (a.employment_type === 'SALARIED') { add('SALARY_CERT'); add('PAYSLIPS_6M'); add('BANK_STATEMENTS_6M'); }
    else if (a.employment_type === 'SELF_EMPLOYED') { add('TRADE_LICENCE'); add('AUDIT_FINANCIALS'); add('BANK_STATEMENTS_6M'); }
    else add('BANK_STATEMENTS_6M');
  }
  // Document_Checklist_Rules (spec 06): configured mandatory documents add to the defaults.
  const VAULT = ['PASSPORT', 'EMIRATES_ID', 'VISA', 'SALARY_CERT', 'PAYSLIPS_6M', 'BANK_STATEMENTS_6M', 'AUDIT_FINANCIALS', 'TRADE_LICENCE', 'AECB_REPORT', 'FORM_F', 'KFS_SIGNED', 'FOL_SIGNED', 'TITLE_DEED', 'TAKAFUL_POLICY'];
  for (const r of activeRows(db, 6)) {
    const doc = r.document_type.toUpperCase();
    if (r.mandatory_flag !== 'Y' || !VAULT.includes(doc)) continue;
    if (r.case_type && r.case_type !== '*' && r.case_type !== deal.transaction_type) continue;
    if (r.bank_id && Number(r.bank_id) !== deal.selected_bank_id) continue;
    if (r.stage_code && STAGES.indexOf(r.stage_code as Stage) > STAGES.indexOf(stage)) continue;
    for (const a of apps) {
      const t = (r.applicant_type || '').toUpperCase();
      if (t && t !== 'ALL' && t !== a.applicant_role && t !== a.employment_type && t !== a.residency_type) continue;
      if (!needs.some((n) => n.category === doc && n.applicantId === a.id)) needs.push({ category: doc, applicantId: a.id, label: `${doc} (${a.full_name_en})` });
    }
  }
  const idx = STAGES.indexOf(stage);
  const dealLevel = (category: string) => needs.push({ category, applicantId: null, label: category });
  if (idx >= STAGES.indexOf('MOU_SIGNED') && pathFor(deal.transaction_type).includes('MOU_SIGNED')) dealLevel('FORM_F');
  if (idx >= STAGES.indexOf('NOC_AND_CLEARANCE')) {
    dealLevel('FOL_SIGNED');
    if (['BUYOUT', 'EQUITY_RELEASE', 'CONSTRUCTION'].includes(deal.transaction_type)) dealLevel('TITLE_DEED');
  }
  if (idx >= STAGES.indexOf('CHEQUES_READY') && tags.includes('ISLAMIC')) dealLevel('TAKAFUL_POLICY');
  return needs;
}

function missingDocs(db: DatabaseSync, dealId: number, needs: DocNeed[]): string[] {
  const docs = db
    .prepare("SELECT doc_category, applicant_id FROM vault_documents WHERE deal_id = ? AND ocr_validation_status != 'REJECTED'")
    .all(dealId) as Row[];
  return needs
    .filter((n) => !docs.some((d) => d.doc_category === n.category && (n.applicantId === null || d.applicant_id === n.applicantId || d.applicant_id === null)))
    .map((n) => n.label);
}

// ---------- guards ----------
type Ctx = { deal: Row; conv: Row | undefined; tags: string[]; asOf: string };

function guardsForward(db: DatabaseSync, c: Ctx, from: Stage, to: Stage): string[] {
  const b: string[] = [];
  const { deal, conv } = c;
  switch (to) {
    case 'KFS_PENDING': {
      const n = db.prepare("SELECT COUNT(*) c FROM applicants WHERE household_id = ? AND applicant_role IN ('PRIMARY','CO_BORROWER','GUARANTOR')").get(deal.household_id) as { c: number };
      if (n.c === 0) b.push('Add at least one applicant');
      if (!(deal.purchase_price_fils > 0)) b.push('Enter purchase price / value');
      if (!(deal.target_loan_fils > 0)) b.push('Enter target loan');
      break;
    }
    case 'DOC_COLLECTION': {
      const g = checkBankSubmissionGate(db, deal.id);
      if (g.missingKfsApplicants.length) b.push(`KFS not signed by: ${g.missingKfsApplicants.join(', ')}`);
      if (g.cddBlocker) b.push(c.tags.includes('COMPLIANCE_HOLD') ? 'Compliance hold: refer to MLRO' : 'CDD clearance pending');
      break;
    }
    case 'UNDERWRITING_READY': {
      if (!approvedQuote(db, deal.id, c.asOf)) b.push('Approved, unexpired quote required (Quote tab on the deal form)');
      const m = missingDocs(db, deal.id, requiredDocs(db, deal.id, c.tags, 'UNDERWRITING_READY'));
      m.forEach((x) => b.push(`Missing document: ${x}`));
      const rejected = db.prepare("SELECT COUNT(*) c FROM vault_documents WHERE deal_id = ? AND ocr_validation_status = 'REJECTED'").get(deal.id) as { c: number };
      if (rejected.c) b.push('A rejected document needs replacing');
      break;
    }
    case 'IPA_SUBMITTED':
      b.push('Use "Submit to banks" on the Underwriting screen (runs KFS/CDD gate and rate card selection)');
      break;
    case 'IPA_APPROVED': {
      const s = db.prepare("SELECT COUNT(*) c FROM deal_submissions WHERE deal_id = ? AND status IN ('IPA_APPROVED','FOL_ISSUED','FOL_SIGNED','SELECTED_FOR_DISBURSAL')").get(deal.id) as { c: number };
      if (!s.c) b.push('No bank has approved the IPA yet');
      break;
    }
    case 'MOU_SIGNED':
      if (!conv?.form_f_signed_date) b.push('Form F signing date not recorded');
      else if (conv.form_f_expiry_date && conv.form_f_expiry_date < c.asOf) b.push('Form F has expired');
      break;
    case 'VALUATION_ORDERED':
      if (!conv?.valuation_firm) b.push('Valuation firm not recorded');
      break;
    case 'VALUATION_RECEIVED':
      if (!(conv?.valuation_amount_fils > 0)) b.push('Valuation amount not recorded');
      break;
    case 'FOL_ISSUED': {
      if (conv && conv.valuation_amount_fils > 0 && conv.valuation_amount_fils < deal.purchase_price_fils && conv.valuation_shortfall_action === 'NONE')
        b.push('Valuation is below price: choose appeal, backup bank, renegotiation or buyer top-up');
      const s = db.prepare("SELECT COUNT(*) c FROM deal_submissions WHERE deal_id = ? AND status IN ('FOL_ISSUED','FOL_SIGNED','SELECTED_FOR_DISBURSAL')").get(deal.id) as { c: number };
      if (!s.c) b.push('Bank has not issued the FOL');
      break;
    }
    case 'FOL_SIGNED': {
      const s = db.prepare("SELECT COUNT(*) c FROM deal_submissions WHERE deal_id = ? AND status IN ('FOL_SIGNED','SELECTED_FOR_DISBURSAL') AND fol_audit_passed = 1").get(deal.id) as { c: number };
      if (!s.c) b.push('FOL must be signed and pass the clause audit');
      break;
    }
    case 'NOC_AND_CLEARANCE':
      break;
    case 'CHEQUES_READY': {
      if (['READY_PURCHASE', 'COMMERCIAL'].includes(deal.transaction_type) && conv?.noc_status !== 'ISSUED') b.push('Developer / seller NOC not issued');
      if (conv?.seller_has_mortgage) {
        if (!(conv.liability_letter_payoff_fils > 0)) b.push('Seller liability letter missing');
        else if (conv.liability_letter_expires_at && conv.liability_letter_expires_at < c.asOf) b.push('Seller liability letter expired: request a new one');
      }
      if (deal.transaction_type === 'BUYOUT' && !(conv?.liability_letter_payoff_fils > 0)) b.push('Current-bank settlement letter missing');
      const open = db
        .prepare(`SELECT COUNT(*) c FROM applicant_liabilities l JOIN applicants a ON a.id = l.applicant_id
                  WHERE a.household_id = ? AND l.to_be_cleared_before_fol = 1 AND l.closure_letter_doc_id IS NULL`)
        .get(deal.household_id) as { c: number };
      if (open.c) b.push(`${open.c} liability closure letter(s) outstanding`);
      missingDocs(db, deal.id, requiredDocs(db, deal.id, c.tags, 'CHEQUES_READY').filter((n) => n.applicantId === null)).forEach((x) =>
        b.push(`Missing document: ${x}`),
      );
      break;
    }
    case 'TRANSFERRED_DISBURSED':
      if (!conv?.transfer_appointment_at) b.push('Transfer appointment not booked');
      b.push('Use "Record disbursal" in ERP (books commission and clawback watch)');
      break;
  }
  return b;
}

// ---------- read model ----------
export type Alert = { level: 'CRITICAL' | 'WARN' | 'INFO'; code: string; text: string; playbook?: string };

export function getDealWorkflow(db: DatabaseSync, dealId: number, asOf = new Date().toISOString().slice(0, 10)) {
  const deal = db.prepare('SELECT * FROM deals WHERE id = ?').get(dealId) as Row | undefined;
  if (!deal) throw new Error(`Deal ${dealId} not found`);
  const conv = db.prepare('SELECT * FROM conveyancing_cases WHERE deal_id = ?').get(dealId) as Row | undefined;
  const tags = classifyDeal(db, dealId);
  const path = pathFor(deal.transaction_type);
  const closed = deal.stage === 'DECLINED' || deal.stage === 'WITHDRAWN';
  const stage = deal.stage as AnyStage;
  const curIdx = closed ? -1 : path.indexOf(stage as Stage);
  const ctx: Ctx = { deal, conv, tags, asOf };

  const track = path.map((s, i) => ({
    stage: s, label: STAGE_META[s].label, owner: STAGE_META[s].owner,
    state: closed ? 'todo' : i < curIdx ? 'done' : i === curIdx ? 'current' : 'todo',
  }));

  const alerts: Alert[] = [];
  const addDays = (d: string, n: number) => new Date(Date.parse(d) + n * 86_400_000).toISOString().slice(0, 10);
  const soon = addDays(asOf, 7);

  const subs = db.prepare('SELECT * FROM deal_submissions WHERE deal_id = ?').all(dealId) as Row[];
  const primary = subs.find((s) => s.priority === 'PRIMARY');
  const backup = subs.find((s) => s.priority === 'BACKUP' && s.status !== 'IPA_DECLINED');
  if (!closed && primary?.status === 'IPA_DECLINED')
    alerts.push({ level: 'CRITICAL', code: 'BANK_DECLINED', playbook: 'P41', text: backup ? 'Primary bank declined. Backup bank is ready to promote.' : 'Primary bank declined and no backup exists.' });
  for (const s of subs) {
    if (!closed && ['IPA_APPROVED'].includes(s.status) && s.ipa_expires_at) {
      if (s.ipa_expires_at < asOf && curIdx < path.indexOf('FOL_SIGNED')) alerts.push({ level: 'CRITICAL', code: 'IPA_EXPIRED', playbook: 'P42', text: `IPA expired on ${s.ipa_expires_at}. Refresh and resubmit.` });
      else if (s.ipa_expires_at <= soon) alerts.push({ level: 'WARN', code: 'IPA_EXPIRING', playbook: 'P42', text: `IPA expires ${s.ipa_expires_at}.` });
    }
  }
  if (!closed && conv?.fol_contingency_date && curIdx < path.indexOf('FOL_SIGNED')) {
    if (conv.fol_contingency_date < asOf) alerts.push({ level: 'CRITICAL', code: 'FOL_LAPSED', playbook: 'P44', text: `FOL contingency date ${conv.fol_contingency_date} has passed.` });
    else if (conv.fol_contingency_date <= soon) alerts.push({ level: 'WARN', code: 'FOL_LAPSE_RISK', playbook: 'P44', text: `FOL contingency date ${conv.fol_contingency_date} is within 7 days.` });
  }
  if (!closed && conv && conv.valuation_amount_fils > 0 && conv.valuation_amount_fils < deal.purchase_price_fils)
    alerts.push({ level: conv.valuation_shortfall_action === 'NONE' ? 'CRITICAL' : 'INFO', code: 'DOWN_VALUATION', playbook: 'P43',
      text: conv.valuation_shortfall_action === 'NONE' ? 'Valuation is below price. Choose an action.' : `Valuation below price. Action: ${conv.valuation_shortfall_action}.` });
  if (!closed && conv?.liability_letter_expires_at && conv.liability_letter_expires_at < asOf && curIdx < path.indexOf('TRANSFERRED_DISBURSED'))
    alerts.push({ level: 'WARN', code: 'LIABILITY_LETTER_EXPIRED', playbook: 'P33', text: 'Seller liability letter has expired.' });
  if (!closed && tags.includes('COMPLIANCE_HOLD'))
    alerts.push({ level: 'CRITICAL', code: 'COMPLIANCE_HOLD', playbook: 'P16', text: 'Compliance hold. Refer to MLRO. Do not discuss with client.' });
  if (!closed && tags.includes('PEP')) alerts.push({ level: 'WARN', code: 'PEP', playbook: 'P15', text: 'PEP applicant: EDD and senior approval required.' });
  if (tags.includes('APL_RESTRICTED')) alerts.push({ level: 'WARN', code: 'APL_RESTRICTED', playbook: 'P32', text: 'Project is restricted on the selected bank.' });

  const apps = db.prepare("SELECT * FROM applicants WHERE household_id = ? AND applicant_role IN ('PRIMARY','CO_BORROWER','GUARANTOR')").all(deal.household_id) as Row[];
  const limit = addDays(asOf, 180);
  for (const a of apps) {
    if (a.eid_expiry_date && a.eid_expiry_date < limit) alerts.push({ level: a.eid_expiry_date < asOf ? 'CRITICAL' : 'WARN', code: 'EID_EXPIRY', playbook: 'P45', text: `${a.full_name_en}: Emirates ID expiry ${a.eid_expiry_date}.` });
    if (a.passport_expiry_date && a.passport_expiry_date < limit) alerts.push({ level: a.passport_expiry_date < asOf ? 'CRITICAL' : 'WARN', code: 'PASSPORT_EXPIRY', playbook: 'P45', text: `${a.full_name_en}: passport expiry ${a.passport_expiry_date}.` });
  }
  const stale = db.prepare("SELECT COUNT(*) c FROM vault_documents WHERE deal_id = ? AND ocr_validation_status IN ('WARNING_STALE_30D','WARNING_EXPIRY_180D','REJECTED')").get(dealId) as { c: number };
  if (stale.c && !closed) alerts.push({ level: 'WARN', code: 'DOCS_STALE', playbook: 'P45', text: `${stale.c} document(s) stale, expiring or rejected.` });

  if (!closed && curIdx >= 0 && curIdx <= path.indexOf('UNDERWRITING_READY') && curIdx >= path.indexOf('DOC_COLLECTION')) {
    try {
      const uw = evaluateDealAcross24Banks(db, dealId);
      if (uw.eligibleOffers.length === 0) alerts.push({ level: 'CRITICAL', code: 'NO_BANK_ELIGIBLE', playbook: 'P40', text: 'No bank is eligible. Restructure loan, tenure, co-borrower or liabilities.' });
      if (uw.eligibleOffers.length === 0) tags.push('NO_BANK_ELIGIBLE');
    } catch { /* ranker needs complete inputs; ignore */ }
  }
  if (primary?.status === 'IPA_DECLINED') tags.push('BANK_DECLINED');
  if (alerts.some((a) => a.code === 'IPA_EXPIRED')) tags.push('IPA_EXPIRED');
  if (alerts.some((a) => a.code === 'FOL_LAPSE_RISK' || a.code === 'FOL_LAPSED')) tags.push('FOL_LAPSE_RISK');
  if (alerts.some((a) => a.code === 'EID_EXPIRY' || a.code === 'PASSPORT_EXPIRY' || a.code === 'DOCS_STALE')) tags.push('DOCS_EXPIRING');

  // forward move + blockers
  let nextStage: Stage | null = null;
  let blockers: string[] = [];
  if (!closed && curIdx >= 0 && curIdx < path.length - 1) {
    nextStage = path[curIdx + 1];
    blockers = guardsForward(db, ctx, path[curIdx], nextStage);
  }
  const progressBlockers = blockers.filter((x) => !x.startsWith('Use "'));

  const owner = closed ? 'SALES_ADVISOR' : STAGE_META[(stage as Stage)].owner;
  const crit = alerts.find((a) => a.level === 'CRITICAL');
  const nextAction = closed
    ? { owner, text: 'Closed. Reopen if circumstances change, or follow up from the nurture list.', slaHours: 0 }
    : crit
      ? { owner: PLAYBOOKS.find((p) => p.id === crit.playbook)?.owner ?? owner, text: crit.text, slaHours: 4 }
      : progressBlockers.length
        ? { owner, text: `Resolve: ${progressBlockers[0]}${progressBlockers.length > 1 ? ` (+${progressBlockers.length - 1} more)` : ''}`, slaHours: stageRule(db, stage as Stage).slaHours }
        : { owner, text: STAGE_META[stage as Stage].action, slaHours: stageRule(db, stage as Stage).slaHours };

  const exceptions: { kind: ExceptionKind; label: string; allowed: boolean; why?: string }[] = [];
  if (!closed && stage !== 'TRANSFERRED_DISBURSED') {
    exceptions.push({ kind: 'PROMOTE_BACKUP', label: 'Promote backup bank', allowed: primary?.status === 'IPA_DECLINED' && !!backup, why: primary?.status !== 'IPA_DECLINED' ? 'Primary bank has not declined' : !backup ? 'No backup submission' : undefined });
    exceptions.push({ kind: 'STEP_BACK', label: 'Step back (rework)', allowed: curIdx > 0 });
    exceptions.push({ kind: 'WITHDRAW', label: 'Withdraw (client / seller fell out)', allowed: true });
    exceptions.push({ kind: 'DECLINE', label: 'Close as declined', allowed: true });
  }
  if (closed) exceptions.push({ kind: 'REOPEN', label: 'Reopen deal', allowed: true });

  const tagSet = new Set(tags);
  const playbooks: Playbook[] = PLAYBOOKS.filter((p) => tagSet.has(p.tag));
  const need = requiredDocs(db, dealId, tags, closed ? 'FACT_FIND' : (stage as Stage));

  return {
    dealId, dealRef: deal.deal_ref as string, stage, closed, tags: [...new Set(tags)], track, nextStage, blockers,
    alerts, nextAction, exceptions, playbooks,
    documents: { required: need.map((n) => n.label), missing: missingDocs(db, dealId, need) },
  };
}

// ---------- write side ----------
const WF = '[WF] ';
function setStage(db: DatabaseSync, actor: UserRecord, dealId: number, to: AnyStage, action: string, meta: unknown) {
  const before = db.prepare('SELECT stage FROM deals WHERE id = ?').get(dealId) as { stage: string };
  db.prepare('UPDATE deals SET stage = ? WHERE id = ?').run(to, dealId);
  db.prepare("UPDATE ops_tasks SET status = 'COMPLETED' WHERE deal_id = ? AND status = 'OPEN' AND title LIKE ?").run(dealId, `${WF}%`);
  if (to !== 'TRANSFERRED_DISBURSED' && to !== 'DECLINED' && to !== 'WITHDRAWN') {
    const m = STAGE_META[to as Stage];
    const rule = stageRule(db, to as Stage);
    db.prepare('INSERT INTO ops_tasks (deal_id, assigned_role, priority, title, due_at) VALUES (?, ?, ?, ?, ?)').run(
      dealId, rule.owner, rule.slaHours <= 24 ? 'HIGH' : 'NORMAL', `${WF}${m.label}: ${m.action}`,
      new Date(Date.now() + rule.slaHours * 3_600_000).toISOString(),
    );
  }
  writeAuditLog(db, actor, 'deals', dealId, action, { stage: before.stage }, { stage: to, ...(meta as object) });
}

export function advanceDeal(db: DatabaseSync, actor: UserRecord, dealId: number) {
  assertRole(actor, STAFF);
  const wf = getDealWorkflow(db, dealId);
  if (wf.closed) throw new Error('Deal is closed. Reopen it first.');
  if (!wf.nextStage) throw new Error('Deal is already at the last stage.');
  if (wf.blockers.length) throw new Error(`Cannot move to ${STAGE_META[wf.nextStage].label}: ${wf.blockers.join(' | ')}`);
  db.exec('BEGIN IMMEDIATE');
  try {
    setStage(db, actor, dealId, wf.nextStage, 'WORKFLOW_ADVANCE', {});
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
  return { stage: wf.nextStage };
}

export type ExceptionKind = 'PROMOTE_BACKUP' | 'STEP_BACK' | 'WITHDRAW' | 'DECLINE' | 'REOPEN';

export function applyException(
  db: DatabaseSync, actor: UserRecord, dealId: number, kind: ExceptionKind,
  input: { reason: string; targetStage?: Stage; reasonCode?: string },
) {
  assertRole(actor, STAFF);
  const reason = (input.reason || '').trim();
  if (!reason) throw new Error('A reason is required');
  const codes = reasonCodes(db);
  if ((kind === 'WITHDRAW' || kind === 'DECLINE') && codes.length && !codes.includes(input.reasonCode ?? '')) throw new Error(`Choose a reason code: ${codes.join(', ')}`);
  const deal = db.prepare('SELECT * FROM deals WHERE id = ?').get(dealId) as Row | undefined;
  if (!deal) throw new Error(`Deal ${dealId} not found`);
  const path = pathFor(deal.transaction_type);

  db.exec('BEGIN IMMEDIATE');
  try {
    let result: AnyStage = deal.stage;
    if (deal.stage === 'TRANSFERRED_DISBURSED' && kind !== 'REOPEN')
      throw new Error('Disbursed deals cannot be changed here. Use ERP clawback for early settlement.');

    if (kind === 'PROMOTE_BACKUP') {
      const subs = db.prepare('SELECT * FROM deal_submissions WHERE deal_id = ?').all(dealId) as Row[];
      const primary = subs.find((s) => s.priority === 'PRIMARY');
      const backup = subs.find((s) => s.priority === 'BACKUP' && s.status !== 'IPA_DECLINED');
      if (primary?.status !== 'IPA_DECLINED') throw new Error('Primary bank has not declined');
      if (!backup) throw new Error('No backup submission to promote');
      db.prepare("UPDATE deal_submissions SET priority = 'BACKUP' WHERE id = ?").run(primary.id);
      db.prepare("UPDATE deal_submissions SET priority = 'PRIMARY' WHERE id = ?").run(backup.id);
      db.prepare('UPDATE deals SET selected_bank_id = ?, selected_rate_card_id = ? WHERE id = ?').run(backup.bank_id, backup.rate_card_id, dealId);
      result = backup.status === 'IPA_APPROVED' ? 'IPA_APPROVED' : 'IPA_SUBMITTED';
      db.prepare("UPDATE conveyancing_cases SET valuation_shortfall_action = 'SWITCHED_BACKUP_BANK' WHERE deal_id = ? AND valuation_amount_fils > 0 AND valuation_amount_fils < ?").run(dealId, deal.purchase_price_fils);
    } else if (kind === 'STEP_BACK') {
      const to = input.targetStage;
      if (!to || !path.includes(to)) throw new Error('Choose a valid earlier stage');
      if (path.indexOf(to) >= path.indexOf(deal.stage)) throw new Error('Target must be earlier than current stage');
      result = to;
    } else if (kind === 'WITHDRAW' || kind === 'DECLINE') {
      result = kind === 'WITHDRAW' ? 'WITHDRAWN' : 'DECLINED';
    } else if (kind === 'REOPEN') {
      if (deal.stage !== 'DECLINED' && deal.stage !== 'WITHDRAWN') throw new Error('Only declined or withdrawn deals can be reopened');
      const to = input.targetStage ?? 'FACT_FIND';
      if (!['FACT_FIND', 'UNDERWRITING_READY'].includes(to)) throw new Error('Reopen to Fact-find or Underwriting only');
      if (to === 'UNDERWRITING_READY') {
        const g = checkBankSubmissionGate(db, dealId);
        if (!g.allowed) throw new Error('KFS and CDD must be complete before reopening at Underwriting');
      }
      result = to;
    }

    setStage(db, actor, dealId, result, `WORKFLOW_${kind}`, { reason, reasonCode: input.reasonCode ?? null });

    if (kind === 'WITHDRAW' || kind === 'DECLINE') {
      db.prepare('INSERT INTO ops_tasks (deal_id, assigned_role, priority, title, due_at) VALUES (?, ?, ?, ?, ?)').run(
        dealId, 'SALES_ADVISOR', 'NORMAL', `${WF}Nurture follow-up (${kind.toLowerCase()}): ${reason}`,
        new Date(Date.now() + 90 * 86_400_000).toISOString(),
      );
      if (deal.lead_id) db.prepare("UPDATE leads SET stage = 'NURTURE' WHERE id = ?").run(deal.lead_id);
    }
    db.exec('COMMIT');
    return { stage: result };
  } catch (e) { db.exec('ROLLBACK'); throw e; }
}
