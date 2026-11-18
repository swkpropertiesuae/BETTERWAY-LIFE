import Link from 'next/link';
import { getDb } from '@/server/db';
import { requireStaffUser } from '@/server/auth/request';
import { formatAedWhole } from '@/lib/format';
import { OsBanner } from '@/components/os-banner';
import { DUBAI_AREAS_24 } from '@/server/engines/swk-enterprise-engine';

export const dynamic = 'force-dynamic';

export default async function MarketPulsePage({
  searchParams,
}: {
  searchParams: Promise<{ area?: string; notice?: string; error?: string }>;
}) {
  await requireStaffUser();
  const sp = await searchParams;
  const selectedCode = sp.area || 'PALM';
  const selectedArea = DUBAI_AREAS_24.find((a) => a.code === selectedCode) || DUBAI_AREAS_24[0];

  const db = getDb();
  const transactions = db
    .prepare('SELECT * FROM dld_market_transactions ORDER BY id DESC LIMIT 16')
    .all() as Array<Record<string, unknown>>;

  const avgPsf = Math.round(DUBAI_AREAS_24.reduce((sum, a) => sum + a.ppsf, 0) / DUBAI_AREAS_24.length);
  const avgYield = (DUBAI_AREAS_24.reduce((sum, a) => sum + a.yieldPct, 0) / DUBAI_AREAS_24.length).toFixed(2);

  return (
    <div className="space-y-6">
      <OsBanner notice={sp.notice} error={sp.error} />

      {/* Oxblood & Brass Header Banner */}
      <div className="rounded-2xl bg-white text-gray-900 p-6 border border-gray-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-700">
            Step 03 · Dubai Land Department (DLD) Live Telemetry &amp; Field Companion
          </div>
          <h1 className="font-display text-2xl md:text-3xl font-bold mt-1">
            Market Pulse &amp; 24-Area Site-Visit Companion
          </h1>
          <p className="text-xs text-gray-500 mt-1 max-w-2xl">
            Live DLD price per sq.ft, 15-Year Future Trajectory (<code>2026 → 2041</code>), nearby
            metro/schools/hospitals, closing keywords, and verbatim field-visit pitch lines across 24 Dubai corridors.
          </p>
        </div>
        <form method="POST" action="/api/v1/actions">
          <input type="hidden" name="action" value="sync_dld_feed" />
          <input type="hidden" name="returnTo" value={`/os/market?area=${selectedArea.code}`} />
          <button type="submit" className="bw-btn-gold cursor-pointer">
            Sync Daily DLD Feed
          </button>
        </form>
      </div>

      {/* 4 Top KPIs (Matches swkpropertiesOS hb-06-market-pulse.png) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bw-card p-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Avg Price / Sq Ft (24 Areas)
          </div>
          <div className="font-display text-2xl font-bold text-slate-900 mt-1">
            AED {avgPsf.toLocaleString('en-US')}
          </div>
          <div className="text-[11px] text-emerald-700 font-semibold mt-0.5">+14.8% YoY across Prime &amp; Core</div>
        </div>
        <div className="bw-card p-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Avg Gross Rental Yield</div>
          <div className="font-display text-2xl font-bold text-slate-900 mt-1">{avgYield}%</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Supports 1.25x+ DSCR &amp; Buy-to-Let LTV</div>
        </div>
        <div className="bw-card p-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Quarterly DLD Volume</div>
          <div className="font-display text-2xl font-bold text-slate-900 mt-1">AED 142.8B</div>
          <div className="text-[11px] text-slate-500 mt-0.5">43,920 registered sales &amp; mortgages</div>
        </div>
        <div className="bw-card p-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Mortgage &amp; Off-Plan Share
          </div>
          <div className="font-display text-2xl font-bold text-slate-900 mt-1">58% / 42%</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Strong handover refinancing pipeline</div>
        </div>
      </div>

      {/* 24-Area Interactive Stock-Ticker Selector */}
      <div className="bg-[#021125] rounded-[6px] p-4 border border-[#3a2326]">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#c9a257]">
            Dubai 24-Corridor Live Valuation Index — Click Any Area to Load Site-Visit Companion
          </span>
          <span className="text-[11px] text-slate-300 font-num">Selected: {selectedArea.ticker}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {DUBAI_AREAS_24.map((area) => {
            const active = area.code === selectedArea.code;
            return (
              <Link
                key={area.code}
                href={`/os/market?area=${area.code}`}
                className={`p-2.5 rounded-xl border transition text-left ${
                  active
                    ? 'bg-[#c9a257]/20 border-slate-900 text-white shadow-sm'
                    : 'bg-white/[0.04] border-white/10 text-gray-500 hover:bg-white/[0.08]'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] font-num">
                  <span className="font-bold text-slate-300">{area.ticker}</span>
                  <span className="text-emerald-400 font-bold">+{area.yoyPct}%</span>
                </div>
                <div className="text-xs font-bold truncate mt-0.5">{area.name}</div>
                <div className="text-[11px] text-gray-500 font-num mt-0.5">
                  AED {area.ppsf.toLocaleString('en-US')}/sqft · {area.yieldPct}%
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Site-Visit Area Companion Card (Matches swkpropertiesOS hb-06-market-pulse.png) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bw-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700">
                {selectedArea.ticker} · {selectedArea.segment} Corridor
              </span>
              <h2 className="font-display text-xl font-bold text-slate-900">{selectedArea.name}</h2>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-num text-xs font-bold">
              +{selectedArea.yoyPct}% YoY
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-gray-50 border border-slate-200/80">
              <div className="text-[10px] text-slate-500 uppercase font-bold">2026 Price / SqFt</div>
              <div className="font-display text-lg font-bold text-slate-900 mt-0.5">
                AED {selectedArea.ppsf.toLocaleString('en-US')}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-gray-50 border border-slate-200/80">
              <div className="text-[10px] text-slate-500 uppercase font-bold">Gross Rental Yield</div>
              <div className="font-display text-lg font-bold text-emerald-700 mt-0.5">{selectedArea.yieldPct}%</div>
            </div>
          </div>

          {/* 15-Year Future Trajectory (2026 -> 2041) */}
          <div className="p-4 rounded-[6px] bg-[#021125] text-white border border-[#3a2326] space-y-2.5">
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#c9a257]">
              15-Year Future Trajectory (2026 → 2041 DLD &amp; 2040 Urban Plan)
            </div>
            <div className="space-y-1.5 text-xs pt-1">
              {selectedArea.forecast15Y.map((f) => (
                <div key={f.year} className="flex items-center justify-between p-2 rounded bg-white/5">
                  <div>
                    <span className="font-num font-bold text-slate-300 mr-2">{f.year}</span>
                    <span className="text-[11px] text-gray-500">{f.catalyst}</span>
                  </div>
                  <span className="font-num font-bold text-emerald-300 shrink-0 ml-2">
                    AED {f.projectedPpsf.toLocaleString('en-US')}/sqft
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Field Companion: Nearby Landmarks, Closing Keywords & Verbatim Pitch Lines */}
        <div className="lg:col-span-2 bw-card p-5 space-y-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700">
              Advisor Site-Visit Briefing Sheet
            </span>
            <h2 className="font-display text-lg font-bold text-slate-900">
              Infrastructure, Closing Keywords &amp; Verbatim Pitch Lines — {selectedArea.name}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="p-3.5 rounded-xl bg-gray-50 border border-slate-200/80">
              <div className="text-[10px] font-bold uppercase text-slate-400">Metro &amp; Connectivity</div>
              <div className="font-semibold text-slate-900 mt-1">{selectedArea.nearby.metro}</div>
            </div>
            <div className="p-3.5 rounded-xl bg-gray-50 border border-slate-200/80">
              <div className="text-[10px] font-bold uppercase text-slate-400">Schools &amp; Education</div>
              <div className="font-semibold text-slate-900 mt-1">{selectedArea.nearby.schools.join(' · ')}</div>
            </div>
            <div className="p-3.5 rounded-xl bg-gray-50 border border-slate-200/80">
              <div className="text-[10px] font-bold uppercase text-slate-400">Hospitals &amp; Healthcare</div>
              <div className="font-semibold text-slate-900 mt-1">{selectedArea.nearby.hospitals.join(' · ')}</div>
            </div>
          </div>

          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Top Advisor Closing Keywords
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedArea.closingKeywords.map((kw) => (
                <span
                  key={kw}
                  className="px-3 py-1 rounded-full bg-slate-900 text-white text-xs font-semibold border border-slate-300"
                >
                  {kw}
                </span>
              ))}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-amber-50/70 border border-gray-200 space-y-1.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-700">
              Verbatim Field-Visit Pitch Script (Read to Client on Site)
            </div>
            {selectedArea.fieldVisitPitchScript.map((line, idx) => (
              <p key={idx} className="font-display text-xs text-slate-900 italic leading-relaxed">
                &ldquo;{line}&rdquo;
              </p>
            ))}
          </div>
        </div>
      </div>

      {/* Daily DLD Open-Data Transactions Feed */}
      <div className="bw-card p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700">
              Dubai Land Department (DLD) Open-Data Stream
            </span>
            <h2 className="font-display text-lg font-bold text-slate-900">
              Recent Verified DLD Sales &amp; Mortgage Registrations ({transactions.length})
            </h2>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 uppercase text-[10px]">
                <th className="py-2.5 px-3">DLD Txn Ref</th>
                <th className="py-2.5 px-3">Area</th>
                <th className="py-2.5 px-3">Property Type</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Size (SqFt)</th>
                <th className="py-2.5 px-3">Amount</th>
                <th className="py-2.5 px-3">PSF (AED)</th>
                <th className="py-2.5 px-3">Lender Bank</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transactions.map((t) => (
                <tr key={String(t.id)}>
                  <td className="py-2.5 px-3 font-num font-bold text-slate-900">{String(t.tx_ref)}</td>
                  <td className="py-2.5 px-3 font-semibold text-slate-800">
                    {String(t.area_name)} ({String(t.area_code)})
                  </td>
                  <td className="py-2.5 px-3">{String(t.property_type)}</td>
                  <td className="py-2.5 px-3">{String(t.transaction_category)}</td>
                  <td className="py-2.5 px-3 font-num">{Number(t.size_sqft).toLocaleString()}</td>
                  <td className="py-2.5 px-3 font-num font-bold text-slate-900">
                    {formatAedWhole(Number(t.amount_fils))}
                  </td>
                  <td className="py-2.5 px-3 font-num text-emerald-700 font-bold">
                    AED {Number(t.ppsf_aed).toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-slate-700">{String(t.lender_bank)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
