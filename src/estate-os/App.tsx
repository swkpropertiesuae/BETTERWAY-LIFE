import { lazy, Suspense, useEffect, type ComponentType } from 'react';
import { Compass, PlugZap } from 'lucide-react';
import { Shell } from '@/estate-os/layout/Shell';
import { AuthGate } from '@/estate-os/layout/AuthGate';
import { LIVE, useStore } from '@/estate-os/store/store';
import { regionKey } from '@/estate-os/store/regionSync';
import '@/estate-os/store/region';
import { NAV_FLAT } from '@/estate-os/layout/nav';
import { ConfirmHost, Toaster } from '@/estate-os/components/dialogs';
import { Button, Empty } from '@/estate-os/components/ui';
import { NoAccess } from '@/estate-os/features/shared';
import { useMe } from '@/estate-os/store/hooks';
import { can } from '@/estate-os/lib/permissions';
import { navigate, useRoute } from '@/estate-os/lib/router';

type Page = ComponentType<{ params: URLSearchParams }>;

const pageLoaders: (() => Promise<unknown>)[] = [];
const lazyPage = (load: () => Promise<Record<string, unknown>>, name: string) => {
  let loading: Promise<{ default: Page }> | null = null;
  const get = () => (loading ??= load().then((m) => ({ default: m[name] as Page })));
  pageLoaders.push(get);
  return lazy(get);
};

function preloadPages() {
  const run = () => pageLoaders.forEach((get) => void get().catch(() => undefined));
  const idle = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  if (idle) idle(run, { timeout: 4000 });
  else setTimeout(run, 2000);
}

const PAGES: Record<string, Page> = {
  dashboard: lazyPage(() => import('@/estate-os/features/dashboard'), 'Dashboard'),
  sales: lazyPage(() => import('@/estate-os/features/salesIntelligence'), 'SalesIntelligencePage'),
  activity: lazyPage(() => import('@/estate-os/features/activity'), 'ActivityPage'),
  leads: lazyPage(() => import('@/estate-os/features/leads'), 'LeadsPage'),
  contacts: lazyPage(() => import('@/estate-os/features/contacts'), 'ContactsPage'),
  properties: lazyPage(() => import('@/estate-os/features/properties'), 'PropertiesPage'),
  deals: lazyPage(() => import('@/estate-os/features/deals'), 'DealsPage'),
  appointments: lazyPage(() => import('@/estate-os/features/appointments'), 'AppointmentsPage'),
  tasks: lazyPage(() => import('@/estate-os/features/tasks'), 'TasksPage'),
  inbox: lazyPage(() => import('@/estate-os/features/inbox'), 'InboxPage'),
  calls: lazyPage(() => import('@/estate-os/features/calls'), 'CallsPage'),
  followups: lazyPage(() => import('@/estate-os/features/followups'), 'FollowUpsPage'),
  cbuae: lazyPage(() => import('@/estate-os/features/mortgageDesks'), 'CbuaeLosPage'),
  conveyancing: lazyPage(() => import('@/estate-os/features/mortgageDesks'), 'ConveyancingDeskPage'),
  erp: lazyPage(() => import('@/estate-os/features/mortgageDesks'), 'ErpAccountingHubPage'),
  pilot: lazyPage(() => import('@/estate-os/features/pilot'), 'PilotPage'),
  agents: lazyPage(() => import('@/estate-os/features/agents'), 'AgentsPage'),
  automations: lazyPage(() => import('@/estate-os/features/automations'), 'AutomationsPage'),
  workflows: lazyPage(() => import('@/estate-os/features/workflows'), 'WorkflowsPage'),
  approvals: lazyPage(() => import('@/estate-os/features/approvals'), 'ApprovalsPage'),
  dataquality: lazyPage(() => import('@/estate-os/features/dataQuality'), 'DataQualityPage'),
  logs: lazyPage(() => import('@/estate-os/features/logs'), 'LogsPage'),
  team: lazyPage(() => import('@/estate-os/features/team'), 'TeamPage'),
  finance: lazyPage(() => import('@/estate-os/features/finance'), 'FinancePage'),
  reports: lazyPage(() => import('@/estate-os/features/reports'), 'ReportsPage'),
  documents: lazyPage(() => import('@/estate-os/features/documents'), 'DocumentsPage'),
  integrations: lazyPage(() => import('@/estate-os/features/integrations'), 'IntegrationsPage'),
  audit: lazyPage(() => import('@/estate-os/features/audit'), 'AuditPage'),
  settings: lazyPage(() => import('@/estate-os/features/settings'), 'SettingsPage'),
};

const NOT_CONNECTED: Record<string, string> = {
  workflows: 'The workflow engine (durable jobs, retries, exit rules) is the next milestone.',
  approvals: 'Approvals arrive with AI agents and workflows; nothing requests approval yet.',
  logs: 'Execution logs record agent and workflow runs, which start in the next milestone.',
};

export default function App() {
  useEffect(preloadPages, []);
  return (
    <>
      <AuthGate>
        <Routed />
      </AuthGate>
      <Toaster />
      <ConfirmHost />
    </>
  );
}

function Routed() {
  const { page, params } = useRoute();
  const me = useMe();
  const nav = NAV_FLAT.find((n) => n.key === page);
  const Page = PAGES[page];
  const region = useStore(regionKey);
  const allowed = !nav?.cap || can(me.role, nav.cap);

  return (
    <>
      <Shell page={page}>
        <Suspense fallback={<PageSkeleton />}>
          {!Page ? (
            <div className="card" style={{ marginTop: 40 }}>
              <Empty icon={<Compass size={20} />} title="Page not found" description="That address doesn't match anything in Estate OS." action={<Button onClick={() => navigate('dashboard')}>Back to dashboard</Button>} />
            </div>
          ) : !allowed ? (
            <NoAccess what={nav?.label.toLowerCase()} />
          ) : LIVE && NOT_CONNECTED[page] ? (
            <NotConnected title={nav?.label ?? page} reason={NOT_CONNECTED[page]} />
          ) : (
            <Page key={`${page}:${region}`} params={params} />
          )}
        </Suspense>
      </Shell>
    </>
  );
}

function NotConnected({ title, reason }: { title: string; reason: string }) {
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">[ Not connected yet ]</div>
          <h1 className="page-title">{title}</h1>
        </div>
      </div>
      <div className="card">
        <Empty icon={<PlugZap size={20} />} title="This area isn’t connected to live data yet" description={reason} action={<Button onClick={() => navigate('dashboard')}>Back to dashboard</Button>} />
      </div>
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="page" aria-busy="true">
      <div className="skeleton" style={{ height: 14, width: 120, marginTop: 20 }} />
      <div className="skeleton" style={{ height: 32, width: 280, marginTop: 10 }} />
      <div className="grid g-kpi mt-24">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 118, borderRadius: 16 }} />
        ))}
      </div>
      <div className="skeleton mt-16" style={{ height: 320, borderRadius: 16 }} />
    </div>
  );
}
