// Fees_and_Closing_Costs (spec 07) resolver, shared by the quote and the conveyancing cheque pack.
// Known fee_type values: DLD_TRANSFER, MORTGAGE_REGISTRATION, TRUSTEE, AGENCY, TITLE_DEED (anything else is an "other" buyer cost).
import type { DatabaseSync } from 'node:sqlite';
import { activeRows } from '@/server/data-hub/import';

type Row = Record<string, any>;
export type ConfiguredFee = { type: string; name: string; fils: number; payer: string; buyerPays: boolean };

const norm = (s: unknown) => String(s ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_');
const ANY = new Set(['', '*', 'ALL']);

export function configuredFees(db: DatabaseSync, deal: Row, asOf?: string): Map<string, ConfiguredFee> {
  const price = Number(deal.purchase_price_fils), loan = Number(deal.target_loan_fils);
  const best = new Map<string, { score: number; from: string; fee: ConfiguredFee }>();
  for (const r of activeRows(db, 7, asOf)) {
    if (!ANY.has(norm(r.emirate)) && norm(r.emirate) !== norm(deal.emirate)) continue;
    if (!ANY.has(norm(r.transaction_type)) && norm(r.transaction_type) !== norm(deal.transaction_type)) continue;
    const type = norm(r.fee_type);
    const base = type === 'MORTGAGE_REGISTRATION' ? loan : price;
    let fils = Math.round((base * Number(r.rate_pct || 0)) / 100) + Math.round(Number(r.fixed_amount_aed || 0) * 100);
    if (/EXCL|STANDARD|5/.test(norm(r.vat_treatment)) && !/EXEMPT|ZERO|INCL/.test(norm(r.vat_treatment))) fils = Math.round(fils * 1.05);
    const payer = norm(r.payer) || 'BUYER';
    const score = ANY.has(norm(r.transaction_type)) ? 0 : 1; // exact transaction type beats a generic row
    const from = r.effective_from || '';
    const cur = best.get(type);
    if (!cur || score > cur.score || (score === cur.score && from > cur.from))
      best.set(type, { score, from, fee: { type, name: `${r.authority || ''} ${r.fee_type}`.trim(), fils, payer, buyerPays: /BUYER|CLIENT|BORROWER/.test(payer) } });
  }
  return new Map([...best].map(([k, v]) => [k, v.fee]));
}
