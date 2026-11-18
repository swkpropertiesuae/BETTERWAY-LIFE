import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getDb } from '@/server/db';
import { ingestWebsiteLeadToOs } from '@/server/engines/swk-enterprise-engine';

const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.BW_PUBLIC_SITE_ORIGIN || '*',
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
    const sigHeader = req.headers.get('x-betterway-signature');
    if (hmacSecret && sigHeader) {
      const provided = sigHeader.replace(/^sha256=/, '');
      const expected = createHmac('sha256', hmacSecret).update(rawBody).digest('hex');
      const provBuf = Buffer.from(provided, 'hex');
      const expBuf = Buffer.from(expected, 'hex');
      if (provBuf.length !== expBuf.length || !timingSafeEqual(provBuf, expBuf)) {
        return NextResponse.json({ error: 'Invalid webhook HMAC signature' }, { status: 401, headers: corsHeaders });
      }
    }

    const payload = JSON.parse(rawBody);
    const contactName = String(payload.contactName || payload.fullName || payload.name || '').trim();
    const contactPhone = String(payload.contactPhone || payload.phone || '').trim();
    if (!contactName || !contactPhone) {
      return NextResponse.json(
        { error: 'contactName and contactPhone are required' },
        { status: 400, headers: corsHeaders },
      );
    }

    const result = ingestWebsiteLeadToOs(getDb(), {
      fullName: contactName,
      phone: contactPhone,
      email: String(payload.contactEmail || payload.email || ''),
      residency: String(payload.residency || 'Expat resident'),
      goal: String(payload.goal || payload.transactionType || 'Buy a ready home'),
      propertyValueAed: Number(payload.propertyPriceAed || payload.propertyValueAed || payload.price || 2_500_000),
      downPaymentPct: Number(payload.downPaymentPct || 20),
      monthlyIncomeAed: Number(payload.monthlyIncomeAed || 45_000),
      topic: String(payload.topic || 'Website Mortgage Enquiry'),
      preferredSlot: payload.preferredSlot ? String(payload.preferredSlot) : undefined,
      sourcePage: payload.sourcePage ? String(payload.sourcePage) : undefined,
      agencyName: payload.agencyName ? String(payload.agencyName) : undefined,
      reraOrn: payload.reraOrn ? String(payload.reraOrn) : undefined,
      reraBrn: payload.reraBrn ? String(payload.reraBrn) : undefined,
    });

    return NextResponse.json(
      {
        ok: true,
        leadId: result.leadId,
        referenceCode: result.referenceCode,
        assignedAdvisor: {
          name: result.assignedAdvisor.fullNameEn,
          designation: result.assignedAdvisor.designation,
          email: result.assignedAdvisor.email,
        },
      },
      { status: 201, headers: corsHeaders },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Lead intake failed' },
      { status: 400, headers: corsHeaders },
    );
  }
}
