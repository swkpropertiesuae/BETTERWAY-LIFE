import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDb } from './index.ts';
import {
  hashPassword,
  verifyPassword,
  createSession,
  resolveSession,
  revokeSession,
  assertMlroAccess,
  getPartnerVisibleDeals,
  getClientVisibleDeals,
} from '../auth/index.ts';
import { encryptVaultBytes, decryptVaultBytes } from '../vault/crypto.ts';

const EXPECTED_41_TABLES = [
  'company_settings',
  'users',
  'sessions',
  'audit_logs',
  'partner_agencies',
  'partner_agents',
  'households',
  'applicants',
  'applicant_liabilities',
  'leads',
  'comm_messages',
  'banks',
  'bank_rate_cards',
  'eibor_fixings',
  'developers',
  'projects',
  'bank_project_apl',
  'bank_bdm_contacts',
  'deals',
  'deal_submissions',
  'conveyancing_cases',
  'vault_documents',
  'homeowner_radar_monitors',
  'cross_sell_referrals',
  'gl_accounts',
  'gl_journal_entries',
  'gl_journal_lines',
  'bank_subvention_grids',
  'bank_bordereau_batches',
  'commission_settlements',
  'clawback_ledger',
  'tax_invoices',
  'vendor_bills',
  'advisor_comp_plans',
  'advisor_comp_slabs',
  'employees',
  'leave_records',
  'payroll_runs',
  'payroll_lines',
  'kfs_acknowledgements',
  'aml_screenings',
  'goaml_reports',
  'sanadak_complaints',
  'wiki_articles',
  'ops_tasks',
];

test('unified SQLite schema initializes all domain tables, enforces foreign keys, and seeds 24 UAE banks & 80 projects', () => {
  const db = createTestDb();
  const rows = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
    .all() as { name: string }[];
  const names = new Set(rows.map((r) => r.name));

  for (const expected of EXPECTED_41_TABLES) {
    assert.equal(names.has(expected), true, `Missing table in unified schema: ${expected}`);
  }

  const fk = db.prepare('PRAGMA foreign_keys').get() as { foreign_keys: number };
  assert.equal(fk.foreign_keys, 1);

  const bankCount = (db.prepare('SELECT COUNT(*) as c FROM banks').get() as { c: number }).c;
  assert.equal(bankCount, 24);

  const projectCount = (db.prepare('SELECT COUNT(*) as c FROM projects').get() as { c: number }).c;
  assert.equal(projectCount, 80);
});

test('audit_logs table is strictly append-only and rejects UPDATE and DELETE mutations', () => {
  const db = createTestDb();
  const res = db
    .prepare(
      `INSERT INTO audit_logs (actor_user_id, actor_role, entity_type, entity_id, action, before_json, after_json, ip_address)
       VALUES (1, 'SUPER_ADMIN', 'deals', '1', 'CREATE', NULL, '{"stage":"FACT_FIND"}', '127.0.0.1')`,
    )
    .run();
  const logId = Number(res.lastInsertRowid);

  assert.throws(() => {
    db.prepare('UPDATE audit_logs SET action = ? WHERE id = ?').run('TAMPERED', logId);
  }, /append-only/i);

  assert.throws(() => {
    db.prepare('DELETE FROM audit_logs WHERE id = ?').run(logId);
  }, /append-only/i);
});

test('password hashing, session lifecycle, and immediate revocation work deterministically', () => {
  const db = createTestDb();
  const hash = hashPassword('Betterway#2026!');
  assert.equal(verifyPassword('Betterway#2026!', hash), true);
  assert.equal(verifyPassword('WrongPass', hash), false);

  const admin = db.prepare("SELECT id FROM users WHERE role = 'SUPER_ADMIN' LIMIT 1").get() as { id: number };
  const token = createSession(db, admin.id, '127.0.0.1', 'UnitTest/1.0');
  const resolved = resolveSession(db, token);
  assert.ok(resolved);
  assert.equal(resolved.id, admin.id);

  revokeSession(db, token);
  assert.equal(resolveSession(db, token), null);
});

test('Chinese-wall guards isolate MLRO goAML access, Partner BRN vs Agency Owner deals, and Borrower household data', () => {
  const db = createTestDb();
  const nonMlroAdmin = db
    .prepare("SELECT * FROM users WHERE role = 'SUPER_ADMIN' AND is_mlro = 0 LIMIT 1")
    .get() as Parameters<typeof assertMlroAccess>[0];
  const mlro = db
    .prepare('SELECT * FROM users WHERE is_mlro = 1 LIMIT 1')
    .get() as Parameters<typeof assertMlroAccess>[0];

  assert.throws(() => assertMlroAccess(nonMlroAdmin), /MLRO/i);
  assert.doesNotThrow(() => assertMlroAccess(mlro));

  const agent1User = db
    .prepare("SELECT * FROM users WHERE email = 'agent.brn1@partner.ae'")
    .get() as Parameters<typeof getPartnerVisibleDeals>[1];
  const agencyOwnerUser = db
    .prepare("SELECT * FROM users WHERE email = 'owner@partner.ae'")
    .get() as Parameters<typeof getPartnerVisibleDeals>[1];

  const agent1View = getPartnerVisibleDeals(db, agent1User);
  const ownerView = getPartnerVisibleDeals(db, agencyOwnerUser);

  assert.ok(agent1View.deals.length >= 1);
  assert.ok(ownerView.deals.length > agent1View.deals.length, 'Agency owner should see deals across all agency BRN agents');
  assert.equal(agent1View.agencyFinancials, null, 'Individual BRN agent must not see agency IBAN or corporate tax invoices');
  assert.ok(ownerView.agencyFinancials?.iban, 'Agency owner sees corporate IBAN');

  for (const masked of ownerView.deals) {
    assert.equal('basic_salary_fils' in masked, false, 'Partner view must never leak borrower salary');
    assert.equal('aecb_score' in masked, false, 'Partner view must never leak borrower AECB score');
  }

  const clientUser = db
    .prepare("SELECT * FROM users WHERE role = 'CLIENT' LIMIT 1")
    .get() as Parameters<typeof getClientVisibleDeals>[1];
  const clientDeals = getClientVisibleDeals(db, clientUser);
  assert.ok(clientDeals.length >= 1);
  const allHouseholdIds = new Set(clientDeals.map((d) => d.household_id));
  assert.equal(allHouseholdIds.size, 1, 'Client must only ever see their own household deals');
});

test('AES-256-GCM vault encryption round-trips binary payloads and rejects tampered ciphertext', () => {
  const masterKey = Buffer.alloc(32, 0x42);
  const plain = Buffer.from('CONFIDENTIAL PASSPORT & 6M BANK STATEMENT PDF PAYLOAD', 'utf8');
  const encrypted = encryptVaultBytes(plain, masterKey);

  assert.notDeepEqual(encrypted.ciphertext, plain);
  const decrypted = decryptVaultBytes(encrypted.ciphertext, masterKey, encrypted.ivHex, encrypted.authTagHex);
  assert.deepEqual(decrypted, plain);

  const tampered = Buffer.from(encrypted.ciphertext);
  tampered[0] ^= 0xff;
  assert.throws(() => {
    decryptVaultBytes(tampered, masterKey, encrypted.ivHex, encrypted.authTagHex);
  });
});
