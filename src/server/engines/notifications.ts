// Templates_and_Notification_Rules (spec 14): approved templates fire on workflow triggers into an outbox.
// Delivery is manual or by a provider adapter (not configured): the outbox is the record of what should be sent.
import type { DatabaseSync } from 'node:sqlite';
import { activeRows } from '@/server/data-hub/import';

type Row = Record<string, any>;
const norm = (s: unknown) => String(s ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_');

export function queueNotifications(db: DatabaseSync, trigger: string, dealId: number): number {
  const rules = activeRows(db, 14).filter((r) => norm(r.trigger) === norm(trigger));
  if (!rules.length) return 0;
  const deal = db.prepare('SELECT d.deal_ref, d.household_id, a.full_name_en name, a.email, a.phone FROM deals d LEFT JOIN applicants a ON a.household_id = d.household_id AND a.applicant_role = \'PRIMARY\' WHERE d.id = ?').get(dealId) as Row | undefined;
  if (!deal) return 0;
  const ins = db.prepare('INSERT INTO notifications (deal_id, template_id, channel, locale, recipient, trigger, body, status, note) VALUES (?,?,?,?,?,?,?,?,?)');
  let n = 0;
  for (const r of rules) {
    const channel = norm(r.channel);
    const toClient = /CLIENT|BORROWER|CUSTOMER/.test(norm(r.audience));
    const recipient = toClient ? (channel === 'EMAIL' ? deal.email : deal.phone) || '' : norm(r.audience);
    const art = db.prepare('SELECT body_en, body_ar FROM wiki_articles WHERE lower(slug) = lower(?) OR lower(title_en) = lower(?)').get(r.template_id, r.template_id) as Row | undefined;
    const text = (r.locale?.toLowerCase().startsWith('ar') ? art?.body_ar : art?.body_en) || `Template ${r.template_id} v${r.approved_version} (no body text stored in the wiki)`;
    const body = text.replace(/\{deal_ref\}/g, deal.deal_ref).replace(/\{client\}/g, deal.name ?? '');
    const skip = toClient && !recipient ? 'No contact detail for the client' : /opt.?out/i.test(r.opt_out_rule) && toClient && !recipient ? 'Opted out' : '';
    ins.run(dealId, r.template_id, channel, r.locale || 'en', recipient, trigger, body, skip ? 'SKIPPED' : 'QUEUED', skip);
    n++;
  }
  return n;
}
