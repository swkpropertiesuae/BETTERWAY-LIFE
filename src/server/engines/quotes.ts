// Versioned, advisor-approved quotes (requirement 05) with saved inputs, rule version and reason codes (requirement 03).
import type { DatabaseSync } from 'node:sqlite';
import { assertRole, writeAuditLog, type UserRecord } from '@/server/auth';
import { evaluateDealAcross24Banks } from './underwriting-engine';
import { activeRows } from '@/server/data-hub/import';

type Row = Record<string, any>;
const QUOTE_ROLES = ['SUPER_ADMIN', 'SALES_ADVISOR', 'CREDIT_UNDERWRITER'] as const;
const fils = (aed: string | number) => Math.round(Number(aed) * 100);

/** Closing costs: configured Fees_and_Closing_Costs rows when present, else Dubai defaults (DLD 4% transfer, 0.25% + AED 290 mortgage registration). */
export function estimateFees(db: DatabaseSync, deal: Row, arrangementFeeFils: number) {
  const price = Number(deal.purchase_price_fils), loan = Number(deal.target_loan_fils);
  const cfg = activeRows(db, 7).filter((r) => (!r.emirate || r.emirate.toLowerCase() === String(deal.emirate).toLowerCase()) && (!r.transaction_type || r.transaction_type === deal.transaction_type || r.transaction_type === '*'));
  let govFees = 0;
  const lines: { name: string; fils: number }[] = [];
  if (cfg.length) {
    for (const r of cfg) {
      const f = (r.rate_pct ? Math.round((price * Number(r.rate_pct) * 100) / 10_000) : 0) + (r.fixed_amount_aed ? fils(r.fixed_amount_aed) : 0);
      if (r.payer && !/buyer|client|borrower/i.test(r.payer)) continue;
      lines.push({ name: `${r.authority || ''} ${r.fee_type}`.trim(), fils: f }); govFees += f;
    }
  } else {
    const dld = Math.round(price * 0.04), mort = Math.round(loan * 0.0025) + 29_000;
    lines.push({ name: 'DLD transfer 4% (default)', fils: dld }, { name: 'Mortgage registration 0.25% + AED 290 (default)', fils: mort });
    govFees = dld + mort;
  }
  lines.push({ name: 'Bank arrangement fee', fils: arrangementFeeFils }, { name: 'Broker fee (client)', fils: Number(deal.direct_client_fee_fils) });
  const total = govFees + arrangementFeeFils + Number(deal.direct_client_fee_fils);
  return { lines, cashToCloseFils: Math.max(0, price - loan) + total, downPaymentFils: Math.max(0, price - loan), feesFils: total };
}

export function currentRuleVersion(db: DatabaseSync) {
  const b = db.prepare('SELECT MAX(id) id FROM data_batches WHERE spec_no IN (3,4,5)').get() as { id: number | null };
  return b.id ? `RULES-B${b.id}` : 'RULES-BUILTIN-1';
}

export function saveQuote(db: DatabaseSync, actor: UserRecord, dealId: number) {
  assertRole(actor, [...QUOTE_ROLES]);
  const deal = db.prepare('SELECT * FROM deals WHERE id = ?').get(dealId) as Row | undefined;
  if (!deal) throw new Error(`Deal ${dealId} not found`);
  const uw = evaluateDealAcross24Banks(db, dealId);
  const top = uw.eligibleOffers.slice(0, 5).map((o) => ({
    ...o, fees: estimateFees(db, deal, o.arrangementFeeFils),
  }));
  if (!top.length) throw new Error('No eligible offers to quote. Restructure the case first (see playbook P40).');
  const inputs = { price: deal.purchase_price_fils, loan: deal.target_loan_fils, tenureMonths: deal.tenure_months, finance: deal.finance_preference, firstHome: deal.is_first_home, emirate: deal.emirate };
  const version = ((db.prepare('SELECT MAX(version) v FROM deal_quotes WHERE deal_id = ?').get(dealId) as { v: number | null }).v ?? 0) + 1;
  const expires = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);
  const r = db
    .prepare(`INSERT INTO deal_quotes (deal_id, version, inputs_json, offers_json, knockouts_json, rule_version, cash_to_close_fils, expires_at, created_by)
              VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(dealId, version, JSON.stringify(inputs), JSON.stringify(top), JSON.stringify(uw.knockouts.map((k) => ({ bank: k.bankName, reason: k.reason }))), currentRuleVersion(db), top[0].fees.cashToCloseFils, expires, actor.id);
  writeAuditLog(db, actor, 'deals', dealId, 'QUOTE_SAVED', null, { version, rule: currentRuleVersion(db) });
  return { id: Number(r.lastInsertRowid), version };
}

export function approveQuote(db: DatabaseSync, actor: UserRecord, quoteId: number, overrideReason = '') {
  assertRole(actor, [...QUOTE_ROLES]);
  const q = db.prepare('SELECT * FROM deal_quotes WHERE id = ?').get(quoteId) as Row | undefined;
  if (!q) throw new Error('Quote not found');
  if (q.status !== 'DRAFT') throw new Error('Only a draft quote can be approved');
  const stale = db.prepare('SELECT target_loan_fils, purchase_price_fils FROM deals WHERE id = ?').get(q.deal_id) as Row;
  const inp = JSON.parse(q.inputs_json);
  const changed = inp.loan !== stale.target_loan_fils || inp.price !== stale.purchase_price_fils;
  if (changed && !overrideReason.trim()) throw new Error('Deal terms changed since this quote. Save a new quote, or give an override reason.');
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare("UPDATE deal_quotes SET status = 'SUPERSEDED' WHERE deal_id = ? AND status = 'APPROVED'").run(q.deal_id);
    db.prepare("UPDATE deal_quotes SET status = 'APPROVED', approved_by = ?, approved_at = datetime('now'), override_reason = ? WHERE id = ?").run(actor.id, overrideReason.trim(), quoteId);
    writeAuditLog(db, actor, 'deals', q.deal_id, 'QUOTE_APPROVED', null, { version: q.version, override: overrideReason.trim() || null });
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
}

export function approvedQuote(db: DatabaseSync, dealId: number, asOf = new Date().toISOString().slice(0, 10)) {
  return db.prepare("SELECT * FROM deal_quotes WHERE deal_id = ? AND status = 'APPROVED' AND expires_at >= ? ORDER BY version DESC LIMIT 1").get(dealId, asOf) as Row | undefined;
}
