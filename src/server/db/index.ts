import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { UNIFIED_SCHEMA_SQL } from './schema';
import { seedInitialData } from './seed';

let singletonDb: DatabaseSync | null = null;

export function initializeDatabase(db: DatabaseSync, shouldSeed = true): DatabaseSync {
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(UNIFIED_SCHEMA_SQL);
  // Columns added after a database file was first created.
  const ensure = (table: string, col: string, ddl: string) => {
    if (!(db.prepare(`PRAGMA table_info('${table}')`).all() as { name: string }[]).some((c) => c.name === col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${ddl}`);
  };
  ensure('data_batches', 'csv_content', "TEXT NOT NULL DEFAULT ''");
  ensure('data_batches', 'applied_rows', 'INTEGER NOT NULL DEFAULT 0');
  ensure('data_rows', 'applied', 'INTEGER NOT NULL DEFAULT 0');
  ensure('users', 'totp_secret', "TEXT NOT NULL DEFAULT ''");
  ensure('users', 'mfa_enabled', 'INTEGER NOT NULL DEFAULT 0');
  ensure('leads', 'lost_reason', "TEXT NOT NULL DEFAULT ''");
  const items: [string, string, string][] = [
    ['Regulatory', 'Confirm LTV caps (resident, non-resident, first/second home, over AED 5M, off-plan) against the current CBUAE rulebook', 'Compliance'],
    ['Regulatory', 'Confirm DLD fees (transfer, mortgage registration, admin, trustee) against the current DLD schedule and import Fees_and_Closing_Costs', 'Finance'],
    ['Regulatory', 'Confirm UAE e-invoicing go-live dates and appoint an Accredited Service Provider', 'Finance'],
    ['Regulatory', 'Confirm AML scope (DNFBP) against the licensed activities and any lender-delegated controls', 'Compliance'],
    ['Regulatory', 'Confirm legal deadlines for data requests and breach notification (PDPL) with counsel', 'Compliance'],
    ['Decision', 'Sign off and fund the historical 24-hour partner payout target (or keep pay-when-paid)', 'Management'],
    ['Decision', 'Sign off commercial / SME lending scope and lender requirements', 'Management'],
    ['Decision', 'Sign off ancillary referral scope (insurance, conveyancing, FX, Golden Visa) and provider agreements', 'Management'],
    ['Data', 'Import bank master, products and rates, eligibility rules, employer policies, SLAs (files 1-5) with source and approver', 'Credit'],
    ['Data', 'Import project list and handover data (file 11) and partner commission rules (file 12)', 'Operations'],
    ['Data', 'Import staff approval matrix (file 9), lead sources and consent (file 10), templates (file 14)', 'Operations'],
    ['Data', 'Load opening balances (file 15) and legacy cases, borrowers, documents, receivables (files 16-22), reconcile and sign off each batch', 'Finance'],
    ['Security', 'Switch MFA on for every admin, finance, compliance and HR user', 'IT'],
    ['Security', 'Set WHATSAPP_VERIFY_TOKEN / WHATSAPP_APP_SECRET and register the webhook (if WhatsApp is used)', 'IT'],
    ['Accounts', 'Open accounts for AECB, UAE PASS, e-signature, OCR and lender APIs, then build the connectors (see Connectors list)', 'IT'],
    ['Operations', 'Add this year\'s public holidays (they move with moon sighting)', 'Operations'],
  ];
  const addItem = db.prepare('INSERT OR IGNORE INTO go_live_items (area, item, owner) VALUES (?, ?, ?)');
  items.forEach((i) => addItem.run(...i));
  if (shouldSeed) {
    seedInitialData(db);
  }
  return db;
}

export function getDb(): DatabaseSync {
  if (singletonDb) return singletonDb;
  const dataDir = path.resolve(process.cwd(), 'data');
  mkdirSync(dataDir, { recursive: true });
  const dbPath = process.env.BW_OS_DB_PATH || path.join(dataDir, 'betterway-os.sqlite');
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA busy_timeout = 5000;');
  initializeDatabase(db, true);
  singletonDb = db;
  return db;
}

export function createTestDb(shouldSeed = true): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  return initializeDatabase(db, shouldSeed);
}
