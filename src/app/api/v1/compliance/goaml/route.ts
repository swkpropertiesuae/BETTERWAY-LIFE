import { NextResponse } from 'next/server';
import { getDb } from '@/server/db';
import { getCurrentUser } from '@/server/auth/request';
import { ForbiddenError, UnauthorizedError } from '@/server/auth';
import { createGoAmlReport, listGoAmlReports } from '@/server/engines/compliance-aml-engine';

export async function GET() {
  try {
    const user = await getCurrentUser();
    const reports = listGoAmlReports(getDb(), user);
    return NextResponse.json({ reports });
  } catch (err) {
    const status = err instanceof UnauthorizedError ? 401 : err instanceof ForbiddenError ? 403 : 400;
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Forbidden' }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    const payload = await req.json();
    const report = createGoAmlReport(getDb(), user, {
      reportType: payload.reportType === 'STR' ? 'STR' : 'SAR',
      dealId: payload.dealId ? Number(payload.dealId) : null,
      subjectSummary: String(payload.subjectSummary || ''),
      redFlags: Array.isArray(payload.redFlags) ? payload.redFlags.map(String) : ['MANUAL_MLRO_ESCALATION'],
    });
    return NextResponse.json({ ok: true, report }, { status: 201 });
  } catch (err) {
    const status = err instanceof UnauthorizedError ? 401 : err instanceof ForbiddenError ? 403 : 400;
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Forbidden' }, { status });
  }
}
