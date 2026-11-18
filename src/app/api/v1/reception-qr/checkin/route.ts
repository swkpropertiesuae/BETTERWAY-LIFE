import { NextResponse } from 'next/server';
import { getDb } from '@/server/db';
import { verifyAndRecordPublicQrCheckIn } from '@/server/engines/swk-enterprise-engine';

export async function GET(req: Request) {
  const forwarded = req.headers.get('x-forwarded-for') || '127.0.0.1';
  return NextResponse.json({
    ssid: 'Betterway-Office-5G',
    detected_client_ip: forwarded.split(',')[0]!.trim(),
    ip_matches_office: true,
    strict_ip: false,
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const res = verifyAndRecordPublicQrCheckIn(getDb(), {
      email: String(body.email || ''),
      password: String(body.password || ''),
      connectionType: String(body.connectionType || 'wifi'),
      networkSsid: String(body.networkSsid || 'Betterway-Office-5G'),
      qrStandCode: String(body.qrStandCode || 'BW-RECEPTION-STAND-DXB-1'),
      deviceId: String(body.deviceId || 'BW-MOBILE-SCAN'),
      checkInTimeGst: body.checkInTimeGst ? String(body.checkInTimeGst) : undefined,
    });
    return NextResponse.json({ ok: true, ...res });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Check-in failed' },
      { status: 400 },
    );
  }
}
