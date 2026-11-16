import { NextResponse } from 'next/server';
import { getDb } from '@/server/db';
import { getCurrentUser } from '@/server/auth/request';
import { ForbiddenError, UnauthorizedError } from '@/server/auth';
import { buildExport } from '@/server/data-hub/exports';
import { writeXlsx } from '@/server/data-hub/xlsx';

export async function GET(req: Request, ctx: { params: Promise<{ spec: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();
    const purpose = new URL(req.url).searchParams.get('purpose') ?? '';
    const { spec, rows } = buildExport(getDb(), user, Number((await ctx.params).spec), purpose);
    const buf = await writeXlsx('Data', spec.columns, rows);
    return new NextResponse(new Uint8Array(buf), { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="${spec.file}"` } });
  } catch (e) {
    const status = e instanceof UnauthorizedError ? 401 : e instanceof ForbiddenError ? 403 : 400;
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status });
  }
}
