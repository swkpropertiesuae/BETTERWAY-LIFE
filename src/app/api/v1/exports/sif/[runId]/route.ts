import { NextResponse } from 'next/server';
import { getDb } from '@/server/db';
import { getCurrentUser } from '@/server/auth/request';
import { assertRole, ForbiddenError, UnauthorizedError, writeAuditLog } from '@/server/auth';

export async function GET(_req: Request, ctx: { params: Promise<{ runId: string }> }) {
  try {
    const user = await getCurrentUser();
    const actor = assertRole(user, ['SUPER_ADMIN', 'FINANCE_ADMIN', 'HR_MANAGER']);
    const { runId } = await ctx.params;
    const db = getDb();

    const run = db
      .prepare('SELECT id, sif_filename, sif_content FROM payroll_runs WHERE id = ?')
      .get(Number(runId)) as { id: number; sif_filename: string; sif_content: string } | undefined;

    if (!run) {
      return NextResponse.json({ error: 'Payroll run not found' }, { status: 404 });
    }

    writeAuditLog(db, actor, 'payroll_runs', run.id, 'DOWNLOAD_WPS_SIF', null, { sifFilename: run.sif_filename });

    return new NextResponse(run.sif_content, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="${run.sif_filename || `WPS-${run.id}.SIF`}"`,
      },
    });
  } catch (err) {
    const status = err instanceof UnauthorizedError ? 401 : err instanceof ForbiddenError ? 403 : 400;
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Forbidden' }, { status });
  }
}
