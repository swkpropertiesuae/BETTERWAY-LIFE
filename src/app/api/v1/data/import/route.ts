import { NextResponse } from 'next/server';
import { getDb } from '@/server/db';
import { getCurrentUser } from '@/server/auth/request';
import { ForbiddenError, UnauthorizedError } from '@/server/auth';
import { importFile } from '@/server/data-hub/import';

export async function POST(req: Request) {
  const back = (q: string) => NextResponse.redirect(new URL(`/os/data?${q}`, req.url), 303);
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();
    const f = await req.formData();
    const file = f.get('file');
    if (!(file instanceof File) || file.size === 0) throw new Error('Choose a file (.xlsx, .csv, .tsv, .txt or .json)');
    if (file.size > 10_000_000) throw new Error('File over 10 MB');
    const specNo = Number(f.get('spec'));
    const r = await importFile(getDb(), user, { specNo, fileName: file.name, bytes: Buffer.from(await file.arrayBuffer()) });
    return back(`spec=${specNo}&notice=${encodeURIComponent(`Imported batch #${r.batchId}: ${r.accepted} accepted, ${r.held} held, ${r.rejected} rejected of ${r.source}. Stored as CSV.${specNo === 16 ? ` Leads created: ${r.applied.created}, duplicates skipped: ${r.applied.duplicates}, no consent: ${r.applied.noConsent}.` : ''}`)}`);
  } catch (e) {
    const status = e instanceof UnauthorizedError ? 401 : e instanceof ForbiddenError ? 403 : 400;
    if (status === 401) return NextResponse.json({ error: 'Sign in' }, { status });
    return back(`error=${encodeURIComponent(e instanceof Error ? e.message : 'Import failed')}`);
  }
}
