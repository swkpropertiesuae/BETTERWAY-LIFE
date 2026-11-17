import { getDb } from '@/server/db';
import { getActiveLang, requirePartnerUser } from '@/server/auth/request';
import { getPartnerVisibleDeals } from '@/server/auth';
import { DEAL_STAGE_LABELS, formatAed, formatBps, tr } from '@/lib/format';
import { OsBanner } from '@/components/os-banner';
import { getPreApprovedBuyerPropertyMatcherPool } from '@/server/engines/commercial-workflows-engine';

export default async function ReraPartnerHubPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const user = await requirePartnerUser();
  const lang = await getActiveLang(user);
  const sp = await searchParams;
  const db = getDb();

  const overview = getPartnerVisibleDeals(db, user);
  const { agentProfile, deals, agencyFinancials } = overview;
  const matcherPool = getPreApprovedBuyerPropertyMatcherPool(db);

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <header className="bg-[#021125] text-white px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <img src="/brand/mark.svg" alt="Betterway" className="h-9 w-9 rounded-md" />
          <div>
            <div className="font-display font-bold text-base">
              Betterway RERA Partner Hub — {agentProfile.company_name}
            </div>
            <div className="text-xs text-[#D7B04E] font-num">
              RERA ORN {agentProfile.rera_orn} · Agent {agentProfile.rera_brn} ·{' '}
              {agentProfile.is_agency_admin ? 'Agency Owner (All Agency BRNs + Tax Invoices)' : 'Individual Agent (Isolated Own BRN Only)'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span
            className={`bw-badge ${
              agentProfile.verification_status === 'VERIFIED' ? 'bg-emerald-400/20 text-emerald-200' : 'bg-amber-400/20 text-amber-200'
            }`}
          >
            ORN {agentProfile.verification_status}
          </span>
          <form method="POST" action="/api/v1/auth/logout">
            <button type="submit" className="rounded bg-white/10 px-3 py-1 hover:bg-white/20 cursor-pointer">
              {tr(lang, 'Sign Out', 'خروج')}
            </button>
          </form>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 lg:p-8 space-y-6">
        <OsBanner notice={sp.notice} error={sp.error} />

        {agentProfile.verification_status !== 'VERIFIED' && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-950">
            <strong>Instant Lead-Drop Active · Commission Payout Hold (`ONBOARDING_HOLD`):</strong> You can submit buyer referrals immediately. Earned introducer splits are held safely in `GL 2110` and release automatically once Betterway verifies RERA ORN <strong>{agentProfile.rera_orn}</strong> and your Brokerage Owner signs the corporate Referral Agreement.
          </div>
        )}

        <div className="grid lg:grid-cols-12 gap-6">
          {/* 30-Second Buyer Lead Drop */}
          <div className="lg:col-span-5 bw-card p-6 space-y-3 text-xs">
            <h2 className="font-display font-bold text-base text-[#021125]">
              30-Second Buyer Mortgage Lead Drop
            </h2>
            <p className="text-slate-600">
              Routes straight to Betterway&apos;s Senior Advisory Desk under a 5-minute GST SLA. Your BRN (<span className="font-num font-semibold">{agentProfile.rera_brn}</span>) is permanently attributed.
            </p>
            <form method="POST" action="/api/v1/actions" className="space-y-2.5">
              <input type="hidden" name="action" value="drop_partner_lead" />
              <input type="hidden" name="returnTo" value="/partners" />
              <input name="contactName" required placeholder="Buyer Full Name" className="bw-input" />
              <div className="grid grid-cols-2 gap-2">
                <input name="contactPhone" required placeholder="+97150..." className="bw-input font-num" />
                <input name="contactEmail" type="email" placeholder="buyer@email.com" className="bw-input" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select name="transactionType" className="bw-input">
                  <option value="READY_PURCHASE">Ready Secondary Purchase</option>
                  <option value="OFFPLAN_HANDOVER">Off-Plan Handover</option>
                  <option value="BUYOUT">Buyout / Equity Release</option>
                </select>
                <input name="targetPropertyAed" type="number" required placeholder="Property Price AED" className="bw-input font-num" />
              </div>
              <input name="notes" placeholder="Unit / Tower / Target MOU signing date..." className="bw-input" />
              <label className="flex items-start gap-2 text-[11px] text-slate-700 pt-1">
                <input type="checkbox" name="clientConsentConfirmed" value="1" required className="mt-0.5" />
                <span>I confirm the buyer consented under UAE PDPL (Federal Decree-Law No. 45 of 2021) to be contacted by Betterway Mortgages.</span>
              </label>
              <button type="submit" className="bw-btn-gold w-full">Drop Buyer Lead Now →</button>
            </form>

            <div className="pt-3 border-t border-slate-200">
              <div className="font-semibold text-slate-700">Co-Branded Buyer Affordability Link</div>
              <div className="mt-1 rounded bg-slate-100 px-3 py-2 font-num text-[11px] text-slate-800 select-all">
                https://betterwaymortgages.com/calculator?ref={agentProfile.referral_code}
              </div>
            </div>
          </div>

          {/* Privacy-Masked Live Deal Pipeline */}
          <div className="lg:col-span-7 bw-card p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display font-bold text-base text-[#021125]">
                  Privacy-Masked Referral Pipeline ({deals.length} Deal{deals.length === 1 ? '' : 's'})
                </h2>
                <p className="text-slate-500">
                  Chinese-wall enforced: displays milestone stage & pre-qualification budget without exposing borrower salary, liabilities, AECB score, or Smart Vault documents.
                </p>
              </div>
            </div>

            {deals.length === 0 ? (
              <div className="text-slate-400 py-6 text-center">No converted mortgage deals yet for your scope.</div>
            ) : (
              <div className="space-y-3">
                {deals.map((d) => (
                  <div key={d.deal_id} className="rounded-lg border border-slate-200 p-4 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="font-num font-bold text-[#021125]">{d.deal_ref}</span> ·{' '}
                        <span className="font-semibold text-slate-900">{d.client_display_name}</span>
                      </div>
                      <span className="bw-badge bg-amber-100 text-[#8A6518]">
                        {DEAL_STAGE_LABELS[d.stage]?.[lang] ?? d.stage}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center justify-between text-slate-600">
                      <span>
                        {d.community_name} · {d.transaction_type} · Agent: <strong>{d.agent_name}</strong> ({d.agent_brn})
                      </span>
                      <span className="font-num font-bold text-[#021125]">Facility: {formatAed(d.target_loan_fils)}</span>
                    </div>
                    {d.pre_qual_cert_enabled === 1 && (
                      <div className="rounded bg-emerald-50 border border-emerald-200 px-3 py-2 text-emerald-950 flex items-center justify-between">
                        <span>
                          ✓ <strong>Verified Buyer Pre-Qualification Certificate:</strong> Qualified up to{' '}
                          <span className="font-num font-bold">{formatAed(Math.round(d.target_loan_fils / 0.8))}</span> purchase price (Zero income/AECB data disclosed)
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Agency Owner Only: Corporate ORN Agreement, IBAN/TRN & Self-Billed Tax Invoices */}
        <div className="bw-card p-6 space-y-4 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                B2B Partner Non-Circumvention &amp; Inventory Matcher
              </span>
              <h2 className="font-display font-bold text-base text-[#021125]">
                Pre-Approved Buyers Seeking Property Matches (&ldquo;You Keep the Client, We Handle the Mortgage&rdquo;)
              </h2>
            </div>
            <span className="bw-badge bg-emerald-100 text-emerald-900">
              100% RERA Non-Circumvention Client Protection Active
            </span>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {matcherPool.map((m) => (
              <div key={m.dealId} className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-num font-bold text-[#021125]">{m.dealRef} · {m.buyerMaskedCode}</span>
                  <span className="px-2 py-0.5 rounded bg-slate-900 text-[#D7B04E] text-[10px] font-bold font-num">
                    {m.nonCircumventionCertId}
                  </span>
                </div>
                <div className="text-[11px] text-slate-600">
                  Target Community: <strong>{m.preferredCommunity}</strong> ({m.preferredProject})
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1 font-num text-[11px]">
                  <div className="rounded bg-white border border-slate-200 p-2">
                    <div className="text-[10px] text-slate-500 font-sans">Verified Max Budget</div>
                    <div className="font-bold text-slate-900">{formatAed(m.verifiedMaxBudgetFils)}</div>
                  </div>
                  <div className="rounded bg-white border border-slate-200 p-2">
                    <div className="text-[10px] text-slate-500 font-sans">Approved Bank Loan</div>
                    <div className="font-bold text-emerald-800">{formatAed(m.approvedLoanFacilityFils)}</div>
                  </div>
                </div>
                <div className="text-[10px] text-slate-500 font-num flex items-center justify-between pt-1">
                  <span>Protected Agent: <strong>{m.protectedAgentBrn}</strong></span>
                  <a href={`/os/print/aip/${m.dealId}`} className="font-semibold text-[#021125] underline">
                    Download 60d AIP Cert →
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>

        {agencyFinancials && (
          <div className="grid lg:grid-cols-12 gap-6 text-xs">
            <div className="lg:col-span-6 bw-card p-6 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display font-bold text-base text-[#021125]">
                  Brokerage Owner Corporate Banking & Referral Agreement (`PARTNER_AGENCY_ADMIN` Only)
                </h2>
                <span className="bw-badge bg-[#021125] text-[#D7B04E]">
                  Tier: {agencyFinancials.tier} ({formatBps(agencyFinancials.default_split_bps)} of Bank Subvention)
                </span>
              </div>
              <p className="text-slate-600">
                Recoverable Clawback Debit Balance:{' '}
                <strong className="font-num text-rose-700">{formatAed(agencyFinancials.clawback_debit_balance_fils)}</strong>
              </p>

              <form method="POST" action="/api/v1/actions" className="grid grid-cols-2 gap-2.5">
                <input type="hidden" name="action" value="update_partner_banking" />
                <input type="hidden" name="returnTo" value="/partners" />
                <div>
                  <label className="block font-semibold mb-1">15-Digit FTA VAT TRN</label>
                  <input name="vatTrn15" defaultValue={agencyFinancials.vat_trn_15} className="bw-input font-num" />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Corporate Bank Name</label>
                  <input name="bankName" defaultValue={agencyFinancials.bank_name} className="bw-input" />
                </div>
                <div className="col-span-2">
                  <label className="block font-semibold mb-1">Corporate UAE IBAN (23 chars)</label>
                  <input name="iban" defaultValue={agencyFinancials.iban} className="bw-input font-num" />
                </div>
                <label className="col-span-2 flex items-center gap-2">
                  <input type="checkbox" name="signAgreement" value="1" defaultChecked={agentProfile.agreement_status === 'SIGNED'} />
                  Digitally Sign Master RERA Corporate Introducer Agreement (Bank-Subvention-Only Pay-When-Paid & Clawback Offset Terms)
                </label>
                <div className="col-span-2">
                  <button type="submit" className="bw-btn-navy w-full">Save Corporate Banking & Sign ORN Agreement</button>
                </div>
              </form>
            </div>

            <div className="lg:col-span-6 bw-card p-6 space-y-3">
              <h2 className="font-display font-bold text-base text-[#021125]">
                Self-Billed Peppol `PINT-AE` Commission Tax Invoices
              </h2>
              {(agencyFinancials.invoices as Record<string, unknown>[]).length === 0 ? (
                <div className="text-slate-400">
                  Self-billed tax invoices appear automatically once bank bordereau cash is reconciled and ORN verification is complete.
                </div>
              ) : (
                <div className="space-y-2">
                  {(agencyFinancials.invoices as Record<string, unknown>[]).map((inv) => (
                    <div key={String(inv.id)} className="rounded border border-slate-200 p-3 flex items-center justify-between">
                      <div>
                        <div className="font-num font-bold text-[#021125]">{String(inv.invoice_number)}</div>
                        <div className="font-num text-slate-500">Total incl. 5% VAT: {formatAed(Number(inv.total_fils))}</div>
                      </div>
                      <a href={`/api/v1/exports/pint-ae/${String(inv.id)}`} className="bw-btn-gold">
                        ⬇ PINT-AE .XML
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
