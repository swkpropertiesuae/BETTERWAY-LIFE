// Setup files that also change live data when imported: project list (11), opening balances (15), benchmark rates (38).
import type { DatabaseSync } from 'node:sqlite';
import { writeAuditLog, type UserRecord } from '@/server/auth';
import { postJournalEntry } from '@/server/engines/ledger-tax-engine';

type Row = Record<string, string>;
const norm = (s: string) => s.trim().toLowerCase().replace(/[\s-]+/g, '_');
const rowsOf = (db: DatabaseSync, batchId: number) =>
  (db.prepare("SELECT id, data_json FROM data_rows WHERE batch_id = ? AND status = 'ACCEPTED'").all(batchId) as { id: number; data_json: string }[]).map((r) => ({ id: r.id, d: JSON.parse(r.data_json) as Row }));
const note = (db: DatabaseSync, id: number, msg: string) => db.prepare('UPDATE data_rows SET errors_json = ? WHERE id = ?').run(JSON.stringify([msg]), id);
const applied = (db: DatabaseSync, id: number) => db.prepare('UPDATE data_rows SET applied = 1 WHERE id = ?').run(id);

export function applySetup(db: DatabaseSync, actor: UserRecord, specNo: number, batchId: number): number {
  if (specNo === 11) return applyProjectApl(db, actor, batchId);
  if (specNo === 15) return applyOpeningBalances(db, actor, batchId);
  if (specNo === 38) return applyBenchmarks(db, batchId);
  return 0;
}

function applyProjectApl(db: DatabaseSync, actor: UserRecord, batchId: number) {
  let n = 0;
  const bank = (v: string) => db.prepare('SELECT id FROM banks WHERE CAST(id AS TEXT) = ? OR lower(bank_key) = lower(?) OR lower(short_name) = lower(?) OR lower(name_en) = lower(?)').get(v, v, v, v) as { id: number } | undefined;
  const project = (v: string) => db.prepare('SELECT id FROM projects WHERE CAST(id AS TEXT) = ? OR lower(slug) = lower(?) OR lower(name) = lower(?)').get(v, v, v) as { id: number } | undefined;
  for (const { id, d } of rowsOf(db, batchId)) {
    const b = bank(d.bank_id), p = project(d.project_id);
    if (!b || !p) { note(db, id, `NOT_APPLIED: ${!b ? `bank "${d.bank_id}"` : `project "${d.project_id}"`} not found in the OS`); continue; }
    const t = norm(d.apl_status);
    const status = /block|not_approved|reject|decline/.test(t) ? 'BLOCKED' : /cap/.test(t) ? 'CAPPED_LTV' : /case/.test(t) ? 'CASE_BY_CASE' : 'APPROVED';
    const prev = db.prepare('SELECT id FROM bank_project_apl WHERE bank_id = ? AND project_id = ?').get(b.id, p.id) as { id: number } | undefined;
    if (prev) db.prepare("UPDATE bank_project_apl SET apl_status = ?, updated_by = ?, updated_at = datetime('now') WHERE id = ?").run(status, actor.id, prev.id);
    else db.prepare("INSERT INTO bank_project_apl (bank_id, project_id, tower_name, apl_status, max_ltv_bps, valuation_basis, updated_by) VALUES (?, ?, '', ?, ?, 'LOWER_OF_SPA_OR_VAL', ?)").run(b.id, p.id, status, status === 'APPROVED' ? 8000 : 6000, actor.id); // conservative LTV until the bank confirms
    applied(db, id); n++;
  }
  if (n) writeAuditLog(db, actor, 'bank_project_apl', batchId, 'APL_IMPORT', null, { rows: n });
  return n;
}

function applyOpeningBalances(db: DatabaseSync, actor: UserRecord, batchId: number) {
  const rows = rowsOf(db, batchId);
  if (!rows.length) return 0;
  const lines: { accountCode: string; debitFils: number; creditFils: number; lineMemo: string }[] = [];
  const accounts = new Set((db.prepare('SELECT code FROM gl_accounts').all() as { code: string }[]).map((a) => a.code));
  let dr = 0, cr = 0;
  for (const { id, d } of rows) {
    if (!accounts.has(d.account_code)) { note(db, id, `NOT_APPLIED: account ${d.account_code} is not in the chart of accounts`); return 0; }
    const fils = Math.round(Number(d.amount_aed) * 100);
    const debit = /^(d|dr|debit)$/i.test(d.balance_type);
    if (!debit && !/^(c|cr|credit)$/i.test(d.balance_type)) { note(db, id, 'NOT_APPLIED: balance_type must be DEBIT or CREDIT'); return 0; }
    lines.push({ accountCode: d.account_code, debitFils: debit ? fils : 0, creditFils: debit ? 0 : fils, lineMemo: `${d.external_ledger_ref} ${d.counterparty_id}`.trim() });
    debit ? (dr += fils) : (cr += fils);
  }
  if (dr !== cr) { // all-or-nothing: unbalanced file is never half-posted
    rows.forEach((r) => note(db, r.id, `NOT_APPLIED: opening balances do not balance (debit ${dr / 100} vs credit ${cr / 100}). Fix the file and re-import`));
    return 0;
  }
  postJournalEntry(db, actor, { entryDate: rows[0].d.as_of_date, memo: 'Opening balances import', sourceModule: 'DATA_HUB', sourceId: `batch-${batchId}`, lines });
  rows.forEach((r) => applied(db, r.id));
  return rows.length;
}

function applyBenchmarks(db: DatabaseSync, batchId: number) {
  let n = 0;
  const col: Record<string, string> = { ON: 'overnight_micro', '1M': 'one_month_micro', '3M': 'three_month_micro', '6M': 'six_month_micro', '1Y': 'one_year_micro' };
  for (const { id, d } of rowsOf(db, batchId)) {
    if (!/EIBOR/i.test(d.rate_code)) continue; // FX and other benchmarks stay in the history only
    const tenor = d.tenor_or_currency_pair.toUpperCase().replace(/\s+/g, '').replace('MONTH', 'M').replace('YEAR', 'Y').replace('OVERNIGHT', 'ON');
    if (!col[tenor] || !/^verified$/i.test(d.verification_status)) { note(db, id, 'NOT_APPLIED: needs a known tenor (ON, 1M, 3M, 6M, 1Y) and verification_status VERIFIED'); continue; }
    const fixed = Math.round(Number(d.value) * 100_000);
    // new fixing date starts from the latest known fixing, then the imported tenor is set
    db.prepare(`INSERT OR IGNORE INTO eibor_fixings (fixing_date, value_date, overnight_micro, one_month_micro, three_month_micro, six_month_micro, one_year_micro, source_status)
                SELECT ?, ?, overnight_micro, one_month_micro, three_month_micro, six_month_micro, one_year_micro, 'IMPORTED' FROM eibor_fixings ORDER BY fixing_date DESC LIMIT 1`).run(d.observation_date, d.observation_date);
    db.prepare(`UPDATE eibor_fixings SET ${col[tenor]} = ?, source_status = 'IMPORTED', retrieved_at = datetime('now') WHERE fixing_date = ?`).run(fixed, d.observation_date);
    applied(db, id); n++;
  }
  return n;
}
