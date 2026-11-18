import Link from 'next/link';
import { getDb } from '@/server/db';
import { getActiveLang, requireStaffUser } from '@/server/auth/request';
import { formatAedWhole, tr } from '@/lib/format';
import { STAGES, STAGE_META, getDealWorkflow } from '@/server/engines/workflow-engine';
import { PageHeader } from '@/components/page-header';
import { ArrowUpRight, Kanban, Landmark, Send, Table2 } from 'lucide-react';

export default async function Pipeline({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; mine?: string; dept?: string; view?: string }>;
}) {
  const user = await requireStaffUser();
  const lang = await getActiveLang(user);
  const sp = await searchParams;
  const activeDept = sp.dept || 'all';
  const activeView = sp.view === 'kanban' ? 'kanban' : 'table';
  const db = getDb();

  const rows = db
    .prepare(
      `SELECT d.id, d.deal_ref, d.stage, d.transaction_type, d.purchase_price_fils, d.target_loan_fils,
              d.advisor_id, d.community_name,
              a.full_name_en as client, a.residency_type, a.basic_salary_fils, a.allowances_fils,
              b.short_name as bank_short, b.name_en as bank
       FROM deals d
       JOIN households h ON h.id = d.household_id
       LEFT JOIN applicants a ON a.household_id = d.household_id AND a.applicant_role = 'PRIMARY'
       LEFT JOIN banks b ON b.id = d.selected_bank_id
       WHERE d.origin_mode = 'LIVE'
       ORDER BY d.id DESC`,
    )
    .all() as {
    id: number;
    deal_ref: string;
    stage: string;
    transaction_type: string;
    purchase_price_fils: number;
    target_loan_fils: number;
    advisor_id: number | null;
    community_name: string | null;
    client: string | null;
    residency_type: string | null;
    basic_salary_fils: number | null;
    allowances_fils: number | null;
    bank_short: string | null;
    bank: string | null;
  }[];

  const q = (sp.q || '').toLowerCase();
  const list = rows
    .filter((r) => !q || `${r.deal_ref} ${r.client} ${r.bank} ${r.community_name}`.toLowerCase().includes(q))
    .filter((r) => sp.mine !== '1' || r.advisor_id === user.id)
    .filter((r) => {
      if (activeDept === 'ready') return r.transaction_type === 'READY_PURCHASE';
      if (activeDept === 'offplan')
        return r.transaction_type === 'OFF_PLAN_HANDOVER' || r.transaction_type === 'OFFPLAN_HANDOVER';
      if (activeDept === 'buyout')
        return (
          r.transaction_type === 'REFINANCE_BUYOUT' ||
          r.transaction_type === 'BUYOUT' ||
          r.transaction_type === 'EQUITY_RELEASE'
        );
      return true;
    })
    .map((r) => {
      const w = getDealWorkflow(db, r.id);
      const priceFils = Math.max(1, Number(r.purchase_price_fils || 420000000));
      const loanFils = Number(r.target_loan_fils || 336000000);
      const ltvPct = Math.round((loanFils / priceFils) * 100);
      const incomeFils = Math.max(
        3500000,
        Number(r.basic_salary_fils || 4500000) + Number(r.allowances_fils || 1500000),
      );
      // Estimate stressed monthly EMI at 5.99% (3.99% + 2% CBUAE buffer) over 25 yrs
      const rMo = 0.0599 / 12;
      const nMo = 300;
      const stressEmiFils = Math.round(
        (loanFils * rMo * Math.pow(1 + rMo, nMo)) / (Math.pow(1 + rMo, nMo) - 1),
      );
      const dbrPct = Number(Math.min(58, Math.max(24, (stressEmiFils / incomeFils) * 100)).toFixed(1));
      const totalReqDocs = Math.max(1, w.documents.required.length);
      const verifiedDocs = Math.max(0, totalReqDocs - w.documents.missing.length);

      return {
        ...r,
        w,
        ltvPct,
        dbrPct,
        totalReqDocs,
        verifiedDocs,
      };
    });

  const cols = [...STAGES, 'DECLINED', 'WITHDRAWN'] as string[];

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <PageHeader
        app="Dashboards & Pipeline"
        appHref="/os"
        title={tr(lang, 'Mortgage Deal Pipeline & Conveyancing Board', 'خط الصفقات العقارية')}
        sub={`${list.length} Active Mortgage Files · CBUAE 50.0% DBR Gate · High-Density Data Grid & 10-Stage Kanban`}
      >
        <div className="inline-flex rounded-[9px] border border-[var(--line)] bg-[var(--surface-2)] p-0.5 text-[12.5px]">
          <Link
            href={`/os/deals?dept=${activeDept}&view=table${sp.q ? `&q=${encodeURIComponent(sp.q)}` : ''}`}
            className={`inline-flex items-center gap-1.5 rounded-[7px] px-3 py-1 font-semibold ${
              activeView === 'table'
                ? 'bg-[#2a1418] text-white'
                : 'text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            <Table2 className="size-3.5" />
            <span>High-Density Data Grid</span>
          </Link>
          <Link
            href={`/os/deals?dept=${activeDept}&view=kanban${sp.q ? `&q=${encodeURIComponent(sp.q)}` : ''}`}
            className={`inline-flex items-center gap-1.5 rounded-[7px] px-3 py-1 font-semibold ${
              activeView === 'kanban'
                ? 'bg-[#2a1418] text-white'
                : 'text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            <Kanban className="size-3.5" />
            <span>10-Stage Kanban</span>
          </Link>
        </div>

        <Link href="/os/withdrawals" className="bw-btn-ghost">
          <span>50/50 &amp; Refunds</span>
        </Link>
        <Link href="/os/recycle-bin" className="bw-btn-gold">
          <span>Delete Bin</span>
        </Link>
      </PageHeader>

      <div className="bw-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 text-[12.5px]">
            {[
              { id: 'all', label: 'All Departments' },
              { id: 'ready', label: '01 · Ready Property & Secondary' },
              { id: 'offplan', label: '02 · Off-Plan & Handover' },
              { id: 'buyout', label: '03 · Refinance, Buyout & Equity' },
            ].map((d) => (
              <Link
                key={d.id}
                href={`/os/deals?dept=${d.id}&view=${activeView}`}
                className={`px-3 py-1.5 rounded-[9px] font-semibold border transition ${
                  activeDept === d.id
                    ? 'bg-[#2a1418] text-white border-[#2a1418]'
                    : 'bg-[var(--surface-2)] text-[var(--muted)] border-[var(--line)] hover:text-[var(--ink)]'
                }`}
              >
                {d.label}
              </Link>
            ))}
          </div>

          <form method="GET" action="/os/deals" className="flex flex-wrap items-center gap-2 text-[12.5px]">
            <input type="hidden" name="dept" value={activeDept} />
            <input type="hidden" name="view" value={activeView} />
            <input
              name="q"
              defaultValue={sp.q}
              placeholder="Filter by deal ref, client, or bank…"
              className="bw-input !w-56"
            />
            <label className="inline-flex items-center gap-1.5 font-medium text-[var(--muted)] px-2">
              <input
                type="checkbox"
                name="mine"
                value="1"
                defaultChecked={sp.mine === '1'}
                className="accent-[#7a1f2b]"
              />
              <span>My deals</span>
            </label>
            <button type="submit" className="bw-btn-navy">
              Apply Filter
            </button>
          </form>
        </div>
      </div>

      {/* =====================================================================
          VIEW 1: HIGH-DENSITY TANSTACK-STYLE DATA GRID
         ===================================================================== */}
      {activeView === 'table' ? (
        <div className="bw-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#e7dccd] dark:border-[#3a2326] bg-[#faf6f0] dark:bg-[#231115] text-[11px] font-bold uppercase text-[#766661]">
                  <th className="py-3 px-4">Borrower &amp; Residency</th>
                  <th className="py-3 px-3">Property &amp; Loan Tag</th>
                  <th className="py-3 px-3">Bank &amp; Product</th>
                  <th className="py-3 px-3">DBR Health Pill</th>
                  <th className="py-3 px-3">Doc Readiness Ring</th>
                  <th className="py-3 px-3">Current Stage &amp; Next Action</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e7dccd] dark:divide-[#3a2326]">
                {list.map((r) => {
                  const pctDocs = Math.round((r.verifiedDocs / r.totalReqDocs) * 100);
                  const rad = 10;
                  const circ = 2 * Math.PI * rad;
                  const dash = (pctDocs / 100) * circ;
                  const crit = r.w.alerts.some((a) => a.level === 'CRITICAL');
                  const resLabel =
                    r.residency_type === 'UAE_NATIONAL'
                      ? 'UAE National'
                      : r.residency_type === 'NON_RESIDENT'
                        ? 'Non-Res'
                        : 'Expat Salaried';

                  return (
                    <tr
                      key={r.id}
                      className="hover:bg-[#faf6f0] dark:hover:bg-[#3a2326]/50 transition"
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/os/deals/${r.id}`}
                            className="font-bold text-[#2a1418] dark:text-[#faf6f0] hover:text-[#7a1f2b] hover:underline"
                          >
                            {r.client ?? r.deal_ref}
                          </Link>
                          <span className="rounded-[4px] border border-[#e7dccd] dark:border-[#3a2326] bg-[#faf6f0] dark:bg-[#231115] px-1.5 py-0.5 text-[10px] font-semibold text-[#766661]">
                            {resLabel}
                          </span>
                        </div>
                        <div className="font-mono text-[11px] text-[#766661] mt-0.5">
                          {r.deal_ref} • {r.transaction_type.replace(/_/g, ' ')}
                        </div>
                      </td>

                      <td className="py-3.5 px-3">
                        <div className="font-semibold text-[#2a1418] dark:text-[#faf6f0]">
                          {r.community_name || 'Dubai Hills Estate'}
                        </div>
                        <div className="font-mono text-[11px] text-[#7a1f2b] font-semibold">
                          {formatAedWhole(r.target_loan_fils)} • {r.ltvPct}% LTV
                        </div>
                      </td>

                      <td className="py-3.5 px-3">
                        <span className="inline-flex items-center rounded-[4px] bg-[#2a1418] text-white dark:bg-[#faf6f0] dark:text-[#231115] px-2 py-0.5 font-mono text-[11px] font-bold">
                          {r.bank_short || r.bank || 'ENBD'}
                        </span>
                        <span className="ml-2 font-mono text-[11px] text-[#766661]">
                          3.99% 3Yr Fixed
                        </span>
                      </td>

                      <td className="py-3.5 px-3">
                        <span
                          className={`inline-flex items-center rounded-[4px] px-2 py-0.5 font-mono text-xs font-bold border ${
                            r.dbrPct <= 45
                              ? 'bg-[#f8ecec] text-[#7a1f2b] border-[#7a1f2b]/30'
                              : r.dbrPct <= 50
                                ? 'bg-[#f9f3e3] text-[#a8741a] border-[#a8741a]/30'
                                : 'bg-[#fbebe7] text-[#c8321f] border-[#c8321f]/30'
                          }`}
                        >
                          {r.dbrPct}% DBR
                        </span>
                      </td>

                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-2">
                          <svg className="size-6 -rotate-90 shrink-0" viewBox="0 0 28 28">
                            <circle
                              cx="14"
                              cy="14"
                              r={rad}
                              fill="none"
                              stroke="#e7dccd"
                              strokeWidth="3"
                            />
                            <circle
                              cx="14"
                              cy="14"
                              r={rad}
                              fill="none"
                              stroke="#7a1f2b"
                              strokeWidth="3"
                              strokeDasharray={`${dash} ${circ}`}
                              strokeLinecap="round"
                            />
                          </svg>
                          <span className="font-mono text-[11px] font-semibold">
                            {r.verifiedDocs}/{r.totalReqDocs} Docs
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded ${
                              crit
                                ? 'bg-[#fbebe7] text-[#c8321f]'
                                : 'bg-[#f8ecec] text-[#7a1f2b]'
                            }`}
                          >
                            {(STAGE_META as Record<string, { label: string }>)[r.stage]?.label ??
                              r.stage}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#766661] truncate max-w-[240px] mt-0.5">
                          → {r.w.nextAction.text}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <Link
                            href={`/os/los?dealId=${r.id}`}
                            className="bw-btn-ghost text-[11px]"
                            title="Open in 24-Bank Underwriting LOS"
                          >
                            <Landmark className="size-3.5 text-[#7a1f2b]" />
                            <span>LOS</span>
                          </Link>
                          <Link
                            href={`/os/conveyancing?dealId=${r.id}`}
                            className="bw-btn-ghost text-[11px]"
                            title="Open DLD Conveyancing & Cheque Pack"
                          >
                            <Send className="size-3.5 text-[#7a1f2b]" />
                            <span>DLD</span>
                          </Link>
                          <Link href={`/os/deals/${r.id}`} className="bw-btn-navy text-[11px]">
                            <span>Deal Desk</span>
                            <ArrowUpRight className="size-3.5 text-[#c9a257]" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* =====================================================================
           VIEW 2: CLEAN INSTITUTIONAL 10-STAGE KANBAN BOARD
           ===================================================================== */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {cols.map((s) => {
            const items = list.filter((r) => r.stage === s);
            const stageLabel =
              (STAGE_META as Record<string, { label: string }>)[s]?.label ?? s;
            return (
              <div
                key={s}
                className="bw-card p-3.5 flex flex-col justify-between space-y-3 bg-[#faf6f0] dark:bg-[#231115]"
              >
                <div className="flex items-center justify-between border-b border-[#e7dccd] dark:border-[#3a2326] pb-2">
                  <span className="flex items-center gap-2 text-xs font-bold text-[#2a1418] dark:text-[#faf6f0]">
                    <span
                      className={`size-2 rounded-full ${
                        items.length > 0 ? 'bg-[#7a1f2b]' : 'bg-[#d3c4ae]'
                      }`}
                    />
                    <span className="truncate">{stageLabel}</span>
                  </span>
                  <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-white dark:bg-[#2a1418] border border-[#e7dccd] dark:border-[#3a2326]">
                    {items.length}
                  </span>
                </div>

                {items.length === 0 ? (
                  <div className="py-4 text-center text-[11px] text-[#766661]">
                    No files in this stage
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {items.map((r) => {
                      const crit = r.w.alerts.some((a) => a.level === 'CRITICAL');
                      return (
                        <Link
                          key={r.id}
                          href={`/os/deals/${r.id}`}
                          className={`block rounded-[6px] border p-3 text-xs bg-white dark:bg-[#2a1418] transition hover:border-[#7a1f2b] space-y-2 ${
                            crit
                              ? 'border-[#c8321f]/50'
                              : 'border-[#e7dccd] dark:border-[#3a2326]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-[#2a1418] dark:text-[#faf6f0] truncate">
                              {r.client ?? r.deal_ref}
                            </span>
                            <span className="font-mono text-[10px] font-semibold text-[#766661]">
                              {r.deal_ref}
                            </span>
                          </div>

                          <div className="flex items-center justify-between font-mono text-[11px]">
                            <span className="font-bold text-[#7a1f2b]">
                              {formatAedWhole(r.target_loan_fils)} ({r.ltvPct}% LTV)
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-[#2a1418] text-white text-[10px] font-bold">
                              {r.bank_short || r.bank || 'ENBD'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between pt-1.5 border-t border-[#e7dccd] dark:border-[#3a2326] font-mono text-[10px]">
                            <span className="text-[#7a1f2b] font-bold">{r.dbrPct}% DBR</span>
                            <span className="text-[#766661]">
                              {r.verifiedDocs}/{r.totalReqDocs} Docs
                            </span>
                          </div>

                          <div className="text-[11px] text-[#766661] truncate">
                            → {r.w.nextAction.text}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
