import path from 'node:path';
import { NextResponse } from 'next/server';
import { getDb } from '@/server/db';
import { getCurrentUser } from '@/server/auth/request';
import { ForbiddenError, UnauthorizedError } from '@/server/auth';
import { downloadDealVaultDocument } from '@/server/services/os-service';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();
    const { id } = await ctx.params;

    const { doc, plainBytes } = downloadDealVaultDocument(getDb(), user, Number(id));
    const safeBase = path.basename(doc.file_name).replace(/[\r\n"]/g, '_') || 'vault-document.pdf';
    const asciiFallback = safeBase.replace(/[^\x20-\x7E]/g, '_') || 'vault-document.pdf';
    const encodedUtf8 = encodeURIComponent(safeBase);

    return new NextResponse(new Uint8Array(plainBytes), {
      status: 200,
      headers: {
        'Content-Type': doc.mime_type || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodedUtf8}`,
      },
    });
  } catch (err) {
    const status = err instanceof UnauthorizedError ? 401 : err instanceof ForbiddenError ? 403 : 404;
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Access denied' }, { status });
  }
}
