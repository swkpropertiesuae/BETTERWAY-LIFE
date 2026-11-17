import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtempSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import { createTestDb } from '@/server/db';
import type { UserRecord } from '@/server/auth';
import { specByNo } from '@/server/data-hub/specs';
import { importFile } from '@/server/data-hub/import';
import { writeXlsx } from '@/server/data-hub/xlsx';
import { convertLeadToDeal, intakeExternalLead, routeLead } from '@/server/services/os-service';
import { getDealWorkflow, advanceDeal } from '@/server/engines/workflow-engine';
import { evaluateDealAcross24Banks } from '@/server/engines/underwriting-engine';
import { assertWithinApprovalLimit } from '@/server/engines/approvals';
import { recordPartnerPayout, reversePartnerPayout } from '@/server/engines/payouts';
import { addBusinessDays } from '@/server/engines/bank-sla';
import { runBackupAndRestoreTest } from '@/server/ops/backup';
import { totpCode, verifyTotp, newTotpSecret } from '@/server/auth/totp';
import { startMfa, confirmMfa, retentionDue, purgeRetention, openIncident, closeIncident } from '@/server/engines/privacy';
import { handleWhatsAppPayload, verifySignature } from '@/server/integrations/whatsapp';
import { importSanctionsList } from '@/server/integrations/sanctions';
import { runApplicantAmlScreening } from '@/server/engines/compliance-aml-engine';
import { buildExport } from '@/server/data-hub/exports';

type DB = ReturnType<typeof createTestDb>;
const csv = (no: number, rows: Record<string, string>[]) => { const c = specByNo(no)!.columns; return Buffer.from([c.join(','), ...rows.map((r) => c.map((k) => r[k] ?? '').join(','))].join('\n')); };
const user = (db: DB, e: string) => db.prepare('SELECT * FROM users WHERE email = ?').get(e) as UserRecord;
const setup = () => {
  const db = createTestDb();
  const admin = user(db, 'md@betterwaymortgages.com'), advisor = user(db, 'tariq.advisor@betterwaymortgages.com'), mlro = user(db, 'farid.mlro@betterwaymortgages.com'), fin = user(db, 'sana.finance@betterwaymortgages.com');
  const imp = (no: number, rows: Record<string, string>[], actor = admin) => importFile(db, actor, { specNo: no, fileName: 'x.csv', bytes: csv(no, rows) });
  const deal = () => {
    const lead = db.prepare("INSERT INTO leads (contact_name, contact_phone, first_response_due_at, client_consent_logged_at) VALUES ('T','+9715',datetime('now'),datetime('now'))").run();
    return convertLeadToDeal(db, advisor, { leadId: Number(lead.lastInsertRowid), residencyType: 'EXPAT_RESIDENT', basicSalaryFils: 4_500_000, allowancesFils: 1_500_000, purchasePriceFils: 150_000_000, targetLoanFils: 100_000_000, tenureMonths: 300, emirate: 'dubai', communityName: 'Dubai Hills Estate' }).dealId;
  };
  return { db, admin, advisor, mlro, fin, imp, deal };
};

test('1 migration: files import in any order, rows wait for their case, then become real cases, borrowers, tasks, document index, receivables', async () => {
  const { db, imp } = setup();
  const before = (db.prepare('SELECT COUNT(*) c FROM deals').get() as { c: number }).c;
  const r17 = await imp(17, [{ legacy_party_id: 'P1', legacy_case_id: 'C1', party_role: 'PRIMARY', residency_status: 'Non-resident', employment_type: 'self employed', preferred_language: 'en', vault_customer_ref: 'v' }]);
  assert.equal(r17.applied.created, 0); // case not there yet
  assert.match((db.prepare("SELECT errors_json e FROM data_rows WHERE spec_no = 17").get() as { e: string }).e, /WAITING/);
  await imp(18, [
    { legacy_case_id: 'C1', legacy_party_id: 'P1', owner_id: 'tariq.advisor@betterwaymortgages.com', case_type: 'Buyout', stage_code: 'DOC_COLLECTION', property_id: 'PR1', loan_requested_aed: '1000000', next_action: 'Call client', due_at: '2026-12-01', closed_at: '', outcome_code: '' },
    { legacy_case_id: 'C2', legacy_party_id: 'P2', owner_id: '', case_type: 'Ready purchase', stage_code: '', property_id: '', loan_requested_aed: '800000', next_action: '', due_at: '', closed_at: '2025-03-01', outcome_code: 'DISBURSED' },
    { legacy_case_id: 'C3', legacy_party_id: 'P3', owner_id: '', case_type: 'x', stage_code: '', property_id: '', loan_requested_aed: '500000', next_action: '', due_at: '', closed_at: '2025-03-01', outcome_code: 'REJECTED' },
  ]);
  assert.equal((db.prepare('SELECT COUNT(*) c FROM deals').get() as { c: number }).c, before + 3);
  const d1 = db.prepare("SELECT d.* FROM deals d JOIN legacy_links l ON l.entity_id = d.id AND l.entity_type = 'case' WHERE l.legacy_id = 'C1'").get() as Record<string, any>;
  assert.deepEqual([d1.transaction_type, d1.stage, d1.origin_mode, d1.target_loan_fils], ['BUYOUT', 'DOC_COLLECTION', 'LIVE', 100_000_000]);
  const app = db.prepare("SELECT * FROM applicants WHERE household_id = ?").get(d1.household_id) as Record<string, string>; // waiting row applied once the case arrived
  assert.deepEqual([app.residency_type, app.employment_type, app.applicant_role], ['NON_RESIDENT', 'SELF_EMPLOYED', 'PRIMARY']);
  const closed = db.prepare("SELECT d.stage, d.origin_mode FROM deals d JOIN legacy_links l ON l.entity_id = d.id WHERE l.legacy_id = 'C2' AND l.entity_type = 'case'").get() as Record<string, string>;
  assert.deepEqual([closed.stage, closed.origin_mode], ['TRANSFERRED_DISBURSED', 'LEGACY_BACKBOOK']);
  assert.equal((db.prepare("SELECT d.stage s FROM deals d JOIN legacy_links l ON l.entity_id = d.id WHERE l.legacy_id = 'C3' AND l.entity_type = 'case'").get() as { s: string }).s, 'DECLINED');

  await imp(19, [{ legacy_property_id: 'PR1', legacy_case_id: 'C1', emirate: 'Abu Dhabi', project_id: '', property_type: 'apt', ready_status: 'Off plan', purchase_price_aed: '1500000', intended_use: 'Investment', transaction_deadline: '2026-12-15' }]);
  await imp(20, [{ legacy_activity_id: 'A1', legacy_case_id: 'C1', event_type: 'CALL', channel: 'phone', owner_id: '', event_at: '', due_at: '2026-12-02', secure_thread_ref: 'T-9' }]);
  await imp(21, [{ legacy_case_id: 'C1', party_id: 'P1', document_type: 'passport', vault_ref: 'V1', received_at: '2026-01-01', expiry_at: '2030-01-01', verification_status: 'VERIFIED', access_class: 'RESTRICTED' }]);
  await imp(22, [{ legacy_case_id: 'C2', counterparty_id: 'ENBD', invoice_ref: 'INV-1', accrued_aed: '5000', paid_aed: '2000', outstanding_aed: '3000', due_date: '2026-12-31', reconciliation_status: 'PARTIAL' }]);
  const upd = db.prepare('SELECT * FROM deals WHERE id = ?').get(d1.id) as Record<string, any>;
  assert.deepEqual([upd.emirate, upd.property_status, upd.is_first_home, upd.purchase_price_fils], ['abu_dhabi', 'OFFPLAN_UNDER_CONSTRUCTION', 0, 150_000_000]);
  assert.equal((db.prepare("SELECT fol_contingency_date d FROM conveyancing_cases WHERE deal_id = ?").get(d1.id) as { d: string }).d, '2026-12-15');
  assert.equal((db.prepare("SELECT COUNT(*) c FROM ops_tasks WHERE deal_id = ? AND title LIKE '[Legacy]%'").get(d1.id) as { c: number }).c, 2); // next action + activity
  const wf = getDealWorkflow(db, d1.id);
  assert.ok(!wf.documents.missing.some((m) => m.startsWith('PASSPORT'))); // migrated document index counts
  assert.equal((db.prepare('SELECT COUNT(*) c FROM legacy_receivables').get() as { c: number }).c, 1);
  assert.ok(buildExport(db, user(db, 'md@betterwaymortgages.com'), 30, 'x').rows.some((r) => r[2] === 'INV-1'));
});

test('2 setup data drives live engines: approval matrix, lead routing, project list + review, partner share, notifications, opening balances, non-resident rules, EIBOR', async () => {
  const { db, admin, advisor, fin, imp, deal } = setup();
  // 9 approval matrix
  await imp(9, [{ staff_id: 'sana.finance@betterwaymortgages.com', branch_id: 'DXB', role_id: '', action: 'DISBURSAL', access_scope: 'ALL', approval_limit_aed: '1000000', escalation_role: 'MD', active_from: '2026-01-01' }]);
  assert.throws(() => assertWithinApprovalLimit(db, fin, 'DISBURSAL', 200_000_000), /exceeds your approval limit.*Escalate to MD/);
  assertWithinApprovalLimit(db, fin, 'DISBURSAL', 90_000_000); assertWithinApprovalLimit(db, admin, 'DISBURSAL', 900_000_000);
  // 10 routing
  await imp(10, [{ source_id: 'S1', channel: 'BAYUT', campaign_code: 'C', routing_rule: 'ROUND_ROBIN', purpose_code: 'P', notice_version: '1', opt_in_method: 'form', suppression_rule: '' }]);
  assert.ok(routeLead(db, 'BAYUT'));
  assert.equal(routeLead(db, 'META'), null);
  // 11 project list
  const proj = db.prepare('SELECT id FROM projects LIMIT 1').get() as { id: number };
  const bank = db.prepare('SELECT id FROM banks LIMIT 1').get() as { id: number };
  const r11 = await imp(11, [{ project_id: String(proj.id), developer_id: 'x', emirate: 'dubai', bank_id: String(bank.id), apl_status: 'blocked', project_stage: 'UC', handover_date: '2027-01-01', date_type: 'PLANNED', bank_confirmation_ref: 'R', effective_from: '2026-01-01', next_review_at: '2026-01-01' }]);
  assert.equal(r11.applied.created, 1);
  assert.equal((db.prepare('SELECT apl_status s FROM bank_project_apl WHERE bank_id = ? AND project_id = ?').get(bank.id, proj.id) as { s: string }).s, 'BLOCKED');
  // 15 opening balances: unbalanced never posts
  const ob = (amt: string) => [{ account_code: '1100', case_id: '', counterparty_id: '', as_of_date: '2026-01-01', balance_type: 'DEBIT', amount_aed: '500', external_ledger_ref: 'L', approver: 'MD' }, { account_code: '3100', case_id: '', counterparty_id: '', as_of_date: '2026-01-01', balance_type: 'CREDIT', amount_aed: amt, external_ledger_ref: 'L', approver: 'MD' }];
  const je0 = (db.prepare('SELECT COUNT(*) c FROM gl_journal_entries').get() as { c: number }).c;
  assert.equal((await imp(15, ob('400'))).applied.created, 0);
  assert.equal((db.prepare('SELECT COUNT(*) c FROM gl_journal_entries').get() as { c: number }).c, je0);
  assert.equal((await imp(15, ob('500'))).applied.created, 2);
  assert.equal((db.prepare('SELECT COUNT(*) c FROM gl_journal_entries').get() as { c: number }).c, je0 + 1);
  // 38 EIBOR
  await imp(38, [{ rate_code: 'EIBOR', tenor_or_currency_pair: '3M', published_at: '2026-11-16', observation_date: '2026-11-16', value: '4.5', source_ref: 'CBUAE', received_at: '2026-11-16', verification_status: 'VERIFIED' }]);
  assert.equal((db.prepare("SELECT three_month_micro v FROM eibor_fixings WHERE fixing_date = '2026-11-16'").get() as { v: number }).v, 450_000);
  // 14 notifications fire on stage change
  await imp(14, [{ template_id: 'KFS_REMINDER', channel: 'WHATSAPP', locale: 'en', trigger: 'STAGE_DOC_COLLECTION', audience: 'CLIENT', approved_version: '2', opt_out_rule: 'STOP', approver: 'MD' }]);
  const d = deal();
  db.prepare("UPDATE applicants SET phone = '+971501', email = 'a@b.ae' WHERE household_id = (SELECT household_id FROM deals WHERE id = ?)").run(d);
  const mlro = user(db, 'farid.mlro@betterwaymortgages.com');
  const { recordKfsAcknowledgement, runApplicantAmlScreening: aml } = await import('@/server/engines/compliance-aml-engine');
  const pid = (db.prepare("SELECT id FROM applicants WHERE household_id = (SELECT household_id FROM deals WHERE id = ?)").get(d) as { id: number }).id;
  recordKfsAcknowledgement(db, { dealId: d, applicantId: pid, disclosedBrokerFeeFils: 0, disclosedLfiCommissionRange: 'x', signedByName: 'T' });
  aml(db, mlro, { dealId: d, applicantId: pid, sourceOfFundsType: 'UAE_SALARY_SAVINGS', verified: true });
  advanceDeal(db, advisor, d);
  const n = db.prepare('SELECT * FROM notifications WHERE deal_id = ?').get(d) as Record<string, string>;
  assert.deepEqual([n.status, n.recipient, n.template_id], ['QUEUED', '+971501', 'KFS_REMINDER']);
  assert.ok(buildExport(db, admin, 47, 'x').rows.length >= 1);
  void evaluateDealAcross24Banks;
});

test('2b non-resident country rules and partner share agreements are applied', async () => {
  const { db, imp, deal } = setup();
  const d = deal();
  db.prepare('UPDATE deals SET target_loan_fils = 60000000 WHERE id = ?').run(d); // 40% LTV so non-resident caps pass
  db.prepare("UPDATE applicants SET residency_type = 'NON_RESIDENT', residence_country = 'GB', currency_code = 'GBP', fx_rate_to_aed_bps = 46000 WHERE household_id = (SELECT household_id FROM deals WHERE id = ?)").run(d);
  const base = evaluateDealAcross24Banks(db, d).eligibleOffers;
  assert.ok(base.length > 0);
  const b = base[0];
  await imp(36, [{ country_code: 'IN', bank_id: String(b.bankId), accepted_income_currency: 'INR', fx_haircut_pct: '10', evidence_type: 'x', translation_rule: '', source_ref: 's', effective_from: '2026-01-01' }]);
  assert.ok(evaluateDealAcross24Banks(db, d).knockouts.some((k) => k.bankId === b.bankId && /no verified rule for GB/.test(k.reason))); // bank lists only India
  await imp(36, [{ country_code: 'GB', bank_id: String(b.bankId), accepted_income_currency: 'GBP', fx_haircut_pct: '20', evidence_type: 'x', translation_rule: '', source_ref: 's', effective_from: '2026-01-01' }]);
  const after = evaluateDealAcross24Banks(db, d).eligibleOffers.find((o) => o.bankId === b.bankId);
  if (after) assert.ok(after.assessableHouseholdIncomeFils < b.assessableHouseholdIncomeFils); // 20% haircut lowers assessable income
});

test('3 every export file in the register is generated', () => {
  const { db, admin } = setup();
  for (const no of [40, 42, 45, 47, 50]) { const { spec, rows } = buildExport(db, admin, no, 'test'); rows.forEach((r) => assert.equal(r.length, spec.columns.length, spec.file)); }
});

test('4 backup and restore drill makes a real copy, verifies it and logs evidence', () => {
  const { db, admin } = setup();
  const r = runBackupAndRestoreTest(db, admin, mkdtempSync(path.join(os.tmpdir(), 'bw-bk-')));
  assert.deepEqual([r.status, r.problems], ['PASS', []]);
  assert.match(r.sha256, /^[0-9a-f]{64}$/);
  assert.equal((db.prepare("SELECT COUNT(*) c FROM data_rows WHERE spec_no = 35 AND data_json LIKE '%BACKUP_RESTORE%'").get() as { c: number }).c, 1);
});

test('5 whatsapp webhook: signature, lead creation, repeat enquiry merges, retries are idempotent; sanctions list import feeds screening', async () => {
  const { db, mlro, advisor } = setup();
  const body = JSON.stringify({ entry: [{ changes: [{ value: { contacts: [{ wa_id: '971501234567', profile: { name: 'Omar' } }], messages: [{ id: 'wamid.1', from: '971501234567', type: 'text', text: { body: 'Need a mortgage' } }] } }] }] });
  const sig = 'sha256=' + createHmac('sha256', 'sek').update(body).digest('hex');
  assert.ok(verifySignature(body, sig, 'sek')); assert.ok(!verifySignature(body, sig, 'other')); assert.ok(!verifySignature(body, null, 'sek'));
  const payload = JSON.parse(body);
  assert.equal(handleWhatsAppPayload(db, payload), 1);
  assert.equal(handleWhatsAppPayload(db, payload), 0); // retry
  payload.entry[0].changes[0].value.messages[0] = { id: 'wamid.2', from: '971501234567', type: 'text', text: { body: 'Any update?' } };
  assert.equal(handleWhatsAppPayload(db, payload), 1);
  assert.equal((db.prepare("SELECT COUNT(*) c FROM leads WHERE contact_phone = '+971501234567'").get() as { c: number }).c, 1);
  assert.ok((db.prepare("SELECT COUNT(*) c FROM comm_messages WHERE body = 'Any update?'").get() as { c: number }).c >= 1);

  const x = await writeXlsx('L', ['Name', 'Source Ref'], [['Rashid Testname Blocked', 'UN-1'], ['Ab', 'short']]);
  await assert.rejects(importSanctionsList(db, advisor, { fileName: 'l.xlsx', bytes: x, listName: 'UN' }), /not permitted/);
  const r = await importSanctionsList(db, mlro, { fileName: 'l.xlsx', bytes: x, listName: 'UN' });
  assert.deepEqual([r.added, r.skipped], [1, 1]);
  const { dealId, primaryApplicantId } = (() => { const lead = db.prepare("INSERT INTO leads (contact_name, contact_phone, first_response_due_at, client_consent_logged_at) VALUES ('Rashid Testname Blocked','+9715',datetime('now'),datetime('now'))").run(); return convertLeadToDeal(db, advisor, { leadId: Number(lead.lastInsertRowid), residencyType: 'EXPAT_RESIDENT', basicSalaryFils: 4_500_000, allowancesFils: 1_500_000, purchasePriceFils: 150_000_000, targetLoanFils: 100_000_000, tenureMonths: 300, emirate: 'dubai', communityName: 'x' }); })();
  runApplicantAmlScreening(db, mlro, { dealId, applicantId: primaryApplicantId, sourceOfFundsType: 'UAE_SALARY_SAVINGS', verified: true });
  assert.equal((db.prepare('SELECT sanctions_match_status s FROM aml_screenings WHERE deal_id = ?').get(dealId) as { s: string }).s, 'CONFIRMED_BLOCK');
});

test('6 MFA (RFC 6238 vector), retention purge needs approval and skips records on hold, incidents close only with evidence', async () => {
  assert.equal(totpCode('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', 59_000), '287082'); // RFC 6238 SHA-1 test vector, 8-digit 94287082 -> last 6
  const s = newTotpSecret(); assert.ok(verifyTotp(s, totpCode(s))); assert.ok(!verifyTotp(s, '000000'));
  const { db, admin, mlro, advisor, imp, deal } = setup();
  startMfa(db, admin); const sec = (db.prepare('SELECT totp_secret t FROM users WHERE id = ?').get(admin.id) as { t: string }).t;
  assert.throws(() => confirmMfa(db, admin, '111111'), /not valid/);
  confirmMfa(db, admin, totpCode(sec));
  assert.equal((db.prepare('SELECT mfa_enabled m FROM users WHERE id = ?').get(admin.id) as { m: number }).m, 1);

  // retention: closed deal with a document, 1-month rule, old closure
  await imp(13, [{ record_type: 'Client documents', processing_purpose: 'mortgage', lawful_basis: 'contract', access_role: 'ADVISOR', retention_trigger: 'DEAL_CLOSED', retention_period: '1 month', processor_id: 'p', hosting_location: 'UAE', transfer_review_ref: '' }]);
  const d = deal();
  db.prepare("UPDATE deals SET stage = 'DECLINED' WHERE id = ?").run(d);
  db.prepare("INSERT INTO audit_logs (actor_role, entity_type, entity_id, action, created_at) VALUES ('SYSTEM','deals',?,'WORKFLOW_DECLINE','2025-01-01 00:00:00')").run(String(d));
  db.prepare(`INSERT INTO vault_documents (doc_uuid, deal_id, doc_category, file_name, mime_type, byte_size, sha256_hash, storage_path, iv_hex, auth_tag_hex) VALUES ('u1', ?, 'PASSPORT', 'p.pdf', 'application/pdf', 1, 'h', '/nonexistent/p.bin', 'i', 't')`).run(d);
  const due = retentionDue(db);
  assert.equal(due.due.length, 1);
  assert.throws(() => purgeRetention(db, advisor, { recordType: 'VAULT_DOCUMENT', ids: [due.due[0].id], approvalRef: 'x' }), /not permitted/);
  assert.throws(() => purgeRetention(db, mlro, { recordType: 'VAULT_DOCUMENT', ids: [due.due[0].id], approvalRef: ' ' }), /Approval reference/);
  db.prepare("INSERT INTO sanadak_complaints (complaint_ref, deal_id, complainant_name, category, description, received_at, ack_due_at, resolution_due_at) VALUES ('C1', ?, 'x', 'FEES', 'd', datetime('now'), datetime('now'), datetime('now'))").run(d);
  assert.equal(retentionDue(db).due.length, 0); // open complaint = hold
  db.prepare("UPDATE sanadak_complaints SET resolved_at = datetime('now')").run();
  const p = purgeRetention(db, mlro, { recordType: 'VAULT_DOCUMENT', ids: [due.due[0].id, 99999], approvalRef: 'APP-1' });
  assert.deepEqual([p.purged, p.skipped], [1, 1]);
  assert.equal((db.prepare('SELECT COUNT(*) c FROM vault_documents').get() as { c: number }).c, 0);

  const inc = openIncident(db, advisor, { kind: 'INCIDENT', subtype: 'LOST_DEVICE', severity: 'HIGH', subject: 'laptop', description: 'lost' });
  assert.match(inc.ref, /^INC-/);
  assert.throws(() => closeIncident(db, mlro, inc.id, ' '), /evidence/i);
  closeIncident(db, mlro, inc.id, 'EV-1');
  assert.equal((db.prepare("SELECT COUNT(*) c FROM ops_tasks WHERE title LIKE '[Privacy]%' AND status = 'OPEN'").get() as { c: number }).c, 0);
  assert.ok(buildExport(db, admin, 32, 'x').rows.some((r) => r[0] === inc.ref));
});

test('7 CRM: repeat enquiries merge instead of duplicating; payouts need approval evidence, different approver, no duplicates, no overpay, and reverse cleanly', () => {
  const { db, admin, fin, deal } = setup();
  const a = intakeExternalLead(db, admin, { contactName: 'Sam', contactPhone: '+971 50 999 8888', contactEmail: 'sam@x.ae' });
  const b = intakeExternalLead(db, admin, { contactName: 'Sam K', contactPhone: '050-999-8888' });
  const c = intakeExternalLead(db, admin, { contactName: 'S', contactPhone: '000', contactEmail: 'SAM@x.ae' });
  assert.deepEqual([b.duplicateOf, c.duplicateOf], [a.leadId, a.leadId]);
  assert.equal((db.prepare("SELECT COUNT(*) c FROM leads WHERE contact_email = 'sam@x.ae'").get() as { c: number }).c, 1);

  const d = deal();
  const s = Number(db.prepare(`INSERT INTO commission_settlements (deal_id, bank_id, disbursed_loan_fils, expected_subvention_ex_vat_fils, partner_released_ex_vat_fils, partner_input_vat_fils, partner_payout_status)
    VALUES (?, 2, 100000000, 500000, 400000, 20000, 'PAYABLE_READY')`).run(d).lastInsertRowid); // AED 4,200 payable
  const other = (db.prepare("SELECT id FROM users WHERE role = 'SUPER_ADMIN' AND id != ? LIMIT 1").get(fin.id) as { id: number }).id;
  const pay = (o: Record<string, any>) => recordPartnerPayout(db, fin, { settlementId: s, amountFils: 100_000, paymentRef: 'PAY-1', approvalRef: 'AP-1', approvedByUserId: other, ...o });
  assert.throws(() => pay({ approvalRef: ' ' }), /both required/);
  assert.throws(() => pay({ approvedByUserId: fin.id }), /Four-eyes/);
  assert.throws(() => pay({ amountFils: 999_999 }), /Overpayment/);
  assert.equal(pay({}).remainingFils, 320_000);
  assert.throws(() => pay({}), /Duplicate payment/);
  const last = pay({ paymentRef: 'PAY-2', amountFils: 320_000 });
  assert.equal(last.remainingFils, 0);
  assert.equal((db.prepare('SELECT partner_payout_status s FROM commission_settlements WHERE id = ?').get(s) as { s: string }).s, 'PAID');
  reversePartnerPayout(db, fin, last.payoutId, 'REV-1');
  assert.equal((db.prepare('SELECT partner_payout_status s FROM commission_settlements WHERE id = ?').get(s) as { s: string }).s, 'PAYABLE_READY');
  assert.equal(pay({ paymentRef: 'PAY-3', amountFils: 320_000 }).remainingFils, 0); // reversed money is payable again
  assert.ok(buildExport(db, admin, 31, 'x').rows.some((r) => String(r[7]).includes('PAY-1')));
});

test('9 public holidays skip business days; backup bank SLA breach shows', async () => {
  const { db, imp, deal } = setup();
  assert.equal(addBusinessDays('2026-11-16', 2), '2026-11-18');
  db.prepare("INSERT INTO public_holidays (day, name) VALUES ('2026-11-17', 'Test holiday')").run();
  const off = new Set(['2026-11-17']);
  assert.equal(addBusinessDays('2026-11-16', 2, off), '2026-11-19');
  const d = deal();
  db.prepare("UPDATE deals SET stage = 'IPA_SUBMITTED', selected_bank_id = 2 WHERE id = ?").run(d);
  const ins = db.prepare("INSERT INTO deal_submissions (deal_id, bank_id, rate_card_id, priority, submitted_loan_fils, calculated_dbr_bps, calculated_ltv_bps, status, created_at) VALUES (?, ?, (SELECT id FROM bank_rate_cards LIMIT 1), ?, 1, 1, 1, 'SUBMITTED', '2026-11-02 09:00:00')");
  ins.run(d, 2, 'PRIMARY'); ins.run(d, 4, 'BACKUP');
  await imp(2, [{ bank_id: '4', contact_role: 'BDM', secure_channel: 'bdm4@bank.ae', stage_code: 'IPA_SUBMITTED', sla_business_days: '2', effective_from: '2026-01-01' }]);
  assert.ok(getDealWorkflow(db, d, '2026-11-20').alerts.some((a) => a.code === 'BANK_SLA_BREACH' && /Backup bank/.test(a.text)));
});

test('2c approved partner agreement sets the subvention share', async () => {
  const { db, fin, imp } = setup();
  const deal = db.prepare('SELECT d.id, pa.agency_id FROM deals d JOIN partner_agents pa ON pa.id = d.partner_agent_id LIMIT 1').get() as { id: number; agency_id: number };
  const { recordDealDisbursal } = await import('@/server/engines/commission-clawback-engine');
  await imp(12, [{ partner_id: String(deal.agency_id), agreement_ref: 'AG-1', effective_from: '2026-01-01', tier: 'GOLD', commission_basis: 'bank subvention', share_pct: '12.5', payout_trigger: 'BANK_CASH', payment_terms_days: '7', clawback_rule: 'x', approver: 'MD' }]);
  recordDealDisbursal(db, fin, { dealId: deal.id, disbursedLoanFils: 100_000_000, disbursedDate: '2026-11-16', fixedExpiryDate: '2028-11-16' });
  assert.equal((db.prepare('SELECT partner_split_bps b FROM commission_settlements WHERE deal_id = ?').get(deal.id) as { b: number }).b, 1250);
});
