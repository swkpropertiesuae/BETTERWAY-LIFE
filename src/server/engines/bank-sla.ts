// Bank_Contacts_and_SLAs (spec 02): per-bank, per-stage turnaround in business days (Mon-Fri) and secure contacts.
import type { DatabaseSync } from 'node:sqlite';
import { activeRows } from '@/server/data-hub/import';
import { isBank, type BankRef } from './imported-rules';

const iso = (d: Date) => d.toISOString().slice(0, 10);
const isWorkday = (d: Date) => ![0, 6].includes(d.getUTCDay());

export function addBusinessDays(from: string, n: number): string {
  const d = new Date(`${from.slice(0, 10)}T00:00:00Z`);
  for (let left = n; left > 0; ) { d.setUTCDate(d.getUTCDate() + 1); if (isWorkday(d)) left--; }
  return iso(d);
}
export function businessDaysBetween(from: string, to: string): number {
  const d = new Date(`${from.slice(0, 10)}T00:00:00Z`), end = new Date(`${to.slice(0, 10)}T00:00:00Z`);
  let n = 0;
  while (d < end) { d.setUTCDate(d.getUTCDate() + 1); if (isWorkday(d)) n++; }
  return n;
}

export type BankSla = { bankName: string; days: number | null; contacts: { role: string; channel: string }[] };

/** SLA and contacts for a bank at a stage. A row with a blank stage_code applies to any stage; an exact stage row wins. */
export function bankSla(db: DatabaseSync, bankId: number, stage: string, asOf?: string): BankSla | null {
  const b = db.prepare('SELECT id, bank_key, short_name, name_en FROM banks WHERE id = ?').get(bankId) as BankRef | undefined;
  if (!b) return null;
  const rows = activeRows(db, 2, asOf).filter((r) => isBank(b, r.bank_id));
  if (!rows.length) return null;
  const at = rows.filter((r) => !r.stage_code || r.stage_code.toUpperCase() === stage);
  const exact = at.filter((r) => r.stage_code);
  const withDays = (exact.length ? exact : at).find((r) => r.sla_business_days);
  return {
    bankName: b.name_en,
    days: withDays ? Number(withDays.sla_business_days) : null,
    contacts: rows.filter((r) => !r.stage_code || r.stage_code.toUpperCase() === stage).map((r) => ({ role: r.contact_role, channel: r.secure_channel })),
  };
}
