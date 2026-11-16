// WhatsApp Business Cloud API, inbound only. Verifies Meta's signature and turns messages into CRM leads / thread messages.
// Outbound messages stay in the notification outbox and are sent by staff (no provider adapter configured).
import type { DatabaseSync } from 'node:sqlite';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { intakeExternalLead } from '@/server/services/os-service';

export function verifySignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!secret || !header?.startsWith('sha256=')) return false;
  const want = Buffer.from(createHmac('sha256', secret).update(rawBody).digest('hex'));
  const got = Buffer.from(header.slice(7));
  return want.length === got.length && timingSafeEqual(want, got);
}

type Payload = { entry?: { changes?: { value?: { contacts?: { wa_id: string; profile?: { name?: string } }[]; messages?: { id: string; from: string; type: string; text?: { body: string } }[] } }[] }[] };

export function handleWhatsAppPayload(db: DatabaseSync, payload: Payload) {
  let handled = 0;
  for (const e of payload.entry ?? []) for (const c of e.changes ?? []) {
    const v = c.value; if (!v?.messages) continue;
    for (const m of v.messages) {
      if (db.prepare("SELECT 1 FROM audit_logs WHERE action = 'WHATSAPP_INBOUND' AND entity_id = ?").get(m.id)) continue; // Meta retries: idempotent
      const name = v.contacts?.find((x) => x.wa_id === m.from)?.profile?.name || `WhatsApp ${m.from}`;
      const body = m.type === 'text' ? m.text?.body ?? '' : `[${m.type} message, open WhatsApp to view]`;
      const r = intakeExternalLead(db, null, { contactName: name, contactPhone: `+${m.from}`, sourceChannel: 'WHATSAPP', initialMessage: body });
      if (r.duplicateOf) db.prepare("INSERT INTO comm_messages (lead_id, channel, direction, sender_name, body, internal_only) VALUES (?, 'WHATSAPP', 'INBOUND', ?, ?, 0)").run(r.leadId, name, body);
      db.prepare("INSERT INTO audit_logs (actor_role, entity_type, entity_id, action) VALUES ('SYSTEM','leads',?, 'WHATSAPP_INBOUND')").run(m.id);
      handled++;
    }
  }
  return handled;
}
