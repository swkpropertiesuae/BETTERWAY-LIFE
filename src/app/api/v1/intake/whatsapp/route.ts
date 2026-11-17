import { NextResponse } from 'next/server';
import { getDb } from '@/server/db';
import { handleWhatsAppPayload, verifySignature } from '@/server/integrations/whatsapp';

// Meta webhook verification handshake
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const token = process.env.WHATSAPP_VERIFY_TOKEN;
  if (token && q.get('hub.mode') === 'subscribe' && q.get('hub.verify_token') === token) return new NextResponse(q.get('hub.challenge') ?? '', { status: 200 });
  return NextResponse.json({ error: 'Not configured or token mismatch' }, { status: 403 });
}

export async function POST(req: Request) {
  const secret = process.env.WHATSAPP_APP_SECRET ?? '';
  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get('x-hub-signature-256'), secret)) return NextResponse.json({ error: 'Bad signature' }, { status: 401 });
  let payload;
  try { payload = JSON.parse(raw); } catch { return NextResponse.json({ error: 'Bad JSON' }, { status: 400 }); }
  return NextResponse.json({ ok: true, handled: handleWhatsAppPayload(getDb(), payload) });
}
