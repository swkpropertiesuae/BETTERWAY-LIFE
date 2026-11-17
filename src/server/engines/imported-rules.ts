// Imported setup data (Data Hub specs 1, 3, 4, 5) applied to underwriting.
// Safety: imported rules can only TIGHTEN statutory limits (LTV, DBR), never loosen them. Held or expired rows are ignored.
import type { DatabaseSync } from 'node:sqlite';
import { activeRows } from '@/server/data-hub/import';

type Row = Record<string, string>;
export type BankRef = { id: number; bank_key: string; short_name: string; name_en: string };

const norm = (s: unknown) => String(s ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
const ALL = new Set(['', 'all', '*', 'global', 'regulatory', 'cbuae']);
export const isBank = (b: BankRef, v: unknown) => [String(b.id), b.bank_key, b.short_name, b.name_en].map(norm).includes(norm(v));
const pctToBps = (v: string) => Math.round(Number(v) * 100);

export type Segments = Set<string>;
export type EligibilityLimits = { maxLtvBps?: number; maxDbrBps?: number; maxTenorMonths?: number; minIncomeFils?: number; incomeFactor?: number; ids: string[] };

export function loadImportedRules(db: DatabaseSync, asOf?: string) {
  const master = activeRows(db, 1, asOf);
  const products = activeRows(db, 3, asOf);
  const elig = activeRows(db, 4, asOf);
  const pol = activeRows(db, 5, asOf);
  const nonRes = activeRows(db, 36, asOf);
  const any = master.length + products.length + elig.length + pol.length > 0;

  return {
    any,
    bankStatus(b: BankRef): string | null {
      const r = master.find((m) => isBank(b, m.bank_id));
      return r ? r.status.toUpperCase() : null;
    },
    /** Map keyed by product code, or null when nothing is imported for this bank (built-in cards are used). */
    products(b: BankRef): Map<string, Row> | null {
      const rows = products.filter((p) => isBank(b, p.bank_id));
      return rows.length ? new Map(rows.map((r) => [norm(r.product_id), r])) : null;
    },
    eligibility(b: BankRef, segments: Segments, productCode?: string): EligibilityLimits {
      const out: EligibilityLimits = { ids: [] };
      for (const r of elig) {
        if (!ALL.has(norm(r.scope)) && !isBank(b, r.scope)) continue;
        if (r.product_id && norm(r.product_id) !== norm(productCode)) continue; // product-specific rows need a card
        if (!r.product_id && productCode) continue; // bank-level rows are applied once, before cards
        const seg = norm(r.segment_code);
        if (!ALL.has(seg) && !segments.has(seg)) continue;
        out.ids.push(r.rule_id);
        if (r.max_ltv_pct) out.maxLtvBps = Math.min(out.maxLtvBps ?? 10_000, pctToBps(r.max_ltv_pct));
        if (r.max_dbr_pct) out.maxDbrBps = Math.min(out.maxDbrBps ?? 5000, pctToBps(r.max_dbr_pct));
        if (r.max_tenor_months) out.maxTenorMonths = Math.min(out.maxTenorMonths ?? 300, Number(r.max_tenor_months));
        if (r.min_income_aed) out.minIncomeFils = Math.max(out.minIncomeFils ?? 0, Math.round(Number(r.min_income_aed) * 100));
        if (r.income_factor) out.incomeFactor = Math.min(out.incomeFactor ?? 1, Number(r.income_factor)); // never above 1
      }
      return out;
    },
    matchesBank: (b: BankRef, v: unknown) => isBank(b, v),
    matchesProject(db2: DatabaseSync, projectId: unknown, v: string) {
      const p = db2.prepare('SELECT id, slug, name FROM projects WHERE id = ?').get(Number(projectId)) as { id: number; slug: string; name: string } | undefined;
      return !!p && [String(p.id), p.slug, p.name].map(norm).includes(norm(v));
    },
    /** NonResident_Countries_Documents_and_FX (spec 36). null = no imported rules for this bank (built-in non-resident policy applies). */
    nonResident(b: BankRef, country: string, currency: string): { allowed: boolean; haircutBps: number } | null {
      const rows = nonRes.filter((r) => isBank(b, r.bank_id));
      if (!rows.length) return null;
      const m = rows.filter((r) => norm(r.country_code) === norm(country) || ALL.has(norm(r.country_code)));
      if (!m.length) return { allowed: false, haircutBps: 0 };
      const cur = m.filter((r) => !r.accepted_income_currency || norm(r.accepted_income_currency) === norm(currency));
      return cur.length ? { allowed: true, haircutBps: Math.max(...cur.map((r) => (r.fx_haircut_pct ? pctToBps(r.fx_haircut_pct) : 0))) } : { allowed: false, haircutBps: 0 };
    },
    policies(b: BankRef) {
      return pol.filter((p) => isBank(b, p.bank_id));
    },
  };
}
export type ImportedRules = ReturnType<typeof loadImportedRules>;

export function segmentsFor(deal: Record<string, unknown>, applicants: Record<string, unknown>[]): Segments {
  const s: Segments = new Set();
  for (const a of applicants) { s.add(norm(a.residency_type)); s.add(norm(a.employment_type)); }
  s.add(Number(deal.is_first_home) === 1 ? 'first_home' : 'second_home');
  s.add(norm(deal.property_status)); s.add(norm(deal.transaction_type));
  return s;
}
