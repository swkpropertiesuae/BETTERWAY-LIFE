import { getActiveLang, requireStaffUser } from '@/server/auth/request';
import { ROLE_LABELS, tr } from '@/lib/format';
import { getDb } from '@/server/db';
import { TopNav } from '@/components/top-nav';

export default async function InternalOsLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaffUser();
  const lang = await getActiveLang(user);
  const db = getDb();
  const open = (db.prepare("SELECT COUNT(*) c FROM ops_tasks WHERE status = 'OPEN' AND assigned_role = ?").get(user.role) as { c: number }).c;

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F9FA]">
      <header className="bg-[#021125] text-white flex items-center gap-3 px-3 h-12 sticky top-0 z-30">
        <img src="/brand/mark.svg" alt="Betterway" className="h-7 w-7 rounded shrink-0" />
        <TopNav lang={lang} />
        <div className="ms-auto flex items-center gap-2 shrink-0">
          <form action="/os/search" method="GET" className="hidden md:block">
            <input name="q" placeholder={tr(lang, 'Search deals, clients, banks…', 'ابحث…')} className="rounded bg-white/10 border border-white/15 px-3 py-1 text-xs text-white placeholder:text-slate-400 w-56" />
          </form>
          <a href="/os/activities" className="relative text-xs px-2 py-1 rounded hover:bg-white/10" title="My activities">
            ✓ <span className="font-num">{open}</span>
          </a>
          <details className="relative">
            <summary className="list-none cursor-pointer text-xs rounded px-2 py-1 hover:bg-white/10">
              {lang === 'ar' && user.full_name_ar ? user.full_name_ar : user.full_name_en} ▾
            </summary>
            <div className="absolute end-0 mt-2 w-64 rounded-lg bg-[#09203f] border border-white/15 p-3 space-y-3 text-xs shadow-xl">
              <div className="text-[#D7B04E]">{ROLE_LABELS[user.role]?.[lang] ?? user.role}{user.is_mlro === 1 ? ' · MLRO' : ''}{user.can_approve_rates === 1 ? ' · Checker' : ''}</div>
              <form method="POST" action="/api/v1/auth/quick-role" className="flex gap-1.5">
                <input type="hidden" name="action" value="switch_role" />
                <select name="email" defaultValue={user.email} className="w-full rounded bg-white/10 border border-white/15 px-2 py-1.5 text-[11px] text-white">
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
                <button type="submit" className="rounded bg-[#D7B04E] px-2.5 text-[11px] font-bold text-[#021125]">Go</button>
              </form>
              <div className="flex justify-between">
                <form method="POST" action="/api/v1/auth/quick-role">
                  <input type="hidden" name="action" value="set_lang" />
                  <input type="hidden" name="lang" value={lang === 'ar' ? 'en' : 'ar'} />
                  <input type="hidden" name="returnTo" value="/os" />
                  <button type="submit" className="rounded border border-white/20 px-2.5 py-1">{lang === 'ar' ? 'English' : 'العربية'}</button>
                </form>
                <form method="POST" action="/api/v1/auth/logout">
                  <button type="submit" className="rounded border border-rose-400/40 px-2.5 py-1 text-rose-200">{tr(lang, 'Sign Out', 'خروج')}</button>
                </form>
              </div>
            </div>
          </details>
        </div>
      </header>
      <main className="p-4 lg:p-6 flex-1">{children}</main>
    </div>
  );
}
