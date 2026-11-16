import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDb } from '@/server/db';
import type { UserRecord } from '@/server/auth';
import { convertLeadToDeal } from '@/server/services/os-service';
import { recordKfsAcknowledgement, runApplicantAmlScreening } from './compliance-aml-engine';
import { advanceDeal, applyException, classifyDeal, getDealWorkflow, pathFor } from './workflow-engine';
import { PLAYBOOKS } from './scenarios';

const user = (db: ReturnType<typeof createTestDb>, email: string) =>
  db.prepare('SELECT * FROM users WHERE email = ?').get(email) as UserRecord;

function mkDeal(db: ReturnType<typeof createTestDb>, o: { type?: string; residency?: string; employment?: string } = {}) {
  const advisor = user(db, 'tariq.advisor@betterwaymortgages.com');
  const lead = db
    .prepare("INSERT INTO leads (contact_name, contact_phone, transaction_type, first_response_due_at, client_consent_logged_at) VALUES ('Test Client','+971500000001',?, datetime('now'), datetime('now'))")
    .run(o.type ?? 'READY_PURCHASE');
  const r = convertLeadToDeal(db, advisor, {
    leadId: Number(lead.lastInsertRowid),
    residencyType: (o.residency as 'EXPAT_RESIDENT') ?? 'EXPAT_RESIDENT',
    employmentType: (o.employment as 'SALARIED') ?? 'SALARIED',
    basicSalaryFils: 4_500_000, allowancesFils: 1_500_000,
    purchasePriceFils: 150_000_000, targetLoanFils: 100_000_000, tenureMonths: 300,
    emirate: 'dubai', communityName: 'Dubai Hills Estate',
  });
  return { ...r, advisor };
}

test('every playbook tag is unique-id and has steps', () => {
  const ids = new Set(PLAYBOOKS.map((p) => p.id));
  assert.equal(ids.size, PLAYBOOKS.length);
  assert.ok(PLAYBOOKS.every((p) => p.steps.length >= 3 && p.owner));
});

test('paths skip MOU for buyout, equity release and construction only', () => {
  assert.ok(pathFor('READY_PURCHASE').includes('MOU_SIGNED'));
  for (const t of ['BUYOUT', 'EQUITY_RELEASE', 'CONSTRUCTION']) assert.ok(!pathFor(t).includes('MOU_SIGNED'));
});

test('forward moves are guarded: KFS/CDD then documents, and cannot be skipped', () => {
  const db = createTestDb();
  const { dealId, primaryApplicantId, advisor } = mkDeal(db);
  assert.equal(getDealWorkflow(db, dealId).stage, 'KFS_PENDING'); // convertLeadToDeal starts at KFS_PENDING
  assert.throws(() => advanceDeal(db, advisor, dealId), /KFS/);

  const mlro = user(db, 'farid.mlro@betterwaymortgages.com');
  recordKfsAcknowledgement(db, { dealId, applicantId: primaryApplicantId, disclosedBrokerFeeFils: 0, disclosedLfiCommissionRange: '0.45%', signedByName: 'Test' });
  runApplicantAmlScreening(db, mlro, { dealId, applicantId: primaryApplicantId, sourceOfFundsType: 'UAE_SALARY_SAVINGS', verified: true });
  assert.equal(advanceDeal(db, advisor, dealId).stage, 'DOC_COLLECTION');

  // documents missing blocks underwriting
  assert.throws(() => advanceDeal(db, advisor, dealId), /Missing document/);
  const wf = getDealWorkflow(db, dealId);
  assert.ok(wf.documents.missing.some((m) => m.startsWith('SALARY_CERT')));
  assert.ok(wf.nextAction.text.startsWith('Resolve'));

  // underwriting -> IPA must go through the bank submission screen
  db.prepare("UPDATE deals SET stage = 'UNDERWRITING_READY' WHERE id = ?").run(dealId);
  assert.throws(() => advanceDeal(db, advisor, dealId), /Submit to banks/);
});

test('scenario classification: self-employed non-resident off-plan joint PEP islamic', () => {
  const db = createTestDb();
  const { dealId, advisor } = mkDeal(db, { residency: 'NON_RESIDENT', employment: 'SELF_EMPLOYED' });
  db.prepare("UPDATE deals SET property_status = 'OFFPLAN_UNDER_CONSTRUCTION', finance_preference = 'ISLAMIC_ONLY', is_first_home = 0 WHERE id = ?").run(dealId);
  db.prepare("UPDATE applicants SET is_pep = 1 WHERE household_id = (SELECT household_id FROM deals WHERE id = ?)").run(dealId);
  const tags = classifyDeal(db, dealId);
  for (const t of ['SELF_EMPLOYED', 'NON_RESIDENT', 'OFFPLAN_HANDOVER', 'ISLAMIC', 'SECOND_HOME', 'PEP']) assert.ok(tags.includes(t), t);
  const wf = getDealWorkflow(db, dealId);
  assert.ok(wf.playbooks.length >= 6);
  // non-resident needs no Emirates ID / AECB; self-employed needs trade licence
  assert.ok(!wf.documents.required.some((d) => d.startsWith('EMIRATES_ID')));
  assert.ok(wf.documents.required.some((d) => d.startsWith('TRADE_LICENCE')));
  assert.ok(advisor);
});

test('exceptions: withdraw needs reason, creates nurture task, reopen works; bank decline promotes backup', () => {
  const db = createTestDb();
  const { dealId, advisor } = mkDeal(db);
  assert.throws(() => applyException(db, advisor, dealId, 'WITHDRAW', { reason: ' ' }), /reason/);
  applyException(db, advisor, dealId, 'WITHDRAW', { reason: 'Seller pulled out' });
  const w = getDealWorkflow(db, dealId);
  assert.equal(w.stage, 'WITHDRAWN');
  assert.ok(w.closed && w.exceptions.some((e) => e.kind === 'REOPEN'));
  const t = db.prepare("SELECT COUNT(*) c FROM ops_tasks WHERE deal_id = ? AND status = 'OPEN' AND title LIKE '%Nurture%'").get(dealId) as { c: number };
  assert.equal(t.c, 1);
  applyException(db, advisor, dealId, 'REOPEN', { reason: 'Client back', targetStage: 'FACT_FIND' });
  assert.equal(getDealWorkflow(db, dealId).stage, 'FACT_FIND');

  // decline with backup
  db.prepare("UPDATE deals SET stage = 'IPA_SUBMITTED' WHERE id = ?").run(dealId);
  const ins = db.prepare(
    `INSERT INTO deal_submissions (deal_id, bank_id, rate_card_id, priority, submitted_loan_fils, calculated_dbr_bps, calculated_ltv_bps, status)
     VALUES (?, ?, (SELECT id FROM bank_rate_cards LIMIT 1), ?, 1, 1, 1, ?)`,
  );
  ins.run(dealId, 2, 'PRIMARY', 'IPA_DECLINED');
  ins.run(dealId, 4, 'BACKUP', 'SUBMITTED');
  assert.ok(getDealWorkflow(db, dealId).alerts.some((a) => a.code === 'BANK_DECLINED'));
  applyException(db, advisor, dealId, 'PROMOTE_BACKUP', { reason: 'Primary declined' });
  const d = db.prepare('SELECT selected_bank_id, stage FROM deals WHERE id = ?').get(dealId) as { selected_bank_id: number; stage: string };
  assert.equal(d.selected_bank_id, 4);
  assert.equal(d.stage, 'IPA_SUBMITTED');
});

test('down-valuation blocks FOL until an action is chosen; disbursed deals cannot be withdrawn', () => {
  const db = createTestDb();
  const { dealId, advisor } = mkDeal(db);
  db.prepare("UPDATE deals SET stage = 'VALUATION_RECEIVED' WHERE id = ?").run(dealId);
  db.prepare('INSERT OR IGNORE INTO conveyancing_cases (deal_id) VALUES (?)').run(dealId);
  db.prepare("UPDATE conveyancing_cases SET valuation_firm = 'Firm', valuation_amount_fils = 140000000 WHERE deal_id = ?").run(dealId);
  assert.ok(getDealWorkflow(db, dealId).blockers.some((b) => b.includes('below price')));
  db.prepare("UPDATE conveyancing_cases SET valuation_shortfall_action = 'BUYER_TOP_UP' WHERE deal_id = ?").run(dealId);
  assert.ok(!getDealWorkflow(db, dealId).blockers.some((b) => b.includes('below price')));

  db.prepare("UPDATE deals SET stage = 'TRANSFERRED_DISBURSED' WHERE id = ?").run(dealId);
  assert.throws(() => applyException(db, advisor, dealId, 'WITHDRAW', { reason: 'x' }), /clawback/i);
});

test('IPA expiry and FOL lapse raise critical alerts', () => {
  const db = createTestDb();
  const { dealId } = mkDeal(db);
  db.prepare("UPDATE deals SET stage = 'IPA_APPROVED' WHERE id = ?").run(dealId);
  db.prepare(
    `INSERT INTO deal_submissions (deal_id, bank_id, rate_card_id, priority, submitted_loan_fils, calculated_dbr_bps, calculated_ltv_bps, status, ipa_expires_at)
     VALUES (?, 2, (SELECT id FROM bank_rate_cards LIMIT 1), 'PRIMARY', 1, 1, 1, 'IPA_APPROVED', '2026-01-01')`,
  ).run(dealId);
  db.prepare('INSERT OR IGNORE INTO conveyancing_cases (deal_id) VALUES (?)').run(dealId);
  db.prepare("UPDATE conveyancing_cases SET fol_contingency_date = '2026-02-01' WHERE deal_id = ?").run(dealId);
  const codes = getDealWorkflow(db, dealId, '2026-03-01').alerts.map((a) => a.code);
  assert.ok(codes.includes('IPA_EXPIRED') && codes.includes('FOL_LAPSED'));
});
