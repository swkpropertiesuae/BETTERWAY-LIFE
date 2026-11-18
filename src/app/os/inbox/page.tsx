import Link from 'next/link';
import { getDb } from '@/server/db';
import { requireStaffUser } from '@/server/auth/request';
import { PageHeader } from '@/components/page-header';
import { OsBanner } from '@/components/os-banner';
import { InboxClient, type InboxLeadItem, type InboxMessageItem } from '@/components/inbox-client';

export const dynamic = 'force-dynamic';

export default async function UnifiedInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ leadId?: string; notice?: string; error?: string }>;
}) {
  const user = await requireStaffUser();
  const sp = await searchParams;
  const db = getDb();

  const rawLeads = db
    .prepare(
      `SELECT l.*, u.full_name_en as advisor_name
       FROM leads l
       LEFT JOIN users u ON u.id = l.assigned_advisor_id
       ORDER BY l.id DESC`,
    )
    .all() as Record<string, unknown>[];

  const leads: InboxLeadItem[] = rawLeads.map((l) => ({
    id: Number(l.id),
    contactName: String(l.contact_name || 'Prospective Borrower'),
    contactPhone: String(l.contact_phone || '+971500000000'),
    contactEmail: String(l.contact_email || 'client@uae.ae'),
    sourceChannel: String(l.source_channel || 'WHATSAPP'),
    transactionType: String(l.transaction_type || 'READY_PURCHASE'),
    targetPropertyAed: Math.round(Number(l.target_property_fils || 300_000_000) / 100),
    stage: String(l.stage || 'NEW'),
    advisorName: String(l.advisor_name || 'Daniel Xavier'),
    responded: Boolean(l.first_responded_at),
    createdAt: String(l.created_at || 'Today'),
  }));

  const rawMessages = db
    .prepare('SELECT * FROM comm_messages ORDER BY id ASC')
    .all() as Record<string, unknown>[];

  const messages: InboxMessageItem[] = rawMessages.map((m) => ({
    id: Number(m.id),
    leadId: Number(m.lead_id),
    channel: String(m.channel || 'WHATSAPP'),
    senderName: String(m.sender_name || 'Betterway Advisor'),
    body: String(m.body || ''),
    createdAt: String(m.created_at || 'Just now'),
  }));

  const initialLeadId = sp.leadId ? Number(sp.leadId) : leads[0]?.id || 0;

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <OsBanner notice={sp.notice} error={sp.error} />

      <PageHeader
        app="Command Center"
        appHref="/os"
        title={
          <>
            Unified Omnichannel <span className="serif">Inbox</span>
          </>
        }
        sub="3-Pane WhatsApp, Email, Call Log, AI Concierge Takeover & Private Internal Team Notes — Connected to SQLite"
      >
        <Link href="/os/crm" className="bw-btn-ghost">
          Open Leads &amp; 5m SLA Desk
        </Link>
        <Link href="/os/deals" className="bw-btn-navy">
          Open 10-Stage Kanban
        </Link>
      </PageHeader>

      <InboxClient
        leads={leads}
        initialMessages={messages}
        initialLeadId={initialLeadId}
        currentUserName={user.full_name_en}
      />
    </div>
  );
}
