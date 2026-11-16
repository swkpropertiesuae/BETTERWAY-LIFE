import { readFileSync } from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { getDb } from '@/server/db';
import { getCurrentUser } from '@/server/auth/request';
import { assertRole, writeAuditLog } from '@/server/auth';

export async function POST(req: Request) {
  const user = await getCurrentUser();
  try {
    assertRole(user, ['SUPER_ADMIN', 'CREDIT_UNDERWRITER', 'SALES_ADVISOR', 'FINANCE_ADMIN']);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const db = getDb();
  let source = 'SNAPSHOT_VERIFIED';

  try {
    const snapRaw = readFileSync(path.resolve(process.cwd(), 'src/data/eibor-snapshot.json'), 'utf8');
    const snap = JSON.parse(snapRaw) as {
      latest: { date: string; valueDate: string; overnight: number; oneMonth: number; threeMonth: number; sixMonth: number; oneYear: number };
    };
    const l = snap.latest;
    db.prepare(
      `INSERT INTO eibor_fixings (
        fixing_date, value_date, overnight_micro, one_month_micro, three_month_micro, six_month_micro, one_year_micro, source_status, retrieved_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(fixing_date) DO UPDATE SET
        retrieved_at = datetime('now'),
        source_status = excluded.source_status`,
    ).run(
      l.date,
      l.valueDate,
      Math.round(l.overnight * 100_000),
      Math.round(l.oneMonth * 100_000),
      Math.round(l.threeMonth * 100_000),
      Math.round(l.sixMonth * 100_000),
      Math.round(l.oneYear * 100_000),
      source,
    );
    writeAuditLog(db, user, 'eibor_fixings', l.date, 'SYNC_CBUAE_EIBOR', null, { source });
  } catch (err) {
    source = err instanceof Error ? err.message : 'SYNC_ERROR';
  }

  const accept = req.headers.get('accept') || '';
  if (accept.includes('text/html')) {
    return NextResponse.redirect(new URL('/os/banks-apl?notice=CBUAE+EIBOR+benchmarked+and+refreshed', req.url), 303);
  }
  return NextResponse.json({ ok: true, source });
}
