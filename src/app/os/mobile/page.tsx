import { getDb } from '@/server/db';
import { requireStaffUser } from '@/server/auth/request';
import { PageHeader } from '@/components/page-header';
import { OsBanner } from '@/components/os-banner';
import {
  buildBetterwayMobileBundle,
  formatMobileLockScreenNotification,
} from '@/server/engines/mobile-app-engine';
import { MobileAppClient } from '@/components/mobile-app-client';

export const dynamic = 'force-dynamic';

export default async function MobileAppPage({
  searchParams,
}: {
  searchParams: Promise<{ staff?: string; notice?: string; error?: string }>;
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

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <OsBanner notice={sp.notice} error={sp.error} />
      <PageHeader
        app="Mobile OS"
        appHref="/os/mobile"
        title="Betterway ONE — Staff & Advisor Mobile App"
        sub="iOS/Android Field PWA with 10:05 AM GST QR Check-In, 5m Lead SLA, Mobile DBR Calculator, Rahaba HR Desk & Offline Sync Queue"
      />
      <MobileAppClient bundle={bundle} quietNotification={quietNotification} />
    </div>
  );
}
