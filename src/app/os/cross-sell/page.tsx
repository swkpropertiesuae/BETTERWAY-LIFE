import { getDb } from '@/server/db';
import { getActiveLang, requireStaffUser } from '@/server/auth/request';
import { formatAed, tr } from '@/lib/format';
import { PageHeader } from '@/components/page-header';
import { OsBanner } from '@/components/os-banner';
import { computeCommercialDscr } from '@/server/engines/underwriting-engine';

export default async function CrossSellAndCommercialPage({
  searchParams,
}: {
  searchParams: Promise<{ noiAed?: string; loanAed?: string; ratePct?: string; years?: string; notice?: string; error?: string }>;
}) {
  const user = await requireStaffUser();
  const lang = await getActiveLang(user);
  const sp = await searchParams;
  const db = getDb();

  const noiAed = Number(sp.noiAed || 1_450_000);
  const loanAed = Number(sp.loanAed || 10_000_000);
  const ratePct = Number(sp.ratePct || 5.75);
  const years = Number(sp.years || 12);

  const dscr = computeCommercialDscr(
    Math.round(noiAed * 100),
    Math.round(loanAed * 100),
    Math.round(ratePct * 100),
    years * 12,
  );

  const externalLifeBanks = db
    .prepare('SELECT name_en, short_name, structure FROM banks WHERE accepts_external_life = 1 ORDER BY id ASC')
    .all() as { name_en: string; short_name: string; structure: string }[];

  const deals = db.prepare("SELECT id, deal_ref FROM deals WHERE origin_mode = 'LIVE' ORDER BY id DESC").all() as {
    id: number;
    deal_ref: string;
  }[];

  const referrals = db
    .prepare(
      `SELECT r.*, d.deal_ref, h.primary_name
       FROM cross_sell_referrals r
       JOIN deals d ON d.id = r.deal_id
       JOIN households h ON h.id = d.household_id
       ORDER BY r.id DESC`,
    )
    .all() as Record<string, unknown>[];

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <OsBanner notice={sp.notice} error={sp.error} />

      <PageHeader app="Sales" appHref="/os/crm" title="Cross-sell & Commercial" sub={tr(lang, 'Commercial Lease-Roll DSCR & External Life / DIFC Wills / FX / Golden Visa Desk', 'حاسبة التغطية التجارية والتأمين والوصايا والإقامة الذهبية')} />

      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 bw-card p-5 space-y-4">
          <h2 className="font-display font-bold text-base text-[#021125]">
            Commercial Warehouse / Office / Retail DSCR Stress Engine (1.25x Benchmark)
          </h2>
          <form method="GET" action="/os/cross-sell" className="grid grid-cols-2 gap-2.5 text-xs">
            <div>
              <label className="block font-semibold mb-1">Verified Annual Ejari NOI (AED)</label>
              <input name="noiAed" type="number" defaultValue={noiAed} className="bw-input font-num" />
            </div>
            <div>
              <label className="block font-semibold mb-1">Commercial Loan (AED)</label>
              <input name="loanAed" type="number" defaultValue={loanAed} className="bw-input font-num" />
            </div>
            <div>
              <label className="block font-semibold mb-1">All-In Commercial Rate (%)</label>
              <input name="ratePct" type="number" step="0.05" defaultValue={ratePct} className="bw-input font-num" />
            </div>
            <div>
              <label className="block font-semibold mb-1">Amortization (Years)</label>
              <input name="years" type="number" defaultValue={years} className="bw-input font-num" />
            </div>
            <div className="col-span-2">
              <button type="submit" className="bw-btn-navy w-full">Compute Institutional DSCR</button>
            </div>
          </form>

          <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 grid grid-cols-3 gap-3 text-xs">
            <div>
              <div className="text-slate-500">Annual Debt Service</div>
              <div className="font-num font-bold text-[#021125] mt-1">{formatAed(dscr.annualDebtServiceFils)}</div>
            </div>
            <div>
              <div className="text-slate-500">Calculated DSCR</div>
              <div className="font-num font-bold text-lg text-[#021125] mt-0.5">{(dscr.dscrBps / 10_000).toFixed(2)}x</div>
            </div>
            <div>
              <div className="text-slate-500">Credit Appetite</div>
              <div className={`font-bold mt-1 ${dscr.meetsInstitutional125x ? 'text-emerald-700' : 'text-rose-700'}`}>
                {dscr.meetsInstitutional125x ? '✓ PASSES >= 1.25x' : '✗ BELOW 1.25x'}
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-6 bw-card p-5 space-y-4">
          <h2 className="font-display font-bold text-base text-[#021125]">
            Banks Accepting External Assigned Life / Takaful Policy ({externalLifeBanks.length} Lenders)
          </h2>
          <p className="text-xs text-slate-600">
            Replacing bundled bank group credit life (~0.45%/yr) with an externally assigned Zurich / Sukoon / Salama policy frequently reduces client life cover cost while generating compliant introducer commission.
          </p>
          <div className="flex flex-wrap gap-2">
            {externalLifeBanks.map((b) => (
              <span key={b.name_en} className="bw-badge bg-emerald-100 text-emerald-900">
                ✓ {b.name_en} ({b.structure})
              </span>
            ))}
          </div>

          <form method="POST" action="/api/v1/actions" className="pt-3 border-t border-slate-200 grid grid-cols-2 gap-2.5 text-xs">
            <input type="hidden" name="action" value="create_cross_sell" />
            <input type="hidden" name="returnTo" value="/os/cross-sell" />
            <div>
              <label className="block font-semibold mb-1">Deal</label>
              <select name="dealId" className="bw-input">
                {deals.map((d) => (
                  <option key={d.id} value={d.id}>{d.deal_ref}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">Ancillary Mandate</label>
              <select name="serviceType" className="bw-input">
                <option value="EXTERNAL_LIFE_TAKAFUL">External Assigned Life / Takaful</option>
                <option value="GOLDEN_VISA_NOC">AED 2M+ DLD Golden Visa Bank NOC</option>
                <option value="FX_TRANSFER">Non-Resident Down-Payment FX Desk</option>
                <option value="DIFC_WILL">DIFC / ADJD Property Will</option>
                <option value="COMMERCIAL_ADVISORY">ADGM / DIFC SPV Advisory</option>
              </select>
            </div>
            <input name="providerName" placeholder="Partner Provider (e.g. Zurich ME / CurrencyTransfer)" required className="bw-input" />
            <input name="referralFeeAed" type="number" placeholder="Expected Introducer Fee AED" defaultValue={3500} className="bw-input font-num" />
            <div className="col-span-2">
              <button type="submit" className="bw-btn-gold w-full">+ Log 360° Cross-Sell Mandate</button>
            </div>
          </form>
        </div>
      </div>

      <div className="bw-card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 font-display font-bold text-sm text-[#021125]">
          Active 360° Ancillary Mandates ({referrals.length})
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-4 py-2.5 text-start">Deal / Client</th>
                <th className="px-4 py-2.5 text-start">Service</th>
                <th className="px-4 py-2.5 text-start">Provider</th>
                <th className="px-4 py-2.5 text-end">Expected Referral Fee</th>
                <th className="px-4 py-2.5 text-start">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {referrals.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-5 text-center text-slate-400">
                    No cross-sell mandates logged yet — use the form above to pitch External Life, FX, DIFC Wills, or Golden Visa NOCs.
                  </td>
                </tr>
              ) : (
                referrals.map((r) => (
                  <tr key={String(r.id)}>
                    <td className="px-4 py-3 font-semibold">{String(r.deal_ref)} · {String(r.primary_name)}</td>
                    <td className="px-4 py-3">{String(r.service_type)}</td>
                    <td className="px-4 py-3">{String(r.provider_name)}</td>
                    <td className="px-4 py-3 text-end font-num font-bold">{formatAed(Number(r.expected_referral_fee_fils))}</td>
                    <td className="px-4 py-3">
                      <span className="bw-badge bg-amber-100 text-[#7d5f1f]">{String(r.status)}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
