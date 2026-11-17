// Migration files 17-22 -> live records. Rows wait (applied = 0) until the case they belong to exists, so files can be imported in any order.
import type { DatabaseSync } from 'node:sqlite';
import { STAGES } from '@/server/engines/workflow-engine';

type Row = Record<string, string>;
const fils = (aed: string) => Math.round(Number(aed || 0) * 100);
const has = (t: string, s: string) => t.toLowerCase().includes(s);

const caseType = (t: string) => (has(t, 'buyout') || has(t, 'refin') ? 'BUYOUT' : has(t, 'equity') ? 'EQUITY_RELEASE' : has(t, 'handover') || has(t, 'off') ? 'OFFPLAN_HANDOVER' : has(t, 'commercial') || has(t, 'sme') ? 'COMMERCIAL' : has(t, 'construction') ? 'CONSTRUCTION' : 'READY_PURCHASE');
const residency = (t: string) => (/non.?res/i.test(t) ? 'NON_RESIDENT' : /gcc/i.test(t) ? 'GCC_NATIONAL' : /national|citizen|uae_nat/i.test(t) ? 'UAE_NATIONAL' : 'EXPAT_RESIDENT');
const employment = (t: string) => (/self|business|owner/i.test(t) ? 'SELF_EMPLOYED' : /invest/i.test(t) ? 'INVESTOR' : 'SALARIED');
const role = (t: string) => (/co/i.test(t) ? 'CO_BORROWER' : /guar/i.test(t) ? 'GUARANTOR' : 'PRIMARY');

export function applyPending(db: DatabaseSync): Record<number, number> {
  const link = (type: string, id: string) => (db.prepare('SELECT entity_id e FROM legacy_links WHERE entity_type = ? AND legacy_id = ?').get(type, id) as { e: number } | undefined)?.e;
  const setLink = db.prepare('INSERT OR REPLACE INTO legacy_links (entity_type, legacy_id, entity_id) VALUES (?, ?, ?)');
  const done = db.prepare('UPDATE data_rows SET applied = 1, errors_json = ? WHERE id = ?');
  const wait = (id: number, why: string) => db.prepare('UPDATE data_rows SET errors_json = ? WHERE id = ?').run(JSON.stringify([`WAITING: ${why}`]), id);
  const rows = (no: number) => (db.prepare("SELECT id, data_json FROM data_rows WHERE spec_no = ? AND status = 'ACCEPTED' AND applied = 0 ORDER BY id").all(no) as { id: number; data_json: string }[]).map((r) => ({ id: r.id, d: JSON.parse(r.data_json) as Row }));
  const user = (v: string) => (v ? (db.prepare('SELECT id, role FROM users WHERE CAST(id AS TEXT) = ? OR lower(email) = lower(?)').get(v, v) as { id: number; role: string } | undefined) : undefined);
  const counts: Record<number, number> = { 17: 0, 18: 0, 19: 0, 20: 0, 21: 0, 22: 0 };

  // 18 cases first: everything else hangs off them
  for (const { id, d } of rows(18)) {
    if (link('case', d.legacy_case_id)) { done.run('[]', id); continue; }
    const loan = fils(d.loan_requested_aed), type = caseType(d.case_type), owner = user(d.owner_id);
    const out = d.outcome_code.toUpperCase();
    const closed = !!d.closed_at;
    const won = closed && /DISB|WON|COMPLETE/.test(out);
    const stage = closed ? (won ? 'TRANSFERRED_DISBURSED' : /WITHDRAW|CANCEL/.test(out) ? 'WITHDRAWN' : 'DECLINED') : (STAGES as readonly string[]).includes(d.stage_code.toUpperCase()) && d.stage_code.toUpperCase() !== 'TRANSFERRED_DISBURSED' ? d.stage_code.toUpperCase() : 'FACT_FIND';
    const hh = Number(db.prepare("INSERT INTO households (primary_name, segment) VALUES (?, 'RESIDENT_SALARIED')").run(`Legacy case ${d.legacy_case_id}`).lastInsertRowid);
    const n = (db.prepare('SELECT COUNT(*) c FROM deals').get() as { c: number }).c + 1;
    const ref = `BW-L${String(n).padStart(4, '0')}`;
    const price = Math.round(loan / 0.8) || 1;
    const dealId = Number(db.prepare(
      `INSERT INTO deals (deal_ref, origin_mode, household_id, advisor_id, transaction_type, purchase_price_fils, estimated_valuation_fils, target_loan_fils, stage, cdd_status, disbursed_loan_fils, disbursed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(ref, won ? 'LEGACY_BACKBOOK' : 'LIVE', hh, owner?.id ?? null, type, price, price, loan, stage, won ? 'CLEARED' : 'PENDING', won ? loan : 0, won ? d.closed_at : null).lastInsertRowid);
    setLink.run('case', d.legacy_case_id, dealId); setLink.run('household', d.legacy_case_id, hh);
    if (d.legacy_party_id) setLink.run('party_case', d.legacy_party_id, dealId);
    if (!closed && d.due_at) db.prepare("INSERT INTO ops_tasks (deal_id, assigned_role, priority, title, due_at) VALUES (?, ?, 'NORMAL', ?, ?)").run(dealId, owner?.role ?? 'SALES_ADVISOR', `[Legacy] ${d.next_action || 'Follow up'}`, d.due_at);
    done.run('[]', id); counts[18]++;
  }

  for (const { id, d } of rows(17)) {
    const dealId = link('case', d.legacy_case_id), hh = link('household', d.legacy_case_id);
    if (!dealId || !hh) { wait(id, `case ${d.legacy_case_id} not imported yet (Open_and_Historical_Cases_Import)`); continue; }
    const first = !db.prepare('SELECT 1 FROM applicants WHERE household_id = ?').get(hh);
    const a = db.prepare(
      `INSERT INTO applicants (household_id, applicant_role, full_name_en, residency_type, employment_type) VALUES (?, ?, ?, ?, ?)`)
      .run(hh, first ? 'PRIMARY' : role(d.party_role), `Legacy party ${d.legacy_party_id}`, residency(d.residency_status), employment(d.employment_type));
    setLink.run('party', d.legacy_party_id, Number(a.lastInsertRowid));
    if (first) db.prepare("UPDATE households SET segment = ? WHERE id = ?").run(residency(d.residency_status) === 'NON_RESIDENT' ? 'NON_RESIDENT' : residency(d.residency_status) === 'UAE_NATIONAL' ? 'UAE_NATIONAL' : employment(d.employment_type) === 'SELF_EMPLOYED' ? 'SELF_EMPLOYED' : 'RESIDENT_SALARIED', hh);
    done.run('[]', id); counts[17]++;
  }

  for (const { id, d } of rows(19)) {
    const dealId = link('case', d.legacy_case_id);
    if (!dealId) { wait(id, `case ${d.legacy_case_id} not imported yet`); continue; }
    const proj = d.project_id ? (db.prepare('SELECT id FROM projects WHERE CAST(id AS TEXT) = ? OR lower(slug) = lower(?) OR lower(name) = lower(?)').get(d.project_id, d.project_id, d.project_id) as { id: number } | undefined) : undefined;
    const status = /under|off|plan/i.test(d.ready_status) ? 'OFFPLAN_UNDER_CONSTRUCTION' : /handover/i.test(d.ready_status) ? 'HANDOVER_COMPLETION' : 'READY';
    const price = fils(d.purchase_price_aed);
    db.prepare(`UPDATE deals SET emirate = COALESCE(NULLIF(?, ''), emirate), project_id = ?, property_status = ?, is_first_home = ?, purchase_price_fils = CASE WHEN ? > 0 THEN ? ELSE purchase_price_fils END,
                estimated_valuation_fils = CASE WHEN ? > 0 THEN ? ELSE estimated_valuation_fils END WHERE id = ?`)
      .run(d.emirate.toLowerCase().replace(/\s+/g, '_'), proj?.id ?? null, status, /invest|second|rent/i.test(d.intended_use) ? 0 : 1, price, price, price, price, dealId);
    if (d.transaction_deadline) {
      db.prepare('INSERT OR IGNORE INTO conveyancing_cases (deal_id) VALUES (?)').run(dealId);
      db.prepare('UPDATE conveyancing_cases SET fol_contingency_date = ? WHERE deal_id = ?').run(d.transaction_deadline, dealId);
    }
    done.run('[]', id); counts[19]++;
  }

  for (const { id, d } of rows(20)) {
    const dealId = link('case', d.legacy_case_id);
    if (!dealId) { wait(id, `case ${d.legacy_case_id} not imported yet`); continue; }
    const o = user(d.owner_id);
    const open = !d.event_at && !!d.due_at;
    db.prepare("INSERT INTO ops_tasks (deal_id, assigned_role, priority, title, due_at, status) VALUES (?, ?, 'NORMAL', ?, ?, ?)")
      .run(dealId, o?.role ?? 'SALES_ADVISOR', `[Legacy] ${d.event_type}${d.channel ? ` via ${d.channel}` : ''}${d.secure_thread_ref ? ` (thread ${d.secure_thread_ref})` : ''}`, d.due_at || d.event_at || new Date().toISOString(), open ? 'OPEN' : 'COMPLETED');
    done.run('[]', id); counts[20]++;
  }

  for (const { id, d } of rows(21)) {
    const dealId = link('case', d.legacy_case_id);
    if (!dealId) { wait(id, `case ${d.legacy_case_id} not imported yet`); continue; }
    const party = d.party_id ? link('party', d.party_id) : undefined;
    db.prepare('INSERT INTO document_index (deal_id, applicant_id, document_type, vault_ref, received_at, expiry_at, verification_status, access_class) VALUES (?,?,?,?,?,?,?,?)')
      .run(dealId, party ?? null, d.document_type.toUpperCase().replace(/[\s-]+/g, '_'), d.vault_ref, d.received_at || null, d.expiry_at || null, d.verification_status, d.access_class);
    done.run('[]', id); counts[21]++;
  }

  for (const { id, d } of rows(22)) {
    const dealId = link('case', d.legacy_case_id);
    if (!dealId) { wait(id, `case ${d.legacy_case_id} not imported yet`); continue; }
    db.prepare('INSERT OR IGNORE INTO legacy_receivables (deal_id, counterparty_id, invoice_ref, accrued_fils, paid_fils, outstanding_fils, due_date, reconciliation_status) VALUES (?,?,?,?,?,?,?,?)')
      .run(dealId, d.counterparty_id, d.invoice_ref, fils(d.accrued_aed), fils(d.paid_aed), fils(d.outstanding_aed), d.due_date || null, d.reconciliation_status);
    done.run('[]', id); counts[22]++;
  }
  return counts;
}
