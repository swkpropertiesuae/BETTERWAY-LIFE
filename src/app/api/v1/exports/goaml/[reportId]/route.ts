import { NextResponse } from 'next/server';
import { getDb } from '@/server/db';
import { getCurrentUser } from '@/server/auth/request';
import { assertMlroAccess, ForbiddenError, UnauthorizedError, writeAuditLog } from '@/server/auth';

export async function GET(_req: Request, ctx: { params: Promise<{ reportId: string }> }) {
  try {
    const user = await getCurrentUser();
    const mlro = assertMlroAccess(user);
    const { reportId } = await ctx.params;
    const db = getDb();

    const row = db
      .prepare('SELECT id, report_ref, goaml_xml_payload FROM goaml_reports WHERE id = ?')
      .get(Number(reportId)) as { id: number; report_ref: string; goaml_xml_payload: string } | undefined;
    if (!row) {
      return NextResponse.json({ error: 'goAML report not found' }, { status: 404 });
    }

    writeAuditLog(db, mlro, 'goaml_reports', row.id, 'EXPORT_GOAML_XML', null, { reportRef: row.report_ref });

    return new NextResponse(row.goaml_xml_payload, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Content-Disposition': `attachment; filename="${row.report_ref}.xml"`,
      },
    });
  } catch (err) {
    const status = err instanceof UnauthorizedError ? 401 : err instanceof ForbiddenError ? 403 : 400;
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Forbidden' }, { status });
  }
}
