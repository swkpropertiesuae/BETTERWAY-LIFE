// Security and privacy operations: MFA enrolment, retention (spec 13), incident and data-request register.
import type { DatabaseSync } from 'node:sqlite';
import { existsSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { assertRole, writeAuditLog, type UserRecord } from '@/server/auth';
import { activeRows } from '@/server/data-hub/import';
import { newTotpSecret, verifyTotp } from '@/server/auth/totp';

type Row = Record<string, any>;

// ---- MFA ----
export function startMfa(db: DatabaseSync, user: UserRecord) {
  const secret = newTotpSecret();
  db.prepare('UPDATE users SET totp_secret = ?, mfa_enabled = 0 WHERE id = ?').run(secret, user.id);
  return secret;
}
export function confirmMfa(db: DatabaseSync, user: UserRecord, code: string) {
  const u = db.prepare('SELECT totp_secret FROM users WHERE id = ?').get(user.id) as { totp_secret: string };
  if (!u.totp_secret || !verifyTotp(u.totp_secret, code)) throw new Error('That code is not valid. Check the time on your phone and try again.');
  db.prepare('UPDATE users SET mfa_enabled = 1 WHERE id = ?').run(user.id);
  writeAuditLog(db, user, 'users', user.id, 'MFA_ENABLED');
}
export function disableMfa(db: DatabaseSync, actor: UserRecord, targetUserId: number, code: string) {
  const t = db.prepare('SELECT totp_secret, mfa_enabled FROM users WHERE id = ?').get(targetUserId) as { totp_secret: string; mfa_enabled: number } | undefined;
  if (!t) throw new Error('User not found');
  if (actor.id === targetUserId) { if (!verifyTotp(t.totp_secret, code)) throw new Error('Enter a valid authenticator code to turn MFA off'); }
  else assertRole(actor, ['SUPER_ADMIN']); // an admin can reset a lost device
  db.prepare("UPDATE users SET mfa_enabled = 0, totp_secret = '' WHERE id = ?").run(targetUserId);
  writeAuditLog(db, actor, 'users', targetUserId, 'MFA_DISABLED');
}

// ---- Retention ----
const years = (s: string): number | null => {
  const m = s.toLowerCase().match(/(\d+(?:\.\d+)?)\s*(y|yr|year|years|m|mo|month|months)\b/);
  return m ? (/^y/.test(m[2]) ? Number(m[1]) * 12 : Number(m[1])) : null; // months
};
const monthsAgo = (iso: string, now: Date) => (now.getTime() - Date.parse(iso)) / (30.44 * 86_400_000);

export type RetentionCandidate = { recordType: 'VAULT_DOCUMENT' | 'LEAD'; id: number; label: string; closedAt: string; ruleMonths: number };

/** Records past their configured retention period. Open complaints or incidents on the deal put it on hold. */
export function retentionDue(db: DatabaseSync, now = new Date()): { due: RetentionCandidate[]; manual: string[] } {
  const rules = activeRows(db, 13);
  const due: RetentionCandidate[] = [];
  const manual: string[] = [];
  for (const r of rules) {
    const months = years(r.retention_period);
    const type = r.record_type.toLowerCase();
    if (!months) { manual.push(`${r.record_type}: retention period "${r.retention_period}" could not be read (use e.g. "5 years")`); continue; }
    if (/document|vault|identity|statement/.test(type)) {
      const docs = db.prepare(`SELECT v.id, v.doc_category, v.file_name, d.deal_ref, d.stage, d.disbursed_at,
          COALESCE((SELECT MAX(created_at) FROM audit_logs a WHERE a.entity_type='deals' AND a.entity_id = CAST(d.id AS TEXT) AND a.action IN ('WORKFLOW_DECLINE','WORKFLOW_WITHDRAW')), d.created_at) last_event
          FROM vault_documents v JOIN deals d ON d.id = v.deal_id
          WHERE d.stage IN ('TRANSFERRED_DISBURSED','DECLINED','WITHDRAWN')
          AND NOT EXISTS (SELECT 1 FROM sanadak_complaints c WHERE c.deal_id = d.id AND c.resolved_at IS NULL)`).all() as Row[];
      for (const d of docs) {
        const closedAt = String(d.stage === 'TRANSFERRED_DISBURSED' ? d.disbursed_at ?? d.last_event : d.last_event ?? '');
        if (closedAt && monthsAgo(closedAt, now) >= months && !due.some((x) => x.recordType === 'VAULT_DOCUMENT' && x.id === d.id))
          due.push({ recordType: 'VAULT_DOCUMENT', id: d.id, label: `${d.doc_category} · ${d.file_name} · ${d.deal_ref}`, closedAt, ruleMonths: months });
      }
    } else if (/lead|contact|prospect/.test(type)) {
      for (const l of db.prepare("SELECT id, contact_name, created_at FROM leads WHERE stage IN ('DISQUALIFIED','NURTURE') AND NOT EXISTS (SELECT 1 FROM deals d WHERE d.lead_id = leads.id)").all() as Row[])
        if (monthsAgo(l.created_at, now) >= months) due.push({ recordType: 'LEAD', id: l.id, label: `${l.contact_name} (lead #${l.id})`, closedAt: l.created_at, ruleMonths: months });
    } else manual.push(`${r.record_type}: no automatic job, review by hand (${r.retention_period} after ${r.retention_trigger})`);
  }
  return { due, manual };
}

export function purgeRetention(db: DatabaseSync, actor: UserRecord, input: { recordType: 'VAULT_DOCUMENT' | 'LEAD'; ids: number[]; approvalRef: string }, now = new Date()) {
  assertRole(actor, ['COMPLIANCE_MLRO']);
  if (!input.approvalRef.trim()) throw new Error('Approval reference is required before deleting records');
  const allowed = new Set(retentionDue(db, now).due.filter((d) => d.recordType === input.recordType).map((d) => d.id));
  const ids = input.ids.filter((i) => allowed.has(i)); // only records that are actually past retention and not on hold
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const id of ids) {
      if (input.recordType === 'VAULT_DOCUMENT') {
        const v = db.prepare('SELECT storage_path FROM vault_documents WHERE id = ?').get(id) as { storage_path: string } | undefined;
        const f = v?.storage_path && (path.isAbsolute(v.storage_path) ? v.storage_path : path.resolve(process.cwd(), v.storage_path));
        if (f && existsSync(f)) unlinkSync(f);
        db.prepare('DELETE FROM vault_documents WHERE id = ?').run(id);
      } else db.prepare('DELETE FROM leads WHERE id = ?').run(id);
      db.prepare('INSERT INTO retention_log (record_type, entity_id, action, approved_by) VALUES (?, ?, ?, ?)').run(input.recordType, String(id), `PURGED (${input.approvalRef.trim()})`, actor.id);
    }
    writeAuditLog(db, actor, 'retention', input.recordType, 'RETENTION_PURGE', null, { ids, approvalRef: input.approvalRef });
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
  return { purged: ids.length, skipped: input.ids.length - ids.length };
}

// ---- Incidents and data requests ----
// shortcut: due-day targets are internal defaults, confirm the legal windows with counsel before relying on them.
const DUE_DAYS: Record<string, number> = { CRITICAL: 1, HIGH: 3, NORMAL: 14, LOW: 30 };

export function openIncident(db: DatabaseSync, actor: UserRecord, input: { kind: 'INCIDENT' | 'DATA_REQUEST'; subtype: string; severity?: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL'; subject: string; description: string }) {
  assertRole(actor, ['SUPER_ADMIN', 'COMPLIANCE_MLRO', 'SALES_ADVISOR', 'CREDIT_UNDERWRITER', 'PROGRESSION_MANAGER', 'FINANCE_ADMIN', 'HR_MANAGER']);
  if (!input.description.trim()) throw new Error('Describe what happened or what was requested');
  const severity = input.kind === 'DATA_REQUEST' ? 'NORMAL' : input.severity ?? 'NORMAL';
  const days = input.kind === 'DATA_REQUEST' ? 30 : DUE_DAYS[severity];
  const n = (db.prepare('SELECT COUNT(*) c FROM incidents WHERE kind = ?').get(input.kind) as { c: number }).c + 1;
  const ref = `${input.kind === 'INCIDENT' ? 'INC' : 'DSR'}-${new Date().getUTCFullYear()}-${String(n).padStart(4, '0')}`;
  const due = new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
  const r = db.prepare('INSERT INTO incidents (ref, kind, subtype, severity, subject, description, due_at) VALUES (?,?,?,?,?,?,?)').run(ref, input.kind, input.subtype, severity, input.subject.trim(), input.description.trim(), due);
  db.prepare("INSERT INTO ops_tasks (deal_id, assigned_role, priority, title, due_at) VALUES (NULL, 'COMPLIANCE_MLRO', ?, ?, ?)").run(severity === 'CRITICAL' || severity === 'HIGH' ? 'CRITICAL' : 'HIGH', `[Privacy] ${ref} ${input.subtype}: ${input.subject || input.description.slice(0, 60)}`, `${due}T14:00:00.000Z`);
  writeAuditLog(db, actor, 'incidents', Number(r.lastInsertRowid), 'INCIDENT_OPENED', null, { ref, kind: input.kind, severity });
  return { id: Number(r.lastInsertRowid), ref, dueAt: due };
}

export function closeIncident(db: DatabaseSync, actor: UserRecord, id: number, closureRef: string) {
  assertRole(actor, ['SUPER_ADMIN', 'COMPLIANCE_MLRO']);
  if (!closureRef.trim()) throw new Error('Closure evidence reference is required');
  const i = db.prepare('SELECT ref, status FROM incidents WHERE id = ?').get(id) as { ref: string; status: string } | undefined;
  if (!i) throw new Error('Not found');
  if (i.status === 'CLOSED') throw new Error('Already closed');
  db.prepare("UPDATE incidents SET status = 'CLOSED', closed_at = datetime('now'), closure_ref = ? WHERE id = ?").run(closureRef.trim(), id);
  db.prepare("UPDATE ops_tasks SET status = 'COMPLETED' WHERE title LIKE ? AND status = 'OPEN'").run(`[Privacy] ${i.ref}%`);
  writeAuditLog(db, actor, 'incidents', id, 'INCIDENT_CLOSED', null, { closureRef });
}
