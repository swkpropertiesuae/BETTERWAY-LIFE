// Generated Excel reports. Restricted files need a stated purpose; every export is logged.
import type { DatabaseSync } from 'node:sqlite';
import { assertRole, writeAuditLog, type UserRecord } from '@/server/auth';
import { specByNo, rolesFor } from './specs';
import { getDealWorkflow, STAGE_META, type Stage } from '@/server/engines/workflow-engine';
import { type Cell } from './xlsx';

type Row = Record<string, any>;
const aed = (f: unknown) => (f == null ? '' : Math.round(Number(f)) / 100);
const pct = (bps: unknown) => (bps == null ? '' : Math.round(Number(bps)) / 100);
const today = () => new Date().toISOString().slice(0, 10);
const all = (db: DatabaseSync, sql: string, ...a: (string | number)[]) => db.prepare(sql).all(...a) as Row[];
const mask = (id: number) => `CASE-${String(id).padStart(4, '0')}`;

const BUILDERS: Record<number, (db: DatabaseSync) => Cell[][]> = {
  24: (db) => all(db, `SELECT l.source_channel src, l.assigned_advisor_id owner, COUNT(*) leads,
      SUM(CASE WHEN l.stage IN ('FACT_FIND','CONVERTED_TO_DEAL') THEN 1 ELSE 0 END) qualified,
      SUM(CASE WHEN EXISTS (SELECT 1 FROM deals d JOIN deal_submissions s ON s.deal_id = d.id WHERE d.lead_id = l.id) THEN 1 ELSE 0 END) submitted,
      SUM(CASE WHEN EXISTS (SELECT 1 FROM deals d WHERE d.lead_id = l.id AND d.stage = 'TRANSFERRED_DISBURSED') THEN 1 ELSE 0 END) disbursed
      FROM leads l GROUP BY l.source_channel, l.assigned_advisor_id`)
    .map((r) => [today(), r.src, r.owner ?? '', r.leads, r.qualified, r.submitted, r.disbursed, 'Leads created; qualified = fact-find or converted', '']),
  25: (db) => all(db, "SELECT id, deal_ref, transaction_type, stage, created_at FROM deals WHERE origin_mode = 'LIVE'").map((d) => {
      const w = getDealWorkflow(db, d.id);
      const t = db.prepare("SELECT due_at FROM ops_tasks WHERE deal_id = ? AND status = 'OPEN' AND title LIKE '[WF]%' ORDER BY id DESC LIMIT 1").get(d.id) as Row | undefined;
      const e = db.prepare("SELECT created_at FROM audit_logs WHERE entity_type = 'deals' AND entity_id = ? AND action LIKE 'WORKFLOW%' ORDER BY id DESC LIMIT 1").get(String(d.id)) as Row | undefined;
      const breach = t ? Math.max(0, Math.round((Date.now() - Date.parse(t.due_at)) / 3_600_000)) : 0;
      return [d.deal_ref, d.transaction_type, d.stage, e?.created_at ?? d.created_at, STAGE_META[d.stage as Stage]?.owner ?? '', w.nextAction.text, t?.due_at ?? '', breach];
    }),
  26: (db) => all(db, "SELECT q.*, d.deal_ref FROM deal_quotes q JOIN deals d ON d.id = q.deal_id ORDER BY q.id").flatMap((q) =>
      (JSON.parse(q.offers_json) as Row[]).map((o) => [q.deal_ref, `Q${q.version}`, `${o.bankShort}:${o.productCode}`, aed(o.assessableHouseholdIncomeFils), '', pct(o.calculatedDbrBps), pct(o.calculatedLtvBps), aed(o.introEmiFils), aed(o.fees?.cashToCloseFils), aed(o.revertEmiFils), (JSON.parse(q.knockouts_json) as Row[]).length ? 'KNOCKOUTS_RECORDED' : '', q.expires_at])),
  27: (db) => all(db, "SELECT id, deal_ref FROM deals WHERE origin_mode = 'LIVE' AND stage NOT IN ('DECLINED','WITHDRAWN')").flatMap((d) => {
      const w = getDealWorkflow(db, d.id);
      const miss = w.documents.missing.map((m) => [d.deal_ref, m, w.stage, 'MISSING', '', '', 'Document not in vault', STAGE_META[w.stage as Stage]?.owner ?? '']);
      const exp = w.alerts.filter((a) => ['EID_EXPIRY', 'PASSPORT_EXPIRY', 'DOCS_STALE'].includes(a.code)).map((a) => [d.deal_ref, a.code, w.stage, 'EXPIRING', '', '', a.text, STAGE_META[w.stage as Stage]?.owner ?? '']);
      return [...miss, ...exp] as Cell[][];
    }),
  28: (db) => all(db, 'SELECT * FROM deal_submissions ORDER BY id').map((s) => [s.id, mask(s.deal_id), s.bank_id, s.created_at, s.status, '', s.underwriter_notes, s.ipa_expires_at ?? '', s.ipa_ref || s.fol_ref || '']),
  29: (db) => all(db, 'SELECT d.deal_ref, d.purchase_price_fils, d.disbursed_loan_fils, d.disbursed_at, c.* FROM deals d JOIN conveyancing_cases c ON c.deal_id = d.id').map((r) => [r.deal_ref, aed(r.valuation_amount_fils), r.valuation_amount_fils ? aed(r.purchase_price_fils - r.valuation_amount_fils) : '', r.transfer_appointment_at ?? '', r.noc_status, r.title_deed_no, r.disbursed_at ? 'DISB' : '', aed(r.disbursed_loan_fils), r.disbursed_at ?? '']),
  30: (db) => all(db, 'SELECT c.*, d.deal_ref FROM commission_settlements c JOIN deals d ON d.id = c.deal_id').map((r) => [r.deal_ref, r.bank_id, `SUBV-${r.id}`, aed(r.expected_subvention_ex_vat_fils + r.expected_output_vat_fils), aed(r.expected_output_vat_fils), r.created_at, aed(r.received_subvention_ex_vat_fils), r.reconciliation_status, aed(r.expected_subvention_ex_vat_fils - r.received_subvention_ex_vat_fils)]),
  31: (db) => all(db, 'SELECT c.*, d.deal_ref FROM commission_settlements c JOIN deals d ON d.id = c.deal_id').map((r) => [r.deal_ref, r.partner_agency_id ?? '', '', aed(r.partner_entitled_ex_vat_fils), r.partner_payout_status, '', aed(r.partner_released_ex_vat_fils), '', r.reconciliation_status === 'CLAWED_BACK' ? 'CLAWBACK' : '']),
  32: (db) => all(db, 'SELECT * FROM sanadak_complaints ORDER BY id').map((r) => [r.complaint_ref, r.deal_id ? mask(r.deal_id) : '', r.category, r.sanadak_escalated ? 'HIGH' : 'NORMAL', 'COMPLIANCE_MLRO', r.received_at, r.resolution_due_at, r.resolved_at ? 'CLOSED' : 'OPEN', r.outcome_notes ?? '']),
  33: (db) => [
    ...all(db, 'SELECT * FROM audit_logs ORDER BY id DESC LIMIT 5000').map((r) => [r.id, r.entity_type === 'deals' ? mask(Number(r.entity_id)) : `${r.entity_type}:${r.entity_id}`, r.actor_user_id ?? r.actor_role, r.action, r.created_at, r.before_json ? JSON.parse(r.before_json)?.stage ?? '' : '', r.after_json ? JSON.parse(r.after_json)?.stage ?? '' : '', '', '']),
    ...all(db, 'SELECT * FROM data_exports ORDER BY id DESC LIMIT 1000').map((r) => [`EXP-${r.id}`, `spec ${r.spec_no}`, r.actor_user_id ?? r.actor_role, 'DATA_EXPORT', r.created_at, '', '', '', r.purpose]),
  ],
  41: (db) => all(db, 'SELECT r.*, d.deal_ref FROM homeowner_radar_monitors r JOIN deals d ON d.id = r.deal_id').map((r) => [r.deal_ref, r.clause_ref, r.fixed_expiry_date, new Date(Date.parse(r.fixed_expiry_date) - 90 * 86_400_000).toISOString().slice(0, 10), 'CHECK_CONSENT', '', '']),
  43: (db) => all(db, "SELECT substr(COALESCE(disbursed_at, created_at),1,7) period, advisor_id, transaction_type, COUNT(*) n, SUM(CASE WHEN stage='TRANSFERRED_DISBURSED' THEN 1 ELSE 0 END) disb FROM deals WHERE origin_mode='LIVE' GROUP BY 1,2,3").map((r) => [r.period, r.advisor_id ?? '', 'DUBAI', r.transaction_type, r.n, r.disb, '', '', '']),
  44: (db) => all(db, 'SELECT c.*, d.deal_ref FROM commission_settlements c JOIN deals d ON d.id = c.deal_id').map((r) => [String(r.created_at).slice(0, 7), r.bank_id, r.reconciliation_status, aed(r.expected_subvention_ex_vat_fils), '', aed(r.received_subvention_ex_vat_fils), aed(r.expected_subvention_ex_vat_fils - r.received_subvention_ex_vat_fils)]),
};
export const EXPORTABLE = Object.keys(BUILDERS).map(Number);

export function buildExport(db: DatabaseSync, actor: UserRecord, specNo: number, purpose: string) {
  const spec = specByNo(specNo);
  if (!spec || spec.type !== 'Export') throw new Error('Not an export file');
  assertRole(actor, rolesFor(spec));
  const build = BUILDERS[specNo];
  if (!build) throw new Error(`${spec.file} is not generated yet (${spec.phase}). Use the template.`);
  const p = purpose.trim();
  if (spec.restricted && !p) throw new Error('A purpose is required for restricted exports');
  const rows = build(db);
  const r = db.prepare('INSERT INTO data_exports (spec_no, actor_user_id, actor_role, purpose, row_count) VALUES (?,?,?,?,?)').run(specNo, actor.id, actor.role, p || 'routine', rows.length);
  writeAuditLog(db, actor, 'data_exports', Number(r.lastInsertRowid), 'DATA_EXPORT', null, { spec: specNo, rows: rows.length, purpose: p });
  return { spec, rows };
}
