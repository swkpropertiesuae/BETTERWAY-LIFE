import Link from 'next/link';
import { getDb } from '@/server/db';
import { getActiveLang, requireStaffUser } from '@/server/auth/request';
import { DEAL_STAGE_LABELS, formatAedWhole } from '@/lib/format';
import { OsBanner } from '@/components/os-banner';
import { computeExecutiveForecastAndBi } from '@/server/engines/statement-and-policy-copilot';
import { canAccessAdminGovernance } from '@/server/engines/swk-enterprise-engine';
import { ODOO_APPS } from '@/lib/odoo-apps';
import {
  Activity,
  ArrowUpRight,
  Building2,
  Clock,
  CreditCard,
  FileSignature,
  KeyRound,
  Landmark,
  MessageCircle,
  PlusCircle,
  Rocket,
  Scale,
  ShieldCheck,
  Trash2,
  Users,
} from 'lucide-react';

export default async function CommandBoardPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const user = await requireStaffUser();
  const lang = await getActiveLang(user);
  const sp = await searchParams;
  const db = getDb();

  const bi = computeExecutiveForecastAndBi(db);
  const adminOk = canAccessAdminGovernance(user);

  const pendingBin = (
    db.prepare("SELECT COUNT(*) as c FROM recycle_bin_requests WHERE status = 'PENDING'").get() as { c: number }
  ).c;
  const pendingWithdrawals = (
    db.prepare("SELECT COUNT(*) as c FROM deal_withdrawals WHERE status != 'REJECTED'").get() as { c: number }
  ).c;
  const pendingRates = (
    db.prepare("SELECT COUNT(*) as c FROM bank_rate_cards WHERE status = 'PENDING_APPROVAL'").get() as { c: number }
  ).c;

  const latestEibor = db
    .prepare('SELECT * FROM eibor_fixings ORDER BY fixing_date DESC LIMIT 1')
    .get() as Record<string, number | string> | undefined;

  const tasks = db
    .prepare(
      `SELECT t.*, d.deal_ref
       FROM ops_tasks t
       LEFT JOIN deals d ON d.id = t.deal_id
       ORDER BY CASE WHEN t.status = 'OPEN' THEN 0 ELSE 1 END,
                CASE t.priority WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 ELSE 2 END,
                t.id DESC LIMIT 6`,
    )
    .all() as {
    id: number;
    deal_ref: string | null;
    assigned_role: string;
    priority: string;
    title: string;
    due_at: string;
    status: string;
  }[];

  const activeDeals = db
    .prepare(
      `SELECT d.id, d.deal_ref, h.primary_name, d.community_name, d.transaction_type, d.target_loan_fils, d.stage, d.cdd_status, b.short_name as bank_short
       FROM deals d
       JOIN households h ON h.id = d.household_id
       LEFT JOIN banks b ON b.id = d.selected_bank_id
       WHERE d.origin_mode = 'LIVE'
       ORDER BY d.id DESC LIMIT 6`,
    )
    .all() as {
    id: number;
    deal_ref: string;
    primary_name: string;
    community_name: string;
    transaction_type: string;
    target_loan_fils: number;
    stage: string;
    cdd_status: string;
    bank_short: string | null;
  }[];

  const teamMembers = db
    .prepare('SELECT id, full_name_en, email, role, status FROM users ORDER BY id ASC LIMIT 8')
    .all() as {
    id: number;
    full_name_en: string;
    email: string;
    role: string;
    status: string;
  }[];

  return (
    <section className="space-y-6">
      <OsBanner notice={sp.notice} error={sp.error} />

      {/* Corporate Header */}
      <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Betterway Mortgages LLC · Executive Command &amp; Treasury Summary
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-0.5">
            Institutional Pipeline, Operations &amp; Governance
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Authenticated: <strong>{user.full_name_en}</strong> ({user.email}) · CBUAE 3M EIBOR Benchmark:{' '}
            <strong className="font-num text-slate-800">
              {((Number(latestEibor?.rate_3m_bps ?? 368) || 368) / 100).toFixed(2)}%
            </strong>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href="/os/crm" className="bw-btn-navy">
            <PlusCircle className="h-3.5 w-3.5" />
            <span>Register Client Inquiry</span>
          </Link>
          <Link href="/os/accounts-expenses" className="bw-btn-ghost">
            Corporate Accounts &amp; Expenses
          </Link>
          <Link href="/os/deals" className="bw-btn-ghost">
            Master Deal Pipeline
          </Link>
        </div>
      </div>

      {/* 4 Institutional KPI Panels */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bw-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Active Loan Pipeline</span>
            <Landmark className="h-4 w-4 text-slate-400" />
          </div>
          <div className="text-xl font-bold text-slate-900 mt-2 font-num">
            {formatAedWhole(bi.grossPipelineLoanFils)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">{bi.activeDealsCount} active underwriting files</p>
        </div>

        <div className="bw-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Weighted Subvention Forecast</span>
            <CreditCard className="h-4 w-4 text-slate-400" />
          </div>
          <div className="text-xl font-bold text-slate-900 mt-2 font-num">
            {formatAedWhole(bi.weightedGrossRevenueFils)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Accrued bank subvention pool</p>
        </div>

        <div className="bw-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Deletion Review Queue</span>
            <Trash2 className="h-4 w-4 text-slate-400" />
          </div>
          <div className="text-xl font-bold text-slate-900 mt-2 font-num">{pendingBin}</div>
          <p className="text-[11px] text-slate-500 mt-1">Awaiting Managing Director review</p>
        </div>

        <div className="bw-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Refunds &amp; Rate Governance</span>
            <Scale className="h-4 w-4 text-slate-400" />
          </div>
          <div className="text-xl font-bold text-slate-900 mt-2 font-num">
            {pendingWithdrawals + pendingRates}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {pendingWithdrawals} refund(s) · {pendingRates} rate card(s)
          </p>
        </div>
      </div>

      {/* Corporate Divisions Quick Access */}
      <div className="bw-card p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Enterprise Divisions
            </span>
            <h2 className="text-sm font-bold text-slate-900">
              Direct Access to Departmental Workbenches
            </h2>
          </div>
          <Link href="/os" className="text-xs font-semibold text-slate-700 hover:text-slate-900 underline">
            Full Module Register →
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {ODOO_APPS.map((div) => (
            <Link
              key={div.id}
              href={div.primaryHref}
              className="p-3 rounded-md border border-slate-200 bg-slate-50/60 hover:bg-white hover:border-slate-400 transition flex flex-col justify-between group"
            >
              <div className="flex items-center justify-between">
                <span className="font-num text-[10px] font-bold text-slate-500">{div.code}</span>
                <ArrowUpRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-900" />
              </div>
              <div className="text-xs font-bold text-slate-900 mt-1.5">{div.name}</div>
              <div className="text-[10px] text-slate-500 mt-0.5 truncate">{div.subApps.length} modules</div>
            </Link>
          ))}
        </div>
      </div>

      {/* Governance & Scheduled Executive Reports */}
      {adminOk && (
        <div className="bw-card p-5 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Executive Governance &amp; Scheduled Reporting
            </div>
            <p className="font-semibold text-sm text-slate-900 mt-0.5">
              Managing Director: Shabib Siraj · Operations Manager: Mohammad Haseeb
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              Standard Operating Hours: Mon–Fri 10:00–19:00 GST · Sat 10:00–16:00 GST (10:05 GST Punctuality Cutoff)
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <form method="POST" action="/api/v1/actions">
              <input type="hidden" name="action" value="send_owner_briefing" />
              <input type="hidden" name="kind" value="morning" />
              <input type="hidden" name="returnTo" value="/os/command" />
              <button type="submit" className="bw-btn-ghost">
                <MessageCircle className="h-3.5 w-3.5 text-slate-600" />
                <span>09:30 Pipeline Dispatch</span>
              </button>
            </form>
            <form method="POST" action="/api/v1/actions">
              <input type="hidden" name="action" value="send_owner_briefing" />
              <input type="hidden" name="kind" value="attendance-1030" />
              <input type="hidden" name="returnTo" value="/os/command" />
              <button type="submit" className="bw-btn-ghost">
                <Clock className="h-3.5 w-3.5 text-slate-600" />
                <span>10:30 Attendance Dispatch</span>
              </button>
            </form>
            <Link href="/os/recycle-bin" className="bw-btn-navy">
              <Trash2 className="h-3.5 w-3.5" />
              <span>Deletion Queue ({pendingBin})</span>
            </Link>
          </div>
        </div>
      )}

      {/* 3 Operational Mortgage desks */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            code: 'DESK-01 · SECONDARY MARKET',
            title: 'Completed Property & Secondary Transfers',
            sub: 'CBUAE 50% DBR & LTV Assessment → Joint KFS & CDD → Dual-Bank IPA → Form F → Valuation → FOL → DLD Trustee Settlement',
            href: '/os/deals?dept=ready',
            Icon: Building2,
          },
          {
            code: 'DESK-02 · OFF-PLAN & HANDOVER',
            title: 'Developer Completion & Handover Finance',
            sub: 'Project APL Verification → 50% Construction / 80–85% Handover LTV → BCC & Valuation → Developer Escrow Settlement',
            href: '/os/deals?dept=offplan',
            Icon: Rocket,
          },
          {
            code: 'DESK-03 · REFINANCE & COMMERCIAL',
            title: 'Liability Buyout, Equity Release & Commercial',
            sub: 'Pre-Revert EIBOR Review & Commercial DSCR (1.25x) → Early Settlement Audit → Buyout FOL → Inter-Bank Settlement',
            href: '/os/deals?dept=buyout',
            Icon: KeyRound,
          },
        ].map((dept) => (
          <Link
            key={dept.code}
            href={dept.href}
            className="bw-card bw-lift p-5 flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="font-num text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  {dept.code}
                </span>
                <dept.Icon className="h-4 w-4 text-slate-400 group-hover:text-slate-900 transition" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 mt-2">{dept.title}</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">{dept.sub}</p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-800">
              <span>Open Department Pipeline</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </div>
          </Link>
        ))}
      </div>

      {/* Active Mortgage Cases & Operational Task Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bw-card p-5">
          <div className="flex items-center justify-between mb-4 pb-2.5 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-900">Active Mortgage Files</h2>
            <Link href="/os/deals" className="text-xs font-semibold text-slate-700 hover:underline">
              View Pipeline →
            </Link>
          </div>
          <ul className="divide-y divide-slate-100">
            {activeDeals.map((d) => (
              <li key={d.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between">
                <div className="flex items-center space-x-3 min-w-0">
                  <div className="bg-slate-100 rounded-md p-2 shrink-0">
                    <FileSignature className="w-4 h-4 text-slate-700" />
                  </div>
                  <div className="min-w-0">
                    <Link
                      href={`/os/deals/${d.id}`}
                      className="text-xs font-bold text-slate-900 hover:underline truncate block"
                    >
                      {d.primary_name} · <span className="font-num">{d.deal_ref}</span>
                    </Link>
                    <p className="text-[11px] text-slate-500 truncate">
                      {d.community_name} · {d.bank_short || 'Unassigned'} ·{' '}
                      {DEAL_STAGE_LABELS[d.stage]?.[lang] ?? d.stage}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <p className="text-xs font-bold text-slate-900 font-num">
                    {formatAedWhole(d.target_loan_fils)}
                  </p>
                  <Link href={`/os/deals/${d.id}`} className="text-[11px] font-medium text-slate-600 hover:underline">
                    Inspect
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="bw-card p-5">
          <div className="flex items-center justify-between mb-4 pb-2.5 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-900">Operational Task Queue</h2>
            <Link href="/os/activities" className="text-xs font-semibold text-slate-700 hover:underline">
              Open Task Register →
            </Link>
          </div>
          <ul className="divide-y divide-slate-100">
            {tasks.map((t) => (
              <li key={t.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between">
                <div className="flex items-center space-x-3 min-w-0">
                  <div className="bg-slate-100 rounded-md p-2 shrink-0">
                    <Activity className="w-4 h-4 text-slate-700" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900 truncate">{t.title.replace('[WF] ', '')}</p>
                    <p className="text-[11px] text-slate-500">
                      {t.deal_ref ? `${t.deal_ref} · ` : ''}
                      {t.assigned_role.replace(/_/g, ' ')} · {t.priority}
                    </p>
                  </div>
                </div>
                {t.status === 'OPEN' ? (
                  <form method="POST" action="/api/v1/actions" className="shrink-0 ml-2">
                    <input type="hidden" name="action" value="complete_task" />
                    <input type="hidden" name="taskId" value={t.id} />
                    <input type="hidden" name="returnTo" value="/os/command" />
                    <button type="submit" className="bw-btn-ghost py-1 px-2.5 text-xs">
                      Complete
                    </button>
                  </form>
                ) : (
                  <span className="text-[11px] font-semibold text-emerald-700">Closed</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Corporate Personnel & Access Hierarchy */}
      <div className="bw-card p-5">
        <div className="flex items-center justify-between mb-4 pb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-slate-700" />
            <h2 className="text-sm font-bold text-slate-900">Corporate Leadership &amp; Advisory Roster</h2>
          </div>
          <Link
            href="/os/recycle-bin?tab=admin_control"
            className="text-xs font-semibold text-slate-700 hover:underline"
          >
            Access Control →
          </Link>
        </div>
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {teamMembers.map((member) => {
            const initials = member.full_name_en
              .split(' ')
              .map((n) => n[0])
              .join('')
              .slice(0, 2);
            return (
              <li
                key={member.id}
                className="flex items-center justify-between p-3 rounded-md border border-slate-200 bg-slate-50/50"
              >
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div className="size-8 rounded-md bg-slate-900 text-[#d0b074] font-semibold text-xs flex items-center justify-center shrink-0">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">{member.full_name_en}</p>
                    <p className="text-[11px] text-slate-500 truncate">{member.role.replace(/_/g, ' ')}</p>
                  </div>
                </div>
                <ShieldCheck className="h-4 w-4 text-slate-400 shrink-0 ml-1" />
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
