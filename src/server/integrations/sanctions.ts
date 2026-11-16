// Manual sanctions / watchlist import (UN consolidated list, local terrorist list, internal watchlist) from any CSV/XLSX/JSON file.
// Used by AML screening alongside the built-in watchlist. A live list feed is not connected.
import type { DatabaseSync } from 'node:sqlite';
import { assertRole, writeAuditLog, type UserRecord } from '@/server/auth';
import { fileToTable } from '@/server/data-hub/files';

export async function importSanctionsList(db: DatabaseSync, actor: UserRecord, input: { fileName: string; bytes: Buffer; listName: string }) {
  assertRole(actor, ['COMPLIANCE_MLRO']);
  const t = await fileToTable(input.fileName, input.bytes);
  const head = (t[0] ?? []).map((h) => String(h).trim().toLowerCase().replace(/[\s-]+/g, '_'));
  const nameCol = head.findIndex((h) => ['name', 'full_name', 'entity_name', 'individual_name', 'whole_name'].includes(h));
  if (nameCol < 0) throw new Error('The file needs a column called name (or full_name / entity_name)');
  const refCol = head.indexOf('source_ref');
  const ins = db.prepare('INSERT OR IGNORE INTO sanctions_list_entries (list_name, name_upper, source_ref) VALUES (?, ?, ?)');
  let added = 0, skipped = 0;
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const r of t.slice(1)) {
      const name = String(r[nameCol] ?? '').trim().toUpperCase().replace(/\s+/g, ' ');
      if (name.length < 5) { skipped++; continue; } // very short names would match innocent applicants
      added += Number(ins.run(input.listName || 'IMPORTED', name, refCol >= 0 ? String(r[refCol] ?? '') : '').changes);
    }
    writeAuditLog(db, actor, 'sanctions_list_entries', input.listName, 'SANCTIONS_LIST_IMPORT', null, { added, skipped, file: input.fileName });
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
  return { added, skipped };
}
