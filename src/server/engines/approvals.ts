// Staff_Roles_and_Approval_Matrix (spec 09): per-person or per-role money limits by action. No row = no extra limit.
import type { DatabaseSync } from 'node:sqlite';
import type { UserRecord } from '@/server/auth';
import { ForbiddenError } from '@/server/auth';
import { activeRows } from '@/server/data-hub/import';

const n = (s: unknown) => String(s ?? '').trim().toLowerCase();

export function assertWithinApprovalLimit(db: DatabaseSync, actor: UserRecord, action: string, amountFils: number, asOf?: string) {
  const me = [String(actor.id), n(actor.email)];
  const mine = activeRows(db, 9, asOf).filter((r) => n(r.action) === n(action) && r.approval_limit_aed !== '' && (me.includes(n(r.staff_id)) || n(r.role_id) === n(actor.role)));
  if (!mine.length) return;
  const limit = Math.min(...mine.map((r) => Number(r.approval_limit_aed) * 100));
  if (amountFils > limit) {
    const esc = mine.find((r) => r.escalation_role)?.escalation_role || 'a senior approver';
    throw new ForbiddenError(`${action} of AED ${(amountFils / 100).toLocaleString()} exceeds your approval limit of AED ${(limit / 100).toLocaleString()}. Escalate to ${esc}.`);
  }
}
