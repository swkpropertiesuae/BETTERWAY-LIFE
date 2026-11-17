import Link from 'next/link';
import { getDb } from '@/server/db';
import { requireStaffUser } from '@/server/auth/request';
import { formatAedWhole } from '@/lib/format';
import { OsBanner } from '@/components/os-banner';
import {
  COMPETITOR_AND_OCA_BENCHMARK_MATRIX,
  generateFixedToFloatingAmortizationSchedule,
} from '@/server/engines/oca-los-engine';
import { Building2, Calculator, CreditCard, Landmark, Shield } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function LoanRiskPdcWorkbenchPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; dealId?: string; notice?: string; error?: string }>;
}) {
  const user = await requireStaffUser();
  const sp = await searchParams;
  const activeTab = sp.tab || 'amortization';
  const db = getDb();

  const deals = db
    .prepare(
      `SELECT d.id, d.deal_ref, d.purchase_price_fils, d.target_loan_fils, d.tenure_months, h.primary_name
       FROM deals d JOIN households h ON h.id = d.household_id
       WHERE d.origin_mode = 'LIVE' ORDER BY d.id ASC`,
    )
    .all() as Array<{
    id: number;
    deal_ref: string;
    purchase_price_fils: number;
    target_loan_fils: number;
    tenure_months: number;
    primary_name: string;
  }>;

  if (deals.length === 0) {
    return (
      <div className="space-y-5 max-w-7xl mx-auto">
        <OsBanner notice={sp.notice} error={sp.error} />
        <div className="bw-card p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="swk-eyebrow">Origination &amp; Treasury</div>
            <h1 className="swk-module-title">
              Loan Amortization, Credit Risk Control, Property Assets &amp; PDC Vault
            </h1>
            <p className="swk-module-sub">
              Fixed-to-floating EIBOR amortization, 100-point borrower credit risk scorecard, DLD Title/Oqood asset registry, and UAE Post-Dated Cheque (PDC) safe vault.
            </p>
          </div>
          <Link href="/os/crm" className="bw-btn-gold">
            + Capture Lead &amp; Convert to Deal →
          </Link>
        </div>
        <div className="bw-card p-10 text-center space-y-3">
          <h2 className="text-base font-bold text-[var(--ink)]">
            No Active Loan Files or PDC Cheques Registered Yet
          </h2>
          <p className="text-xs text-[var(--muted)] max-w-md mx-auto">
            Capture a borrower enquiry in CRM (/os/crm) and convert it into an active mortgage deal to generate EIBOR amortization schedules, credit risk scorecards, DLD property asset records, and security PDC vault entries.
          </p>
          <div className="pt-2 flex justify-center gap-2">
            <Link href="/os/crm" className="bw-btn-gold">
              + Open Leads &amp; 5m SLA Desk
            </Link>
            <Link href="/os/toolkit" className="bw-btn-navy">
              Open CBUAE 50% DBR Calculator
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const activeDealId = sp.dealId ? Number(sp.dealId) : deals[0]?.id ?? 1;
  const activeDeal = deals.find((d) => d.id === activeDealId) ?? deals[0]!;

  // Ensure at least one saved amortization schedule exists for the active deal
  let latestScheduleRow = db
    .prepare('SELECT * FROM loan_amortization_schedules WHERE deal_id = ? ORDER BY id DESC LIMIT 1')
    .get(activeDeal.id) as Record<string, unknown> | undefined;

  if (!latestScheduleRow) {
    generateFixedToFloatingAmortizationSchedule(db, user, {
      dealId: activeDeal.id,
      principalFils: activeDeal.target_loan_fils,
      tenureMonths: activeDeal.tenure_months || 300,
      fixedYears: 3,
      introRateBps: 399,
      revertEiborBps: 368,
      revertMarginBps: 165,
      floorRateBps: 299,
    });
    latestScheduleRow = db
      .prepare('SELECT * FROM loan_amortization_schedules WHERE deal_id = ? ORDER BY id DESC LIMIT 1')
      .get(activeDeal.id) as Record<string, unknown>;
  }

  const parsedSchedule = JSON.parse(String(latestScheduleRow.schedule_json || '{}')) as {
    annualSummary?: Array<{
      year: number;
      regime: string;
      rateBps: number;
      openingBalanceFils: number;
      annualEmiFils: number;
      annualPrincipalFils: number;
      annualInterestFils: number;
      closingBalanceFils: number;
      earlySettlementFeeExVatFils: number;
    }>;
  };

  const riskProfiles = db
    .prepare(
      `SELECT r.*, d.deal_ref, h.primary_name
       FROM credit_risk_profiles r
       JOIN deals d ON d.id = r.deal_id
       JOIN households h ON h.id = d.household_id
       ORDER BY r.id ASC`,
    )
    .all() as Array<Record<string, unknown>>;

  const realEstateAssets = db
    .prepare(
      `SELECT a.*, d.deal_ref, h.primary_name
       FROM real_estate_assets a
       LEFT JOIN deals d ON d.id = a.deal_id
       LEFT JOIN households h ON h.id = a.household_id
       ORDER BY a.id DESC`,
    )
    .all() as Array<Record<string, unknown>>;

  const pdcCheques = db
    .prepare(
      `SELECT p.*, d.deal_ref, h.primary_name
       FROM pdc_cheque_register p
       JOIN deals d ON d.id = p.deal_id
       JOIN households h ON h.id = d.household_id
       ORDER BY p.id DESC`,
    )
    .all() as Array<Record<string, unknown>>;

  const tabs = [
    { id: 'amortization', label: '01 · Loan & Amortization Schedule' },
    { id: 'risk', label: '02 · Credit Risk & Dunning Control' },
    { id: 'realestate', label: '03 · Property & Title Asset Registry' },
    { id: 'pdc', label: '04 · UAE Post-Dated Cheque (PDC) Vault' },
    { id: 'benchmarks', label: '05 · System Architecture Comparison Matrix' },
  ];

  return (
    <div className="space-y-6">
      <OsBanner notice={sp.notice} error={sp.error} />

      {/* Institutional Header */}
      <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Institutional Loan, Credit Risk, Real Estate Asset &amp; PDC Treasury Engine
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-0.5">
            Loan Amortization, Credit Risk Control, Property Assets &amp; PDC Vault
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 max-w-3xl">
            Deterministic integer-fils fixed-to-floating EIBOR amortization (`account_loan`), 100-point borrower credit
            risk &amp; dunning control (`credit-control`), DLD Title/Oqood asset registry (`vertical-realestate`), and
            UAE Post-Dated Cheque (PDC) safe vault (`odoo-loans`).
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {deals.map((d) => (
            <Link
              key={d.id}
              href={`/os/loan-risk-pdc?tab=${activeTab}&dealId=${d.id}`}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition ${
                d.id === activeDeal.id
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              <span className="font-num">{d.deal_ref}</span> · {d.primary_name}
            </Link>
          ))}
        </div>
      </div>

      {/* Segmented Workbench Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 bg-white p-2 rounded-lg border border-slate-200 shadow-2xs">
        {tabs.map((t) => {
          const active = activeTab === t.id;
          return (
            <Link
              key={t.id}
              href={`/os/loan-risk-pdc?tab=${t.id}&dealId=${activeDeal.id}`}
              className={`px-3.5 py-2 rounded-md text-xs font-semibold transition ${
                active
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      {/* TAB 1: LOAN & AMORTIZATION SCHEDULE (account_loan) */}
      {activeTab === 'amortization' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bw-card p-4">
              <div className="text-xs font-semibold text-slate-500">Fixed Intro Monthly EMI</div>
              <div className="text-xl font-bold text-slate-900 font-num mt-1">
                {formatAedWhole(Number(latestScheduleRow.intro_monthly_emi_fils))}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Years 1–{Number(latestScheduleRow.fixed_years)} at{' '}
                {(Number(latestScheduleRow.intro_rate_bps) / 100).toFixed(2)}% p.a.
              </div>
            </div>

            <div className="bw-card p-4">
              <div className="text-xs font-semibold text-slate-500">Floating EIBOR Revert EMI</div>
              <div className="text-xl font-bold text-slate-900 font-num mt-1">
                {formatAedWhole(Number(latestScheduleRow.revert_monthly_emi_fils))}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                3M EIBOR ({(Number(latestScheduleRow.revert_eibor_bps) / 100).toFixed(2)}%) +{' '}
                {(Number(latestScheduleRow.revert_margin_bps) / 100).toFixed(2)}% Margin
              </div>
            </div>

            <div className="bw-card p-4">
              <div className="text-xs font-semibold text-slate-500">Year 1 Principal vs. Interest</div>
              <div className="text-sm font-bold text-slate-900 font-num mt-1.5">
                P: {formatAedWhole(Number(latestScheduleRow.first_year_principal_fils))} · I:{' '}
                {formatAedWhole(Number(latestScheduleRow.first_year_interest_fils))}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Exact monthly integer-fils allocation
              </div>
            </div>

            <div className="bw-card p-4">
              <div className="text-xs font-semibold text-slate-500">Total Lifetime Payable</div>
              <div className="text-xl font-bold text-slate-900 font-num mt-1">
                {formatAedWhole(Number(latestScheduleRow.total_payable_fils))}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Total Interest: {formatAedWhole(Number(latestScheduleRow.total_interest_fils))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 bw-card p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Calculator className="h-4 w-4 text-slate-700" />
                <h2 className="text-sm font-bold text-slate-900">
                  Compute Fixed-to-Floating EIBOR Schedule
                </h2>
              </div>
              <form method="POST" action="/api/v1/actions" className="space-y-3 text-xs">
                <input type="hidden" name="action" value="generate_amortization_schedule" />
                <input
                  type="hidden"
                  name="returnTo"
                  value={`/os/loan-risk-pdc?tab=amortization&dealId=${activeDeal.id}`}
                />
                <input type="hidden" name="dealId" value={activeDeal.id} />

                <label className="block">
                  <span className="font-semibold text-slate-700">Loan Principal (AED)</span>
                  <input
                    type="number"
                    name="principalAed"
                    defaultValue={Math.round(activeDeal.target_loan_fils / 100)}
                    className="bw-input mt-1 w-full font-num"
                  />
                </label>

                <div className="grid grid-cols-2 gap-2.5">
                  <label className="block">
                    <span className="font-semibold text-slate-700">Tenure (Months)</span>
                    <input
                      type="number"
                      name="tenureMonths"
                      defaultValue={activeDeal.tenure_months || 300}
                      className="bw-input mt-1 w-full font-num"
                    />
                  </label>
                  <label className="block">
                    <span className="font-semibold text-slate-700">Fixed Period (Years)</span>
                    <input type="number" name="fixedYears" defaultValue={3} className="bw-input mt-1 w-full font-num" />
                  </label>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <label className="block">
                    <span className="font-semibold text-slate-700">Intro Rate %</span>
                    <input
                      type="number"
                      step="0.01"
                      name="introRatePct"
                      defaultValue={3.99}
                      className="bw-input mt-1 w-full font-num"
                    />
                  </label>
                  <label className="block">
                    <span className="font-semibold text-slate-700">3M EIBOR %</span>
                    <input
                      type="number"
                      step="0.01"
                      name="revertEiborPct"
                      defaultValue={3.68}
                      className="bw-input mt-1 w-full font-num"
                    />
                  </label>
                  <label className="block">
                    <span className="font-semibold text-slate-700">Margin %</span>
                    <input
                      type="number"
                      step="0.01"
                      name="revertMarginPct"
                      defaultValue={1.65}
                      className="bw-input mt-1 w-full font-num"
                    />
                  </label>
                </div>

                <button type="submit" className="bw-btn-navy w-full py-2.5">
                  Generate 25-Year Amortization Table
                </button>
              </form>
            </div>

            <div className="lg:col-span-8 bw-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900">
                  Annual Amortization &amp; CBUAE Early Settlement Schedule ({String(latestScheduleRow.schedule_ref)})
                </h2>
                <span className="text-[11px] font-num text-slate-500">
                  CBUAE Early Settlement Cap: min(1% Principal, AED 10,000)
                </span>
              </div>

              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] sticky top-0">
                    <tr>
                      <th className="py-2 px-2.5">Year</th>
                      <th className="py-2 px-2.5">Rate Regime</th>
                      <th className="py-2 px-2.5 text-right">Rate</th>
                      <th className="py-2 px-2.5 text-right">Opening Bal.</th>
                      <th className="py-2 px-2.5 text-right">Principal Paid</th>
                      <th className="py-2 px-2.5 text-right">Interest Paid</th>
                      <th className="py-2 px-2.5 text-right">Closing Bal.</th>
                      <th className="py-2 px-2.5 text-right">Early Exit Cap</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(parsedSchedule.annualSummary ?? []).map((yr) => (
                      <tr key={yr.year} className="hover:bg-slate-50">
                        <td className="py-2 px-2.5 font-num font-bold">Year {yr.year}</td>
                        <td className="py-2 px-2.5 text-slate-600">{yr.regime}</td>
                        <td className="py-2 px-2.5 text-right font-num">{(yr.rateBps / 100).toFixed(2)}%</td>
                        <td className="py-2 px-2.5 text-right font-num">{formatAedWhole(yr.openingBalanceFils)}</td>
                        <td className="py-2 px-2.5 text-right font-num font-semibold text-emerald-700">
                          {formatAedWhole(yr.annualPrincipalFils)}
                        </td>
                        <td className="py-2 px-2.5 text-right font-num text-slate-700">
                          {formatAedWhole(yr.annualInterestFils)}
                        </td>
                        <td className="py-2 px-2.5 text-right font-num font-bold text-slate-900">
                          {formatAedWhole(yr.closingBalanceFils)}
                        </td>
                        <td className="py-2 px-2.5 text-right font-num text-slate-600">
                          {formatAedWhole(yr.earlySettlementFeeExVatFils)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CREDIT RISK & DUNNING CONTROL (account_financial_risk & account_credit_control) */}
      {activeTab === 'risk' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bw-card p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-slate-700" />
              <h2 className="text-sm font-bold text-slate-900">
                Evaluate Borrower Credit Risk &amp; Dunning Stage
              </h2>
            </div>
            <form method="POST" action="/api/v1/actions" className="space-y-3 text-xs">
              <input type="hidden" name="action" value="evaluate_credit_risk" />
              <input type="hidden" name="returnTo" value={`/os/loan-risk-pdc?tab=risk&dealId=${activeDeal.id}`} />

              <label className="block">
                <span className="font-semibold text-slate-700">Mortgage Case File</span>
                <select name="dealId" defaultValue={activeDeal.id} className="bw-input mt-1 w-full">
                  {deals.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.deal_ref} — {d.primary_name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-3 gap-2.5">
                <label className="block">
                  <span className="font-semibold text-slate-700">AECB (300–900)</span>
                  <input type="number" name="aecbScore" defaultValue={768} className="bw-input mt-1 w-full font-num" />
                </label>
                <label className="block">
                  <span className="font-semibold text-slate-700">Stress DBR %</span>
                  <input
                    type="number"
                    step="0.1"
                    name="stressedDbrPct"
                    defaultValue={39.5}
                    className="bw-input mt-1 w-full font-num"
                  />
                </label>
                <label className="block">
                  <span className="font-semibold text-slate-700">LTV Ratio %</span>
                  <input
                    type="number"
                    step="0.1"
                    name="ltvPct"
                    defaultValue={78.0}
                    className="bw-input mt-1 w-full font-num"
                  />
                </label>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <label className="block">
                  <span className="font-semibold text-slate-700">Employer Tier</span>
                  <select name="employerTier" className="bw-input mt-1 w-full">
                    <option value="GOVERNMENT_GRE">Gov / GRE</option>
                    <option value="APPROVED_LISTED">Approved Listed</option>
                    <option value="MNC">Multinational</option>
                    <option value="UNLISTED_SME">Unlisted / SME</option>
                  </select>
                </label>
                <label className="block">
                  <span className="font-semibold text-slate-700">Dishonoured PDCs</span>
                  <input
                    type="number"
                    name="bouncedChequesCount"
                    defaultValue={0}
                    className="bw-input mt-1 w-full font-num"
                  />
                </label>
                <label className="block">
                  <span className="font-semibold text-slate-700">Overdue Days</span>
                  <input type="number" name="overdueDays" defaultValue={0} className="bw-input mt-1 w-full font-num" />
                </label>
              </div>

              <button type="submit" className="bw-btn-navy w-full py-2.5">
                Run 100-Point Credit Risk &amp; Dunning Scorecard
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 bw-card p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-900">
              Active Borrower Credit Risk &amp; Exposure Register ({riskProfiles.length})
            </h2>
            <div className="space-y-3">
              {riskProfiles.map((rp) => (
                <div key={String(rp.id)} className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-num font-bold text-slate-900 mr-2">{String(rp.deal_ref)}</span>
                      <span className="font-bold text-slate-900">{String(rp.primary_name)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded font-num font-bold text-[10px] ${
                          rp.risk_grade === 'AAA_PRIME' || rp.risk_grade === 'AA_STANDARD'
                            ? 'bg-emerald-100 text-emerald-800'
                            : rp.risk_grade === 'D_BLOCKED'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {String(rp.risk_grade)} ({Number(rp.composite_risk_score)}/100)
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-800 font-semibold text-[10px]">
                        Dunning: {String(rp.dunning_level)}
                      </span>
                    </div>
                  </div>
                  <p className="text-slate-600">{String(rp.risk_notes)}</p>
                  <div className="text-[11px] text-slate-500">
                    Credit Committee Recommendation:{' '}
                    <strong className="text-slate-900">{String(rp.credit_committee_decision)}</strong>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PROPERTY & TITLE ASSET REGISTRY (vertical-realestate) */}
      {activeTab === 'realestate' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bw-card p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-slate-700" />
              <h2 className="text-sm font-bold text-slate-900">
                Register DLD Property Asset &amp; Yield Profile
              </h2>
            </div>
            <form method="POST" action="/api/v1/actions" className="space-y-3 text-xs">
              <input type="hidden" name="action" value="register_real_estate_asset" />
              <input
                type="hidden"
                name="returnTo"
                value={`/os/loan-risk-pdc?tab=realestate&dealId=${activeDeal.id}`}
              />
              <input type="hidden" name="dealId" value={activeDeal.id} />

              <div className="grid grid-cols-2 gap-2.5">
                <label className="block">
                  <span className="font-semibold text-slate-700">Registration Type</span>
                  <select name="registrationType" className="bw-input mt-1 w-full">
                    <option value="TITLE_DEED">DLD Title Deed</option>
                    <option value="OQOOD_PRE_TITLE">DLD Oqood Pre-Title</option>
                  </select>
                </label>
                <label className="block">
                  <span className="font-semibold text-slate-700">Title Deed / Oqood No.</span>
                  <input
                    name="titleDeedOrOqoodNo"
                    defaultValue="DLD-TD-2026-90411"
                    className="bw-input mt-1 w-full font-num"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <label className="block">
                  <span className="font-semibold text-slate-700">DLD Plot Number</span>
                  <input name="dldPlotNo" defaultValue="PLOT-631-0880" className="bw-input mt-1 w-full font-num" />
                </label>
                <label className="block">
                  <span className="font-semibold text-slate-700">10-Digit Makani No.</span>
                  <input name="makaniNo" defaultValue="29481 94880" className="bw-input mt-1 w-full font-num" />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <label className="block">
                  <span className="font-semibold text-slate-700">Master Community</span>
                  <input name="communityName" defaultValue="Dubai Hills Estate" className="bw-input mt-1 w-full" />
                </label>
                <label className="block">
                  <span className="font-semibold text-slate-700">Building / Sub-Community</span>
                  <input
                    name="buildingOrProjectName"
                    defaultValue="Park Gate Villas"
                    className="bw-input mt-1 w-full"
                  />
                </label>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <label className="block">
                  <span className="font-semibold text-slate-700">Unit No.</span>
                  <input name="unitNo" defaultValue="V-208" className="bw-input mt-1 w-full font-num" />
                </label>
                <label className="block">
                  <span className="font-semibold text-slate-700">BUA (Sq.Ft)</span>
                  <input
                    type="number"
                    name="builtUpAreaSqft"
                    defaultValue={3200}
                    className="bw-input mt-1 w-full font-num"
                  />
                </label>
                <label className="block">
                  <span className="font-semibold text-slate-700">Mortgagee Bank</span>
                  <input
                    name="firstRankMortgageeBank"
                    defaultValue="Emirates NBD"
                    className="bw-input mt-1 w-full"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <label className="block">
                  <span className="font-semibold text-slate-700">Purchase Price (AED)</span>
                  <input
                    type="number"
                    name="purchasePriceAed"
                    defaultValue={4500000}
                    className="bw-input mt-1 w-full font-num"
                  />
                </label>
                <label className="block">
                  <span className="font-semibold text-slate-700">Panel Valuation (AED)</span>
                  <input
                    type="number"
                    name="latestValuationAed"
                    defaultValue={4600000}
                    className="bw-input mt-1 w-full font-num"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <label className="block">
                  <span className="font-semibold text-slate-700">Annual Service Charge (AED)</span>
                  <input
                    type="number"
                    name="annualServiceChargeAed"
                    defaultValue={22400}
                    className="bw-input mt-1 w-full font-num"
                  />
                </label>
                <label className="block">
                  <span className="font-semibold text-slate-700">Ejari Annual Rent (AED)</span>
                  <input
                    type="number"
                    name="ejariAnnualRentAed"
                    defaultValue={285000}
                    className="bw-input mt-1 w-full font-num"
                  />
                </label>
              </div>

              <button type="submit" className="bw-btn-navy w-full py-2.5">
                Register Property Asset &amp; Compute Net Yield
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 bw-card p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-900">
              Collateral Property &amp; Title Deed Register ({realEstateAssets.length})
            </h2>
            <div className="space-y-3">
              {realEstateAssets.map((a) => (
                <div key={String(a.id)} className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-num font-bold text-slate-900 mr-2">{String(a.property_code)}</span>
                      <span className="font-bold text-slate-900">
                        {String(a.building_or_project_name)} ({String(a.unit_no)}) — {String(a.community_name)}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-800 font-num font-bold text-[10px]">
                      {String(a.registration_type)} · {String(a.title_deed_or_oqood_no)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                    <div>
                      <div className="text-[10px] text-slate-500">Purchase Price</div>
                      <div className="font-num font-bold text-slate-900">
                        {formatAedWhole(Number(a.purchase_price_fils))}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500">Panel Valuation</div>
                      <div className="font-num font-bold text-emerald-700">
                        {formatAedWhole(Number(a.latest_valuation_fils))}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500">Gross / Net Yield</div>
                      <div className="font-num font-bold text-slate-900">
                        {(Number(a.gross_yield_bps) / 100).toFixed(2)}% / {(Number(a.net_yield_bps) / 100).toFixed(2)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500">First-Rank Lien</div>
                      <div className="font-semibold text-slate-800">{String(a.first_rank_mortgagee_bank)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: UAE POST-DATED CHEQUE (PDC) VAULT (odoo-loans) */}
      {activeTab === 'pdc' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bw-card p-5 space-y-4">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-slate-700" />
              <h2 className="text-sm font-bold text-slate-900">
                Log Post-Dated Cheque (PDC) or Manager&apos;s Cheque in Vault
              </h2>
            </div>
            <form method="POST" action="/api/v1/actions" className="space-y-3 text-xs">
              <input type="hidden" name="action" value="register_pdc_cheque" />
              <input type="hidden" name="returnTo" value={`/os/loan-risk-pdc?tab=pdc&dealId=${activeDeal.id}`} />

              <label className="block">
                <span className="font-semibold text-slate-700">Mortgage Case File</span>
                <select name="dealId" defaultValue={activeDeal.id} className="bw-input mt-1 w-full">
                  {deals.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.deal_ref} — {d.primary_name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-2.5">
                <label className="block">
                  <span className="font-semibold text-slate-700">Instrument Type</span>
                  <select name="chequeType" className="bw-input mt-1 w-full">
                    <option value="SECURITY_DEPOSIT_10PCT">10% Form F Security Cheque</option>
                    <option value="DLD_MANAGER_CHEQUE">DLD Trustee Manager&apos;s Cheque</option>
                    <option value="AGENCY_FEE_PDC">Brokerage Fee PDC</option>
                    <option value="INSTALLMENT_PDC">Installment PDC</option>
                    <option value="SUBVENTION_CHEQUE">Bank Subvention Cheque</option>
                  </select>
                </label>
                <label className="block">
                  <span className="font-semibold text-slate-700">Cheque Number</span>
                  <input name="chequeNumber" defaultValue="CHQ-904512" className="bw-input mt-1 w-full font-num" />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <label className="block">
                  <span className="font-semibold text-slate-700">Drawer Name</span>
                  <input name="drawerName" defaultValue={activeDeal.primary_name} className="bw-input mt-1 w-full" />
                </label>
                <label className="block">
                  <span className="font-semibold text-slate-700">Drawer Bank</span>
                  <input name="drawerBank" defaultValue="Emirates NBD" className="bw-input mt-1 w-full" />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <label className="block">
                  <span className="font-semibold text-slate-700">Payee Name</span>
                  <input
                    name="payeeName"
                    defaultValue="Betterway Mortgages LLC"
                    className="bw-input mt-1 w-full"
                  />
                </label>
                <label className="block">
                  <span className="font-semibold text-slate-700">Amount (AED)</span>
                  <input type="number" name="amountAed" defaultValue={26250} className="bw-input mt-1 w-full font-num" />
                </label>
              </div>

              <label className="block">
                <span className="font-semibold text-slate-700">Maturity / Presentation Date</span>
                <input
                  type="date"
                  name="maturityDate"
                  defaultValue="2026-12-15"
                  className="bw-input mt-1 w-full font-num"
                />
              </label>

              <button type="submit" className="bw-btn-navy w-full py-2.5">
                Register Instrument in Safe Vault
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 bw-card p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-900">
              UAE Post-Dated Cheque (PDC) &amp; Manager&apos;s Cheque Vault ({pdcCheques.length})
            </h2>
            <div className="space-y-3">
              {pdcCheques.map((p) => (
                <div key={String(p.id)} className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2.5 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-num font-bold text-slate-900 mr-2">
                        {String(p.cheque_ref)} · #{String(p.cheque_number)}
                      </span>
                      <span className="font-semibold text-slate-700">({String(p.cheque_type)})</span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                        p.vault_status === 'CLEARED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : p.vault_status === 'BOUNCED_DISHONOURED'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-slate-200 text-slate-800'
                      }`}
                    >
                      {String(p.vault_status)}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-slate-600">
                    <span>
                      Drawer: <strong>{String(p.drawer_name)}</strong> ({String(p.drawer_bank)}) → Payee:{' '}
                      <strong>{String(p.payee_name)}</strong>
                    </span>
                    <span className="font-num font-bold text-slate-900">{formatAedWhole(Number(p.amount_fils))}</span>
                  </div>

                  <div className="pt-2 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-2">
                    <span className="font-num text-[11px] text-slate-500">
                      Maturity: {String(p.maturity_date)} · Deal: {String(p.deal_ref)}
                    </span>
                    <form method="POST" action="/api/v1/actions" className="flex flex-wrap gap-1.5">
                      <input type="hidden" name="action" value="transition_pdc_cheque" />
                      <input type="hidden" name="chequeId" value={String(p.id)} />
                      <input
                        type="hidden"
                        name="returnTo"
                        value={`/os/loan-risk-pdc?tab=pdc&dealId=${activeDeal.id}`}
                      />
                      <button
                        type="submit"
                        name="newStatus"
                        value="PRESENTED_TO_BANK"
                        className="bw-btn-ghost py-1 px-2 text-[11px]"
                      >
                        Present
                      </button>
                      <button
                        type="submit"
                        name="newStatus"
                        value="CLEARED"
                        className="bw-btn-navy py-1 px-2.5 text-[11px]"
                      >
                        Clear &amp; Post GL
                      </button>
                      <button
                        type="submit"
                        name="newStatus"
                        value="BOUNCED_DISHONOURED"
                        className="px-2.5 py-1 rounded bg-rose-700 hover:bg-rose-800 text-white font-semibold text-[11px] cursor-pointer"
                      >
                        Dishonour (Credit Hold)
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: SYSTEM ARCHITECTURE COMPARISON MATRIX */}
      {activeTab === 'benchmarks' && (
        <div className="bw-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Landmark className="h-4 w-4 text-slate-700" />
            <h2 className="text-sm font-bold text-slate-900">
              Architectural Comparison: Open-Source OCA / LOS Modules vs. Betterway Hardcoded UAE Engine
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Domain</th>
                  <th className="py-2.5 px-3">Reference Repository</th>
                  <th className="py-2.5 px-3">Baseline Capability</th>
                  <th className="py-2.5 px-3">UAE Regulatory Gap in Generic Module</th>
                  <th className="py-2.5 px-3">Betterway Hardcoded UAE Logic</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {COMPETITOR_AND_OCA_BENCHMARK_MATRIX.map((row) => (
                  <tr key={row.moduleDomain} className="align-top hover:bg-slate-50/70">
                    <td className="py-3 px-3 font-bold text-slate-900">{row.moduleDomain}</td>
                    <td className="py-3 px-3 font-num text-slate-700">{row.referenceRepo}</td>
                    <td className="py-3 px-3 text-slate-600">{row.referenceCapability}</td>
                    <td className="py-3 px-3 text-rose-800">{row.uaeGapInGenericRepo}</td>
                    <td className="py-3 px-3 font-medium text-slate-900">{row.betterwayHardcodedLogic}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
