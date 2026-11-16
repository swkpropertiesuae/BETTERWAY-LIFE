import { redirect } from 'next/navigation';
import { defaultHomeForRole, getActiveLang, getCurrentUser } from '@/server/auth/request';
import { tr } from '@/lib/format';
import { OsBanner } from '@/components/os-banner';

const DEMO_ACCOUNTS = [
  { email: 'md@betterwaymortgages.com', label: 'Managing Director (SUPER_ADMIN + MLRO + Checker)', badge: 'All 12 Modules' },
  { email: 'ops.director@betterwaymortgages.com', label: 'Ops Director (SUPER_ADMIN · Non-MLRO)', badge: 'Tests goAML 403 Wall' },
  { email: 'tariq.advisor@betterwaymortgages.com', label: 'Tariq Al Mansoori (SALES_ADVISOR)', badge: 'CRM + LOS' },
  { email: 'layla.credit@betterwaymortgages.com', label: 'Layla Khoury (CREDIT_UNDERWRITER · Checker)', badge: 'Rate Checker + APL' },
  { email: 'omar.underwriter@betterwaymortgages.com', label: 'Omar Siddiqui (CREDIT_UNDERWRITER · Maker)', badge: 'Rate Maker' },
  { email: 'nadia.conveyancing@betterwaymortgages.com', label: 'Nadia Al Zaabi (PROGRESSION_MANAGER)', badge: 'Form F + 72h Cheques' },
  { email: 'farid.mlro@betterwaymortgages.com', label: 'Farid Qureshi (COMPLIANCE_MLRO)', badge: 'KFS + goAML Vault' },
  { email: 'sana.finance@betterwaymortgages.com', label: 'Sana Nair (FINANCE_ADMIN)', badge: 'ERP + VAT + PINT-AE' },
  { email: 'reem.hr@betterwaymortgages.com', label: 'Reem Al Hashimi (HR_MANAGER · Arabic)', badge: 'WPS .SIF + EOSB' },
  { email: 'owner@partner.ae', label: 'Harbour Crest Owner (PARTNER_AGENCY_ADMIN)', badge: 'Agency ORN + Invoices' },
  { email: 'agent.brn1@partner.ae', label: 'Karim Darwish (PARTNER_AGENT · BRN-48219)', badge: 'Isolated BRN #1' },
  { email: 'client.khalid@example.ae', label: 'Khalid Al Nuaimi (CLIENT · Joint Borrower)', badge: 'Smart Vault + KFS' },
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; error?: string; notice?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) {
    redirect(defaultHomeForRole(user.role));
  }
  const sp = await searchParams;
  const tab = sp.tab === 'partner' || sp.tab === 'borrower' ? sp.tab : 'staff';
  const lang = await getActiveLang(null);

  return (
    <div className="min-h-screen grid lg:grid-cols-12 bg-[#021125] text-white">
      <div className="lg:col-span-7 p-8 lg:p-12 flex flex-col justify-between border-b lg:border-b-0 lg:border-e border-white/10">
        <div>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src="/brand/mark.svg" alt="Betterway Mortgages" className="h-10 w-10 rounded-lg" />
              <div>
                <div className="font-display text-lg font-bold tracking-tight text-white">Betterway Mortgages</div>
                <div className="text-xs text-[#D7B04E] font-medium">
                  {tr(lang, 'UAE Sovereign Mortgage Operating System', 'نظام تشغيل الوساطة العقارية والتمويل — الإمارات')}
                </div>
              </div>
            </div>
            <form method="POST" action="/api/v1/auth/quick-role">
              <input type="hidden" name="action" value="set_lang" />
              <input type="hidden" name="lang" value={lang === 'ar' ? 'en' : 'ar'} />
              <input type="hidden" name="returnTo" value={`/login?tab=${tab}`} />
              <button type="submit" className="rounded-md border border-white/20 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10">
                {lang === 'ar' ? 'English (LTR)' : 'العربية (RTL)'}
              </button>
            </form>
          </div>

          <h1 className="mt-8 font-display text-3xl lg:text-4xl font-bold leading-tight text-white">
            {tr(
              lang,
              'Unified CRM, 24-Bank CBUAE LOS, RERA Conveyancing, FTA ERP & MOHRE WPS.',
              'منصة موحدة لإدارة العملاء، الائتمان لدى 24 بنكاً، نقل الملكية، المحاسبة الضريبية وحماية الأجور.',
            )}
          </h1>
          <p className="mt-3 text-sm text-slate-300 max-w-2xl">
            Al Nasr Plaza, Oud Metha, Dubai, UAE · CBUAE Reg <span className="font-num text-[#D7B04E]">CBUAE-MB-2025-041</span> · RERA{' '}
            <span className="font-num text-[#D7B04E]">ORN-31910</span> · FTA TRN <span className="font-num text-[#D7B04E]">100482910400003</span>
          </p>

          <div className="mt-8">
            <div className="text-xs font-semibold uppercase tracking-wider text-[#D7B04E] mb-3">
              {tr(lang, '1-Click Role Switcher (Local Verification Matrix — Password: Betterway#2026)', 'تبديل فوري للأدوار (للفحص المباشر)')}
            </div>
            <div className="grid sm:grid-cols-2 gap-2.5">
              {DEMO_ACCOUNTS.map((acc) => (
                <form key={acc.email} method="POST" action="/api/v1/auth/quick-role">
                  <input type="hidden" name="action" value="switch_role" />
                  <input type="hidden" name="email" value={acc.email} />
                  <button
                    type="submit"
                    className="w-full text-start rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 hover:border-[#D7B04E]/60 px-3.5 py-2.5 transition cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-white truncate">{acc.label}</span>
                      <span className="shrink-0 rounded bg-[#D7B04E]/20 px-2 py-0.5 text-[10px] font-semibold text-[#D7B04E]">
                        {acc.badge}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[11px] font-num text-slate-400">{acc.email}</div>
                  </button>
                </form>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 pt-4 border-t border-white/10 text-xs text-slate-400 flex flex-wrap justify-between gap-2">
          <span>AES-256-GCM Smart Vault · Append-Only Audit Ledger</span>
          <span>Peppol PINT-AE UBL 2.1 · MOHRE WPS .SIF · UAE FIU goAML XML</span>
        </div>
      </div>

      <div className="lg:col-span-5 bg-[#F8F9FA] text-slate-900 p-8 lg:p-12 flex flex-col justify-center">
        <div className="max-w-md w-full mx-auto">
          <OsBanner notice={sp.notice} error={sp.error} />

          <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-200/80 p-1 mb-6 text-xs font-semibold">
            <a
              href="/login?tab=staff"
              className={`text-center py-2 rounded-md ${tab === 'staff' ? 'bg-[#021125] text-white shadow-xs' : 'text-slate-700'}`}
            >
              {tr(lang, 'Sign In', 'تسجيل الدخول')}
            </a>
            <a
              href="/login?tab=partner"
              className={`text-center py-2 rounded-md ${tab === 'partner' ? 'bg-[#021125] text-white shadow-xs' : 'text-slate-700'}`}
            >
              {tr(lang, 'RERA Partner', 'شريك عقاري')}
            </a>
            <a
              href="/login?tab=borrower"
              className={`text-center py-2 rounded-md ${tab === 'borrower' ? 'bg-[#021125] text-white shadow-xs' : 'text-slate-700'}`}
            >
              {tr(lang, 'Borrower Vault', 'بوابة المقترض')}
            </a>
          </div>

          {tab === 'staff' && (
            <form method="POST" action="/api/v1/auth/login" className="bw-card p-6 space-y-4">
              <input type="hidden" name="mode" value="login" />
              <h2 className="font-display text-xl font-bold text-[#021125]">
                {tr(lang, 'Betterway OS Sign In', 'الدخول إلى نظام بيترواي')}
              </h2>
              <p className="text-xs text-slate-600">
                {tr(
                  lang,
                  'Authenticate into Internal OS, RERA Partner Hub, or Borrower Smart Vault.',
                  'سجّل الدخول إلى النظام الداخلي أو بوابة الوسطاء أو خزنة المقترض.',
                )}
              </p>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                <input name="email" type="email" required defaultValue="md@betterwaymortgages.com" className="bw-input" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
                <input name="password" type="password" required defaultValue="Betterway#2026" className="bw-input" />
              </div>
              <button type="submit" className="bw-btn-gold w-full">
                {tr(lang, 'Authenticate & Enter Workspace', 'دخول آمن إلى مساحة العمل')}
              </button>
            </form>
          )}

          {tab === 'partner' && (
            <form method="POST" action="/api/v1/auth/login" className="bw-card p-6 space-y-3">
              <input type="hidden" name="mode" value="register_partner" />
              <h2 className="font-display text-lg font-bold text-[#021125]">
                {tr(lang, '30-Second RERA Broker Onboarding', 'تسجيل وسيط عقاري مرخص (ريرا)')}
              </h2>
              <p className="text-xs text-slate-600">
                Drop buyer leads immediately upon signup. Commission payouts release once Betterway verifies your corporate ORN & signed Referral Agreement.
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold mb-1">Brokerage Name</label>
                  <input name="companyName" required placeholder="Marina Prime Realty LLC" className="bw-input" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">RERA ORN</label>
                  <input name="reraOrn" required placeholder="ORN-29410" className="bw-input" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold mb-1">DED Licence No.</label>
                  <input name="tradeLicenceNo" required placeholder="DED-992811" className="bw-input" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Agent RERA BRN</label>
                  <input name="reraBrn" required placeholder="BRN-55821" className="bw-input" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold mb-1">Full Name</label>
                  <input name="fullNameEn" required placeholder="Yousef Al Marri" className="bw-input" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">UAE Mobile</label>
                  <input name="phone" required placeholder="+971501234567" className="bw-input" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold mb-1">Work Email</label>
                  <input name="email" type="email" required placeholder="agent@agency.ae" className="bw-input" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Password</label>
                  <input name="password" type="password" required defaultValue="Betterway#2026" className="bw-input" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-700 pt-1">
                <input type="checkbox" name="isAgencyAdmin" value="1" />
                I am the authorized Brokerage Owner / Managing Partner (ORN Signatory)
              </label>
              <button type="submit" className="bw-btn-gold w-full">
                Create Partner Account & Open Hub
              </button>
            </form>
          )}

          {tab === 'borrower' && (
            <form method="POST" action="/api/v1/auth/login" className="bw-card p-6 space-y-3">
              <input type="hidden" name="mode" value="register_borrower" />
              <h2 className="font-display text-lg font-bold text-[#021125]">
                {tr(lang, 'Borrower Smart Vault Registration', 'فتح خزنة المقترض الذكية')}
              </h2>
              <p className="text-xs text-slate-600">
                Create your encrypted UAE mortgage workspace, review your CBUAE Key Facts Statement, and track live IPA/FOL milestones.
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold mb-1">Full Name (EN)</label>
                  <input name="fullNameEn" required placeholder="Amira Al Shamsi" className="bw-input" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Mobile</label>
                  <input name="phone" required placeholder="+971509876543" className="bw-input" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold mb-1">Email</label>
                  <input name="email" type="email" required placeholder="amira@example.ae" className="bw-input" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Password</label>
                  <input name="password" type="password" required defaultValue="Betterway#2026" className="bw-input" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-semibold mb-1">Residency</label>
                  <select name="residencyType" className="bw-input">
                    <option value="EXPAT_RESIDENT">UAE Resident</option>
                    <option value="UAE_NATIONAL">UAE National</option>
                    <option value="NON_RESIDENT">Non-Resident</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Property (AED)</label>
                  <input name="purchasePriceAed" type="number" defaultValue={3000000} className="bw-input font-num" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Loan (AED)</label>
                  <input name="targetLoanAed" type="number" defaultValue={2400000} className="bw-input font-num" />
                </div>
              </div>
              <button type="submit" className="bw-btn-gold w-full">
                Open Encrypted Borrower Smart Vault
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
