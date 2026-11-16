import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDb } from '@/server/db';
import type { UserRecord } from '@/server/auth';
import { specByNo } from '@/server/data-hub/specs';
import { importFile } from '@/server/data-hub/import';
import { convertLeadToDeal } from '@/server/services/os-service';
import { evaluateDealAcross24Banks } from './underwriting-engine';

const csv = (cols: string[], rows: Record<string, string>[]) => Buffer.from([cols.join(','), ...rows.map((r) => cols.map((c) => r[c] ?? '').join(','))].join('\n'));

async function setup() {
  const db = createTestDb();
  const admin = db.prepare("SELECT * FROM users WHERE email = 'md@betterwaymortgages.com'").get() as UserRecord;
  const advisor = db.prepare("SELECT * FROM users WHERE email = 'tariq.advisor@betterwaymortgages.com'").get() as UserRecord;
  const lead = db.prepare("INSERT INTO leads (contact_name, contact_phone, first_response_due_at, client_consent_logged_at) VALUES ('T','+9715',datetime('now'),datetime('now'))").run();
  const { dealId } = convertLeadToDeal(db, advisor, { leadId: Number(lead.lastInsertRowid), residencyType: 'EXPAT_RESIDENT', basicSalaryFils: 4_500_000, allowancesFils: 1_500_000, purchasePriceFils: 150_000_000, targetLoanFils: 100_000_000, tenureMonths: 300, emirate: 'dubai', communityName: 'Dubai Hills Estate' });
  const imp = (no: number, rows: Record<string, string>[]) => importFile(db, admin, { specNo: no, fileName: 'x.csv', bytes: csv(specByNo(no)!.columns, rows) });
  return { db, dealId, imp };
}

test('imported rules tighten underwriting; held rows and loosening attempts are ignored', async () => {
  const { db, dealId, imp } = await setup();
  const base = evaluateDealAcross24Banks(db, dealId);
  assert.ok(base.eligibleOffers.length >= 3);
  const top = base.eligibleOffers[0];
  const ref = String(top.bankId);

  // Bank_Master: suspended bank is knocked out
  await imp(1, [{ bank_id: ref, legal_name: 'x', status: 'SUSPENDED', source_ref: 'doc', last_verified_at: '2026-11-01' }]);
  let r = evaluateDealAcross24Banks(db, dealId);
  assert.ok(!r.eligibleOffers.some((o) => o.bankId === top.bankId));
  assert.ok(r.knockouts.some((k) => k.bankId === top.bankId && /SUSPENDED/.test(k.reason)));
  await imp(1, [{ bank_id: ref, legal_name: 'x', status: 'ACTIVE', source_ref: 'doc', last_verified_at: '2026-11-01' }]); // new version supersedes
  assert.ok(evaluateDealAcross24Banks(db, dealId).eligibleOffers.some((o) => o.bankId === top.bankId));

  // Eligibility: lowering max LTV knocks the bank out; raising it cannot loosen the statutory cap
  const rule = (o: Record<string, string>) => ({ rule_id: 'R1', scope: ref, source_ref: 's', effective_from: '2026-01-01', approver: 'MD', ...o });
  await imp(4, [rule({ max_ltv_pct: '50' })]);
  r = evaluateDealAcross24Banks(db, dealId);
  assert.ok(r.knockouts.some((k) => k.bankId === top.bankId && /LTV/.test(k.reason)));
  await imp(4, [rule({ max_ltv_pct: '99', max_dbr_pct: '90', income_factor: '5' })]);
  r = evaluateDealAcross24Banks(db, dealId);
  const same = r.eligibleOffers.find((o) => o.bankId === top.bankId)!;
  assert.equal(same.maxAllowedLtvBps, top.maxAllowedLtvBps);
  assert.equal(same.assessableHouseholdIncomeFils, top.assessableHouseholdIncomeFils);

  // Held (no approver) rule is not used
  await imp(4, [rule({ max_ltv_pct: '10', approver: '' })]);
  assert.ok(evaluateDealAcross24Banks(db, dealId).eligibleOffers.some((o) => o.bankId === top.bankId));
});

test('imported products override rates and are the source of truth for that bank; policies enforce tenure and salary transfer', async () => {
  const { db, dealId, imp } = await setup();
  const base = evaluateDealAcross24Banks(db, dealId);
  const top = base.eligibleOffers[0];
  const ref = String(top.bankId);
  const prod = (o: Record<string, string>) => ({ product_id: top.productCode, bank_id: ref, product_type: 'x', rate_type: 'FIXED', fixed_rate_pct: '3.00', fixed_months: '36', benchmark_tenor: '3M', revert_margin_pct: '2.50', floor_pct: '3', fees: '', source_ref: 's', effective_from: '2026-01-01', last_verified_at: '2026-11-01', approved_by: 'MD', ...o });
  await imp(3, [prod({})]);
  const o = evaluateDealAcross24Banks(db, dealId).eligibleOffers.find((x) => x.bankId === top.bankId)!;
  assert.equal(o.introRateBps, 300);
  assert.ok(o.rulesApplied!.includes(`PRODUCT:${top.productCode}`));
  assert.ok(o.introEmiFils < top.introEmiFils);

  const second = base.eligibleOffers[1];
  await imp(3, [prod({ product_id: 'NOT_A_PRODUCT', bank_id: String(second.bankId) })]); // no matching card: bank has no approved product
  assert.ok(evaluateDealAcross24Banks(db, dealId).knockouts.some((k) => k.bankId === second.bankId && /No active approved rate card/.test(k.reason)));

  await imp(5, [{ policy_id: 'P1', bank_id: ref, employer_category: '', employment_tenure_months: '600', income_type: 'SALARY', accepted_income_pct: '100', salary_transfer_rule: 'optional', source_ref: 's', effective_from: '2026-01-01' }]);
  assert.ok(evaluateDealAcross24Banks(db, dealId).knockouts.some((k) => k.bankId === top.bankId && /policy minimum/.test(k.reason)));
});
