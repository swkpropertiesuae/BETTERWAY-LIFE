import { getDb } from '@/server/db';
import { getActiveLang, requireStaffUser } from '@/server/auth/request';
import { formatAed, tr } from '@/lib/format';
import { PageHeader } from '@/components/page-header';
import { OsBanner } from '@/components/os-banner';
import {
  calculateUaeGratuityFils,
  computeNafisComplianceStatus,
  getDocumentExpiryWatchlist,
} from '@/server/engines/wps-gratuity-engine';

export default async function HrmAndWpsPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const user = await requireStaffUser();
  const lang = await getActiveLang(user);
  const sp = await searchParams;
  if (!['SUPER_ADMIN', 'HR_MANAGER', 'FINANCE_ADMIN'].includes(user.role)) {
    return (
      <div className="bw-card p-8 text-sm text-rose-900 bg-rose-50 border-rose-200">
        🔒 403 — Staff salaries, IBANs, draws and WPS .SIF files are restricted to HR, Finance and Managing Director roles ({user.role} is not permitted).
      </div>
    );
  }
  const db = getDb();

  const nafis = computeNafisComplianceStatus(db);
  const expiryAlerts = getDocumentExpiryWatchlist(db, 365);

  const employees = db.prepare('SELECT * FROM employees ORDER BY id ASC').all() as Record<string, unknown>[];
  const payrollRuns = db.prepare('SELECT * FROM payroll_runs ORDER BY id DESC').all() as Record<string, unknown>[];

  const nowMs = Date.now();

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <OsBanner notice={sp.notice} error={sp.error} />

      <PageHeader app="Employees" appHref="/os/hrm" title="Staff & Payroll" sub={tr(lang, 'UAE Workforce Roster, Recoverable Advisor Draws & Wage Protection System', 'سجل الموظفين، السلف المستردة للمستشارين ونظام حماية الأجور')} />

      {/* Nafis + WPS Summary */}
      <div className="grid md:grid-cols-3 gap-4 text-xs">
        <div className="bw-card p-5">
          <div className="text-slate-500">MOHRE Emiratisation / Nafis Status</div>
          <div className="font-display text-lg font-bold text-[#021125] mt-1">
            {nafis.emiratiCount} Qualifying Emiratis / {nafis.totalHeadcount} Staff
          </div>
          <div className={`mt-1 font-semibold ${nafis.compliant ? 'text-emerald-700' : 'text-rose-700'}`}>
            {nafis.compliant ? '✓ Compliant with Mainland Skilled Target' : `⚠ Shortfall: ${nafis.shortfallSlots} slot(s)`}
          </div>
        </div>

        <div className="bw-card p-5">
          <div className="text-slate-500">GPSSA Pension Rule (UAE Nationals)</div>
          <div className="font-display text-lg font-bold text-[#021125] mt-1">5.0% Employee · 12.5% Employer</div>
          <div className="text-slate-600 mt-1">Auto-computed on Basic + Housing in monthly WPS run</div>
        </div>

        <div className="bw-card p-5">
          <div className="text-slate-500">Statutory EOSB Formula (Decree-Law 33/2021)</div>
          <div className="font-display text-lg font-bold text-[#021125] mt-1">21d (Yrs 1–5) · 30d (Yr 5+)</div>
          <div className="text-slate-600 mt-1">Strictly on Basic Salary (allowances & commissions excluded)</div>
        </div>
      </div>

      {/* Run Monthly WPS Payroll + Download .SIF */}
      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bw-card p-5 space-y-3 text-xs">
          <h2 className="font-display font-bold text-base text-[#021125]">
            Generate Monthly MOHRE WPS `.SIF` File
          </h2>
          <p className="text-slate-600">
            Calculates paid vs unpaid leave days, Emirati GPSSA deductions, advisor commission releases, and recoverable draw deficit recoupment, then posts balanced GL entries.
          </p>
          <form method="POST" action="/api/v1/actions" className="space-y-2.5">
            <input type="hidden" name="action" value="run_wps_payroll" />
            <input type="hidden" name="returnTo" value="/os/hrm" />
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block font-semibold mb-1">Month (YYYY-MM)</label>
                <input name="periodMonth" defaultValue="2026-11" className="bw-input font-num" />
              </div>
              <div>
                <label className="block font-semibold mb-1">Period Start</label>
                <input type="date" name="payStartDate" defaultValue="2026-11-01" className="bw-input font-num" />
              </div>
              <div>
                <label className="block font-semibold mb-1">Period End</label>
                <input type="date" name="payEndDate" defaultValue="2026-11-30" className="bw-input font-num" />
              </div>
            </div>
            <button type="submit" className="bw-btn-gold w-full">
              Execute Payroll & Generate MOHRE .SIF
            </button>
          </form>
        </div>

        <div className="lg:col-span-7 bw-card p-5 space-y-3 text-xs">
          <h2 className="font-display font-bold text-base text-[#021125]">
            Generated MOHRE WPS `.SIF` Batches ({payrollRuns.length})
          </h2>
          {payrollRuns.length === 0 ? (
            <div className="text-slate-400">No WPS payroll runs executed yet — click &ldquo;Execute Payroll&rdquo; on the left to generate `EDR` + `SCR` `.SIF` output.</div>
          ) : (
            <div className="space-y-3">
              {payrollRuns.map((pr) => (
                <div key={String(pr.id)} className="rounded-lg border border-slate-200 p-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-bold text-[#021125] font-num">{String(pr.period_month)}</span> ·{' '}
                      <span className="font-num text-slate-600">{String(pr.sif_filename)}</span> · Net Transfer:{' '}
                      <strong className="font-num">{formatAed(Number(pr.total_net_fils))}</strong>
                    </div>
                    <a href={`/api/v1/exports/sif/${String(pr.id)}`} className="bw-btn-navy">
                      ⬇ Download .SIF File
                    </a>
                  </div>
                  <pre className="overflow-x-auto rounded bg-slate-900 text-emerald-300 p-2.5 text-[10px] font-num">
                    {String(pr.sif_content)}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Employee Directory & EOSB Accrual Table */}
      <div className="bw-card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 font-display font-bold text-sm text-[#021125]">
          UAE Active Staff, Recoverable Draw Deficits & Live Statutory EOSB Gratuity Accrual
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-4 py-2.5 text-start">Employee</th>
                <th className="px-4 py-2.5 text-start">MOHRE ID / IBAN</th>
                <th className="px-4 py-2.5 text-end">Basic Salary</th>
                <th className="px-4 py-2.5 text-end">Allowances</th>
                <th className="px-4 py-2.5 text-end">Monthly Draw / Deficit</th>
                <th className="px-4 py-2.5 text-end">Accrued EOSB (Expat) / GPSSA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {employees.map((e) => {
                const basic = Number(e.basic_salary_fils);
                const allow =
                  Number(e.housing_allowance_fils) +
                  Number(e.transport_allowance_fils) +
                  Number(e.other_allowance_fils);
                const serviceDays = Math.max(0, Math.floor((nowMs - Date.parse(String(e.join_date) + 'T00:00:00Z')) / 86_400_000));
                const eosb =
                  Number(e.is_uae_national) === 1
                    ? null
                    : calculateUaeGratuityFils({
                        basicSalaryFils: basic,
                        totalMonthlySalaryFils: basic + allow,
                        grossServiceDays: serviceDays,
                        unpaidLeaveDays: 0,
                      });

                return (
                  <tr key={String(e.id)}>
                    <td className="px-4 py-3">
                      <div className="font-bold text-[#021125]">
                        {String(e.full_name)}{' '}
                        {Number(e.is_uae_national) === 1 && (
                          <span className="bw-badge bg-emerald-100 text-emerald-900">UAE National · Nafis</span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {String(e.emp_code)} · {String(e.designation)} · Joined {String(e.join_date)}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-num text-[11px] text-slate-600">
                      <div>MOL: {String(e.mohre_person_id_14)}</div>
                      <div>{String(e.employee_iban_23)}</div>
                    </td>
                    <td className="px-4 py-3 text-end font-num font-semibold">{formatAed(basic)}</td>
                    <td className="px-4 py-3 text-end font-num">{formatAed(allow)}</td>
                    <td className="px-4 py-3 text-end font-num">
                      {formatAed(Number(e.monthly_draw_fils))} /{' '}
                      <span className="text-rose-700">{formatAed(Number(e.draw_deficit_fils))}</span>
                    </td>
                    <td className="px-4 py-3 text-end font-num font-bold text-[#021125]">
                      {eosb ? `${formatAed(eosb.gratuityFils)} (${eosb.netServiceYears}y)` : `GPSSA ${String(e.gpssa_number)}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Document Expiry Watchlist + Leave Logger */}
      <div className="grid lg:grid-cols-12 gap-6 text-xs">
        <div className="lg:col-span-6 bw-card p-5 space-y-2.5">
          <h3 className="font-display font-bold text-sm text-[#021125]">
            UAE Residence Visa, Emirates ID, RERA Broker Card & Medical Insurance Watchlist
          </h3>
          {expiryAlerts.map((a, idx) => (
            <div key={idx} className="rounded border border-amber-200 bg-amber-50/50 px-3 py-2 flex justify-between">
              <span>
                <strong>{a.fullName}</strong> ({a.empCode}) — {a.docType}
              </span>
              <span className="font-num font-semibold text-[#8A6518]">Expires {a.expiryDate}</span>
            </div>
          ))}
        </div>

        <div className="lg:col-span-6 bw-card p-5 space-y-3">
          <h3 className="font-display font-bold text-sm text-[#021125]">
            Record Statutory Annual / Sick / Parental / Unpaid Leave
          </h3>
          <form method="POST" action="/api/v1/actions" className="grid grid-cols-2 gap-2.5">
            <input type="hidden" name="action" value="add_leave_record" />
            <input type="hidden" name="returnTo" value="/os/hrm" />
            <select name="employeeId" className="bw-input">
              {employees.map((e) => (
                <option key={String(e.id)} value={String(e.id)}>{String(e.full_name)}</option>
              ))}
            </select>
            <select name="leaveType" className="bw-input">
              <option value="ANNUAL">Annual Leave</option>
              <option value="UNPAID">Unpaid Leave (Deducts WPS & EOSB)</option>
              <option value="SICK">Sick Leave</option>
              <option value="MATERNITY">Maternity Leave</option>
              <option value="PARENTAL">Parental Leave</option>
            </select>
            <input type="date" name="startDate" defaultValue="2026-11-10" className="bw-input font-num" />
            <input type="number" name="daysCount" defaultValue={3} placeholder="Days" className="bw-input font-num" />
            <input type="hidden" name="endDate" value="2026-11-12" />
            <div className="col-span-2">
              <button type="submit" className="bw-btn-navy w-full">Log Approved Leave Record</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
