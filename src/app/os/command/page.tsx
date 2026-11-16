import { getDb } from '@/server/db';
import { getActiveLang, requireStaffUser } from '@/server/auth/request';
import { DEAL_STAGE_LABELS, formatAed, formatMicroPct, tr } from '@/lib/format';
import { PageHeader } from '@/components/page-header';
import { OsBanner } from '@/components/os-banner';
import { getDocumentExpiryWatchlist } from '@/server/engines/wps-gratuity-engine';
import { computeExecutiveForecastAndBi } from '@/server/engines/statement-and-policy-copilot';

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
  const pendingRates = (
    db.prepare("SELECT COUNT(*) as c FROM bank_rate_cards WHERE status = 'PENDING_APPROVAL'").get() as { c: number }
  ).c;
  const pendingOrns = (
    db.prepare("SELECT COUNT(*) as c FROM partner_agencies WHERE verification_status = 'PENDING_ORN_CHECK'").get() as {
      c: number;
    }
  ).c;
  const unrespondedLeads = (
    db.prepare("SELECT COUNT(*) as c FROM leads WHERE first_responded_at IS NULL AND stage = 'NEW'").get() as { c: number }
  ).c;
  const docAlerts = getDocumentExpiryWatchlist(db, 180);

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
                t.id DESC`,
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
      `SELECT d.id, d.deal_ref, h.primary_name, d.community_name, d.target_loan_fils, d.stage, d.cdd_status, b.short_name as bank_short
       FROM deals d
       JOIN households h ON h.id = d.household_id
       LEFT JOIN banks b ON b.id = d.selected_bank_id
       WHERE d.origin_mode = 'LIVE'
       ORDER BY d.id DESC LIMIT 8`,
    )
    .all() as {
    id: number;
    deal_ref: string;
    primary_name: string;
    community_name: string;
    target_loan_fils: number;
    stage: string;
    cdd_status: string;
    bank_short: string | null;
  }[];

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <OsBanner notice={sp.notice} error={sp.error} />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeader app="Activities" appHref="/os/activities" title="Command Board" sub={tr(lang, 'Betterway Operations & SLA Breach Wall', 'لوحة العمليات ومراقبة اتفاقيات مستوى الخدمة')} />
        {latestEibor && (
          <div className="bw-card px-4 py-2.5 flex items-center gap-4 text-xs">
            <span className="font-semibold text-[#021125]">CBUAE 3M EIBOR ({String(latestEibor.fixing_date)}):</span>
            <span className="font-num font-bold text-[#8A6518] text-sm">
              {formatMicroPct(Number(latestEibor.three_month_micro))}
            </span>
          </div>
        )}
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bw-card p-5">
          <div className="text-xs text-slate-500">{tr(lang, 'Active Mortgage Pipeline', 'إجمالي التمويلات النشطة')}</div>
          <div className="font-num text-xl font-bold text-[#021125] mt-1">{formatAed(bi.grossPipelineLoanFils)}</div>
          <div className="text-xs text-emerald-700 mt-1 font-medium">
            {bi.activeDealsCount} live files · Net Weighted House: <span className="font-num">{formatAed(bi.weightedNetHouseAfterSplitsAndClawbackFils)}</span>
          </div>
        </div>

        <div className="bw-card p-5">
          <div className="text-xs text-slate-500">{tr(lang, '5-Min Lead SLA Queue', 'طابور الاستجابة خلال 5 دقائق')}</div>
          <div className="font-num text-xl font-bold text-[#021125] mt-1">{unrespondedLeads} Unresponded</div>
          <a href="/os/crm" className="text-xs text-[#8A6518] font-semibold mt-1 inline-block hover:underline">
            Open Omnichannel CRM →
          </a>
        </div>

        <div className="bw-card p-5">
          <div className="text-xs text-slate-500">{tr(lang, 'Governance Queues', 'طوابير الحوكمة والاعتماد')}</div>
          <div className="font-num text-xl font-bold text-[#021125] mt-1">
            {pendingRates} Rate Card · {pendingOrns} ORN Check
          </div>
          <a href="/os/banks-apl" className="text-xs text-[#8A6518] font-semibold mt-1 inline-block hover:underline">
            Review Maker-Checker Queue →
          </a>
        </div>

        <div className="bw-card p-5">
          <div className="text-xs text-slate-500">{tr(lang, 'MOHRE / RERA Expiry Watchdog', 'تنبيهات انتهاء الإقامات وبطاقات ريرا')}</div>
          <div className="font-num text-xl font-bold text-[#021125] mt-1">{docAlerts.length} Staff Alerts (&lt;180d)</div>
          <a href="/os/hrm" className="text-xs text-[#8A6518] font-semibold mt-1 inline-block hover:underline">
            Inspect HR & WPS Roster →
          </a>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bw-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-bold text-base text-[#021125]">
              {tr(lang, 'Critical Progression, KFS & Conveyancing SLA Tasks', 'مهام المتابعة الحرجة والالتزام')}
            </h2>
          </div>

          <div className="divide-y divide-slate-100">
            {tasks.map((t) => (
              <div key={t.id} className="py-3 flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`bw-badge ${
                        t.status === 'COMPLETED'
                          ? 'bg-slate-100 text-slate-500'
                          : t.priority === 'CRITICAL'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-900'
                      }`}
                    >
                      {t.status === 'COMPLETED' ? 'DONE' : t.priority}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">{t.assigned_role}</span>
                    {t.deal_ref && (
                      <a href={`/os/los`} className="font-num text-xs font-bold text-[#8A6518] hover:underline">
                        {t.deal_ref}
                      </a>
                    )}
                  </div>
                  <div className={`text-sm font-medium mt-1 ${t.status === 'COMPLETED' ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                    {t.title}
                  </div>
                  <div className="text-[11px] font-num text-slate-500">Due: {t.due_at.slice(0, 16).replace('T', ' ')} UTC</div>
                </div>
                {t.status === 'OPEN' && (
                  <form method="POST" action="/api/v1/actions">
                    <input type="hidden" name="action" value="complete_ops_task" />
                    <input type="hidden" name="taskId" value={t.id} />
                    <input type="hidden" name="returnTo" value="/os/command" />
                    <button type="submit" className="bw-btn-navy text-xs">
                      Mark Done
                    </button>
                  </form>
                )}
              </div>
            ))}
          </div>

          <form method="POST" action="/api/v1/actions" className="pt-3 border-t border-slate-200 grid sm:grid-cols-12 gap-2">
            <input type="hidden" name="action" value="create_ops_task" />
            <input type="hidden" name="returnTo" value="/os/command" />
            <input
              name="title"
              required
              placeholder="Add morning standup action item (e.g. Chase DLD NOC for Marina Gate)..."
              className="bw-input sm:col-span-6"
            />
            <select name="assignedRole" className="bw-input sm:col-span-3">
              <option value="SALES_ADVISOR">SALES_ADVISOR</option>
              <option value="CREDIT_UNDERWRITER">CREDIT_UNDERWRITER</option>
              <option value="PROGRESSION_MANAGER">PROGRESSION_MANAGER</option>
              <option value="COMPLIANCE_MLRO">COMPLIANCE_MLRO</option>
              <option value="FINANCE_ADMIN">FINANCE_ADMIN</option>
            </select>
            <select name="priority" className="bw-input sm:col-span-1">
              <option value="CRITICAL">CRIT</option>
              <option value="HIGH">HIGH</option>
            </select>
            <button type="submit" className="bw-btn-gold sm:col-span-2">
              + Add Task
            </button>
          </form>
        </div>

        <div className="lg:col-span-5 bw-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-bold text-base text-[#021125]">
              {tr(lang, 'Live Mortgage Deal Board', 'ملفات الرهن العقاري الحية')}
            </h2>
            <a href="/os/los" className="text-xs font-semibold text-[#8A6518] hover:underline">
              Open 24-Bank LOS →
            </a>
          </div>

          <div className="space-y-2.5">
            {activeDeals.map((d) => (
              <a
                key={d.id}
                href={`/os/los?dealId=${d.id}`}
                className="block rounded-lg border border-slate-200 p-3 hover:border-[#D7B04E] transition"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-num text-xs font-bold text-[#021125]">{d.deal_ref}</span>
                  <span className="bw-badge bg-slate-100 text-slate-800">
                    {DEAL_STAGE_LABELS[d.stage]?.[lang] ?? d.stage}
                  </span>
                </div>
                <div className="font-semibold text-sm text-slate-900 mt-1">{d.primary_name}</div>
                <div className="flex items-center justify-between text-xs text-slate-500 mt-1">
                  <span>{d.community_name} · {d.bank_short || 'TBD'}</span>
                  <span className="font-num font-semibold text-slate-900">{formatAed(d.target_loan_fils)}</span>
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
