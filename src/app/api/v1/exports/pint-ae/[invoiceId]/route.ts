import { NextResponse } from 'next/server';
import { getDb } from '@/server/db';
import { getCurrentUser } from '@/server/auth/request';
import { ForbiddenError, UnauthorizedError, writeAuditLog } from '@/server/auth';

export async function GET(_req: Request, ctx: { params: Promise<{ invoiceId: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();
    const { invoiceId } = await ctx.params;
    const db = getDb();

    const inv = db
      .prepare('SELECT id, deal_id, invoice_number, invoice_type, counterparty_name, pint_ae_xml FROM tax_invoices WHERE id = ?')
      .get(Number(invoiceId)) as
      | {
          id: number;
          deal_id: number | null;
          invoice_number: string;
          invoice_type: string;
          counterparty_name: string;
          pint_ae_xml: string;
        }
      | undefined;

    if (!inv) {
      return NextResponse.json({ error: 'Tax invoice not found' }, { status: 404 });
    }

    if (user.role === 'PARTNER_AGENCY_ADMIN') {
      const owns = db
        .prepare(
          `SELECT cs.id
           FROM partner_agents pa
           JOIN commission_settlements cs ON cs.partner_agency_id = pa.agency_id
           WHERE pa.user_id = ? AND pa.is_agency_admin = 1 AND cs.deal_id = ?`,
        )
        .get(user.id, inv.deal_id ?? -1);
      if (!owns || inv.invoice_type !== 'SELF_BILLED_PARTNER') {
        throw new ForbiddenError('Partner agency admins can only export their own agency self-billed invoices');
      }
    } else if (!['SUPER_ADMIN', 'FINANCE_ADMIN'].includes(user.role)) {
      throw new ForbiddenError('Role is not permitted to export Peppol PINT-AE invoices');
    }

    writeAuditLog(db, user, 'tax_invoices', inv.id, 'EXPORT_PINT_AE_XML', null, { invoiceNumber: inv.invoice_number });

    return new NextResponse(inv.pint_ae_xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Content-Disposition': `attachment; filename="${inv.invoice_number}.xml"`,
      },
    });
  } catch (err) {
    const status = err instanceof UnauthorizedError ? 401 : err instanceof ForbiddenError ? 403 : 400;
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Forbidden' }, { status });
  }
}
