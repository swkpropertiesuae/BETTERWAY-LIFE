import { getDb } from '@/server/db';
import { getActiveLang, requireStaffUser } from '@/server/auth/request';
import { DEAL_STAGE_LABELS, formatAed, formatBps, tr } from '@/lib/format';
import { PageHeader } from '@/components/page-header';
import { OsBanner } from '@/components/os-banner';
import { evaluateDealAcross24Banks } from '@/server/engines/underwriting-engine';
import { checkBankSubmissionGate } from '@/server/engines/compliance-aml-engine';
import {
  computeBuyoutRefinanceAnalysis,
  computeLtiAndAgeAtMaturityDiagnostics,
  computeRentVsBuyWealthAnalysis,
} from '@/server/engines/commercial-workflows-engine';

export default async function LosUnderwritingPage({
  searchParams,
}: {
  searchParams: Promise<{ dealId?: string; notice?: string; error?: string }>;
}) {
  const user = await requireStaffUser();
  const lang = await getActiveLang(user);
  const sp = await searchParams;
  const db = getDb();

  const deals = db
    .prepare(
      `SELECT d.*, h.primary_name
       FROM deals d JOIN households h ON h.id = d.household_id
       WHERE d.origin_mode = 'LIVE'
       ORDER BY d.id DESC`,
    )
    .all() as Record<string, unknown>[];

  if (deals.length === 0) {
    return (
      <div className="space-y-5 max-w-7xl mx-auto">
        <OsBanner notice={sp.notice} error={sp.error} />
        <PageHeader
          app="Origination & LOS"
          appHref="/os/los"
          title="24-Bank CBUAE Underwriting & LOS Desk"
          sub="50% Stressed DBR Gate, 3% vs 5% Card Stress, 7x Annual Salary LTI Cap & Multi-Bank Comparison"
        >
          <a href="/os/toolkit" className="bw-btn-ghost">
            Open Standalone DBR Calculator
          </a>
          <a href="/os/crm" className="bw-btn-gold">
            + Capture Lead in CRM →
          </a>
        </PageHeader>
        <div className="bw-card p-10 text-center space-y-3">
          <h2 className="text-base font-bold text-[var(--ink)]">
            No Active Mortgage Files in LOS Yet
          </h2>
          <p className="text-xs text-[var(--muted)] max-w-md mx-auto">
            All 24 UAE banks and active rate cards are configured in production. Capture a borrower lead in the CRM &amp; 5m SLA Desk and click &ldquo;Convert Lead to Active Mortgage Deal&rdquo; to evaluate their household here.
          </p>
          <div className="pt-2 flex justify-center gap-2">
            <a href="/os/crm" className="bw-btn-gold">
              + Open Leads &amp; 5m SLA Desk
            </a>
            <a href="/os/banks-apl" className="bw-btn-navy">
              Inspect 24-Bank Rate Cards
            </a>
          </div>
        </div>
      </div>
    );
  }

  const activeDealId = sp.dealId ? Number(sp.dealId) : Number(deals[0]?.id || 1);
  const deal = (deals.find((d) => Number(d.id) === activeDealId) ?? deals[0]) as Record<string, unknown>;
  const dealId = Number(deal.id);

  const applicants = db
    .prepare('SELECT * FROM applicants WHERE household_id = ? ORDER BY id ASC')
    .all(Number(deal.household_id)) as Record<string, unknown>[];

  const appIds = applicants.map((a) => Number(a.id));
  const liabilities =
    appIds.length > 0
      ? (db
          .prepare(`SELECT * FROM applicant_liabilities WHERE applicant_id IN (${appIds.map(() => '?').join(',')})`)
          .all(...appIds) as Record<string, unknown>[])
      : [];

  const uw = evaluateDealAcross24Banks(db, dealId);
  const gate = checkBankSubmissionGate(db, dealId);
  const buyout = computeBuyoutRefinanceAnalysis({
    existingPrincipalFils: uw.netLoanNeededFils,
    remainingMonths: Number(deal.tenure_months || 240),
    currentRateBps: 549,
    newIntroRateBps: uw.eligibleOffers[0]?.introRateBps ?? 399,
    financeMode: (uw.eligibleOffers[0]?.financeMode as 'CONVENTIONAL') || 'CONVENTIONAL',
  });
  const rentVsBuy = computeRentVsBuyWealthAnalysis({
    currentAnnualRentFils: Math.round(Number(deal.purchase_price_fils) * 0.062),
    targetPropertyPriceFils: Number(deal.purchase_price_fils),
    mortgageRateBps: uw.eligibleOffers[0]?.introRateBps ?? 399,
    tenureMonths: Number(deal.tenure_months || 300),
  });
  const ltiAge = computeLtiAndAgeAtMaturityDiagnostics(db, dealId);

  const submissions = db
    .prepare(
      `SELECT ds.*, b.name_en as bank_name, rc.product_code
       FROM deal_submissions ds
       JOIN banks b ON b.id = ds.bank_id
       JOIN bank_rate_cards rc ON rc.id = ds.rate_card_id
       WHERE ds.deal_id = ? ORDER BY ds.id DESC`,
    )
    .all(dealId) as Record<string, unknown>[];

  const projects = db.prepare('SELECT id, name, community FROM projects ORDER BY id ASC LIMIT 30').all() as {
    id: number;
    name: string;
    community: string;
  }[];
  const banks = db.prepare('SELECT id, name_en FROM banks ORDER BY id ASC').all() as { id: number; name_en: string }[];

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <OsBanner notice={sp.notice} error={sp.error} />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader app="Mortgage Desk" appHref="/os/deals" title={<>{String(deal.deal_ref)} — {String(deal.primary_name)} ({DEAL_STAGE_LABELS[String(deal.stage)]?.[lang] ?? String(deal.stage)})</>} sub={tr(lang, 'Module 02 · 24-Bank CBUAE Underwriting LOS & Proposal Studio', 'الوحدة 02 · نظام الائتمان والمقارنة بين 24 بنكاً')}>
          <div className="flex flex-wrap items-center gap-2">
            <a className="bw-btn-gold text-xs" href={`/os/print/proposal/${deal.id}`}>3-Bank Proposal PDF →</a>
            <a className="bw-btn-navy text-xs" href={`/os/print/aip/${deal.id}`}>60-Day Pre-Qual (AIP) →</a>
            <a className="bw-btn-navy text-xs" href={`/os/print/coversheet/${deal.id}`}>Bank BDM Fast-Pass →</a>
            <a className="bw-btn-ghost text-xs" href={`/os/deals/${deal.id}`}>Deal form →</a>
          </div>
        </PageHeader>

        <div className="flex flex-wrap gap-2">
          {deals.map((d) => (
            <a
              key={String(d.id)}
              href={`/os/los?dealId=${String(d.id)}`}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold border ${
                Number(d.id) === dealId
                  ? 'bg-[#021125] text-white border-[#021125]'
                  : 'bg-white text-slate-700 border-slate-300 hover:border-[#c9a257]'
              }`}
            >
              <span className="font-num">{String(d.deal_ref)}</span> · {String(d.primary_name)}
            </a>
          ))}
        </div>
      </div>

      {/* Compliance Gate Banner */}
      <div
        className={`rounded-xl border p-4 flex flex-wrap items-center justify-between gap-3 ${
          gate.allowed ? 'bg-emerald-50 border-emerald-200 text-emerald-950' : 'bg-amber-50 border-amber-300 text-amber-950'
        }`}
      >
        <div className="text-xs space-y-0.5">
          <div className="font-bold">
            {gate.allowed
              ? '✓ CBUAE Bank Submission Gate CLEARED (All Obligated Applicants Signed KFS + AML/CDD Verified)'
              : '⚠ CBUAE Statutory Submission Hard-Gate Active (Blocks transition to IPA_SUBMITTED until cleared)'}
          </div>
          {!gate.allowed && (
            <div>
              {gate.missingKfsApplicants.length > 0 && (
                <span>Missing Joint KFS Signature: <strong>{gate.missingKfsApplicants.join(', ')}</strong>. </span>
              )}
              {gate.cddBlocker && <span>{gate.cddBlocker}.</span>}
            </div>
          )}
        </div>
        <a href={`/os/compliance?dealId=${dealId}`} className="bw-btn-navy text-xs">
          Open KFS & AML/CDD Desk →
        </a>
      </div>

      {/* Deal Structure + Household Fact-Find */}
      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bw-card p-5 space-y-4">
          <h2 className="font-display font-bold text-sm text-[#021125]">Deal Structure, LTV & Housing Grant</h2>
          <form method="POST" action="/api/v1/actions" className="grid grid-cols-2 gap-2.5 text-xs">
            <input type="hidden" name="action" value="update_deal_terms" />
            <input type="hidden" name="dealId" value={dealId} />
            <input type="hidden" name="returnTo" value={`/os/los?dealId=${dealId}`} />
            <div>
              <label className="block font-semibold mb-1">Purchase Price (AED)</label>
              <input name="purchasePriceAed" type="number" defaultValue={Number(deal.purchase_price_fils) / 100} className="bw-input font-num" />
            </div>
            <div>
              <label className="block font-semibold mb-1">Est. Valuation (AED)</label>
              <input name="estimatedValuationAed" type="number" defaultValue={Number(deal.estimated_valuation_fils) / 100} className="bw-input font-num" />
            </div>
            <div>
              <label className="block font-semibold mb-1">Target Loan (AED)</label>
              <input name="targetLoanAed" type="number" defaultValue={Number(deal.target_loan_fils) / 100} className="bw-input font-num" />
            </div>
            <div>
              <label className="block font-semibold mb-1">Tenure (Months, max 300)</label>
              <input name="tenureMonths" type="number" defaultValue={Number(deal.tenure_months)} className="bw-input font-num" />
            </div>
            <div>
              <label className="block font-semibold mb-1">Property Status</label>
              <select name="propertyStatus" defaultValue={String(deal.property_status)} className="bw-input">
                <option value="READY">Completed / Ready</option>
                <option value="HANDOVER_COMPLETION">Off-Plan Handover</option>
                <option value="OFFPLAN_UNDER_CONSTRUCTION">Off-Plan Under Construction (50% Cap)</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">Sharia / Structure Pref</label>
              <select name="financePreference" defaultValue={String(deal.finance_preference)} className="bw-input">
                <option value="ANY">All 24 Banks (Conventional + Islamic)</option>
                <option value="ISLAMIC_ONLY">Islamic Only (Ijara / Murabaha)</option>
                <option value="CONVENTIONAL_ONLY">Conventional Only</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">Tower / Off-Plan Project</label>
              <select name="projectId" defaultValue={String(deal.project_id || '')} className="bw-input">
                <option value="">Secondary Ready Villa/Apt</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.community})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">Direct Client Fee (AED)</label>
              <input name="directClientFeeAed" type="number" defaultValue={Number(deal.direct_client_fee_fils) / 100} className="bw-input font-num" />
            </div>
            <div>
              <label className="block font-semibold mb-1">UAE National Housing Grant</label>
              <select name="housingGrantProgram" defaultValue={String(deal.housing_grant_program)} className="bw-input">
                <option value="NONE">None</option>
                <option value="MRHE">MRHE (Mohammed Bin Rashid Housing)</option>
                <option value="SZHP">SZHP (Sheikh Zayed Housing)</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">Grant Amount (AED)</label>
              <input name="housingGrantAed" type="number" defaultValue={Number(deal.housing_grant_fils) / 100} className="bw-input font-num" />
            </div>
            <div className="col-span-2 flex items-center justify-between pt-1">
              <label className="flex items-center gap-2">
                <input type="checkbox" name="preQualCertEnabled" value="1" defaultChecked={Number(deal.pre_qual_cert_enabled) === 1} />
                Enable Privacy-Safe Partner Pre-Qual Certificate
              </label>
              <input type="hidden" name="isFirstHome" value={String(deal.is_first_home)} />
              <button type="submit" className="bw-btn-gold">Recalculate 24 Banks</button>
            </div>
          </form>
        </div>

        <div className="lg:col-span-7 bw-card p-5 space-y-4">
          <h2 className="font-display font-bold text-sm text-[#021125]">
            Household Applicants & AECB Liabilities (3% vs 5% Card Limit Engine)
          </h2>

          <div className="space-y-3">
            {applicants.map((a) => (
              <form
                key={String(a.id)}
                method="POST"
                action="/api/v1/actions"
                className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 grid sm:grid-cols-6 gap-2 text-xs items-end"
              >
                <input type="hidden" name="action" value="update_applicant_income" />
                <input type="hidden" name="applicantId" value={String(a.id)} />
                <input type="hidden" name="returnTo" value={`/os/los?dealId=${dealId}`} />
                <div className="sm:col-span-2">
                  <div className="font-bold text-[#021125]">
                    {String(a.full_name_en)} <span className="bw-badge bg-amber-100 text-[#7d5f1f]">{String(a.applicant_role)}</span>
                  </div>
                  <select name="residencyType" defaultValue={String(a.residency_type)} className="bw-input mt-1">
                    <option value="EXPAT_RESIDENT">Expat Resident</option>
                    <option value="UAE_NATIONAL">UAE National</option>
                    <option value="GCC_NATIONAL">GCC National</option>
                    <option value="NON_RESIDENT">Non-Resident</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold">Basic AED</label>
                  <input name="basicSalaryAed" type="number" defaultValue={Number(a.basic_salary_fils) / 100} className="bw-input font-num" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold">Allowances AED</label>
                  <input name="allowancesAed" type="number" defaultValue={Number(a.allowances_fils) / 100} className="bw-input font-num" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold">AECB Score</label>
                  <input name="aecbScore" type="number" defaultValue={Number(a.aecb_score || 750)} className="bw-input font-num" />
                </div>
                <input type="hidden" name="employmentType" value={String(a.employment_type)} />
                <button type="submit" className="bw-btn-navy">Save</button>
              </form>
            ))}
          </div>

          {/* Liabilities Table */}
          <div className="border-t border-slate-200 pt-3">
            <div className="text-xs font-bold text-slate-700 mb-2">Active AECB & Statement Liabilities</div>
            <div className="space-y-1.5">
              {liabilities.map((l) => (
                <div key={String(l.id)} className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 px-3 py-2 text-xs">
                  <div>
                    <span className="font-semibold text-[#021125]">{String(l.liability_type)}</span> · {String(l.lender_name)}
                    <span className="font-num text-slate-500 ms-2">
                      Limit: {formatAed(Number(l.credit_limit_fils))} · Monthly EMI: {formatAed(Number(l.monthly_emi_fils))}
                    </span>
                  </div>
                  <form method="POST" action="/api/v1/actions">
                    <input type="hidden" name="action" value="toggle_liability_clearance" />
                    <input type="hidden" name="liabilityId" value={String(l.id)} />
                    <input type="hidden" name="returnTo" value={`/os/los?dealId=${dealId}`} />
                    <button
                      type="submit"
                      className={`rounded px-2.5 py-1 text-[11px] font-semibold cursor-pointer ${
                        Number(l.to_be_cleared_before_fol) === 1
                          ? 'bg-emerald-100 text-emerald-900'
                          : 'bg-slate-200 text-slate-800'
                      }`}
                    >
                      {Number(l.to_be_cleared_before_fol) === 1 ? 'Cleared Pre-FOL (Excluded)' : 'Active in 50% DBR (Click to Clear)'}
                    </button>
                  </form>
                </div>
              ))}
            </div>

            <form method="POST" action="/api/v1/actions" className="mt-2.5 grid sm:grid-cols-5 gap-2 text-xs">
              <input type="hidden" name="action" value="add_liability" />
              <input type="hidden" name="applicantId" value={String(applicants[0]?.id || 1)} />
              <input type="hidden" name="returnTo" value={`/os/los?dealId=${dealId}`} />
              <select name="liabilityType" className="bw-input">
                <option value="CREDIT_CARD">Credit Card</option>
                <option value="PERSONAL_LOAN">Personal Loan</option>
                <option value="AUTO_LOAN">Auto Loan</option>
                <option value="BNPL">Tabby/Tamara BNPL</option>
              </select>
              <input name="lenderName" placeholder="Lender Name" required className="bw-input" />
              <input name="creditLimitAed" type="number" placeholder="Card Limit AED" className="bw-input font-num" />
              <input name="monthlyEmiAed" type="number" placeholder="Loan EMI AED" className="bw-input font-num" />
              <button type="submit" className="bw-btn-navy">+ Add Liability</button>
            </form>
          </div>
        </div>
      </div>

      {/* Ranked 24-Bank Underwriting Engine Output */}
      <div className="bw-card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display font-bold text-base text-[#021125]">
              Ranked 24-Bank Eligibility & True 5-Year Total Cost Comparison ({uw.eligibleOffers.length} Eligible / {uw.knockouts.length} Knocked Out)
            </h2>
            <p className="text-xs text-slate-500">
              Benchmarked against CBUAE 3M EIBOR ({formatBps(uw.eibor3mBps)}) · Net Loan Required: <span className="font-num font-semibold">{formatAed(uw.netLoanNeededFils)}</span>
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-4 py-2.5 text-start">Rank & Bank</th>
                <th className="px-4 py-2.5 text-start">Product / Mode</th>
                <th className="px-4 py-2.5 text-end">Intro Rate</th>
                <th className="px-4 py-2.5 text-end">Revert Rate</th>
                <th className="px-4 py-2.5 text-end">Intro EMI</th>
                <th className="px-4 py-2.5 text-end">Stressed DBR</th>
                <th className="px-4 py-2.5 text-end">LTV / Cap</th>
                <th className="px-4 py-2.5 text-end">5-Yr Total Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {uw.eligibleOffers.slice(0, 12).map((o, idx) => (
                <tr key={o.rateCardId} className={idx === 0 ? 'bg-emerald-50/50' : 'hover:bg-slate-50'}>
                  <td className="px-4 py-3 flex items-center gap-2.5">
                    <span className="font-num font-bold text-slate-400">#{idx + 1}</span>
                    <img src={o.logoPath} alt={o.bankShort} className="h-6 w-6 object-contain rounded bg-white p-0.5 border border-slate-200" />
                    <div>
                      <div className="font-bold text-[#021125]">{o.bankName}</div>
                      <div className="text-[10px] text-slate-500">{o.structure}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-num font-semibold">{o.productCode}</span>
                    <div className="text-[10px] text-slate-500">{o.fixedYears}Y Fixed · {o.financeMode}</div>
                  </td>
                  <td className="px-4 py-3 text-end font-num font-bold text-[#021125]">{formatBps(o.introRateBps)}</td>
                  <td className="px-4 py-3 text-end font-num text-slate-600">{formatBps(o.effectiveRevertRateBps)}</td>
                  <td className="px-4 py-3 text-end font-num font-semibold">{formatAed(o.introEmiFils)}</td>
                  <td className="px-4 py-3 text-end font-num">{formatBps(o.calculatedDbrBps)}</td>
                  <td className="px-4 py-3 text-end font-num">
                    {formatBps(o.calculatedLtvBps)} <span className="text-slate-400">/ {formatBps(o.maxAllowedLtvBps)}</span>
                  </td>
                  <td className="px-4 py-3 text-end font-num font-bold text-emerald-800">{formatAed(o.fiveYearTotalCostFils)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {uw.knockouts.length > 0 && (
          <div className="p-4 bg-slate-50 border-t border-slate-200">
            <div className="text-xs font-bold text-slate-700 mb-2">Policy & CBUAE Knock-Out Diagnostics ({uw.knockouts.length} Banks Excluded)</div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {uw.knockouts.slice(0, 9).map((k) => (
                <div key={k.bankId} className="rounded border border-rose-200 bg-white px-3 py-2 text-[11px]">
                  <span className="font-bold text-rose-900">{k.bankName}:</span>{' '}
                  <span className="text-slate-600">{k.reason}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Dual-Bank Parallel IPA Submission & FOL Tracker */}
      <div className="bw-card p-5 space-y-3 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              UAE Refinance &amp; Sharia Structuring Desk
            </span>
            <h3 className="font-display font-bold text-sm text-[#021125]">
              Buyout Break-Even Calculator (CBUAE AED 10,000 Penalty Cap) &amp; Islamic Structure
            </h3>
          </div>
          <span
            className={`bw-badge ${
              buyout.recommendation === 'RECOMMEND_BUYOUT'
                ? 'bg-emerald-100 text-emerald-900'
                : 'bg-amber-100 text-amber-900'
            }`}
          >
            {buyout.recommendation} · Break-Even: {buyout.breakEvenMonths ?? 'N/A'} Months · LL Window: {buyout.liabilityLetterValidityDays} Days
          </span>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 font-num">
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <div className="text-[10px] text-slate-500 font-sans">Current EMI (5.49%) vs New EMI ({formatBps(buyout.newIntroRateBps)})</div>
            <div className="font-bold text-slate-900 mt-1">
              {formatAed(buyout.currentMonthlyEmiFils)} → {formatAed(buyout.newMonthlyEmiFils)}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <div className="text-[10px] text-slate-500 font-sans">Monthly Cash-Flow Savings</div>
            <div className="font-bold text-emerald-800 mt-1">{formatAed(buyout.monthlySavingsFils)} / mo</div>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <div className="text-[10px] text-slate-500 font-sans">CBUAE Early Settlement Cap (Incl. 5% VAT)</div>
            <div className="font-bold text-slate-900 mt-1">{formatAed(buyout.cbuaeEarlySettlementPenaltyInclVatFils)}</div>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <div className="text-[10px] text-slate-500 font-sans">Total Switching Cost (CBUAE + DLD 0.25% + Val)</div>
            <div className="font-bold text-slate-900 mt-1">{formatAed(buyout.totalSwitchingCostFils)}</div>
          </div>
          <div className="p-3 rounded-lg bg-emerald-50/70 border border-emerald-200">
            <div className="text-[10px] text-emerald-800 font-sans">Net 60-Month Refinance Savings</div>
            <div className="font-bold text-emerald-950 mt-1">{formatAed(buyout.fiveYearNetSavingsFils)}</div>
          </div>
        </div>
        <div className="text-[11px] text-slate-600">
          <strong>Contract Structure:</strong> {buyout.shariaStructureSummary}
        </div>
      </div>

      {/* Mortgage Finder Style: Rent vs. Buy 5-Year Wealth Calculator + 7x LTI & Age-at-Maturity Diagnostics */}
      <div className="grid lg:grid-cols-12 gap-6 text-xs">
        <div className="lg:col-span-7 bw-card p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Tenant-to-Buyer Conversion Engine (Dubai Ejari vs. Mortgage Equity)
              </span>
              <h3 className="font-display font-bold text-sm text-[#021125]">
                5-Year Rent vs. Buy Wealth Comparison (Includes 4% DLD, 0.25% Mortgage Reg &amp; Principal Equity)
              </h3>
            </div>
            <span className="bw-badge bg-emerald-100 text-emerald-900 font-num">
              {rentVsBuy.verdict} · Break-Even Year {rentVsBuy.breakEvenYear}
            </span>
          </div>

          <div className="grid sm:grid-cols-4 gap-2.5 font-num">
            <div className="p-3 rounded-lg bg-rose-50/70 border border-rose-200">
              <div className="text-[10px] text-rose-800 font-sans">5-Yr Sunk Ejari Rent + Renewals</div>
              <div className="font-bold text-rose-950 mt-1">- {formatAed(rentVsBuy.fiveYearTotalRentOutflowFils)}</div>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <div className="text-[10px] text-slate-500 font-sans">5-Yr Mortgage Principal Equity Paid</div>
              <div className="font-bold text-slate-900 mt-1">+ {formatAed(rentVsBuy.fiveYearPrincipalEquityBuiltFils)}</div>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <div className="text-[10px] text-slate-500 font-sans">5-Yr Est. Capital Appreciation (4.5%/yr)</div>
              <div className="font-bold text-slate-900 mt-1">+ {formatAed(rentVsBuy.fiveYearCapitalAppreciationFils)}</div>
            </div>
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
              <div className="text-[10px] text-emerald-800 font-sans">Net 5-Yr Buyer Wealth Advantage</div>
              <div className="font-bold text-emerald-950 mt-1">+ {formatAed(rentVsBuy.netFiveYearWealthAdvantageFils)}</div>
            </div>
          </div>
          <div className="text-[11px] text-slate-500 font-num">
            Upfront DLD 4% + Agency 2% + Trustee/Valuation Sunk Costs Factored: <strong>{formatAed(rentVsBuy.upfrontDldAndAgencyFeesFils)}</strong> · Down Payment Equity Retained: <strong>{formatAed(rentVsBuy.downPaymentFils)}</strong>
          </div>
        </div>

        <div className="lg:col-span-5 bw-card p-5 space-y-3">
          <div className="border-b border-slate-200 pb-2.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              UAE Bank Credit Policy Stress Checks
            </span>
            <h3 className="font-display font-bold text-sm text-[#021125]">
              7x Annual Income Cap (LTI) &amp; Age-at-Maturity (65/70) Diagnostics
            </h3>
          </div>

          <div className="space-y-2 font-num">
            <div className="flex items-center justify-between p-2.5 rounded bg-slate-50 border border-slate-200">
              <span className="font-sans text-slate-600">Loan-to-Income (LTI) Multiple (Max 7.0x Annual)</span>
              <span className={`font-bold ${ltiAge.ltiCompliant ? 'text-emerald-800' : 'text-rose-700'}`}>
                {ltiAge.ltiMultipleX}x ({ltiAge.ltiCompliant ? 'CLEARED' : 'EXCEEDS 7.0x CAP'})
              </span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded bg-slate-50 border border-slate-200">
              <span className="font-sans text-slate-600">Max Facility at 7.0x Annual Income</span>
              <span className="font-bold text-slate-900">{formatAed(ltiAge.maxLoanAt7xIncomeFils)}</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded bg-slate-50 border border-slate-200">
              <span className="font-sans text-slate-600">Age at Loan Maturity (Current {ltiAge.currentAgeYears}y + {ltiAge.tenureYears}y)</span>
              <span className={`font-bold ${ltiAge.ageAtMaturityCompliant ? 'text-emerald-800' : 'text-rose-700'}`}>
                {ltiAge.ageAtMaturityYears} Yrs / Cap {ltiAge.maxMaturityAgeYears} Yrs
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bw-card p-5 space-y-3">
          <h3 className="font-display font-bold text-sm text-[#021125]">
            Parallel Primary + Backup Bank IPA Submission
          </h3>
          <form method="POST" action="/api/v1/actions" className="space-y-3 text-xs">
            <input type="hidden" name="action" value="submit_dual_bank_ipa" />
            <input type="hidden" name="dealId" value={dealId} />
            <input type="hidden" name="returnTo" value={`/os/los?dealId=${dealId}`} />
            <div>
              <label className="block font-semibold mb-1">Primary Bank</label>
              <select name="primaryBankId" defaultValue={String(uw.eligibleOffers[0]?.bankId || deal.selected_bank_id || 1)} className="bw-input">
                {banks.map((b) => (
                  <option key={b.id} value={b.id}>{b.name_en}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">Backup Bank (Optional Parallel Submission)</label>
              <select name="backupBankId" defaultValue={String(uw.eligibleOffers[1]?.bankId || '')} className="bw-input">
                <option value="">None</option>
                {banks.map((b) => (
                  <option key={b.id} value={b.id}>{b.name_en}</option>
                ))}
              </select>
            </div>
            <input name="underwriterNotes" placeholder="Packaging notes for BDM (STL / Bonus / Employer tier)..." className="bw-input" />
            <button type="submit" className="bw-btn-gold w-full">
              Submit Bank IPA Package (Enforces Joint KFS + CDD Gate)
            </button>
          </form>
        </div>

        <div className="lg:col-span-7 bw-card p-5 space-y-3">
          <h3 className="font-display font-bold text-sm text-[#021125]">Active Bank Submissions & FOL Audit</h3>
          {submissions.length === 0 ? (
            <div className="text-xs text-slate-400">No bank IPA packages submitted yet for {String(deal.deal_ref)}.</div>
          ) : (
            <div className="space-y-2.5">
              {submissions.map((s) => (
                <form
                  key={String(s.id)}
                  method="POST"
                  action="/api/v1/actions"
                  className="rounded-lg border border-slate-200 p-3 grid sm:grid-cols-6 gap-2 items-center text-xs"
                >
                  <input type="hidden" name="action" value="update_submission_fol" />
                  <input type="hidden" name="submissionId" value={String(s.id)} />
                  <input type="hidden" name="returnTo" value={`/os/los?dealId=${dealId}`} />
                  <div className="sm:col-span-2">
                    <div className="font-bold text-[#021125]">{String(s.bank_name)} ({String(s.priority)})</div>
                    <div className="font-num text-[11px] text-slate-500">
                      {String(s.product_code)} · DBR {formatBps(Number(s.calculated_dbr_bps))}
                    </div>
                  </div>
                  <select name="status" defaultValue={String(s.status)} className="bw-input">
                    <option value="SUBMITTED">SUBMITTED</option>
                    <option value="IPA_APPROVED">IPA_APPROVED</option>
                    <option value="FOL_ISSUED">FOL_ISSUED</option>
                    <option value="FOL_SIGNED">FOL_SIGNED</option>
                    <option value="IPA_DECLINED">IPA_DECLINED</option>
                  </select>
                  <input name="ipaRef" defaultValue={String(s.ipa_ref || '')} placeholder="IPA Ref" className="bw-input font-num" />
                  <label className="flex items-center gap-1.5 text-[11px]">
                    <input type="checkbox" name="folAuditPassed" value="1" defaultChecked={Number(s.fol_audit_passed) === 1} />
                    FOL Audited
                  </label>
                  <button type="submit" className="bw-btn-navy">Update</button>
                </form>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
