import { NextResponse } from 'next/server';
import { getDb } from '@/server/db';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET() {
  const db = getDb();
  const latestEibor = db
    .prepare('SELECT fixing_date, value_date, three_month_micro, six_month_micro FROM eibor_fixings ORDER BY fixing_date DESC LIMIT 1')
    .get() as
    | { fixing_date: string; value_date: string; three_month_micro: number; six_month_micro: number }
    | undefined;

  const banksCount = (db.prepare('SELECT COUNT(*) as c FROM banks').get() as { c: number }).c;
  const projectsCount = (db.prepare('SELECT COUNT(*) as c FROM projects').get() as { c: number }).c;

  return NextResponse.json(
    {
      ok: true,
      company: 'Betterway Mortgages LLC',
      osStatus: 'LIVE',
      banksCount,
      projectsCount,
      eibor: latestEibor
        ? {
            fixingDate: latestEibor.fixing_date,
            valueDate: latestEibor.value_date,
            threeMonthPct: Number((latestEibor.three_month_micro / 100_000).toFixed(3)),
            sixMonthPct: Number((latestEibor.six_month_micro / 100_000).toFixed(3)),
          }
        : null,
      endpoints: {
        leadIntake: '/api/v1/intake/leads',
        clientPortal: '/portal',
        partnerHub: '/partners',
        osLogin: '/login',
      },
    },
    { headers: corsHeaders },
  );
}
