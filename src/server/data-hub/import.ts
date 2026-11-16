// Spec-driven import: validate against the PDF column spec, accept/hold/reject per row, keep a reconciliation.
import type { DatabaseSync } from 'node:sqlite';
import { assertRole, writeAuditLog, type UserRecord } from '@/server/auth';
import { specByNo, rolesFor, type Spec } from './specs';
import { parseCsv, readXlsx, type Cell } from './xlsx';

// Natural key (defaults to first column).
const KEYS: Record<number, string[]> = {
  2: ['bank_id', 'contact_role', 'stage_code'], 8: ['stage_code', 'next_stage', 'reason_code'], 9: ['staff_id', 'action'],
  11: ['project_id', 'bank_id'], 12: ['partner_id', 'agreement_ref'], 13: ['record_type', 'processing_purpose'],
  14: ['template_id', 'locale', 'channel'], 15: ['account_code', 'case_id', 'balance_type', 'as_of_date'],
  17: ['legacy_party_id', 'legacy_case_id'], 21: ['legacy_case_id', 'document_type', 'vault_ref'], 22: ['legacy_case_id', 'invoice_ref'],
  23: ['source_file', 'source_field'], 35: ['integration_id', 'test_at'], 36: ['country_code', 'bank_id', 'effective_from'],
  37: ['provider_id', 'service_type'], 38: ['rate_code', 'tenor_or_currency_pair', 'observation_date'], 39: ['page_id', 'locale'],
  48: ['product_id', 'bank_id', 'collateral_type'], 49: ['provider_id', 'service_type'],
};
const keyCols = (s: Spec) => KEYS[s.no] ?? [s.columns[0]];

const DATE_COL = /(_at|_date|^effective_from|^effective_to|^active_from|^active_to|^date_type)$|^(effective_from|effective_to|active_from|active_to|as_of_date|due_date|handover_date|review_at|expiry_at|next_review_at)$/;
const isDateCol = (c: string) => c !== 'date_type' && (DATE_COL.test(c) || c.endsWith('_at') || c.endsWith('_date'));
const isAed = (c: string) => c.endsWith('_aed');
const isPct = (c: string) => c.endsWith('_pct');
const isInt = (c: string) => /_(months|days|hours|rows|count)$/.test(c) || ['leads', 'qualified', 'submitted', 'disbursed', 'sla_business_days', 'sla_days'].includes(c);
const isFlag = (c: string) => c.endsWith('_flag');

export type RowResult = { rowNo: number; key: string; data: Record<string, string>; status: 'ACCEPTED' | 'HELD_FOR_REVIEW' | 'REJECTED'; errors: string[]; from: string | null; to: string | null };

function normDate(v: string): string | null {
  const s = v.trim();
  if (/^\d{4}-\d{2}-\d{2}([T ].*)?$/.test(s)) return Number.isNaN(Date.parse(s)) ? null : s;
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) { const d = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; return Number.isNaN(Date.parse(d)) ? null : d; }
  return null;
}
const str = (v: Cell): string => (v instanceof Date ? v.toISOString().slice(0, 10) : v == null ? '' : String(v).trim());

export function validateRows(spec: Spec, table: Cell[][]): { rows: RowResult[]; fatal?: string } {
  if (!table.length) return { rows: [], fatal: 'File is empty' };
  const header = table[0].map((h) => str(h).toLowerCase());
  const missing = spec.columns.filter((c) => !header.includes(c));
  if (missing.length) return { rows: [], fatal: `Missing columns: ${missing.join(', ')}. Download the template.` };
  const idx = Object.fromEntries(spec.columns.map((c) => [c, header.indexOf(c)]));
  const keys = keyCols(spec);
  const seen = new Set<string>();
  const out: RowResult[] = [];
  table.slice(1).forEach((r, i) => {
    if (r.every((c) => str(c) === '')) return;
    const data: Record<string, string> = {};
    const errors: string[] = [];
    for (const c of spec.columns) {
      let v = str(r[idx[c]]);
      if (v && isDateCol(c)) { const d = normDate(v); if (d) v = d; else errors.push(`${c}: invalid date "${v}"`); }
      if (v && (isAed(c) || isPct(c))) {
        const n = Number(v.replace(/,/g, ''));
        if (Number.isNaN(n) || n < 0) errors.push(`${c}: must be a non-negative number`); else { v = String(n); if (isPct(c) && n > 100) errors.push(`${c}: percentage above 100`); }
      }
      if (v && isInt(c) && !/^\d+$/.test(v)) errors.push(`${c}: must be a whole number`);
      if (v && isFlag(c)) { const f = v.toUpperCase(); if (!['Y', 'N', '1', '0', 'TRUE', 'FALSE', 'YES', 'NO'].includes(f)) errors.push(`${c}: use Y or N`); else v = ['Y', '1', 'TRUE', 'YES'].includes(f) ? 'Y' : 'N'; }
      if (v && c === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) errors.push('email: invalid');
      data[c] = v;
    }
    for (const k of keys) if (!data[k]) errors.push(`${k}: required`);
    const key = keys.map((k) => data[k]).join('|');
    const from = data.effective_from || data.active_from || null;
    const to = data.effective_to || data.active_to || null;
    if (from && to && to < from) errors.push('effective_to is before effective_from');
    if (key && seen.has(key)) errors.push(`DUPLICATE_KEY_IN_FILE: ${key}`);
    if (key) seen.add(key);

    let status: RowResult['status'] = errors.length ? 'REJECTED' : 'ACCEPTED';
    if (status === 'ACCEPTED' && spec.type === 'Setup') {
      const held: string[] = [];
      if ('source_ref' in data && !data.source_ref) held.push('source_ref missing');
      for (const a of ['approved_by', 'approver']) if (a in data && !data[a]) held.push(`${a} missing`);
      if ('last_verified_at' in data && !data.last_verified_at) held.push('last_verified_at missing');
      if (held.length) { status = 'HELD_FOR_REVIEW'; errors.push(...held); }
    }
    out.push({ rowNo: i + 2, key, data, status, errors, from, to });
  });
  return { rows: out };
}

export async function importFile(
  db: DatabaseSync, actor: UserRecord,
  input: { specNo: number; fileName: string; bytes: Buffer },
) {
  const spec = specByNo(input.specNo);
  if (!spec) throw new Error(`Unknown spec ${input.specNo}`);
  if (spec.type === 'Export') throw new Error('Export files are generated by the OS; they cannot be imported.');
  assertRole(actor, rolesFor(spec));
  const isCsv = /\.csv$/i.test(input.fileName);
  const table: Cell[][] = isCsv ? parseCsv(input.bytes.toString('utf8')) : await readXlsx(input.bytes);
  const { rows, fatal } = validateRows(spec, table);
  if (fatal) throw new Error(fatal);

  db.exec('BEGIN IMMEDIATE');
  try {
    const batch = db.prepare('INSERT INTO data_batches (spec_no, file_name, source_rows, created_by) VALUES (?, ?, ?, ?)').run(spec.no, input.fileName, rows.length, actor.id);
    const batchId = Number(batch.lastInsertRowid);
    const find = db.prepare("SELECT id FROM data_rows WHERE spec_no = ? AND external_id = ? AND status IN ('ACCEPTED','HELD_FOR_REVIEW')");
    const ins = db.prepare('INSERT INTO data_rows (batch_id, spec_no, row_no, external_id, data_json, status, errors_json, effective_from, effective_to) VALUES (?,?,?,?,?,?,?,?,?)');
    const sup = db.prepare("UPDATE data_rows SET status = 'SUPERSEDED' WHERE id = ?");
    let acc = 0, held = 0, rej = 0;
    for (const r of rows) {
      let status = r.status;
      if (status !== 'REJECTED') {
        const existing = find.all(spec.no, r.key) as { id: number }[];
        if (existing.length) {
          if (spec.type === 'Setup') existing.forEach((e) => sup.run(e.id)); // new version wins
          else { status = 'REJECTED'; r.errors.push(`DUPLICATE_EXTERNAL_ID: ${r.key} already imported`); }
        }
      }
      ins.run(batchId, spec.no, r.rowNo, r.key, JSON.stringify(r.data), status, JSON.stringify(r.errors), r.from, r.to);
      if (status === 'ACCEPTED') acc++; else if (status === 'HELD_FOR_REVIEW') held++; else rej++;
    }
    db.prepare('UPDATE data_batches SET accepted_rows = ?, held_rows = ?, rejected_rows = ? WHERE id = ?').run(acc, held, rej, batchId);
    writeAuditLog(db, actor, 'data_batches', batchId, 'DATA_IMPORT', null, { spec: spec.no, file: input.fileName, source: rows.length, accepted: acc, held, rejected: rej });
    db.exec('COMMIT');
    return { batchId, source: rows.length, accepted: acc, held, rejected: rej };
  } catch (e) { db.exec('ROLLBACK'); throw e; }
}

export function reviewBatch(db: DatabaseSync, actor: UserRecord, batchId: number, evidenceRef: string) {
  const b = db.prepare('SELECT spec_no FROM data_batches WHERE id = ?').get(batchId) as { spec_no: number } | undefined;
  if (!b) throw new Error('Batch not found');
  assertRole(actor, rolesFor(specByNo(b.spec_no)!));
  if (!evidenceRef.trim()) throw new Error('Evidence reference is required to sign off a batch');
  db.prepare('UPDATE data_batches SET reviewer_id = ?, evidence_ref = ? WHERE id = ?').run(actor.id, evidenceRef.trim(), batchId);
  writeAuditLog(db, actor, 'data_batches', batchId, 'DATA_BATCH_REVIEWED', null, { evidenceRef });
}

/** Rows the engines may use: accepted, inside the effective window, and approved when the spec carries an approver column. */
export function activeRows(db: DatabaseSync, specNo: number, asOf = new Date().toISOString().slice(0, 10)): Record<string, string>[] {
  const rows = db
    .prepare("SELECT data_json FROM data_rows WHERE spec_no = ? AND status = 'ACCEPTED' AND (effective_from IS NULL OR effective_from <= ?) AND (effective_to IS NULL OR effective_to = '' OR effective_to >= ?)")
    .all(specNo, asOf, asOf) as { data_json: string }[];
  return rows.map((r) => JSON.parse(r.data_json));
}

export function templateGuide(spec: Spec): string[][] {
  const g: string[][] = [['File', spec.file], ['Type', `${spec.type} · ${spec.phase}${spec.restricted ? ' · restricted' : ''}`], ['Area', spec.area], ['Key (must be unique)', keyCols(spec).join(' + ')], ['Dates', 'YYYY-MM-DD'], ['Amounts / percentages', '*_aed and *_pct: plain numbers, percentages 0-100'], ['Flags', 'Y or N']];
  if (spec.type === 'Setup') g.push(['Hold rule', 'Rows without source_ref / approver / last_verified_at are held for review and not used by the OS']);
  if (spec.type === 'Migration') g.push(['Duplicates', 'Rows whose external ID was already imported are rejected; reconcile accepted vs rejected after import']);
  return g;
}
