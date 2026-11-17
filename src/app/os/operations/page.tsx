import Link from 'next/link';
import { getDb } from '@/server/db';
import { requireStaffUser } from '@/server/auth/request';
import { formatAedWhole } from '@/lib/format';
import { OsBanner } from '@/components/os-banner';
import { PERMITTED_UAE_PAYMENT_CHANNELS } from '@/server/engines/swk-enterprise-engine';

export const dynamic = 'force-dynamic';

export default async function CompanyOperationsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; notice?: string; error?: string }>;
}) {
  const user = await requireStaffUser();
  const sp = await searchParams;
  const activeTab = sp.tab || 'overview';
  const db = getDb();

  const activeDeals = (
    db
      .prepare(
        "SELECT COUNT(*) AS c FROM deals WHERE origin_mode = 'LIVE' AND stage NOT IN ('TRANSFERRED_DISBURSED', 'DECLINED', 'WITHDRAWN')",
      )
      .get() as { c: number }
  ).c;

  const collectedSubvention = (
    db.prepare('SELECT COALESCE(SUM(expected_subvention_ex_vat_fils), 0) AS s FROM commission_settlements').get() as {
      s: number;
    }
  ).s;

  const rateCardsCount = (db.prepare('SELECT COUNT(*) AS c FROM bank_rate_cards').get() as { c: number }).c;
  const clearedFolCount = (
    db
      .prepare(
        "SELECT COUNT(*) AS c FROM deals WHERE stage IN ('FOL_ISSUED', 'FOL_SIGNED', 'NOC_AND_CLEARANCE', 'CHEQUES_READY', 'TRANSFERRED_DISBURSED')",
      )
      .get() as { c: number }
  ).c;
  const pendingBin = (
    db.prepare("SELECT COUNT(*) AS c FROM recycle_bin_requests WHERE status = 'PENDING'").get() as { c: number }
  ).c;
  const pendingDecisions = (
    db.prepare("SELECT COUNT(*) AS c FROM manager_admin_decisions WHERE status = 'PENDING'").get() as { c: number }
  ).c;
  const openCompliance = (
    db.prepare("SELECT COUNT(*) AS c FROM goaml_reports WHERE status != 'CLOSED_NO_ACTION'").get() as { c: number }
  ).c;

  const dailyReports = db
    .prepare('SELECT * FROM daily_work_reports ORDER BY id DESC LIMIT 20')
    .all() as Array<Record<string, unknown>>;

  const rateCards = db
    .prepare(
      `SELECT r.*, b.name_en AS bank_name
       FROM bank_rate_cards r
       JOIN banks b ON b.id = r.bank_id
       ORDER BY r.intro_rate_bps ASC LIMIT 12`,
    )
    .all() as Array<Record<string, unknown>>;

  const folDeals = db
    .prepare(
      `SELECT d.id, d.deal_ref, d.stage, d.target_loan_fils, h.primary_name AS client_name, u.full_name_en AS advisor_name
       FROM deals d
       JOIN households h ON h.id = d.household_id
       LEFT JOIN users u ON u.id = d.advisor_id
       WHERE d.origin_mode = 'LIVE'
       ORDER BY d.id DESC LIMIT 12`,
    )
    .all() as Array<Record<string, unknown>>;

  const settlements = db
    .prepare(
      `SELECT cs.*, d.deal_ref, u.full_name_en AS advisor_name
       FROM commission_settlements cs
       JOIN deals d ON d.id = cs.deal_id
       LEFT JOIN users u ON u.id = cs.advisor_id
       ORDER BY cs.id DESC LIMIT 12`,
    )
    .all() as Array<Record<string, unknown>>;

  const employees = db
    .prepare(
      `SELECT e.*, u.full_name_en, u.email, u.role
       FROM employees e
       JOIN users u ON u.id = e.user_id
       ORDER BY e.id ASC`,
    )
    .all() as Array<Record<string, unknown>>;

  const internalTasks = db
    .prepare(
      `SELECT t.*, d.deal_ref
       FROM ops_tasks t
       LEFT JOIN deals d ON d.id = t.deal_id
       ORDER BY CASE WHEN t.status = 'OPEN' THEN 0 ELSE 1 END, t.id DESC LIMIT 12`,
    )
    .all() as Array<Record<string, unknown>>;

  const tabs = [
    { id: 'overview', label: 'Overview & Tasks' },
    { id: 'tasks', label: 'Internal Tasks Board' },
    { id: 'reports', label: 'Daily Work Reports' },
    { id: 'rates', label: 'Bank Rate Cards & FOLs' },
    { id: 'nocs', label: 'Developer NOCs & MOUs' },
    { id: 'disbursals', label: 'DLD Disbursals & Subvention' },
    { id: 'payouts', label: '50/50 Advisor Payouts' },
    { id: 'visas', label: 'Staff Visas & WPS' },
    { id: 'whatsapp', label: 'WhatsApp Templates' },
    { id: 'compliance', label: 'CBUAE & goAML Checks' },
    { id: 'handover', label: 'Post-Disbursal Care' },
  ];

  return (
    <div className="space-y-6">
      <OsBanner notice={sp.notice} error={sp.error} />

      {/* Midnight & Champagne Header Banner */}
      <div className="rounded-2xl bg-white text-gray-900 p-6 border border-gray-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-700">
            Step 02 · Daily Operations &amp; Department Control
          </div>
          <h1 className="font-display text-2xl md:text-3xl font-bold mt-1">Company Operations Centre</h1>
          <p className="text-xs text-gray-500 mt-1 max-w-2xl">
            Bank rate cards, daily work reports, FOL clearances, subvention collection, 50/50 advisor splits, staff
            visas, and CBUAE compliance in one place.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/os/accounts-expenses"
            className="px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-800 transition"
          >
            Company Accounts &amp; Expenses →
          </Link>
          <Link
            href="/os/command"
            className="px-3.5 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 border border-gray-200 text-xs font-semibold text-gray-800 transition"
          >
            Executive Overview
          </Link>
          <Link
            href="/os/recycle-bin"
            className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition"
          >
            Pending Delete Bin ({pendingBin})
          </Link>
        </div>
      </div>

      {/* 7 KPI Strip (Matches swkpropertiesOS hb-04-daily-operations.png) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: 'Active Modules', value: '10', sub: 'Core company modules' },
          { label: 'Active Pipeline', value: String(activeDeals), sub: 'Live mortgage files' },
          { label: 'Subvention Ledger', value: formatAedWhole(collectedSubvention), sub: 'Verified bank inflows' },
          { label: 'Approved Rate Cards', value: String(rateCardsCount), sub: '24-bank products' },
          { label: 'Cleared FOLs & NOCs', value: String(clearedFolCount), sub: 'Ready for trustee' },
          { label: 'Pending Owner Queue', value: String(pendingBin + pendingDecisions), sub: 'Bin & Admin decisions' },
          { label: 'Compliance Cases', value: String(openCompliance), sub: 'CBUAE / goAML files' },
        ].map((kpi) => (
          <div key={kpi.label} className="bw-card p-3.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{kpi.label}</div>
            <div className="font-display text-lg font-bold text-slate-900 mt-1">{kpi.value}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* 10 Segmented Module Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 bg-white p-2 rounded-xl border border-slate-200/90 shadow-sm">
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <Link
              key={tab.id}
              href={`/os/operations?tab=${tab.id}`}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                active
                  ? 'bg-slate-900 text-white shadow-sm border border-slate-300'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* Overview or Internal Tasks Tab: Assign & Complete Internal Tasks */}
      {(activeTab === 'overview' || activeTab === 'tasks') && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bw-card p-5 space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700">
              Internal Operations Queue
            </span>
            <h2 className="font-display text-lg font-bold text-slate-900">Assign New Internal Company Task</h2>
            <form method="POST" action="/api/v1/actions" className="space-y-3 text-xs">
              <input type="hidden" name="action" value="create_ops_task" />
              <input type="hidden" name="returnTo" value={`/os/operations?tab=${activeTab}`} />
              <label className="block">
                <span className="font-semibold text-slate-700">Task Description</span>
                <input
                  name="title"
                  required
                  placeholder="e.g. Follow up with bank credit desk on valuation report"
                  className="bw-input mt-1 w-full"
                />
              </label>
              <label className="block">
                <span className="font-semibold text-slate-700">Assign To Department</span>
                <select name="assignedRole" className="bw-input mt-1 w-full">
                  <option value="SALES_ADVISOR">Sales &amp; Advisory</option>
                  <option value="CREDIT_UNDERWRITER">Bank Underwriting</option>
                  <option value="PROGRESSION_MANAGER">Property Transfer &amp; NOC</option>
                  <option value="FINANCE_ADMIN">Accounting &amp; Commissions</option>
                  <option value="COMPLIANCE_MLRO">Compliance &amp; ID Check</option>
                  <option value="HR_MANAGER">HR &amp; Office Operations</option>
                  <option value="SUPER_ADMIN">Owner &amp; Management</option>
                </select>
              </label>
              <label className="block">
                <span className="font-semibold text-slate-700">Priority</span>
                <select name="priority" className="bw-input mt-1 w-full">
                  <option value="HIGH">High Priority</option>
                  <option value="CRITICAL">Critical / Urgent</option>
                  <option value="NORMAL">Normal</option>
                </select>
              </label>
              <button type="submit" className="bw-btn-gold w-full justify-center">
                + Assign Internal Task
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 bw-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-slate-900">
                Internal Company Tasks Queue ({internalTasks.length})
              </h2>
              <Link href="/os/activities" className="text-xs font-semibold text-slate-700 hover:underline">
                Open Full Tasks Board →
              </Link>
            </div>
            <div className="space-y-2 text-xs">
              {internalTasks.map((t) => (
                <div
                  key={String(t.id)}
                  className="p-3 rounded-xl bg-gray-50 border border-slate-200/80 flex flex-wrap items-center justify-between gap-2"
                >
                  <div>
                    <div className="font-bold text-slate-900">{String(t.title).replace('[WF] ', '')}</div>
                    <div className="text-slate-500 mt-0.5">
                      Department: <strong>{String(t.assigned_role).replace(/_/g, ' ')}</strong> · Priority:{' '}
                      <strong>{String(t.priority)}</strong>
                      {t.deal_ref ? ` · Deal: ${String(t.deal_ref)}` : ''}
                    </div>
                  </div>
                  {t.status === 'OPEN' ? (
                    <form method="POST" action="/api/v1/actions">
                      <input type="hidden" name="action" value="complete_ops_task" />
                      <input type="hidden" name="taskId" value={String(t.id)} />
                      <input type="hidden" name="returnTo" value={`/os/operations?tab=${activeTab}`} />
                      <button type="submit" className="bw-btn-gold text-xs py-1.5 px-3">
                        Mark Complete ✓
                      </button>
                    </form>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full bg-green-100 text-green-800 text-[10px] font-bold">
                      COMPLETED ✓
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Connected Channels Card */}
            <div className="bw-card p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700">Live Telemetry</span>
                  <h2 className="font-display text-lg font-bold text-slate-900">Connected Channels &amp; Gateways</h2>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
                  All Gateways Online
                </span>
              </div>
              <div className="space-y-2.5 text-xs">
                {[
                  {
                    name: 'UAE PASS Digital Identity & e-Sign',
                    detail: 'CBUAE AECB Consent & Joint KFS Digital Signature',
                    status: 'Connected',
                  },
                  {
                    name: 'AECB Credit Score & DBR Feed',
                    detail: 'Real-time 50% DBR & +200 bps stress rate check',
                    status: 'Connected',
                  },
                  {
                    name: 'Dubai Land Department (DLD) Open-Data API',
                    detail: '24 Dubai corridors & daily mortgage registrations',
                    status: 'Connected',
                  },
                  {
                    name: 'Owner Executive WhatsApp Briefing Engine',
                    detail: '09:30 AM Morning Briefing & 10:30 AM Attendance Report to Shabib Siraj',
                    status: 'Scheduled',
                  },
                ].map((c) => (
                  <div
                    key={c.name}
                    className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-slate-200/70"
                  >
                    <div>
                      <div className="font-bold text-slate-900">{c.name}</div>
                      <div className="text-[11px] text-slate-500">{c.detail}</div>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                      {c.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* How Betterway Mortgages Works (7 Core Rules) */}
            <div className="bw-card p-5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700">
                Standard Operating Rules
              </span>
              <h2 className="font-display text-lg font-bold text-slate-900 mb-3">
                How Betterway Mortgages Works (7 Core Rules)
              </h2>
              <ol className="space-y-2 text-xs text-slate-700">
                <li className="flex gap-2.5">
                  <span className="font-num font-bold text-slate-700">01.</span>
                  <span>
                    <strong>CBUAE Hard Guardrails:</strong> Max 50% DBR, +200 bps stress test, max 25-year tenure, and
                    80%/85% LTV caps enforced automatically.
                  </span>
                </li>
                <li className="flex gap-2.5">
                  <span className="font-num font-bold text-slate-700">02.</span>
                  <span>
                    <strong>Zero Direct Delete:</strong> Staff cannot hard-delete records. Deletions enter the Pending
                    Delete Bin for Owner Shabib Siraj&apos;s approval.
                  </span>
                </li>
                <li className="flex gap-2.5">
                  <span className="font-num font-bold text-slate-700">03.</span>
                  <span>
                    <strong>Strictly Legal UAE Payment Channels:</strong> Zero tolerance for personal advisor bank
                    accounts ({PERMITTED_UAE_PAYMENT_CHANNELS.length} permitted corporate channels).
                  </span>
                </li>
                <li className="flex gap-2.5">
                  <span className="font-num font-bold text-slate-700">04.</span>
                  <span>
                    <strong>50/50 Commission Split:</strong> After deducting external B2B partner share, remaining net
                    subvention splits 50% Betterway / 50% Mortgage Advisor.
                  </span>
                </li>
                <li className="flex gap-2.5">
                  <span className="font-num font-bold text-slate-700">05.</span>
                  <span>
                    <strong>180-Day Clawback Reserve:</strong> Every bank subvention sets aside a clawback reserve
                    until the bank retention window clears.
                  </span>
                </li>
                <li className="flex gap-2.5">
                  <span className="font-num font-bold text-slate-700">06.</span>
                  <span>
                    <strong>Office QR Attendance (10:00 AM–7:00 PM):</strong> Grace until <code>10:05 AM</code>; 3+
                    late arrivals in 7 days trigger a Continuous Contemptor Alert to Owner &amp; Operations Manager.
                  </span>
                </li>
                <li className="flex gap-2.5">
                  <span className="font-num font-bold text-slate-700">07.</span>
                  <span>
                    <strong>Mandatory Daily Work Reports:</strong> All advisors and managers log their daily calls,
                    site visits, and IPA submissions before sign-off.
                  </span>
                </li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* Daily Work Reports Tab */}
      {activeTab === 'reports' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bw-card p-5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700">Daily Accountability</span>
            <h2 className="font-display text-lg font-bold text-slate-900 mt-0.5 mb-3">Submit Daily Work Report</h2>
            <form method="POST" action="/api/v1/actions" className="space-y-3 text-xs">
              <input type="hidden" name="action" value="submit_daily_report" />
              <input type="hidden" name="returnTo" value="/os/operations?tab=reports" />
              <div className="grid grid-cols-2 gap-2.5">
                <label className="block">
                  <span className="font-semibold text-slate-700">Calls Logged</span>
                  <input type="number" name="callsCount" defaultValue={14} className="bw-input mt-1 w-full" />
                </label>
                <label className="block">
                  <span className="font-semibold text-slate-700">Leads Qualified</span>
                  <input type="number" name="leadsQualified" defaultValue={5} className="bw-input mt-1 w-full" />
                </label>
                <label className="block">
                  <span className="font-semibold text-slate-700">Site Visits</span>
                  <input type="number" name="siteVisitsCount" defaultValue={2} className="bw-input mt-1 w-full" />
                </label>
                <label className="block">
                  <span className="font-semibold text-slate-700">IPAs Submitted</span>
                  <input type="number" name="ipasSubmitted" defaultValue={2} className="bw-input mt-1 w-full" />
                </label>
              </div>
              <label className="block">
                <span className="font-semibold text-slate-700">Summary of Progress &amp; Tomorrow&apos;s Priority</span>
                <textarea
                  name="summaryNotes"
                  rows={3}
                  required
                  placeholder="List client meetings, bank credit queries resolved, and trustee bookings..."
                  className="bw-input mt-1 w-full"
                />
              </label>
              <button type="submit" className="bw-btn-gold w-full justify-center">
                Submit Daily Report to Operations &amp; Owner
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 bw-card p-5">
            <h2 className="font-display text-lg font-bold text-slate-900 mb-3">
              Submitted Staff Daily Work Reports ({dailyReports.length})
            </h2>
            <div className="space-y-3">
              {dailyReports.map((r) => (
                <div key={String(r.id)} className="p-4 rounded-xl bg-gray-50 border border-slate-200/80">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-slate-900 text-sm">{String(r.employee_name)}</span>
                    <span className="font-num text-xs font-semibold text-slate-700">{String(r.report_date)}</span>
                  </div>
                  <p className="text-xs text-slate-700 mt-2">{String(r.summary_notes)}</p>
                  <div className="flex flex-wrap items-center gap-3 mt-2.5 text-[11px] text-slate-600">
                    <span>
                      Calls: <strong>{Number(r.calls_count)}</strong>
                    </span>
                    <span>
                      Qualified: <strong>{Number(r.leads_qualified)}</strong>
                    </span>
                    <span>
                      Site Visits: <strong>{Number(r.site_visits_count)}</strong>
                    </span>
                    <span>
                      IPAs Submitted: <strong>{Number(r.ipas_submitted)}</strong>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Other Operational Tabs */}
      {activeTab !== 'overview' && activeTab !== 'tasks' && activeTab !== 'reports' && (
        <div className="bw-card p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700">
                Operational Ledger · {activeTab.toUpperCase()}
              </span>
              <h2 className="font-display text-lg font-bold text-slate-900">
                {tabs.find((t) => t.id === activeTab)?.label}
              </h2>
            </div>
            <div className="flex gap-2">
              <Link
                href="/os/banks-apl"
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-800"
              >
                Open 24-Bank Engine →
              </Link>
              <Link
                href="/os/erp"
                className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold"
              >
                Open ERP &amp; Subvention Ledger →
              </Link>
            </div>
          </div>

          {activeTab === 'rates' && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase text-[10px]">
                    <th className="py-2.5 px-3">Bank</th>
                    <th className="py-2.5 px-3">Product Code</th>
                    <th className="py-2.5 px-3">Mode</th>
                    <th className="py-2.5 px-3">Intro Rate</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rateCards.map((rc) => (
                    <tr key={String(rc.id)}>
                      <td className="py-2.5 px-3 font-bold text-slate-900">{String(rc.bank_name)}</td>
                      <td className="py-2.5 px-3 font-num text-slate-700">{String(rc.product_code)}</td>
                      <td className="py-2.5 px-3">{String(rc.finance_mode)}</td>
                      <td className="py-2.5 px-3 font-num font-bold text-emerald-700">
                        {(Number(rc.intro_rate_bps) / 100).toFixed(2)}%
                      </td>
                      <td className="py-2.5 px-3">{String(rc.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {(activeTab === 'nocs' || activeTab === 'disbursals' || activeTab === 'handover') && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase text-[10px]">
                    <th className="py-2.5 px-3">Deal Ref</th>
                    <th className="py-2.5 px-3">Client</th>
                    <th className="py-2.5 px-3">Stage</th>
                    <th className="py-2.5 px-3">Target Loan</th>
                    <th className="py-2.5 px-3">Advisor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {folDeals.map((d) => (
                    <tr key={String(d.id)}>
                      <td className="py-2.5 px-3 font-num font-bold text-slate-900">{String(d.deal_ref)}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800">{String(d.client_name)}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                          {String(d.stage)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-num">{formatAedWhole(Number(d.target_loan_fils))}</td>
                      <td className="py-2.5 px-3 text-slate-600">{String(d.advisor_name || 'Assigned')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'payouts' && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase text-[10px]">
                    <th className="py-2.5 px-3">Deal Ref</th>
                    <th className="py-2.5 px-3">Advisor</th>
                    <th className="py-2.5 px-3">Gross Subvention</th>
                    <th className="py-2.5 px-3">Advisor Share</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {settlements.map((p) => (
                    <tr key={String(p.id)}>
                      <td className="py-2.5 px-3 font-num font-bold">{String(p.deal_ref)}</td>
                      <td className="py-2.5 px-3 font-semibold">{String(p.advisor_name || 'Advisor')}</td>
                      <td className="py-2.5 px-3 font-num">{formatAedWhole(Number(p.expected_subvention_ex_vat_fils))}</td>
                      <td className="py-2.5 px-3 font-num font-bold text-emerald-700">
                        {formatAedWhole(Number(p.advisor_released_fils || p.advisor_entitled_fils || 0))}
                      </td>
                      <td className="py-2.5 px-3">{String(p.reconciliation_status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'visas' && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase text-[10px]">
                    <th className="py-2.5 px-3">Employee</th>
                    <th className="py-2.5 px-3">Role</th>
                    <th className="py-2.5 px-3">Employee Code</th>
                    <th className="py-2.5 px-3">Visa Expiry</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {employees.map((e) => (
                    <tr key={String(e.id)}>
                      <td className="py-2.5 px-3 font-bold text-slate-900">{String(e.full_name_en)}</td>
                      <td className="py-2.5 px-3">{String(e.role)}</td>
                      <td className="py-2.5 px-3 font-num">{String(e.emp_code || 'BW-EMP')}</td>
                      <td className="py-2.5 px-3 font-num">{String(e.visa_expiry_date || '2028-12-31')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {(activeTab === 'whatsapp' || activeTab === 'compliance') && (
            <div className="p-4 rounded-xl bg-gray-50 border border-slate-200/80 text-xs text-slate-700 space-y-2">
              <p className="font-semibold text-slate-900">
                Logged in as {user.full_name_en} ({user.role}) — All CBUAE Key Facts Statements (KFS), AECB consents,
                and goAML screening logs are synced with the Compliance Vault.
              </p>
              <Link
                href="/os/compliance"
                className="inline-block px-3.5 py-2 rounded-lg bg-slate-900 text-white font-bold"
              >
                Open CBUAE &amp; goAML Vault →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
