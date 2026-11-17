import { getDb } from '@/server/db';
import { getActiveLang, requireStaffUser } from '@/server/auth/request';
import { formatBps, formatMicroPct, tr } from '@/lib/format';
import { PageHeader } from '@/components/page-header';
import { OsBanner } from '@/components/os-banner';

export default async function BanksAndAplPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const user = await requireStaffUser();
  const lang = await getActiveLang(user);
  const sp = await searchParams;
  const db = getDb();

  const latestEibor = db.prepare('SELECT * FROM eibor_fixings ORDER BY fixing_date DESC LIMIT 1').get() as
    | Record<string, number | string>
    | undefined;

  const pendingCards = db
    .prepare(
      `SELECT rc.*, b.name_en as bank_name, b.logo_path, u.full_name_en as maker_name
       FROM bank_rate_cards rc
       JOIN banks b ON b.id = rc.bank_id
       LEFT JOIN users u ON u.id = rc.created_by
       WHERE rc.status = 'PENDING_APPROVAL'
       ORDER BY rc.id DESC`,
    )
    .all() as Record<string, unknown>[];

  const banks = db
    .prepare(
      `SELECT b.*, bdm.bdm_name, bdm.email as bdm_email, bdm.avg_ipa_tat_days, bdm.avg_fol_tat_days,
              (SELECT commission_bps FROM bank_subvention_grids g WHERE g.bank_id = b.id ORDER BY monthly_volume_min_fils ASC LIMIT 1) as base_subv_bps
       FROM banks b
       LEFT JOIN bank_bdm_contacts bdm ON bdm.bank_id = b.id
       ORDER BY b.id ASC`,
    )
    .all() as Record<string, unknown>[];

  const projects = db
    .prepare(
      `SELECT p.id, p.name, p.community, p.completion_status, d.name as dev_name
       FROM projects p JOIN developers d ON d.id = p.developer_id
       ORDER BY p.id ASC`,
    )
    .all() as { id: number; name: string; community: string; completion_status: string; dev_name: string }[];

  const aplRows = db
    .prepare(
      `SELECT a.*, b.short_name as bank_short, p.name as project_name, p.community
       FROM bank_project_apl a
       JOIN banks b ON b.id = a.bank_id
       JOIN projects p ON p.id = a.project_id
       ORDER BY a.updated_at DESC, a.id DESC LIMIT 24`,
    )
    .all() as Record<string, unknown>[];

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <OsBanner notice={sp.notice} error={sp.error} />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader app="Mortgage Desk" appHref="/os/deals" title="Banks & Rates" sub={tr(lang, 'Lender Product Intelligence & Approved Project Matrix', 'ذكاء المنتجات المصرفية ومصفوفة المشاريع المعتمدة')} />

        <form method="POST" action="/api/v1/eibor/sync">
          <button type="submit" className="bw-btn-gold">
            ↻ Sync CBUAE EIBOR Benchmark
          </button>
        </form>
      </div>

      {/* Live EIBOR Strip */}
      {latestEibor && (
        <div className="bw-card p-4 grid grid-cols-2 sm:grid-cols-6 gap-3 text-xs">
          <div>
            <div className="text-slate-500">Fixing Date</div>
            <div className="font-num font-bold text-[#021125] mt-0.5">{String(latestEibor.fixing_date)}</div>
          </div>
          <div>
            <div className="text-slate-500">O/N EIBOR</div>
            <div className="font-num font-bold text-[#021125] mt-0.5">{formatMicroPct(Number(latestEibor.overnight_micro))}</div>
          </div>
          <div>
            <div className="text-slate-500">1M EIBOR</div>
            <div className="font-num font-bold text-[#021125] mt-0.5">{formatMicroPct(Number(latestEibor.one_month_micro))}</div>
          </div>
          <div>
            <div className="text-slate-500">3M EIBOR</div>
            <div className="font-num font-bold text-[#8A6518] mt-0.5">{formatMicroPct(Number(latestEibor.three_month_micro))}</div>
          </div>
          <div>
            <div className="text-slate-500">6M EIBOR</div>
            <div className="font-num font-bold text-[#021125] mt-0.5">{formatMicroPct(Number(latestEibor.six_month_micro))}</div>
          </div>
          <div>
            <div className="text-slate-500">1Y EIBOR</div>
            <div className="font-num font-bold text-[#021125] mt-0.5">{formatMicroPct(Number(latestEibor.one_year_micro))}</div>
          </div>
        </div>
      )}

      {/* Maker-Checker Queue + New Rate Submission */}
      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bw-card p-5 space-y-3">
          <h2 className="font-display font-bold text-sm text-[#021125]">
            Maker-Checker Rate Approval Queue ({pendingCards.length} Pending — Self-Approval Blocked)
          </h2>
          {pendingCards.length === 0 ? (
            <div className="text-xs text-slate-500">All submitted bank rate cards have been verified.</div>
          ) : (
            <div className="space-y-2.5">
              {pendingCards.map((rc) => (
                <div key={String(rc.id)} className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3">
                    <img src={String(rc.logo_path)} alt="" className="h-7 w-7 object-contain bg-white rounded p-0.5 border border-slate-200" />
                    <div>
                      <div className="font-bold text-[#021125]">
                        {String(rc.bank_name)} · <span className="font-num">{String(rc.product_code)}</span>
                      </div>
                      <div className="text-slate-600 font-num">
                        {String(rc.fixed_years)}Y Fixed @ {formatBps(Number(rc.intro_rate_bps))} · Revert +{formatBps(Number(rc.revert_margin_bps))} · Maker: {String(rc.maker_name)}
                      </div>
                    </div>
                  </div>
                  <form method="POST" action="/api/v1/actions">
                    <input type="hidden" name="action" value="approve_rate_card" />
                    <input type="hidden" name="rateCardId" value={String(rc.id)} />
                    <input type="hidden" name="returnTo" value="/os/banks-apl" />
                    <button type="submit" className="bw-btn-navy">Approve (Checker)</button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-5 bw-card p-5 space-y-3">
          <h2 className="font-display font-bold text-sm text-[#021125]">Submit New Bank Rate Card (Maker)</h2>
          <form method="POST" action="/api/v1/actions" className="grid grid-cols-2 gap-2.5 text-xs">
            <input type="hidden" name="action" value="submit_rate_card" />
            <input type="hidden" name="returnTo" value="/os/banks-apl" />
            <div className="col-span-2">
              <label className="block font-semibold mb-1">Bank</label>
              <select name="bankId" className="bw-input">
                {banks.map((b) => (
                  <option key={String(b.id)} value={String(b.id)}>{String(b.name_en)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">Product Code</label>
              <input name="productCode" required placeholder="FAB-3Y-ELITE" className="bw-input font-num" />
            </div>
            <div>
              <label className="block font-semibold mb-1">Fixed Years</label>
              <select name="fixedYears" defaultValue="3" className="bw-input">
                <option value="1">1 Year</option>
                <option value="2">2 Years</option>
                <option value="3">3 Years</option>
                <option value="5">5 Years</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">Intro Rate (%)</label>
              <input name="introRatePct" type="number" step="0.01" defaultValue="3.89" className="bw-input font-num" />
            </div>
            <div>
              <label className="block font-semibold mb-1">Revert Margin (%)</label>
              <input name="revertMarginPct" type="number" step="0.01" defaultValue="1.55" className="bw-input font-num" />
            </div>
            <div className="col-span-2">
              <button type="submit" className="bw-btn-gold w-full">Queue Rate Card for Checker Approval</button>
            </div>
          </form>
        </div>
      </div>

      {/* 80-Project Tower APL Matrix */}
      <div className="bw-card p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display font-bold text-base text-[#021125]">
              Tower-Level Approved Project List (APL) Matrix ({projects.length} UAE Developments Seeded)
            </h2>
            <p className="text-xs text-slate-500">
              Controls automatic bank knockouts & LTV caps in the 24-Bank LOS engine.
            </p>
          </div>
        </div>

        <form method="POST" action="/api/v1/actions" className="grid sm:grid-cols-5 gap-2.5 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200">
          <input type="hidden" name="action" value="upsert_project_apl" />
          <input type="hidden" name="returnTo" value="/os/banks-apl" />
          <select name="bankId" className="bw-input">
            {banks.map((b) => (
              <option key={String(b.id)} value={String(b.id)}>{String(b.name_en)}</option>
            ))}
          </select>
          <select name="projectId" className="bw-input">
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name} — {p.dev_name}</option>
            ))}
          </select>
          <select name="aplStatus" className="bw-input">
            <option value="APPROVED">APPROVED</option>
            <option value="CAPPED_LTV">CAPPED_LTV</option>
            <option value="CASE_BY_CASE">CASE_BY_CASE</option>
            <option value="BLOCKED">BLOCKED (Auto Knock-Out)</option>
          </select>
          <input name="maxLtvPct" type="number" defaultValue={80} placeholder="Max LTV %" className="bw-input font-num" />
          <button type="submit" className="bw-btn-navy">Save Tower APL Rule</button>
        </form>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
          {aplRows.map((a) => (
            <div key={String(a.id)} className="rounded-lg border border-slate-200 p-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="font-bold text-[#021125] truncate">{String(a.project_name)}</div>
                <div className="text-[11px] text-slate-500">{String(a.bank_short)} · Max LTV {formatBps(Number(a.max_ltv_bps))}</div>
              </div>
              <span
                className={`bw-badge shrink-0 ${
                  a.apl_status === 'BLOCKED' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {String(a.apl_status)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 24 UAE Banks Panel Directory */}
      <div className="bw-card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 font-display font-bold text-sm text-[#021125]">
          24 UAE Licensed Lenders — DBR Card Policy, Subvention Slabs, Clawback Window & BDM SLA
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-4 py-2.5 text-start">Bank</th>
                <th className="px-4 py-2.5 text-start">Structure</th>
                <th className="px-4 py-2.5 text-end">Card DBR</th>
                <th className="px-4 py-2.5 text-start">Non-Res</th>
                <th className="px-4 py-2.5 text-start">Ext. Life</th>
                <th className="px-4 py-2.5 text-end">Base Subvention</th>
                <th className="px-4 py-2.5 text-end">Clawback Window</th>
                <th className="px-4 py-2.5 text-start">BDM Contact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {banks.map((b) => (
                <tr key={String(b.id)} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 flex items-center gap-2.5">
                    <img src={String(b.logo_path)} alt="" className="h-6 w-6 object-contain rounded bg-white p-0.5 border border-slate-200" />
                    <span className="font-semibold text-[#021125]">{String(b.name_en)}</span>
                  </td>
                  <td className="px-4 py-2.5">{String(b.structure)}</td>
                  <td className="px-4 py-2.5 text-end font-num">{formatBps(Number(b.card_limit_dbr_bps))}</td>
                  <td className="px-4 py-2.5">{Number(b.accepts_non_resident) === 1 ? '✓ Yes' : '—'}</td>
                  <td className="px-4 py-2.5">{Number(b.accepts_external_life) === 1 ? '✓ Accepted' : 'Group Only'}</td>
                  <td className="px-4 py-2.5 text-end font-num font-semibold">{formatBps(Number(b.base_subv_bps))}</td>
                  <td className="px-4 py-2.5 text-end font-num">{String(b.clawback_window_months)}m</td>
                  <td className="px-4 py-2.5 font-num text-slate-600">{String(b.bdm_email)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
