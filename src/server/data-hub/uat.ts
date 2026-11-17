// Spec 34 UAT_Cases_and_Expected_Results: one synthetic test per playbook, ready to run and sign off.
import type { DatabaseSync } from 'node:sqlite';
import { assertRole, writeAuditLog, type UserRecord } from '@/server/auth';
import { PLAYBOOKS } from '@/server/engines/scenarios';

export function generateUatCases(db: DatabaseSync, actor: UserRecord) {
  assertRole(actor, ['SUPER_ADMIN', 'PROGRESSION_MANAGER', 'CREDIT_UNDERWRITER']);
  const have = new Set((db.prepare("SELECT external_id FROM data_rows WHERE spec_no = 34 AND status = 'ACCEPTED'").all() as { external_id: string }[]).map((r) => r.external_id));
  const todo = PLAYBOOKS.filter((p) => !have.has(`UAT-${p.id}`));
  if (!todo.length) return 0;
  db.exec('BEGIN IMMEDIATE');
  try {
    const b = db.prepare("INSERT INTO data_batches (spec_no, file_name, source_rows, accepted_rows, created_by) VALUES (34, 'generated-from-playbooks', ?, ?, ?)").run(todo.length, todo.length, actor.id);
    const ins = db.prepare("INSERT INTO data_rows (batch_id, spec_no, row_no, external_id, data_json, status) VALUES (?, 34, ?, ?, ?, 'ACCEPTED')");
    todo.forEach((p, i) => ins.run(Number(b.lastInsertRowid), i + 1, `UAT-${p.id}`, JSON.stringify({
      test_id: `UAT-${p.id}`, workflow: p.title, fixture_ref: `synthetic-${p.tag.toLowerCase()}`, inputs: p.trigger,
      expected_outcome: p.steps.join(' → '), actual_outcome: '', status: 'NOT_RUN', reviewer: '',
    })));
    writeAuditLog(db, actor, 'data_batches', Number(b.lastInsertRowid), 'UAT_GENERATED', null, { count: todo.length });
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
  return todo.length;
}
