import Link from 'next/link';
import { getDb } from '@/server/db';
import { requireStaffUser } from '@/server/auth/request';
import { formatAed } from '@/lib/format';
import { PageHeader } from '@/components/page-header';
import { OsBanner } from '@/components/os-banner';

export const dynamic = 'force-dynamic';

const ROLE_CAPABILITIES = [
  {
    capability: 'Executive Governance & Admin Account Lock/Unlock',
    owner: true,
    manager: false,
    compliance: false,
    advisor: false,
  },
  {
    capability: 'Recycle Bin & Deal Withdrawal Final Approval',
    owner: true,
    manager: false,
    compliance: false,
    advisor: false,
  },
  {
    capability: 'Print Office Reception QR Stand & Team Briefings',
    owner: true,
    manager: true,
    compliance: false,
    advisor: false,
  },
  {
    capability: 'CBUAE KFS Sign-off, PEP/Sanctions & goAML STR Filing',
    owner: true,
    manager: true,
    compliance: true,
    advisor: false,
  },
  {
    capability: '24-Bank LOS Submission, DBR Structuring & Lead Conversion',
    owner: true,
    manager: true,
    compliance: false,
    advisor: true,
  },
  {
    capability: 'Omnichannel Inbox Takeover & Internal Team Notes',
    owner: true,
    manager: true,
    compliance: true,
    advisor: true,
  },
];

export default async function InternalTeamWorkloadPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  await requireStaffUser();
  const sp = await searchParams;
  const db = getDb();

  const staffRows = db
    .prepare(
      `SELECT u.id, u.email, u.full_name_en, u.role, u.phone, u.status,
              e.designation, e.department, e.basic_salary_fils, e.housing_allowance_fils, e.monthly_draw_fils,
              (SELECT COUNT(*) FROM leads l WHERE l.assigned_advisor_id = u.id) as open_leads_count,
              (SELECT COUNT(*) FROM deals d WHERE d.advisor_id = u.id OR d.underwriter_id = u.id OR d.progression_manager_id = u.id) as active_deals_count,
              (SELECT COALESCE(SUM(d.target_loan_fils), 0) FROM deals d WHERE d.advisor_id = u.id) as pipeline_fils
       FROM users u
       LEFT JOIN employees e ON e.user_id = u.id
       WHERE u.role NOT IN ('PARTNER_AGENT', 'PARTNER_AGENCY_ADMIN', 'CLIENT')
       ORDER BY u.id ASC`,
    )
    .all() as Record<string, unknown>[];

  const totalOpenLeads = staffRows.reduce((s, r) => s + Number(r.open_leads_count || 0), 0);
  const totalActiveDeals = staffRows.reduce((s, r) => s + Number(r.active_deals_count || 0), 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <OsBanner notice={sp.notice} error={sp.error} />

      <PageHeader
        app="Command Center"
        appHref="/os"
        title={
          <>
            Internal Team &amp; <span className="serif">Workload Desk</span>
          </>
        }
        sub="Betterway Mortgages LLC — Single-Company Internal Staff Directory, Live Desk Capacity, SLA Ownership & Role Matrix"
      >
        <Link href="/os/reception-qr" className="bw-btn-ghost">
          10:05 AM Attendance &amp; QR
        </Link>
        <Link href="/os/hrm" className="bw-btn-navy">
          MOHRE WPS Payroll &amp; EOSB
        </Link>
      </PageHeader>

      {/* Top Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
        <div className="bw-card p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-3)]">
            Internal Staff Roster
          </div>
          <div className="text-2xl font-bold font-num text-[var(--text)] mt-1">{staffRows.length} Staff</div>
          <div className="text-xs text-emerald-700 font-medium mt-1">100% Internal Betterway Mortgages LLC</div>
        </div>
        <div className="bw-card p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-3)]">
            Assigned Omnichannel Leads
          </div>
          <div className="text-2xl font-bold font-num text-[var(--text)] mt-1">{totalOpenLeads} Active</div>
          <div className="text-xs text-[var(--text-3)] mt-1">5-Minute GST SLA Enforced</div>
        </div>
        <div className="bw-card p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-3)]">
            Active Mortgage Files
          </div>
          <div className="text-2xl font-bold font-num text-[var(--text)] mt-1">{totalActiveDeals} Deals</div>
          <div className="text-xs text-[var(--text-3)] mt-1">Across 24 UAE Banks &amp; DLD Desks</div>
        </div>
        <div className="bw-card p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-3)]">
            Commission Split Policy
          </div>
          <div className="text-2xl font-bold font-num text-[#0f4c81] mt-1">50% / 50%</div>
          <div className="text-xs text-[var(--text-3)] mt-1">Net Pool After Partner Referral Share</div>
        </div>
      </div>

      {/* Staff Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {staffRows.map((member) => {
          const name = String(member.full_name_en || 'Staff Member');
          const email = String(member.email || '');
          const role = String(member.role || 'ADVISOR');
          const desk = String(member.department || 'Origination Desk');
          const designation = String(member.designation || role.replace(/_/g, ' '));
          const leadsCount = Number(member.open_leads_count || 0);
          const dealsCount = Number(member.active_deals_count || 0);
          const pipelineFils = Number(member.pipeline_fils || 0);
          const capacityPct = Math.min(100, leadsCount * 18 + dealsCount * 15);
          const initials = name
            .split(' ')
            .map((p) => p[0])
            .slice(0, 2)
            .join('')
            .toUpperCase();

          return (
            <div key={String(member.id)} className="bw-card p-5 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#1c1c1c] text-white font-bold text-xs flex items-center justify-center shrink-0">
                      {initials}
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-[var(--text)]">{name}</h3>
                      <div className="text-xs text-[var(--text-3)]">{designation}</div>
                    </div>
                  </div>
                  <span className="bw-badge bg-[var(--bg-2)] text-[var(--text-2)]">{role}</span>
                </div>

                <div className="mt-3 pt-3 border-t border-[var(--border)] grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <div className="text-[10.5px] text-[var(--text-3)]">Open Leads</div>
                    <div className="font-bold font-num text-sm text-[var(--text)] mt-0.5">{leadsCount}</div>
                  </div>
                  <div>
                    <div className="text-[10.5px] text-[var(--text-3)]">Active Deals</div>
                    <div className="font-bold font-num text-sm text-[var(--text)] mt-0.5">{dealsCount}</div>
                  </div>
                  <div>
                    <div className="text-[10.5px] text-[var(--text-3)]">Desk</div>
                    <div className="font-semibold text-xs text-[var(--text-2)] truncate mt-0.5">{desk}</div>
                  </div>
                </div>

                {/* Workload Progress Bar */}
                <div className="mt-3 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[var(--text-3)]">Desk Workload Utilization</span>
                    <span className="font-num font-semibold text-[var(--text)]">{capacityPct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[var(--bg-2)] overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        capacityPct > 80 ? 'bg-amber-500' : 'bg-[#0f4c81]'
                      }`}
                      style={{ width: `${capacityPct}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between text-[11px] text-[var(--text-3)]">
                <span className="font-num truncate">{email}</span>
                {pipelineFils > 0 ? (
                  <span className="font-num font-semibold text-emerald-700 shrink-0">
                    {formatAed(pipelineFils)}
                  </span>
                ) : (
                  <span className="text-emerald-700 font-medium shrink-0">Active</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Internal Governance & Role Capability Matrix */}
      <div className="bw-card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[var(--border)] flex items-center justify-between">
          <div>
            <h2 className="font-bold text-sm text-[var(--text)]">
              Betterway Mortgages LLC — Internal Role &amp; Governance Matrix
            </h2>
            <p className="text-xs text-[var(--text-3)]">
              Strict single-company internal hierarchy: Supreme Owner (Shabib Siraj) → Manager (Mohammad Haseeb) → Compliance / Advisors
            </p>
          </div>
          <Link href="/os/recycle-bin" className="bw-btn-ghost !text-xs">
            Owner Approval Desk →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-[var(--bg)] text-[var(--text-3)] border-b border-[var(--border)]">
              <tr>
                <th className="px-4 py-2.5 text-left font-semibold">Internal Operating Capability</th>
                <th className="px-4 py-2.5 text-center font-semibold">Owner (Shabib Siraj)</th>
                <th className="px-4 py-2.5 text-center font-semibold">Manager (Mohammad Haseeb)</th>
                <th className="px-4 py-2.5 text-center font-semibold">MLRO / Compliance</th>
                <th className="px-4 py-2.5 text-center font-semibold">Mortgage Advisor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {ROLE_CAPABILITIES.map((row) => (
                <tr key={row.capability} className="hover:bg-[var(--bg)]/50">
                  <td className="px-4 py-3 font-medium text-[var(--text)]">{row.capability}</td>
                  <td className="px-4 py-3 text-center">
                    {row.owner ? <span className="text-emerald-600 font-bold">✓ Full</span> : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {row.manager ? <span className="text-emerald-600 font-bold">✓ Authorized</span> : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {row.compliance ? <span className="text-emerald-600 font-bold">✓ Authorized</span> : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {row.advisor ? <span className="text-emerald-600 font-bold">✓ Desk Access</span> : <span className="text-slate-300">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
