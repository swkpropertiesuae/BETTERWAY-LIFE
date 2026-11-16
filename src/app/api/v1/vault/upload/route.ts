import { NextResponse } from 'next/server';
import { getDb } from '@/server/db';
import { getCurrentUser } from '@/server/auth/request';
import { ForbiddenError, UnauthorizedError } from '@/server/auth';
import { uploadDealVaultDocument } from '@/server/services/os-service';

export async function POST(req: Request) {
  const form = await req.formData();
  const rawReturnTo = String(form.get('returnTo') || '/portal');
  const returnTo = rawReturnTo.startsWith('/') && !rawReturnTo.startsWith('//') ? rawReturnTo : '/portal';

  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();

    const dealId = Number(form.get('dealId') || 0);
    const applicantId = form.get('applicantId') ? Number(form.get('applicantId')) : null;
    const docCategory = String(form.get('docCategory') || 'SALARY_CERT') as 'SALARY_CERT';
    const documentIssueDate = form.get('documentIssueDate') ? String(form.get('documentIssueDate')) : null;
    const documentExpiryDate = form.get('documentExpiryDate') ? String(form.get('documentExpiryDate')) : null;
    const fileEntry = form.get('file');

    let fileName = 'uploaded-document.pdf';
    let mimeType = 'application/pdf';
    let plainBytes: Buffer;

    if (fileEntry instanceof File && fileEntry.size > 0) {
      fileName = fileEntry.name;
      mimeType = fileEntry.type || 'application/octet-stream';
      plainBytes = Buffer.from(await fileEntry.arrayBuffer());
    } else {
      const sampleText = String(form.get('sampleText') || `%PDF-1.4 Betterway Smart Vault Verified Upload (${docCategory})`);
      fileName = `${docCategory.toLowerCase()}-${Date.now()}.pdf`;
      plainBytes = Buffer.from(sampleText, 'utf8');
    }

    uploadDealVaultDocument(getDb(), user, {
      dealId,
      applicantId,
      docCategory,
      fileName,
      mimeType,
      plainBytes,
      documentIssueDate,
      documentExpiryDate,
    });

    const sep = returnTo.includes('?') ? '&' : '?';
    return NextResponse.redirect(new URL(`${returnTo}${sep}notice=Document+encrypted+with+AES-256-GCM+and+stored`, req.url), 303);
  } catch (err) {
    const status = err instanceof UnauthorizedError ? 401 : err instanceof ForbiddenError ? 403 : 400;
    const msg = err instanceof Error ? err.message : 'Upload failed';
    const accept = req.headers.get('accept') || '';
    if (!accept.includes('text/html')) {
      return NextResponse.json({ error: msg }, { status });
    }
    const sep = returnTo.includes('?') ? '&' : '?';
    return NextResponse.redirect(new URL(`${returnTo}${sep}error=${encodeURIComponent(msg)}`, req.url), 303);
  }
}
