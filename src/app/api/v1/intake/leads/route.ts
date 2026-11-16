import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getDb } from '@/server/db';
import { intakeExternalLead } from '@/server/services/os-service';

const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.BW_PUBLIC_SITE_ORIGIN || 'http://localhost:3000',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Betterway-Signature',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const hmacSecret = process.env.BW_INTAKE_HMAC_SECRET;
    if (hmacSecret) {
      const provided = (req.headers.get('x-betterway-signature') || '').replace(/^sha256=/, '');
      const expected = createHmac('sha256', hmacSecret).update(rawBody).digest('hex');
      const provBuf = Buffer.from(provided, 'hex');
      const expBuf = Buffer.from(expected, 'hex');
      if (provBuf.length !== expBuf.length || !timingSafeEqual(provBuf, expBuf)) {
        return NextResponse.json({ error: 'Invalid webhook HMAC signature' }, { status: 401, headers: corsHeaders });
      }
    }

    const payload = JSON.parse(rawBody);
    const contactName = String(payload.contactName || payload.name || '').trim();
    const contactPhone = String(payload.contactPhone || payload.phone || '').trim();
    if (!contactName || !contactPhone) {
      return NextResponse.json({ error: 'contactName and contactPhone are required' }, { status: 400, headers: corsHeaders });
    }

    const result = intakeExternalLead(getDb(), null, {
      contactName,
      contactPhone,
      contactEmail: String(payload.contactEmail || payload.email || ''),
      sourceChannel: payload.sourceChannel || 'WEBSITE_CALC',
      transactionType: payload.transactionType || 'READY_PURCHASE',
      targetPropertyFils: Math.round(Number(payload.propertyPriceAed || 0) * 100),
      calculatorSnapshot: payload.calculatorSnapshot ?? payload,
      initialMessage: payload.notes ? String(payload.notes) : undefined,
    });

    return NextResponse.json({ ok: true, leadId: result.leadId }, { status: 201, headers: corsHeaders });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Lead intake failed' },
      { status: 400, headers: corsHeaders },
    );
  }
}
