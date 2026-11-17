// Partner payouts: approval evidence, four-eyes, duplicate-payment and overpayment guards, reversal.
import type { DatabaseSync } from 'node:sqlite';
import { assertRole, writeAuditLog, type UserRecord } from '@/server/auth';
import { assertWithinApprovalLimit } from './approvals';

type Row = Record<string, any>;

export function recordPartnerPayout(db: DatabaseSync, actor: UserRecord, input: { settlementId: number; amountFils: number; paymentRef: string; approvalRef: string; approvedByUserId: number }) {
  assertRole(actor, ['SUPER_ADMIN', 'FINANCE_ADMIN']);
  const paymentRef = input.paymentRef.trim(), approvalRef = input.approvalRef.trim();
  if (!paymentRef || !approvalRef) throw new Error('Payment reference and approval reference are both required');
  if (!Number.isInteger(input.amountFils) || input.amountFils <= 0) throw new Error('Amount must be greater than zero');
  if (input.approvedByUserId === actor.id) throw new Error('Four-eyes rule: the approver must be a different person from the payer');
  const approver = db.prepare("SELECT id FROM users WHERE id = ? AND role IN ('SUPER_ADMIN','FINANCE_ADMIN') AND status = 'ACTIVE'").get(input.approvedByUserId);
  if (!approver) throw new Error('Approver must be an active finance or admin user');
  const s = db.prepare('SELECT * FROM commission_settlements WHERE id = ?').get(input.settlementId) as Row | undefined;
  if (!s) throw new Error('Settlement not found');
  if (!['PAYABLE_READY', 'PAID'].includes(s.partner_payout_status)) throw new Error(`Partner payout is ${s.partner_payout_status}; it is not payable yet`);
  if (db.prepare('SELECT 1 FROM partner_payouts WHERE payment_ref = ?').get(paymentRef)) throw new Error(`Duplicate payment: reference ${paymentRef} was already recorded`);
  const paid = (db.prepare("SELECT COALESCE(SUM(amount_fils),0) p FROM partner_payouts WHERE settlement_id = ? AND reversal_ref = ''").get(s.id) as { p: number }).p;
  const due = Number(s.partner_released_ex_vat_fils) + Number(s.partner_input_vat_fils) - paid;
  if (input.amountFils > due) throw new Error(`Overpayment blocked: only AED ${(due / 100).toFixed(2)} is still payable on this settlement`);
  assertWithinApprovalLimit(db, actor, 'PARTNER_PAYOUT', input.amountFils);
  db.exec('BEGIN IMMEDIATE');
  try {
    const r = db.prepare('INSERT INTO partner_payouts (settlement_id, amount_fils, payment_ref, approval_ref, approved_by, paid_by) VALUES (?,?,?,?,?,?)').run(s.id, input.amountFils, paymentRef, approvalRef, input.approvedByUserId, actor.id);
    if (due - input.amountFils === 0) db.prepare("UPDATE commission_settlements SET partner_payout_status = 'PAID' WHERE id = ?").run(s.id);
    writeAuditLog(db, actor, 'partner_payouts', Number(r.lastInsertRowid), 'PARTNER_PAYOUT', null, { settlementId: s.id, amountFils: input.amountFils, paymentRef, approvalRef });
    db.exec('COMMIT');
    return { payoutId: Number(r.lastInsertRowid), remainingFils: due - input.amountFils };
  } catch (e) { db.exec('ROLLBACK'); throw e; }
}

export function reversePartnerPayout(db: DatabaseSync, actor: UserRecord, payoutId: number, reversalRef: string) {
  assertRole(actor, ['SUPER_ADMIN', 'FINANCE_ADMIN']);
  if (!reversalRef.trim()) throw new Error('Reversal reference is required');
  const p = db.prepare('SELECT * FROM partner_payouts WHERE id = ?').get(payoutId) as Row | undefined;
  if (!p) throw new Error('Payout not found');
  if (p.reversal_ref) throw new Error('Payout already reversed');
  db.prepare('UPDATE partner_payouts SET reversal_ref = ? WHERE id = ?').run(reversalRef.trim(), payoutId);
  db.prepare("UPDATE commission_settlements SET partner_payout_status = 'PAYABLE_READY' WHERE id = ? AND partner_payout_status = 'PAID'").run(p.settlement_id);
  writeAuditLog(db, actor, 'partner_payouts', payoutId, 'PARTNER_PAYOUT_REVERSED', null, { reversalRef });
}
