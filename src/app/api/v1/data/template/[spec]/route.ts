import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/server/auth/request';
import { UnauthorizedError } from '@/server/auth';
import { specByNo } from '@/server/data-hub/specs';
import { templateGuide } from '@/server/data-hub/import';
import { writeXlsx } from '@/server/data-hub/xlsx';

export async function GET(_req: Request, ctx: { params: Promise<{ spec: string }> }) {
  try {
    if (!(await getCurrentUser())) throw new UnauthorizedError();
    const spec = specByNo(Number((await ctx.params).spec));
    if (!spec) return NextResponse.json({ error: 'Unknown spec' }, { status: 404 });
    const buf = await writeXlsx('Data', spec.columns, [], templateGuide(spec));
    return new NextResponse(new Uint8Array(buf), { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="${spec.file}"` } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: e instanceof UnauthorizedError ? 401 : 400 });
  }
}
