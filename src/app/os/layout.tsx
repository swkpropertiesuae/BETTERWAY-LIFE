import { getActiveLang, requireStaffUser } from '@/server/auth/request';
import { ROLE_LABELS, tr } from '@/lib/format';
import { getDb } from '@/server/db';

const NAV_ITEMS = [
  { href: '/os/command', code: 'M11', en: 'Command & SLA Wall', ar: 'غرفة العمليات والالتزام' },
  { href: '/os/workflow', code: 'WF', en: 'Deal Desk & Playbooks', ar: 'مكتب الصفقات وأدلة الحالات' },
  { href: '/os/crm', code: 'M01', en: 'Omnichannel CRM', ar: 'إدارة العملاء المحتملين' },
  { href: '/os/los', code: 'M02', en: '24-Bank LOS & Underwriting', ar: 'الائتمان و24 بنكاً' },
  { href: '/os/banks-apl', code: 'M03', en: 'Rate Governance & APL', ar: 'حوكمة الفائدة والأبراج' },
  { href: '/os/conveyancing', code: 'M04', en: 'RERA Conveyancing & 72h Cheques', ar: 'نقل الملكية وشيكات 72 ساعة' },
  { href: '/os/cross-sell', code: 'M07', en: '360° Cross-Sell & DSCR', ar: 'الخدمات المساندة والتجاري' },
  { href: '/os/erp', code: 'M08', en: 'UAE ERP, Commissions & Tax', ar: 'المحاسبة والعمولات والضريبة' },
  { href: '/os/hrm', code: 'M09', en: 'UAE HRM, WPS .SIF & EOSB', ar: 'الموارد البشرية وحماية الأجور' },
  { href: '/os/compliance', code: 'M10', en: 'CBUAE KFS, Sanadak & MLRO', ar: 'الامتثال ومكافحة الغسل' },
  { href: '/os/wiki', code: 'M11B', en: 'Policy Wiki & Templates', ar: 'موسوعة السياسات والقوالب' },
  { href: '/os/bi-copilot', code: 'M12', en: 'Executive BI & Co-Pilot', ar: 'ذكاء الأعمال والمساعد الآلي' },
];

export default async function InternalOsLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaffUser();
  const lang = await getActiveLang(user);
  const db = getDb();
  const company = db.prepare('SELECT * FROM company_settings WHERE id = 1').get() as Record<string, string>;

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#F8F9FA]">
      <aside className="lg:w-72 shrink-0 bg-[#021125] text-white flex flex-col justify-between border-b lg:border-b-0 lg:border-e border-white/10">
        <div>
          <div className="p-5 border-b border-white/10 flex items-center gap-3">
            <img src="/brand/mark.svg" alt="Betterway" className="h-9 w-9 rounded-md" />
            <div className="min-w-0">
              <div className="font-display font-bold text-sm text-white truncate">Betterway OS</div>
              <div className="text-[11px] text-[#D7B04E] truncate">
                {tr(lang, 'Al Nasr Plaza · Dubai', 'النصر بلازا · دبي')}
              </div>
            </div>
          </div>

          <nav className="p-3 space-y-1">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-200 hover:bg-white/10 hover:text-white transition"
              >
                <span className="truncate">{lang === 'ar' ? item.ar : item.en}</span>
                <span className="font-num text-[10px] text-[#D7B04E]/90 bg-white/5 px-1.5 py-0.5 rounded">
                  {item.code}
                </span>
              </a>
            ))}
          </nav>
        </div>

        <div className="p-4 border-t border-white/10 space-y-3 text-xs">
          <div className="rounded-lg bg-white/5 p-3">
            <div className="font-semibold text-white">
              {lang === 'ar' && user.full_name_ar ? user.full_name_ar : user.full_name_en}
            </div>
            <div className="text-[#D7B04E] text-[11px] mt-0.5">
              {ROLE_LABELS[user.role]?.[lang] ?? user.role}
              {user.is_mlro === 1 ? ' · MLRO' : ''}
              {user.can_approve_rates === 1 ? ' · Checker' : ''}
            </div>
            <div className="font-num text-[10px] text-slate-400 mt-1 truncate">{user.email}</div>
          </div>

          <form method="POST" action="/api/v1/auth/quick-role" className="space-y-1.5">
            <input type="hidden" name="action" value="switch_role" />
            <label className="block text-[10px] uppercase tracking-wider text-slate-400">
              {tr(lang, 'Switch Workspace Role', 'تبديل الدور')}
            </label>
            <div className="flex gap-1.5">
              <select
                name="email"
                defaultValue={user.email}
                className="w-full rounded bg-white/10 border border-white/15 px-2 py-1.5 text-[11px] text-white"
              >
                <option value="md@betterwaymortgages.com" className="text-slate-900">MD (MLRO + Checker)</option>
                <option value="ops.director@betterwaymortgages.com" className="text-slate-900">Ops Director (Non-MLRO)</option>
                <option value="tariq.advisor@betterwaymortgages.com" className="text-slate-900">Sales Advisor (Tariq)</option>
                <option value="layla.credit@betterwaymortgages.com" className="text-slate-900">Head Credit (Checker)</option>
                <option value="omar.underwriter@betterwaymortgages.com" className="text-slate-900">Underwriter (Maker)</option>
                <option value="nadia.conveyancing@betterwaymortgages.com" className="text-slate-900">Progression (Nadia)</option>
                <option value="farid.mlro@betterwaymortgages.com" className="text-slate-900">MLRO Officer (Farid)</option>
                <option value="sana.finance@betterwaymortgages.com" className="text-slate-900">Finance Admin (Sana)</option>
                <option value="reem.hr@betterwaymortgages.com" className="text-slate-900">HR Manager (Reem)</option>
                <option value="owner@partner.ae" className="text-slate-900">Partner Owner (/partners)</option>
                <option value="agent.brn1@partner.ae" className="text-slate-900">Partner BRN #1 (/partners)</option>
                <option value="client.khalid@example.ae" className="text-slate-900">Borrower Khalid (/portal)</option>
              </select>
              <button type="submit" className="rounded bg-[#D7B04E] px-2.5 py-1.5 text-[11px] font-bold text-[#021125] cursor-pointer">
                Go
              </button>
            </div>
          </form>

          <div className="flex items-center justify-between gap-2 pt-1">
            <form method="POST" action="/api/v1/auth/quick-role">
              <input type="hidden" name="action" value="set_lang" />
              <input type="hidden" name="lang" value={lang === 'ar' ? 'en' : 'ar'} />
              <input type="hidden" name="returnTo" value="/os/command" />
              <button type="submit" className="rounded border border-white/20 px-2.5 py-1 text-[11px] hover:bg-white/10 cursor-pointer">
                {lang === 'ar' ? 'English' : 'العربية'}
              </button>
            </form>
            <form method="POST" action="/api/v1/auth/logout">
              <button type="submit" className="rounded border border-rose-400/40 px-2.5 py-1 text-[11px] text-rose-200 hover:bg-rose-500/20 cursor-pointer">
                {tr(lang, 'Sign Out', 'خروج')}
              </button>
            </form>
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="bg-white border-b border-slate-200 px-6 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3 text-slate-600">
            <span className="font-semibold text-[#021125]">{company.legal_name}</span>
            <span>·</span>
            <span>RERA <strong className="font-num text-slate-900">{company.rera_orn}</strong></span>
            <span>·</span>
            <span>CBUAE <strong className="font-num text-slate-900">{company.cbuae_broker_reg}</strong></span>
            <span>·</span>
            <span>FTA TRN <strong className="font-num text-slate-900">{company.vat_trn_15}</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <span className="bw-badge bg-emerald-100 text-emerald-900">SQLite WAL · ACID</span>
            <span className="bw-badge bg-amber-100 text-[#8A6518]">24 UAE Banks Live</span>
          </div>
        </header>

        <main className="p-6 lg:p-8 flex-1">{children}</main>
      </div>
    </div>
  );
}
