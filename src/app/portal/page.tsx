import { getDb } from '@/server/db';
import { getActiveLang, requirePortalUser } from '@/server/auth/request';
import { getClientVisibleDeals } from '@/server/auth';
import { DEAL_STAGE_LABELS, formatAed, formatBps, tr } from '@/lib/format';
import { OsBanner } from '@/components/os-banner';

export default async function BorrowerPortalPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const user = await requirePortalUser();
  const lang = await getActiveLang(user);
  const sp = await searchParams;
  const db = getDb();

  const deals = getClientVisibleDeals(db, user);
  const activeDeal = deals[0];

  const householdApplicants = activeDeal
    ? (db
        .prepare(
          `SELECT a.id, a.user_id, a.full_name_en, a.applicant_role,
                  (SELECT signed_at FROM kfs_acknowledgements k WHERE k.deal_id = ? AND k.applicant_id = a.id) as signed_at
           FROM applicants a
           WHERE a.household_id = ? AND a.applicant_role IN ('PRIMARY','CO_BORROWER','GUARANTOR')
           ORDER BY a.id ASC`,
        )
        .all(activeDeal.id, activeDeal.household_id) as {
        id: number;
        user_id: number | null;
        full_name_en: string;
        applicant_role: string;
        signed_at: string | null;
      }[])
    : [];

  const vaultDocs = activeDeal
    ? (db
        .prepare('SELECT * FROM vault_documents WHERE deal_id = ? ORDER BY id DESC')
        .all(activeDeal.id) as Record<string, unknown>[])
    : [];

  const radar = activeDeal
    ? (db
        .prepare(
          `SELECT r.*, b.name_en as bank_name
           FROM homeowner_radar_monitors r
           JOIN banks b ON b.id = r.lender_bank_id
           WHERE r.household_id = ? ORDER BY r.id DESC`,
        )
        .all(activeDeal.household_id) as Record<string, unknown>[])
    : [];

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <header className="bg-[#021125] text-white px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <img src="/brand/mark.svg" alt="Betterway" className="h-9 w-9 rounded-md" />
          <div>
            <div className="font-display font-bold text-base">Betterway Borrower Smart Vault</div>
            <div className="text-xs text-[#D7B04E]">
              {tr(lang, 'AES-256-GCM Encrypted Household Workspace', 'خزنة المقترض المشفرة ومتابعة الرهن العقاري')}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span className="text-slate-300">{user.full_name_en} ({user.email})</span>
          <form method="POST" action="/api/v1/auth/quick-role">
            <input type="hidden" name="action" value="set_lang" />
            <input type="hidden" name="lang" value={lang === 'ar' ? 'en' : 'ar'} />
            <input type="hidden" name="returnTo" value="/portal" />
            <button type="submit" className="rounded border border-white/20 px-2.5 py-1 hover:bg-white/10 cursor-pointer">
              {lang === 'ar' ? 'English' : 'العربية'}
            </button>
          </form>
          <form method="POST" action="/api/v1/auth/logout">
            <button type="submit" className="rounded bg-white/10 px-3 py-1 hover:bg-white/20 cursor-pointer">
              {tr(lang, 'Sign Out', 'خروج')}
            </button>
          </form>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 lg:p-8 space-y-6">
        <OsBanner notice={sp.notice} error={sp.error} />

        {!activeDeal ? (
          <div className="bw-card p-8 text-center text-sm text-slate-600">
            No active mortgage file linked to your household yet. Your Betterway Mortgage Advisor will initialize your file shortly.
          </div>
        ) : (
          <>
            {/* Live Deal Milestone Banner */}
            <div className="bw-card p-6 flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-[#8A6518]">
                  Active UAE Mortgage File · <span className="font-num">{activeDeal.deal_ref}</span>
                </div>
                <h1 className="font-display text-2xl font-bold text-[#021125] mt-1">
                  {activeDeal.community_name} — {formatAed(activeDeal.target_loan_fils)} Facility
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  Purchase Price: <span className="font-num">{formatAed(activeDeal.purchase_price_fils)}</span> · Tenure:{' '}
                  <span className="font-num">{activeDeal.tenure_months} months</span>
                </p>
              </div>
              <div className="text-end">
                <div className="text-xs text-slate-500">Current Progression Stage</div>
                <div className="mt-1 inline-block rounded-full bg-[#021125] text-[#D7B04E] px-4 py-1.5 text-xs font-bold">
                  {DEAL_STAGE_LABELS[activeDeal.stage]?.[lang] ?? activeDeal.stage}
                </div>
              </div>
            </div>

            {/* Joint CBUAE Key Facts Statement (KFS) Digital Signature Gate */}
            <div className="bw-card p-6 space-y-4">
              <div>
                <h2 className="font-display font-bold text-base text-[#021125]">
                  1. Mandatory CBUAE Key Facts Statement (KFS) — Joint Applicant Signatures
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  Per CBUAE Consumer Protection Regulations, every obligated applicant in your household must review and sign the KFS (confirming early settlement cap of 1% or AED 10,000 + VAT and EIBOR revert mechanics) before bank submission.
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-3 text-xs">
                {householdApplicants.map((app) => (
                  <div key={app.id} className="rounded-lg border border-slate-200 p-4 flex items-center justify-between gap-3">
                    <div>
                      <div className="font-bold text-[#021125]">
                        {app.full_name_en} <span className="bw-badge bg-slate-100 text-slate-700">{app.applicant_role}</span>
                      </div>
                      <div className="mt-1">
                        {app.signed_at ? (
                          <span className="text-emerald-700 font-semibold">✓ Digitally Signed ({app.signed_at})</span>
                        ) : (
                          <span className="text-amber-800 font-semibold">Pending Signature</span>
                        )}
                      </div>
                    </div>
                    {!app.signed_at && (app.user_id === null || app.user_id === user.id) && (
                      <form method="POST" action="/api/v1/actions">
                        <input type="hidden" name="action" value="sign_kfs" />
                        <input type="hidden" name="dealId" value={activeDeal.id} />
                        <input type="hidden" name="applicantId" value={app.id} />
                        <input type="hidden" name="signedByName" value={app.full_name_en} />
                        <input type="hidden" name="returnTo" value="/portal" />
                        <button type="submit" className="bw-btn-gold">Sign CBUAE KFS</button>
                      </form>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* AES-256-GCM Encrypted Smart Vault */}
            <div className="grid lg:grid-cols-12 gap-6">
              <div className="lg:col-span-5 bw-card p-6 space-y-3 text-xs">
                <h2 className="font-display font-bold text-base text-[#021125]">
                  2. Upload to Encrypted Smart Vault (`AES-256-GCM`)
                </h2>
                <p className="text-slate-600">
                  Automatic pre-flight checks warn if Passports/EIDs expire within 180 days or if Salary Certificates are older than 30 days.
                </p>
                <form method="POST" action="/api/v1/vault/upload" encType="multipart/form-data" className="space-y-2.5">
                  <input type="hidden" name="dealId" value={activeDeal.id} />
                  <input type="hidden" name="applicantId" value={householdApplicants[0]?.id || ''} />
                  <input type="hidden" name="returnTo" value="/portal" />
                  <div>
                    <label className="block font-semibold mb-1">Document Category</label>
                    <select name="docCategory" className="bw-input">
                      <option value="PASSPORT">Passport</option>
                      <option value="EMIRATES_ID">Emirates ID</option>
                      <option value="VISA">UAE Residence Visa</option>
                      <option value="SALARY_CERT">Employer Salary Certificate (30d Rule)</option>
                      <option value="BANK_STATEMENTS_6M">6-Month Bank Statements</option>
                      <option value="PAYSLIPS_6M">6-Month Payslips</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-semibold mb-1">Issue Date</label>
                      <input type="date" name="documentIssueDate" defaultValue="2026-11-10" className="bw-input font-num" />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">Expiry Date</label>
                      <input type="date" name="documentExpiryDate" defaultValue="2029-11-10" className="bw-input font-num" />
                    </div>
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Select File (Optional in Demo — Auto-generates PDF if blank)</label>
                    <input type="file" name="file" className="bw-input" />
                  </div>
                  <button type="submit" className="bw-btn-navy w-full">Encrypt & Upload Document</button>
                </form>
              </div>

              <div className="lg:col-span-7 bw-card p-6 space-y-3 text-xs">
                <h2 className="font-display font-bold text-base text-[#021125]">
                  Stored Household Vault Documents ({vaultDocs.length})
                </h2>
                {vaultDocs.length === 0 ? (
                  <div className="text-slate-400">No documents uploaded yet — upload your Emirates ID or Salary Certificate on the left.</div>
                ) : (
                  <div className="space-y-2">
                    {vaultDocs.map((d) => (
                      <div key={String(d.id)} className="rounded-lg border border-slate-200 p-3 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="font-bold text-[#021125]">
                            {String(d.doc_category)} · <span className="font-num">{String(d.file_name)}</span>
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {String(d.ocr_notes)} · SHA-256 <span className="font-num">{String(d.sha256_hash).slice(0, 12)}...</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`bw-badge ${
                              d.ocr_validation_status === 'PASSED'
                                ? 'bg-emerald-100 text-emerald-900'
                                : 'bg-amber-100 text-amber-900'
                            }`}
                          >
                            {String(d.ocr_validation_status)}
                          </span>
                          <a href={`/api/v1/vault/${String(d.id)}`} className="bw-btn-navy">
                            ⬇ Decrypt
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Permanent Homeowner Post-Settlement Refinance Radar */}
            <div className="bw-card p-6 space-y-3 text-xs">
              <h2 className="font-display font-bold text-base text-[#021125]">
                3. Permanent Homeowner Vault & 90-Day Pre-Revert Refinance Radar
              </h2>
              {radar.length === 0 ? (
                <div className="text-slate-500">
                  Once your mortgage disburses and Title Deed transfers, Betterway automatically monitors your fixed-rate expiry against daily CBUAE EIBOR and alerts you 90 days before revert.
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-3">
                  {radar.map((r) => (
                    <div key={String(r.id)} className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
                      <div className="font-bold text-[#021125]">{String(r.bank_name)}</div>
                      <div className="mt-1 font-num">
                        Balance: <strong>{formatAed(Number(r.disbursed_loan_fils))}</strong> · Intro Rate:{' '}
                        <strong>{formatBps(Number(r.current_rate_bps))}</strong> · Fixed Until:{' '}
                        <strong>{String(r.fixed_expiry_date)}</strong>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
