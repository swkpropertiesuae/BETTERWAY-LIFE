import { NextResponse } from 'next/server';
import { getDb } from '@/server/db';
import { getCurrentUser } from '@/server/auth/request';
import { ForbiddenError, UnauthorizedError } from '@/server/auth';
import { importSanctionsList } from '@/server/integrations/sanctions';

export async function POST(req: Request) {
  const back = (q: string) => NextResponse.redirect(new URL(`/os/compliance?${q}`, req.url), 303);
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();
    const f = await req.formData();
    const file = f.get('file');
    if (!(file instanceof File) || !file.size) throw new Error('Choose a file');
    const r = await importSanctionsList(getDb(), user, { fileName: file.name, bytes: Buffer.from(await file.arrayBuffer()), listName: String(f.get('listName') || 'IMPORTED') });
    return back(`notice=${encodeURIComponent(`Watchlist updated: ${r.added} new names, ${r.skipped} skipped`)}`);
  } catch (e) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ error: 'Sign in' }, { status: 401 });
    return back(`error=${encodeURIComponent(e instanceof Error ? e.message : 'Import failed')}`);
  }
}
