import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { UNIFIED_SCHEMA_SQL } from './schema';
import { seedInitialData } from './seed';

let singletonDb: DatabaseSync | null = null;

export function initializeDatabase(db: DatabaseSync, shouldSeed = true): DatabaseSync {
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(UNIFIED_SCHEMA_SQL);
  // Databases created before these columns existed.
  const cols = (db.prepare("PRAGMA table_info('data_batches')").all() as { name: string }[]).map((c) => c.name);
  if (!cols.includes('csv_content')) db.exec("ALTER TABLE data_batches ADD COLUMN csv_content TEXT NOT NULL DEFAULT ''");
  if (!cols.includes('applied_rows')) db.exec('ALTER TABLE data_batches ADD COLUMN applied_rows INTEGER NOT NULL DEFAULT 0');
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
