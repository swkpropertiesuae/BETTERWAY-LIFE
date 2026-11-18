import { getDb } from '@/server/db';
import { requireStaffUser } from '@/server/auth/request';
import {
  buildBetterwayMobileBundle,
  formatMobileLockScreenNotification,
} from '@/server/engines/mobile-app-engine';
import { getRahabaOperationsDashboard } from '@/server/engines/rahaba-hr-operations-engine';
import { listStudioTemplates } from '@/server/engines/pdf-studio-engine';
import { MobileAppClient } from '@/components/mobile-app-client';

export const dynamic = 'force-dynamic';

export default async function MobileAppPage({
  searchParams,
}: {
  searchParams: Promise<{ staff?: string; tab?: string; notice?: string; error?: string }>;
}) {
  const user = await requireStaffUser();
  const sp = await searchParams;
  const db = getDb();

  const targetEmail = (sp.staff || user.email || 'daniel@betterwaymortgages.com').trim().toLowerCase();
  const bundle = buildBetterwayMobileBundle(
    db,
    targetEmail,
    `BW-IOS-${targetEmail.split('@')[0]!.toUpperCase()}-01`,
  );

  const quietNotification = formatMobileLockScreenNotification(
    {
      title: 'Confidential Borrower KFS & Salary Pack Updated',
      recordType: 'DEAL',
      recordId: String(bundle.assignedDeals[0]?.deal_ref || 'BW-2026-0001'),
    },
    true,
  );

  const hrDash = getRahabaOperationsDashboard(db);
  const studioTemplates = listStudioTemplates();

  return (
    <MobileAppClient
      bundle={bundle}
      quietNotification={quietNotification}
      hrDash={hrDash}
      studioTemplates={studioTemplates}
      initialTab={sp.tab || 'qr'}
      notice={sp.notice}
      error={sp.error}
    />
  );
}
