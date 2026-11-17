import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDb } from '@/server/db';
import type { UserRecord } from '@/server/auth';
import { specByNo } from '@/server/data-hub/specs';
import { importFile } from '@/server/data-hub/import';
import { convertLeadToDeal } from '@/server/services/os-service';
import { computeConveyancingPack } from './conveyancing-engine';
import { saveQuote } from './quotes';
import { getDealWorkflow, openStageTask } from './workflow-engine';
import { addBusinessDays, businessDaysBetween } from './bank-sla';

const csv = (cols: string[], rows: Record<string, string>[]) => Buffer.from([cols.join(','), ...rows.map((r) => cols.map((c) => r[c] ?? '').join(','))].join('\n'));

async function setup() {
  const db = createTestDb();
  const admin = db.prepare("SELECT * FROM users WHERE email = 'md@betterwaymortgages.com'").get() as UserRecord;
  const advisor = db.prepare("SELECT * FROM users WHERE email = 'tariq.advisor@betterwaymortgages.com'").get() as UserRecord;
  const lead = db.prepare("INSERT INTO leads (contact_name, contact_phone, first_response_due_at, client_consent_logged_at) VALUES ('T','+9715',datetime('now'),datetime('now'))").run();
  const { dealId } = convertLeadToDeal(db, advisor, { leadId: Number(lead.lastInsertRowid), residencyType: 'EXPAT_RESIDENT', basicSalaryFils: 4_500_000, allowancesFils: 1_500_000, purchasePriceFils: 150_000_000, targetLoanFils: 100_000_000, tenureMonths: 300, emirate: 'dubai', communityName: 'Dubai Hills Estate' });
  const imp = (no: number, rows: Record<string, string>[]) => importFile(db, admin, { specNo: no, fileName: 'x.csv', bytes: csv(specByNo(no)!.columns, rows) });
  return { db, dealId, advisor, imp };
}

test('business days skip Saturday and Sunday', () => {
  assert.equal(addBusinessDays('2026-11-13', 1), '2026-11-16'); // Fri -> Mon
  assert.equal(addBusinessDays('2026-11-16', 5), '2026-11-23');
  assert.equal(businessDaysBetween('2026-11-13', '2026-11-16'), 1);
});

test('imported fees drive both the cheque pack and the quote; seller-paid and wrong-emirate rows are ignored; exact type wins', async () => {
  const { db, dealId, advisor, imp } = await setup();
  const base = computeConveyancingPack(db, dealId).cheques;
  const quoteBase = saveQuote(db, advisor, dealId);
  const cashBase = (db.prepare('SELECT cash_to_close_fils c FROM deal_quotes WHERE id = ?').get(quoteBase.id) as { c: number }).c;

  const fee = (o: Record<string, string>) => ({ fee_id: 'F', emirate: 'dubai', authority: 'DLD', transaction_type: '', fee_type: 'DLD_TRANSFER', rate_pct: '', fixed_amount_aed: '', vat_treatment: '', payer: 'BUYER', source_ref: 's', effective_from: '2026-01-01', ...o });
  await imp(7, [
    fee({ fee_id: 'F1', rate_pct: '2' }),                                          // generic 2%
    fee({ fee_id: 'F2', transaction_type: 'READY_PURCHASE', rate_pct: '3', fixed_amount_aed: '500' }), // exact type wins: 3% + AED 500
    fee({ fee_id: 'F3', emirate: 'abu_dhabi', rate_pct: '9' }),                    // other emirate ignored
    fee({ fee_id: 'F4', fee_type: 'TRUSTEE', fixed_amount_aed: '4000', vat_treatment: 'EXCLUSIVE' }), // +5% VAT
    fee({ fee_id: 'F5', fee_type: 'VALUATION_COURTESY', fixed_amount_aed: '1000', payer: 'SELLER' }), // seller pays: not in buyer cash
  ]);
  const c = computeConveyancingPack(db, dealId).cheques;
  assert.equal(c.dldTransferFils, 4_500_000 + 50_000);
  assert.equal(c.trusteeFeeFils, 420_000);
  assert.notEqual(c.dldTransferFils, base.dldTransferFils);
  assert.equal(c.mortgageRegFils, base.mortgageRegFils); // not configured: default kept

  const q2 = saveQuote(db, advisor, dealId);
  const cash2 = (db.prepare('SELECT cash_to_close_fils c FROM deal_quotes WHERE id = ?').get(q2.id) as { c: number }).c;
  // DLD went from 4% (6,000,000) to 3% + AED 500 (4,550,000); trustee adds 4,200 AED; seller fee excluded
  assert.equal(cash2 - cashBase, (4_550_000 - 6_000_000) + 420_000);
});

test('bank SLA: contacts and due date shown, breach alerts after the business-day window, chase task has the SLA due date', async () => {
  const { db, dealId, advisor, imp } = await setup();
  db.prepare("UPDATE deals SET selected_bank_id = 2, stage = 'IPA_SUBMITTED' WHERE id = ?").run(dealId);
  db.prepare("INSERT INTO audit_logs (actor_role, entity_type, entity_id, action, created_at) VALUES ('SYSTEM','deals',?,'SUBMIT_DUAL_BANK_IPA','2026-11-09 09:00:00')").run(String(dealId)); // Monday
  assert.equal(getDealWorkflow(db, dealId, '2026-11-12').bankClock, null); // nothing imported yet

  const row = (o: Record<string, string>) => ({ bank_id: '2', contact_role: 'BDM', secure_channel: 'bdm@bank.ae', stage_code: 'IPA_SUBMITTED', sla_business_days: '2', effective_from: '2026-01-01', ...o });
  await imp(2, [row({})]);
  const ok = getDealWorkflow(db, dealId, '2026-11-11');
  assert.equal(ok.bankClock!.dueBy, '2026-11-11');
  assert.ok(!ok.alerts.some((a) => a.code === 'BANK_SLA_BREACH'));
  const late = getDealWorkflow(db, dealId, '2026-11-13');
  assert.ok(late.alerts.some((a) => a.code === 'BANK_SLA_BREACH' && /bdm@bank.ae/.test(a.text)));

  // other-bank rows and expired rows are ignored
  await imp(2, [row({ bank_id: '4', contact_role: 'X' }), row({ contact_role: 'OLD', effective_to: '2026-01-31' })]);
  assert.deepEqual(getDealWorkflow(db, dealId, '2026-11-11').bankClock!.contacts.map((c) => c.role), ['BDM']);

  // submitting to banks opens a chase task due by the bank SLA (not the generic stage SLA)
  openStageTask(db, dealId, 'IPA_SUBMITTED');
  const t = db.prepare("SELECT title, due_at FROM ops_tasks WHERE deal_id = ? AND status = 'OPEN' ORDER BY id DESC LIMIT 1").get(dealId) as { title: string; due_at: string };
  assert.match(t.title, /chase .* via bdm@bank\.ae \(SLA 2 business days\)/);
  assert.equal(t.due_at.slice(0, 10), addBusinessDays(new Date().toISOString(), 2));
  assert.ok(advisor);
});
