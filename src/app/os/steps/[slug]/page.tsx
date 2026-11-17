import Link from 'next/link';
import { getDb } from '@/server/db';
import { requireStaffUser } from '@/server/auth/request';
import { formatAedWhole } from '@/lib/format';
import { OsBanner } from '@/components/os-banner';
import { STEP_WORKFLOWS, getStepBySlug } from '@/lib/step-workflows';
import { evaluateDealAcross24Banks } from '@/server/engines/underwriting-engine';
import { checkBankSubmissionGate } from '@/server/engines/compliance-aml-engine';
import { computeConveyancingPack } from '@/server/engines/conveyancing-engine';
import {
  DUBAI_AREAS_24,
  PERMITTED_UAE_PAYMENT_CHANNELS,
  computeSwk5050CommissionSplit,
  isSupremeOwner,
} from '@/server/engines/swk-enterprise-engine';
import { ArrowLeft, ArrowRight, CheckCircle2, ExternalLink, ListChecks } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function SingleStepWorkflowPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ dealId?: string; area?: string; notice?: string; error?: string }>;
}) {
  const user = await requireStaffUser();
  const { slug } = await params;
  const sp = await searchParams;
  const step = getStepBySlug(slug);
  const prevStep = STEP_WORKFLOWS.find((s) => s.stepNumber === step.stepNumber - 1);
  const nextStep = STEP_WORKFLOWS.find((s) => s.stepNumber === step.stepNumber + 1);
  const returnTo = `/os/steps/${step.slug}`;

  const db = getDb();
  const supremeOwner = isSupremeOwner(user);

  const leads = db
    .prepare('SELECT id, contact_name, contact_phone, source_channel, stage, target_property_fils, first_responded_at FROM leads ORDER BY id DESC LIMIT 12')
    .all() as Array<Record<string, unknown>>;

  const deals = db
    .prepare(
      `SELECT d.id, d.deal_ref, d.household_id, d.purchase_price_fils, d.target_loan_fils, d.stage, d.cdd_status, h.primary_name
       FROM deals d JOIN households h ON h.id = d.household_id
       WHERE d.origin_mode = 'LIVE' ORDER BY d.id DESC`,
    )
    .all() as Array<Record<string, unknown>>;

  const activeDealId = sp.dealId ? Number(sp.dealId) : Number(deals[0]?.id || 1);
  const activeDeal = (deals.find((d) => Number(d.id) === activeDealId) ?? deals[0]) as Record<string, unknown>;

  const applicants = activeDeal
    ? (db
        .prepare('SELECT * FROM applicants WHERE household_id = ? ORDER BY id ASC')
        .all(Number(activeDeal.household_id)) as Array<Record<string, unknown>>)
    : [];

  const banks = db.prepare('SELECT id, name_en FROM banks ORDER BY id ASC').all() as Array<{
    id: number;
    name_en: string;
  }>;

  const submissions = db
    .prepare(
      `SELECT ds.id, ds.deal_id, ds.status, ds.ipa_ref, ds.fol_ref, b.name_en as bank_name, d.deal_ref
       FROM deal_submissions ds
       JOIN banks b ON b.id = ds.bank_id
       JOIN deals d ON d.id = ds.deal_id
       ORDER BY ds.id DESC LIMIT 12`,
    )
    .all() as Array<Record<string, unknown>>;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <OsBanner notice={sp.notice} error={sp.error} />

      {/* Top 20-Step Progress Bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-700">
            <ListChecks className="h-4 w-4 text-slate-700" />
            <span>
              Step-by-Step Guided Workflow · You are on{' '}
              <strong className="text-slate-700">
                Step {String(step.stepNumber).padStart(2, '0')} of 20
              </strong>
            </span>
          </div>
          <Link href="/os/steps" className="text-xs font-semibold text-slate-700 hover:text-slate-800">
            View All 20 Steps List →
          </Link>
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {STEP_WORKFLOWS.map((s) => {
            const active = s.slug === step.slug;
            return (
              <Link
                key={s.slug}
                href={`/os/steps/${s.slug}`}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition ${
                  active
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900'
                }`}
              >
                {s.shortTitle}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Simple Plain-English Explanation Card */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-800">
              {step.category} · Step {String(step.stepNumber).padStart(2, '0')} of 20
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mt-2">{step.title}</h1>
            <p className="text-sm text-gray-600 mt-1 max-w-3xl leading-relaxed">{step.whatIsThis}</p>
          </div>
          <Link
            href={step.fullModuleHref}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-gray-300 bg-white hover:bg-gray-50 text-xs font-semibold text-gray-700 shrink-0"
          >
            <span>{step.fullModuleLabel}</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* 3 Simple Steps Box */}
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-2">
            Operational Procedure:
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {step.howToFollow.map((item, idx) => (
              <div key={idx} className="bg-white rounded-lg p-3 border border-slate-200 flex items-start gap-2 text-xs text-gray-800">
                <CheckCircle2 className="h-4 w-4 text-slate-700 shrink-0 mt-0.5" />
                <span>
                  <strong>Step {idx + 1}:</strong> {item}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* DEDICATED ACTION WORKSPACE FOR EACH OF THE 20 STEPS */}

      {/* STEP 01: MORNING CHECK-IN */}
      {step.slug === 'check-in' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-gray-900">Complete Your Morning Office Check-In</h2>
            <p className="text-xs text-gray-500">
              Office hours are 10:00 AM – 7:00 PM (Mon–Fri) and 10:00 AM – 4:00 PM (Sat). Arrival up to 10:05 AM is
              marked On Time.
            </p>
            <form method="POST" action="/api/v1/actions" className="space-y-3 text-xs">
              <input type="hidden" name="action" value="reception_qr_checkin" />
              <input type="hidden" name="returnTo" value={returnTo} />
              <label className="block">
                <span className="font-semibold text-gray-700">Your Arrival Time (Dubai Time HH:MM)</span>
                <input type="text" name="checkInTimeGst" defaultValue="09:58" className="bw-input mt-1 w-full font-num" />
              </label>
              <label className="block">
                <span className="font-semibold text-gray-700">Reception QR Stand Code</span>
                <input type="text" name="qrStandCode" defaultValue="BW-RECEPTION-STAND-DXB-1" className="bw-input mt-1 w-full font-num" />
              </label>
              <button type="submit" className="bw-btn-gold w-full justify-center py-2.5">
                Complete Morning Check-In Now
              </button>
            </form>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs">
            <h2 className="text-base font-bold text-gray-900 mb-3">Recent Office Check-Ins</h2>
            <div className="space-y-2 text-xs">
              {(
                db.prepare('SELECT * FROM office_attendance_logs ORDER BY id DESC LIMIT 6').all() as Array<
                  Record<string, unknown>
                >
              ).map((log) => (
                <div key={String(log.id)} className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 border border-gray-200">
                  <div>
                    <span className="font-semibold text-gray-900">{String(log.employee_name)}</span>
                    <span className="text-gray-500 ml-2 font-num">{String(log.check_in_date)}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${log.status === 'ON_TIME' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {String(log.check_in_time_gst)} · {String(log.status)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* STEP 02: ADD A NEW CLIENT LEAD */}
      {step.slug === 'add-lead' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-gray-900">Enter New Client Details</h2>
            <form method="POST" action="/api/v1/actions" className="space-y-3 text-xs">
              <input type="hidden" name="action" value="create_lead" />
              <input type="hidden" name="returnTo" value={returnTo} />
              <label className="block">
                <span className="font-semibold text-gray-700">Client Full Name</span>
                <input name="contactName" required placeholder="e.g. Ahmed Al Mansoori" className="bw-input mt-1 w-full" />
              </label>
              <label className="block">
                <span className="font-semibold text-gray-700">Client Mobile / WhatsApp Number</span>
                <input name="contactPhone" required defaultValue="+97150" placeholder="+971501234567" className="bw-input mt-1 w-full font-num" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="font-semibold text-gray-700">How Did They Find Us?</span>
                  <select name="sourceChannel" className="bw-input mt-1 w-full">
                    <option value="WHATSAPP">WhatsApp Direct</option>
                    <option value="WEBSITE_CALC">Website Calculator</option>
                    <option value="PROPERTY_FINDER">Property Finder</option>
                    <option value="BAYUT">Bayut</option>
                    <option value="SELF_GEN">Advisor Self-Generated</option>
                  </select>
                </label>
                <label className="block">
                  <span className="font-semibold text-gray-700">What Are They Buying?</span>
                  <select name="transactionType" className="bw-input mt-1 w-full">
                    <option value="READY_PURCHASE">Ready Property</option>
                    <option value="OFFPLAN_HANDOVER">Off-Plan Handover</option>
                    <option value="BUYOUT">Refinance / Buyout</option>
                    <option value="EQUITY_RELEASE">Equity Release</option>
                  </select>
                </label>
              </div>
              <label className="block">
                <span className="font-semibold text-gray-700">Estimated Property Price (AED)</span>
                <input name="targetPropertyAed" type="number" defaultValue={2500000} className="bw-input mt-1 w-full font-num" />
              </label>
              <button type="submit" className="bw-btn-gold w-full justify-center py-2.5">
                Save New Client Lead
              </button>
            </form>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs">
            <h2 className="text-base font-bold text-gray-900 mb-3">Latest Client Leads ({leads.length})</h2>
            <div className="space-y-2 text-xs">
              {leads.slice(0, 6).map((l) => (
                <div key={String(l.id)} className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 border border-gray-200">
                  <div>
                    <div className="font-semibold text-gray-900">{String(l.contact_name)}</div>
                    <div className="text-gray-500 font-num">{String(l.contact_phone)} · {String(l.source_channel)}</div>
                  </div>
                  <span className="font-num font-semibold text-gray-800">
                    {formatAedWhole(Number(l.target_property_fils))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* STEP 03: CALL & WHATSAPP CLIENT */}
      {step.slug === 'call-lead' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-4">
          <h2 className="text-base font-bold text-gray-900">Log Your First Call or WhatsApp Reply</h2>
          <form method="POST" action="/api/v1/actions" className="space-y-3 text-xs max-w-xl">
            <input type="hidden" name="action" value="respond_lead" />
            <input type="hidden" name="returnTo" value={returnTo} />
            <label className="block">
              <span className="font-semibold text-gray-700">Select Client Lead</span>
              <select name="leadId" className="bw-input mt-1 w-full">
                {leads.map((l) => (
                  <option key={String(l.id)} value={String(l.id)}>
                    Lead #{String(l.id)} — {String(l.contact_name)} ({String(l.contact_phone)})
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="font-semibold text-gray-700">How Did You Contact Them?</span>
              <select name="channel" className="bw-input mt-1 w-full">
                <option value="WHATSAPP">WhatsApp Message</option>
                <option value="CALL_NOTE">Phone Call</option>
                <option value="EMAIL">Email</option>
              </select>
            </label>
            <label className="block">
              <span className="font-semibold text-gray-700">What Did You Discuss?</span>
              <textarea
                name="body"
                required
                rows={3}
                defaultValue="Called client, confirmed monthly salary and 20% down payment readiness. Shared initial monthly payment estimate."
                className="bw-input mt-1 w-full"
              />
            </label>
            <button type="submit" className="bw-btn-gold py-2.5 px-6">
              Log Call &amp; Pass 5-Minute SLA Timer
            </button>
          </form>
        </div>
      )}

      {/* STEP 04: CONVERT LEAD TO DEAL */}
      {step.slug === 'convert-lead' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-4">
          <h2 className="text-base font-bold text-gray-900">Convert Client into an Active Mortgage File</h2>
          <form method="POST" action="/api/v1/actions" className="space-y-3 text-xs max-w-xl">
            <input type="hidden" name="action" value="convert_lead_to_deal" />
            <input type="hidden" name="returnTo" value={returnTo} />
            <label className="block">
              <span className="font-semibold text-gray-700">Select Qualified Client Lead</span>
              <select name="leadId" className="bw-input mt-1 w-full">
                {leads.map((l) => (
                  <option key={String(l.id)} value={String(l.id)}>
                    Lead #{String(l.id)} — {String(l.contact_name)} ({formatAedWhole(Number(l.target_property_fils))})
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="bw-btn-gold py-2.5 px-6">
              Create Active Mortgage File Now
            </button>
          </form>
        </div>
      )}

      {/* STEP 05: MARKET GUIDE */}
      {step.slug === 'market-guide' && (() => {
        const selectedArea = DUBAI_AREAS_24.find((a) => a.code === (sp.area || 'PALM')) ?? DUBAI_AREAS_24[0]!;
        return (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
              <div className="text-xs font-bold text-gray-700 mb-2">Click Any of the 24 Dubai Areas:</div>
              <div className="flex flex-wrap gap-1.5">
                {DUBAI_AREAS_24.map((a) => (
                  <Link
                    key={a.code}
                    href={`/os/steps/market-guide?area=${a.code}`}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                      a.code === selectedArea.code
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-slate-100'
                    }`}
                  >
                    {a.name} (AED {a.ppsf}/sqft)
                  </Link>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-4">
              <h2 className="text-lg font-bold text-gray-900">
                {selectedArea.name} — AED {selectedArea.ppsf.toLocaleString()}/sqft (+{selectedArea.yoyPct}% YoY ·{' '}
                {selectedArea.yieldPct}% Rental Yield)
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                  <strong>Metro:</strong> {selectedArea.nearby.metro}
                </div>
                <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                  <strong>Schools:</strong> {selectedArea.nearby.schools.join(', ')}
                </div>
                <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                  <strong>Hospitals:</strong> {selectedArea.nearby.hospitals.join(', ')}
                </div>
              </div>
              <div className="p-4 rounded-xl bg-slate-100 border border-slate-200 space-y-1.5 text-xs">
                <div className="font-bold text-slate-900 uppercase">Exact Words to Say to Your Client on Site:</div>
                {selectedArea.fieldVisitPitchScript.map((line, i) => (
                  <p key={i} className="text-gray-900 italic">
                    &ldquo;{line}&rdquo;
                  </p>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* STEP 06: PAYMENT CALCULATOR */}
      {step.slug === 'calculator' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-4">
          <h2 className="text-base font-bold text-gray-900">Quick Reference: Buyer Cash Needed &amp; Monthly Payment</h2>
          <p className="text-xs text-gray-600">
            Example for an <strong>AED 2,500,000</strong> property with 20% Down Payment (AED 500,000) and AED 2,000,000
            Loan at 3.99% for 25 Years:
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200">
              <div className="text-gray-500">Monthly Payment (EMI)</div>
              <div className="text-base font-bold text-gray-900 font-num mt-1">AED 10,546 / mo</div>
            </div>
            <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200">
              <div className="text-gray-500">DLD 4% + Trustee Fee</div>
              <div className="text-base font-bold text-gray-900 font-num mt-1">AED 104,780</div>
            </div>
            <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200">
              <div className="text-gray-500">Total Cash to Close</div>
              <div className="text-base font-bold text-slate-700 font-num mt-1">AED 665,720</div>
            </div>
            <div className="p-3.5 rounded-xl bg-green-50 border border-green-200">
              <div className="text-green-700">10-Year Golden Visa</div>
              <div className="text-base font-bold text-green-900 mt-1">ELIGIBLE (AED 2M+)</div>
            </div>
          </div>
          <Link href="/os/toolkit" className="bw-btn-gold inline-flex">
            Open Interactive Slider Calculator →
          </Link>
        </div>
      )}

      {/* STEP 07: SIGN CLIENT CONSENT (KFS) */}
      {step.slug === 'sign-kfs' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-4">
          <h2 className="text-base font-bold text-gray-900">Sign Client Key Facts Statement (KFS Consent)</h2>
          <form method="POST" action="/api/v1/actions" className="space-y-3 text-xs max-w-xl">
            <input type="hidden" name="action" value="sign_kfs" />
            <input type="hidden" name="returnTo" value={returnTo} />
            <input type="hidden" name="dealId" value={String(activeDeal.id)} />
            <label className="block">
              <span className="font-semibold text-gray-700">Select Applicant on {String(activeDeal.deal_ref)}</span>
              <select name="applicantId" className="bw-input mt-1 w-full">
                {applicants.map((a) => (
                  <option key={String(a.id)} value={String(a.id)}>
                    {String(a.full_name_en)} ({String(a.applicant_role)})
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="font-semibold text-gray-700">Typed Signature Name</span>
              <input
                name="signedByName"
                required
                defaultValue={String(applicants[0]?.full_name_en || 'Client Signed')}
                className="bw-input mt-1 w-full"
              />
            </label>
            <input type="hidden" name="disclosedBrokerFeeAed" value="0" />
            <input type="hidden" name="lfiCommissionRange" value="0.45% to 1.00% Bank Subvention" />
            <button type="submit" className="bw-btn-gold py-2.5 px-6">
              Record Signed KFS Consent
            </button>
          </form>
        </div>
      )}

      {/* STEP 08: CLIENT ID & SAFETY CHECK (AML/CDD) */}
      {step.slug === 'id-check' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-4">
          <h2 className="text-base font-bold text-gray-900">Complete Client ID &amp; Safety Check (AML / CDD)</h2>
          <form method="POST" action="/api/v1/actions" className="space-y-3 text-xs max-w-xl">
            <input type="hidden" name="action" value="run_aml_cdd" />
            <input type="hidden" name="returnTo" value={returnTo} />
            <input type="hidden" name="dealId" value={String(activeDeal.id)} />
            <label className="block">
              <span className="font-semibold text-gray-700">Select Applicant on {String(activeDeal.deal_ref)}</span>
              <select name="applicantId" className="bw-input mt-1 w-full">
                {applicants.map((a) => (
                  <option key={String(a.id)} value={String(a.id)}>
                    {String(a.full_name_en)} ({String(a.applicant_role)})
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="font-semibold text-gray-700">Where Does Their Down-Payment Money Come From?</span>
              <select name="sourceOfFundsType" className="bw-input mt-1 w-full">
                <option value="UAE_SALARY_SAVINGS">UAE Salary Savings (6 Months Bank Statements)</option>
                <option value="PROPERTY_SALE_PROCEEDS">Sale of Existing Property</option>
                <option value="AUDITED_DIVIDENDS">Audited Company Dividends</option>
              </select>
            </label>
            <input type="hidden" name="sourceOfFundsVerified" value="1" />
            <input type="hidden" name="sanctionsMatchStatus" value="CLEAR" />
            <input type="hidden" name="isPep" value="0" />
            <button type="submit" className="bw-btn-gold py-2.5 px-6">
              Approve Client ID Check &amp; Unlock Banks
            </button>
          </form>
        </div>
      )}

      {/* STEP 09: UPDATE CLIENT SALARY & LOAN */}
      {step.slug === 'update-income' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-4">
          <h2 className="text-base font-bold text-gray-900">Enter Client Monthly Salary &amp; Credit Score</h2>
          <form method="POST" action="/api/v1/actions" className="space-y-3 text-xs max-w-xl">
            <input type="hidden" name="action" value="update_applicant_income" />
            <input type="hidden" name="returnTo" value={returnTo} />
            <label className="block">
              <span className="font-semibold text-gray-700">Select Applicant</span>
              <select name="applicantId" className="bw-input mt-1 w-full">
                {applicants.map((a) => (
                  <option key={String(a.id)} value={String(a.id)}>
                    {String(a.full_name_en)}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="font-semibold text-gray-700">Basic Salary (AED / month)</span>
                <input type="number" name="basicSalaryAed" defaultValue={32000} className="bw-input mt-1 w-full font-num" />
              </label>
              <label className="block">
                <span className="font-semibold text-gray-700">Allowances (AED / month)</span>
                <input type="number" name="allowancesAed" defaultValue={18000} className="bw-input mt-1 w-full font-num" />
              </label>
            </div>
            <label className="block">
              <span className="font-semibold text-gray-700">AECB Credit Score (300 to 900)</span>
              <input type="number" name="aecbScore" defaultValue={760} className="bw-input mt-1 w-full font-num" />
            </label>
            <button type="submit" className="bw-btn-gold py-2.5 px-6">
              Save Client Salary &amp; Recalculate 24 Banks
            </button>
          </form>
        </div>
      )}

      {/* STEP 10: COMPARE 24 UAE BANKS */}
      {step.slug === 'compare-banks' && (() => {
        const uw = evaluateDealAcross24Banks(db, Number(activeDeal.id));
        return (
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-bold text-gray-900">
                24-Bank Eligibility Results for {String(activeDeal.primary_name)} ({String(activeDeal.deal_ref)})
              </h2>
              <span className="px-3 py-1 rounded-full bg-green-100 text-green-800 text-xs font-bold">
                {uw.eligibleOffers.length} of 24 UAE Banks Approve This Client
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-500 uppercase text-[10px]">
                    <th className="py-2 px-3">Rank</th>
                    <th className="py-2 px-3">UAE Bank</th>
                    <th className="py-2 px-3">Fixed Rate</th>
                    <th className="py-2 px-3">Monthly Payment (EMI)</th>
                    <th className="py-2 px-3">Stress DBR (Max 50%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {uw.eligibleOffers.slice(0, 8).map((off, idx) => (
                    <tr key={off.rateCardId}>
                      <td className="py-2.5 px-3 font-num font-bold text-slate-700">#{idx + 1}</td>
                      <td className="py-2.5 px-3 font-bold text-gray-900">{off.bankName}</td>
                      <td className="py-2.5 px-3 font-num">{(off.introRateBps / 100).toFixed(2)}%</td>
                      <td className="py-2.5 px-3 font-num font-semibold">{formatAedWhole(off.introEmiFils)}</td>
                      <td className="py-2.5 px-3 font-num text-green-700 font-bold">
                        {(off.calculatedDbrBps / 100).toFixed(1)}% PASS
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* STEP 11: SUBMIT DUAL-BANK IPA */}
      {step.slug === 'submit-ipa' && (() => {
        const gate = checkBankSubmissionGate(db, Number(activeDeal.id));
        return (
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-4">
            <div className={`p-3.5 rounded-lg text-xs font-semibold ${gate.allowed ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-amber-50 text-amber-800 border border-amber-200'}`}>
              {gate.allowed
                ? '✓ Client KFS Consent & ID Check are complete. You can submit to banks now.'
                : '⚠ Note: Complete Step 07 (Sign KFS) and Step 08 (ID Check) first if this deal has not been cleared yet.'}
            </div>
            <form method="POST" action="/api/v1/actions" className="space-y-3 text-xs max-w-xl">
              <input type="hidden" name="action" value="submit_dual_bank_ipa" />
              <input type="hidden" name="returnTo" value={returnTo} />
              <label className="block">
                <span className="font-semibold text-gray-700">Select Mortgage Deal File</span>
                <select name="dealId" defaultValue={String(activeDeal.id)} className="bw-input mt-1 w-full">
                  {deals.map((d) => (
                    <option key={String(d.id)} value={String(d.id)}>
                      {String(d.deal_ref)} — {String(d.primary_name)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="font-semibold text-gray-700">Primary Bank Choice</span>
                  <select name="primaryBankId" defaultValue="1" className="bw-input mt-1 w-full">
                    {banks.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name_en}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="font-semibold text-gray-700">Backup Bank Choice</span>
                  <select name="backupBankId" defaultValue="2" className="bw-input mt-1 w-full">
                    {banks.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name_en}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="block">
                <span className="font-semibold text-gray-700">Short Note for Bank Credit Team</span>
                <input
                  name="underwriterNotes"
                  defaultValue="Strong salaried profile, 20% down payment verified, requesting 48h IPA."
                  className="bw-input mt-1 w-full"
                />
              </label>
              <button type="submit" className="bw-btn-gold py-2.5 px-6">
                Submit Application to Primary &amp; Backup Bank
              </button>
            </form>
          </div>
        );
      })()}

      {/* STEP 12: RECORD BANK FOL */}
      {step.slug === 'record-fol' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-4">
          <h2 className="text-base font-bold text-gray-900">Record Bank Pre-Approval (IPA) or Final Offer Letter (FOL)</h2>
          <form method="POST" action="/api/v1/actions" className="space-y-3 text-xs max-w-xl">
            <input type="hidden" name="action" value="update_submission_fol" />
            <input type="hidden" name="returnTo" value={returnTo} />
            <label className="block">
              <span className="font-semibold text-gray-700">Select Bank Application</span>
              <select name="submissionId" className="bw-input mt-1 w-full">
                {submissions.map((s) => (
                  <option key={String(s.id)} value={String(s.id)}>
                    Submission #{String(s.id)} — {String(s.deal_ref)} ({String(s.bank_name)} · {String(s.status)})
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="font-semibold text-gray-700">New Bank Status</span>
              <select name="status" className="bw-input mt-1 w-full">
                <option value="IPA_APPROVED">Pre-Approval (IPA) Issued</option>
                <option value="FOL_ISSUED">Final Offer Letter (FOL) Issued</option>
                <option value="FOL_SIGNED">Client Signed Final Offer Letter (FOL)</option>
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="font-semibold text-gray-700">IPA Reference Number</span>
                <input name="ipaRef" defaultValue="IPA-2026-8841" className="bw-input mt-1 w-full font-num" />
              </label>
              <label className="block">
                <span className="font-semibold text-gray-700">FOL Reference Number</span>
                <input name="folRef" defaultValue="FOL-2026-9920" className="bw-input mt-1 w-full font-num" />
              </label>
            </div>
            <input type="hidden" name="folAuditPassed" value="1" />
            <button type="submit" className="bw-btn-gold py-2.5 px-6">
              Save Bank Approval Status
            </button>
          </form>
        </div>
      )}

      {/* STEP 13: VALUATION & DEVELOPER NOC */}
      {step.slug === 'valuation-noc' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-4">
          <h2 className="text-base font-bold text-gray-900">Record Property Valuation &amp; Developer NOC</h2>
          <form method="POST" action="/api/v1/actions" className="space-y-3 text-xs max-w-xl">
            <input type="hidden" name="action" value="update_conveyancing" />
            <input type="hidden" name="returnTo" value={returnTo} />
            <label className="block">
              <span className="font-semibold text-gray-700">Select Mortgage Deal File</span>
              <select name="dealId" defaultValue={String(activeDeal.id)} className="bw-input mt-1 w-full">
                {deals.map((d) => (
                  <option key={String(d.id)} value={String(d.id)}>
                    {String(d.deal_ref)} — {String(d.primary_name)}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="font-semibold text-gray-700">Agreed Purchase Price (AED)</span>
                <input type="number" name="mouPurchasePriceAed" defaultValue={3500000} className="bw-input mt-1 w-full font-num" />
              </label>
              <label className="block">
                <span className="font-semibold text-gray-700">Bank Valuation Result (AED)</span>
                <input type="number" name="bankValuationAed" defaultValue={3500000} className="bw-input mt-1 w-full font-num" />
              </label>
            </div>
            <label className="block">
              <span className="font-semibold text-gray-700">Developer NOC Status</span>
              <select name="nocStatus" defaultValue="ISSUED" className="bw-input mt-1 w-full">
                <option value="ISSUED">Developer NOC Issued &amp; Ready</option>
                <option value="APPLIED">NOC Applied</option>
                <option value="NOT_APPLIED">Not Applied Yet</option>
              </select>
            </label>
            <input type="hidden" name="dldTrusteeOffice" value="Al Manara DLD Registration Trustee" />
            <input type="hidden" name="trusteeBookingDate" value="2026-11-25" />
            <button type="submit" className="bw-btn-gold py-2.5 px-6">
              Save Valuation &amp; Developer NOC
            </button>
          </form>
        </div>
      )}

      {/* STEP 14: DLD TRUSTEE CHEQUES */}
      {step.slug === 'trustee-cheques' && (() => {
        const pack = computeConveyancingPack(db, Number(activeDeal.id), 2);
        const rows = [
          { label: '1. Seller Bank Payoff Cheque', val: pack.cheques.sellerBankPayoffFils },
          { label: '2. Seller Net Proceeds Cheque', val: pack.cheques.sellerNetFils },
          { label: '3. DLD 4% Transfer Fee Cheque', val: pack.cheques.dldTransferFils },
          { label: '4. DLD Mortgage Registration (0.25% + AED 290)', val: pack.cheques.mortgageRegFils },
          { label: '5. DLD Registration Trustee Fee', val: pack.cheques.trusteeFeeFils },
          { label: '6. Real Estate Agency Fee (2% + VAT)', val: pack.cheques.agencyFeeInclVatFils },
        ];
        return (
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-gray-900">
              Manager&apos;s Cheques Required at DLD Trustee for {pack.dealRef}
            </h2>
            <div className="space-y-2 text-xs">
              {rows.map((r) => (
                <div key={r.label} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-200">
                  <span className="font-medium text-gray-800">{r.label}</span>
                  <span className="font-num font-bold text-gray-900">{formatAedWhole(r.val)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-100 border border-slate-200 font-bold text-sm text-slate-900">
                <span>Total Manager&apos;s Cheques Required</span>
                <span className="font-num">{formatAedWhole(pack.cheques.totalManagerChequesFils)}</span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* STEP 15: MARK LOAN DISBURSED */}
      {step.slug === 'disburse-loan' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-4">
          <h2 className="text-base font-bold text-gray-900">Mark Loan Disbursed &amp; Book Expected Bank Commission</h2>
          <form method="POST" action="/api/v1/actions" className="space-y-3 text-xs max-w-xl">
            <input type="hidden" name="action" value="record_disbursal" />
            <input type="hidden" name="returnTo" value={returnTo} />
            <label className="block">
              <span className="font-semibold text-gray-700">Select Mortgage Deal File</span>
              <select name="dealId" defaultValue={String(activeDeal.id)} className="bw-input mt-1 w-full">
                {deals.map((d) => (
                  <option key={String(d.id)} value={String(d.id)}>
                    {String(d.deal_ref)} — {String(d.primary_name)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="font-semibold text-gray-700">Final Disbursed Loan Amount (AED)</span>
              <input type="number" name="disbursedLoanAed" defaultValue={2800000} className="bw-input mt-1 w-full font-num" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="font-semibold text-gray-700">Disbursal Date</span>
                <input type="date" name="disbursedDate" defaultValue="2026-11-17" className="bw-input mt-1 w-full font-num" />
              </label>
              <label className="block">
                <span className="font-semibold text-gray-700">Fixed-Rate End Date</span>
                <input type="date" name="fixedExpiryDate" defaultValue="2028-11-17" className="bw-input mt-1 w-full font-num" />
              </label>
            </div>
            <button type="submit" className="bw-btn-gold py-2.5 px-6">
              Record Loan Disbursal
            </button>
          </form>
        </div>
      )}

      {/* STEP 16: 50/50 COMMISSION SPLIT */}
      {step.slug === 'split-commission' && (() => {
        const split = computeSwk5050CommissionSplit({
          grossCommissionExVatFils: 4_500_000,
          partnerShareBps: 2000,
        });
        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-4">
              <h2 className="text-base font-bold text-gray-900">Record Bank Commission Wire Received</h2>
              <form method="POST" action="/api/v1/actions" className="space-y-3 text-xs">
                <input type="hidden" name="action" value="record_bordereau_cash" />
                <input type="hidden" name="returnTo" value={returnTo} />
                <label className="block">
                  <span className="font-semibold text-gray-700">Select Disbursed Deal</span>
                  <select name="dealId" defaultValue="2" className="bw-input mt-1 w-full">
                    {deals.map((d) => (
                      <option key={String(d.id)} value={String(d.id)}>
                        {String(d.deal_ref)} — {String(d.primary_name)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="font-semibold text-gray-700">Bank Wire / Bordereau Reference</span>
                  <input name="batchRef" defaultValue="BORD-2026-1117" className="bw-input mt-1 w-full font-num" />
                </label>
                <label className="block">
                  <span className="font-semibold text-gray-700">Bank Commission Cash Received (AED)</span>
                  <input type="number" name="subventionCashInclVatAed" defaultValue={22050} className="bw-input mt-1 w-full font-num" />
                </label>
                <button type="submit" className="bw-btn-gold w-full justify-center py-2.5">
                  Record Bank Cash &amp; Release 50/50 Split
                </button>
              </form>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-3 text-xs">
              <h2 className="text-base font-bold text-gray-900">How the 50/50 Commission Split Works</h2>
              <p className="text-gray-600">
                Example on AED 45,000 Gross Bank Commission with a 20% external B2B Partner referral:
              </p>
              <div className="space-y-2">
                <div className="flex justify-between p-2.5 rounded-lg bg-gray-50">
                  <span>Gross Bank Commission</span>
                  <strong className="font-num">{formatAedWhole(split.grossCommissionExVatFils)}</strong>
                </div>
                <div className="flex justify-between p-2.5 rounded-lg bg-gray-50">
                  <span>Less: External Partner Share (20%)</span>
                  <strong className="font-num text-amber-700">- {formatAedWhole(split.partnerShareFils)}</strong>
                </div>
                <div className="flex justify-between p-2.5 rounded-lg bg-green-50 border border-green-200">
                  <span>Betterway 50% Company Share</span>
                  <strong className="font-num text-green-800">{formatAedWhole(split.company50ShareFils)}</strong>
                </div>
                <div className="flex justify-between p-2.5 rounded-lg bg-slate-100 border border-slate-200">
                  <span>Mortgage Advisor 50% Payout</span>
                  <strong className="font-num text-slate-800">{formatAedWhole(split.advisor50ShareFils)}</strong>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* STEP 17: WITHDRAW DEAL / CLIENT REFUND */}
      {step.slug === 'withdraw-deal' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-4">
          <h2 className="text-base font-bold text-gray-900">Log a Deal Cancellation or Client Refund Request</h2>
          <form method="POST" action="/api/v1/actions" className="space-y-3 text-xs max-w-xl">
            <input type="hidden" name="action" value="create_deal_withdrawal" />
            <input type="hidden" name="returnTo" value={returnTo} />
            <label className="block">
              <span className="font-semibold text-gray-700">Select Mortgage Deal File</span>
              <select name="dealId" className="bw-input mt-1 w-full">
                {deals.map((d) => (
                  <option key={String(d.id)} value={String(d.id)}>
                    {String(d.deal_ref)} — {String(d.primary_name)}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="font-semibold text-gray-700">Fee Collected (AED)</span>
                <input type="number" name="collectedFeeAed" defaultValue={5250} className="bw-input mt-1 w-full font-num" />
              </label>
              <label className="block">
                <span className="font-semibold text-gray-700">Costs Already Spent (AED)</span>
                <input type="number" name="incurredCostAed" defaultValue={2100} className="bw-input mt-1 w-full font-num" />
              </label>
            </div>
            <label className="block">
              <span className="font-semibold text-gray-700">Legal UAE Refund Channel (Personal Accounts Blocked)</span>
              <select name="paymentChannel" className="bw-input mt-1 w-full">
                {PERMITTED_UAE_PAYMENT_CHANNELS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="font-semibold text-gray-700">Reason for Cancellation / Refund</span>
              <textarea
                name="withdrawalReason"
                rows={3}
                required
                defaultValue="Property valuation came in below MOU price; client exercising valuation protection clause."
                className="bw-input mt-1 w-full"
              />
            </label>
            <button type="submit" className="bw-btn-gold py-2.5 px-6">
              Submit Refund for Owner Shabib Siraj Approval
            </button>
          </form>
        </div>
      )}

      {/* STEP 18: DAILY WORK REPORT */}
      {step.slug === 'daily-report' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-4">
          <h2 className="text-base font-bold text-gray-900">Submit Your End-of-Day Work Report</h2>
          <form method="POST" action="/api/v1/actions" className="space-y-3 text-xs max-w-xl">
            <input type="hidden" name="action" value="submit_daily_report" />
            <input type="hidden" name="returnTo" value={returnTo} />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <label className="block">
                <span className="font-semibold text-gray-700">Calls Made</span>
                <input type="number" name="callsCount" defaultValue={15} className="bw-input mt-1 w-full font-num" />
              </label>
              <label className="block">
                <span className="font-semibold text-gray-700">Leads Qualified</span>
                <input type="number" name="leadsQualified" defaultValue={5} className="bw-input mt-1 w-full font-num" />
              </label>
              <label className="block">
                <span className="font-semibold text-gray-700">Site Visits</span>
                <input type="number" name="siteVisitsCount" defaultValue={2} className="bw-input mt-1 w-full font-num" />
              </label>
              <label className="block">
                <span className="font-semibold text-gray-700">Bank IPAs Sent</span>
                <input type="number" name="ipasSubmitted" defaultValue={2} className="bw-input mt-1 w-full font-num" />
              </label>
            </div>
            <label className="block">
              <span className="font-semibold text-gray-700">Summary of Today&apos;s Work &amp; Tomorrow&apos;s Priority</span>
              <textarea
                name="summaryNotes"
                rows={3}
                required
                defaultValue="Completed 15 client calls, submitted 2 dual-bank IPAs, and prepared DLD Trustee cheques for tomorrow."
                className="bw-input mt-1 w-full"
              />
            </label>
            <button type="submit" className="bw-btn-gold py-2.5 px-6">
              Submit Daily Work Report
            </button>
          </form>
        </div>
      )}

      {/* STEP 19: PENDING DELETE BIN */}
      {step.slug === 'delete-bin' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-gray-900">Send a Mistaken / Duplicate Record to Delete Bin</h2>
            <form method="POST" action="/api/v1/actions" className="space-y-3 text-xs">
              <input type="hidden" name="action" value="queue_delete_to_bin" />
              <input type="hidden" name="returnTo" value={returnTo} />
              <label className="block">
                <span className="font-semibold text-gray-700">Record Type</span>
                <select name="entityType" className="bw-input mt-1 w-full">
                  <option value="leads">Client Lead</option>
                  <option value="deals">Mortgage Deal</option>
                  <option value="vault_documents">Uploaded Document</option>
                </select>
              </label>
              <label className="block">
                <span className="font-semibold text-gray-700">Record ID</span>
                <input name="entityId" defaultValue="3" className="bw-input mt-1 w-full font-num" />
              </label>
              <label className="block">
                <span className="font-semibold text-gray-700">Record Name / Title</span>
                <input name="recordTitle" required defaultValue="Lead #3 — Duplicate Test Inquiry" className="bw-input mt-1 w-full" />
              </label>
              <label className="block">
                <span className="font-semibold text-gray-700">Mandatory Reason for Owner Shabib Siraj</span>
                <textarea
                  name="deleteReason"
                  rows={2}
                  required
                  defaultValue="Duplicate inquiry entered twice by mistake."
                  className="bw-input mt-1 w-full"
                />
              </label>
              <button type="submit" className="bw-btn-gold w-full justify-center py-2.5">
                Send to Pending Delete Bin
              </button>
            </form>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-3">
            <h2 className="text-base font-bold text-gray-900">Items Waiting in Delete Bin</h2>
            {(
              db.prepare('SELECT * FROM recycle_bin_requests ORDER BY id DESC LIMIT 6').all() as Array<
                Record<string, unknown>
              >
            ).map((req) => (
              <div key={String(req.id)} className="p-3 rounded-lg bg-gray-50 border border-gray-200 text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="font-bold text-gray-900">{String(req.record_title)}</span>
                  <span className="font-semibold text-slate-700">{String(req.status)}</span>
                </div>
                <div className="text-gray-500">Reason: {String(req.delete_reason)}</div>
                {req.status === 'PENDING' && supremeOwner && (
                  <form method="POST" action="/api/v1/actions" className="flex gap-2 pt-1">
                    <input type="hidden" name="action" value="decide_recycle_bin" />
                    <input type="hidden" name="binId" value={String(req.id)} />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <button type="submit" name="decision" value="REJECTED_RESTORED" className="px-3 py-1 rounded bg-green-600 text-white font-semibold cursor-pointer">
                      Restore Record
                    </button>
                    <button type="submit" name="decision" value="APPROVED_DELETED" className="px-3 py-1 rounded bg-red-600 text-white font-semibold cursor-pointer">
                      Approve Delete
                    </button>
                  </form>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STEP 20: OWNER APPROVALS & ADMIN ACCOUNT CONTROL */}
      {step.slug === 'owner-approvals' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-gray-900">1-Click Owner WhatsApp Briefings (Shabib Siraj)</h2>
            <p className="text-xs text-gray-600">
              Send the 09:30 AM Morning Pipeline Briefing or the 10:30 AM Attendance &amp; Late Contemptor Report
              immediately.
            </p>
            <div className="flex flex-wrap gap-3">
              <form method="POST" action="/api/v1/actions">
                <input type="hidden" name="action" value="send_owner_briefing" />
                <input type="hidden" name="kind" value="morning" />
                <input type="hidden" name="returnTo" value={returnTo} />
                <button type="submit" className="bw-btn-gold">
                  Send 09:30 AM Morning Briefing
                </button>
              </form>
              <form method="POST" action="/api/v1/actions">
                <input type="hidden" name="action" value="send_owner_briefing" />
                <input type="hidden" name="kind" value="attendance-1030" />
                <input type="hidden" name="returnTo" value={returnTo} />
                <button type="submit" className="bw-btn-ghost">
                  Send 10:30 AM Attendance Report
                </button>
              </form>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-gray-900">
              Supreme Owner Control Over Admin Account (<code>admin@betterwaymortgages.com</code>)
            </h2>
            <form method="POST" action="/api/v1/actions" className="space-y-3 text-xs">
              <input type="hidden" name="action" value="owner_admin_control" />
              <input type="hidden" name="returnTo" value={returnTo} />
              <label className="block">
                <span className="font-semibold text-gray-700">Choose Action on Admin Account</span>
                <select name="controlAction" className="bw-input mt-1 w-full">
                  <option value="activate">Activate / Unlock Admin Account</option>
                  <option value="suspend">Suspend Admin Account Immediately</option>
                  <option value="force_signout">Force Sign-Out All Admin Sessions</option>
                  <option value="reset_password">Reset Admin Password</option>
                </select>
              </label>
              <input type="hidden" name="notes" value="Executed by Supreme Owner Shabib Siraj" />
              <button type="submit" className="bw-btn-gold w-full justify-center py-2.5">
                Execute Owner Control Action
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Bottom Previous / Next Step Navigation Bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        {prevStep ? (
          <Link
            href={`/os/steps/${prevStep.slug}`}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-gray-300 bg-white hover:bg-gray-50 text-xs font-semibold text-gray-700 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Previous: {prevStep.shortTitle}</span>
          </Link>
        ) : (
          <div />
        )}

        {nextStep ? (
          <Link
            href={`/os/steps/${nextStep.slug}`}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-sm transition"
          >
            <span>Next Step: {nextStep.shortTitle}</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        ) : (
          <Link
            href="/os/steps"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-green-600 hover:bg-green-700 text-white text-xs font-semibold shadow-sm transition"
          >
            <span>All 20 Steps Completed — Back to Step Directory</span>
            <CheckCircle2 className="h-4 w-4" />
          </Link>
        )}
      </div>
    </div>
  );
}
