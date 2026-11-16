import { NextResponse } from 'next/server';
import { getDb } from '@/server/db';
import { getCurrentUser } from '@/server/auth/request';
import { ForbiddenError, getPartnerVisibleDeals, UnauthorizedError } from '@/server/auth';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();
    const overview = getPartnerVisibleDeals(getDb(), user);
    return NextResponse.json(overview);
  } catch (err) {
    const status = err instanceof UnauthorizedError ? 401 : err instanceof ForbiddenError ? 403 : 400;
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Forbidden' }, { status });
  }
}
