import Link from 'next/link';
import { getDb } from '@/server/db';
import { requireStaffUser } from '@/server/auth/request';
import { OsBanner } from '@/components/os-banner';
import { CheckCircle2, Clock, PlusCircle } from 'lucide-react';

export const dynamic = 'force-dynamic';

const ROLE_LABELS: Record<string, string> = {
  ALL: 'All Departments',
  SALES_ADVISOR: 'Sales & Advisory',
  CREDIT_UNDERWRITER: 'Bank Underwriting',
  PROGRESSION_MANAGER: 'Property Transfer & NOC',
  FINANCE_ADMIN: 'Accounting & Commissions',
  COMPLIANCE_MLRO: 'Compliance & ID Check',
  HR_MANAGER: 'HR & Office Operations',
  SUPER_ADMIN: 'Owner & Management',
};

export default async function InternalTasksPage({
  searchParams,
}: {
  searchParams: Promise<{ dept?: string; status?: string; notice?: string; error?: string }>;
}) {
  await requireStaffUser();
  const sp = await searchParams;
  const activeDept = sp.dept || 'ALL';
  const activeStatus = sp.status || 'OPEN';
  const db = getDb();

  const allTasks = db
    .prepare(
      `SELECT t.*, d.deal_ref, h.primary_name AS client_name
       FROM ops_tasks t
       LEFT JOIN deals d ON d.id = t.deal_id
       LEFT JOIN households h ON h.id = d.household_id
       ORDER BY CASE WHEN t.status = 'OPEN' THEN 0 ELSE 1 END,
                CASE t.priority WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 ELSE 2 END,
                t.id DESC`,
    )
    .all() as Array<{
    id: number;
    deal_id: number | null;
    deal_ref: string | null;
    client_name: string | null;
    assigned_role: string;
    priority: string;
    title: string;
    due_at: string;
    status: string;
  }>;

  const filteredTasks = allTasks.filter((t) => {
    if (activeStatus !== 'ALL' && t.status !== activeStatus) return false;
    if (activeDept !== 'ALL' && t.assigned_role !== activeDept) return false;
    return true;
  });

  const deals = db
    .prepare(
      `SELECT d.id, d.deal_ref, h.primary_name
       FROM deals d JOIN households h ON h.id = d.household_id
       WHERE d.origin_mode = 'LIVE' ORDER BY d.id DESC`,
    )
    .all() as Array<{ id: number; deal_ref: string; primary_name: string }>;

  const openCount = allTasks.filter((t) => t.status === 'OPEN').length;
  const completedCount = allTasks.filter((t) => t.status === 'COMPLETED').length;
  const criticalCount = allTasks.filter((t) => t.status === 'OPEN' && t.priority === 'CRITICAL').length;

  return (
    <div className="space-y-6">
      <OsBanner notice={sp.notice} error={sp.error} />

      {/* Top Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-gray-500">Open Internal Tasks</div>
            <div className="text-2xl font-bold text-gray-900 font-num mt-1">{openCount}</div>
          </div>
          <div className="h-10 w-10 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center">
            <Clock className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-gray-500">Urgent / Critical Tasks</div>
            <div className="text-2xl font-bold text-red-600 font-num mt-1">{criticalCount}</div>
          </div>
          <div className="h-10 w-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
            <Clock className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-gray-500">Completed Tasks</div>
            <div className="text-2xl font-bold text-green-600 font-num mt-1">{completedCount}</div>
          </div>
          <div className="h-10 w-10 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Create / Assign New Internal Task Form */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <PlusCircle className="h-5 w-5 text-slate-700" />
          <h2 className="text-base font-bold text-gray-900">
            Assign a New Internal Company Task to Any Department
          </h2>
        </div>

        <form method="POST" action="/api/v1/actions" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          <input type="hidden" name="action" value="create_ops_task" />
          <input type="hidden" name="returnTo" value="/os/activities" />

          <label className="sm:col-span-2 block">
            <span className="font-semibold text-gray-700">Task Description (What needs to be done?)</span>
            <input
              name="title"
              required
              placeholder="e.g. Collect updated 6-month bank statement & salary certificate"
              className="bw-input mt-1 w-full"
            />
          </label>

          <label className="block">
            <span className="font-semibold text-gray-700">Assign To Department</span>
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
            <span className="font-semibold text-gray-700">Priority &amp; Related Deal</span>
            <div className="grid grid-cols-2 gap-1.5 mt-1">
              <select name="priority" className="bw-input w-full">
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
                <option value="NORMAL">Normal</option>
              </select>
              <select name="dealId" className="bw-input w-full">
                <option value="">General Company Task</option>
                {deals.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.deal_ref}
                  </option>
                ))}
              </select>
            </div>
          </label>

          <div className="flex items-end">
            <button type="submit" className="bw-btn-gold w-full justify-center py-2.5">
              + Assign Internal Task
            </button>
          </div>
        </form>
      </div>

      {/* Department & Status Filter Bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(ROLE_LABELS).map(([roleKey, label]) => (
            <Link
              key={roleKey}
              href={`/os/activities?dept=${roleKey}&status=${activeStatus}`}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                activeDept === roleKey
                  ? 'bg-slate-900 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {label}
            </Link>
          ))}
        </div>

        <div className="flex gap-1.5">
          {[
            ['OPEN', `Open (${openCount})`],
            ['COMPLETED', `Completed (${completedCount})`],
            ['ALL', `All (${allTasks.length})`],
          ].map(([st, label]) => (
            <Link
              key={st}
              href={`/os/activities?dept=${activeDept}&status=${st}`}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                activeStatus === st
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      {/* Internal Tasks List */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs divide-y divide-gray-100">
        {filteredTasks.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            No internal tasks match this filter. Use the form above to assign a new internal task.
          </div>
        ) : (
          filteredTasks.map((t) => (
            <div key={t.id} className="p-4 flex flex-wrap items-center justify-between gap-3 text-xs hover:bg-gray-50/70">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <span
                  className={`mt-1 h-2.5 w-2.5 rounded-full shrink-0 ${
                    t.status === 'COMPLETED'
                      ? 'bg-green-500'
                      : t.priority === 'CRITICAL'
                      ? 'bg-red-500'
                      : 'bg-slate-1000'
                  }`}
                />
                <div className="min-w-0">
                  <div className="font-bold text-sm text-gray-900">{t.title.replace('[WF] ', '')}</div>
                  <div className="flex flex-wrap items-center gap-2 mt-1 text-gray-500">
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200 text-[10px] font-bold">
                      {ROLE_LABELS[t.assigned_role] || t.assigned_role}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-[10px] font-semibold">
                      Priority: {t.priority}
                    </span>
                    {t.deal_id && (
                      <Link
                        href={`/os/deals/${t.deal_id}`}
                        className="font-semibold text-slate-700 hover:underline"
                      >
                        Deal: {t.deal_ref} ({t.client_name})
                      </Link>
                    )}
                    <span className="font-num">Due: {t.due_at.slice(0, 16).replace('T', ' ')}</span>
                  </div>
                </div>
              </div>

              {t.status === 'OPEN' ? (
                <form method="POST" action="/api/v1/actions">
                  <input type="hidden" name="action" value="complete_ops_task" />
                  <input type="hidden" name="taskId" value={t.id} />
                  <input
                    type="hidden"
                    name="returnTo"
                    value={`/os/activities?dept=${activeDept}&status=${activeStatus}`}
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-semibold cursor-pointer transition"
                  >
                    Mark Complete ✓
                  </button>
                </form>
              ) : (
                <span className="px-3 py-1 rounded-full bg-green-100 text-green-800 font-bold text-[11px]">
                  Completed ✓
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
