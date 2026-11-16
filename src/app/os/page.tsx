import { getDb } from '@/server/db';
import { getActiveLang, requireStaffUser } from '@/server/auth/request';
import { tr } from '@/lib/format';
import { APPS } from '@/lib/apps';
import { OsBanner } from '@/components/os-banner';
import { getDealWorkflow } from '@/server/engines/workflow-engine';

export default async function AppsHome({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string }> }) {
  const user = await requireStaffUser();
  const lang = await getActiveLang(user);
  const sp = await searchParams;
  const db = getDb();
  const c = (sql: string, ...a: (string | number)[]) => (db.prepare(sql).get(...a) as { c: number }).c;

  const badge: Record<string, number> = {
    sales: c("SELECT COUNT(*) c FROM leads WHERE stage IN ('NEW','CONTACTED')"),
    mortgage: c("SELECT COUNT(*) c FROM deals WHERE origin_mode='LIVE' AND stage NOT IN ('TRANSFERRED_DISBURSED','DECLINED','WITHDRAWN')"),
    conveyancing: c("SELECT COUNT(*) c FROM deals WHERE stage IN ('IPA_APPROVED','MOU_SIGNED','VALUATION_ORDERED','VALUATION_RECEIVED','FOL_ISSUED','FOL_SIGNED','NOC_AND_CLEARANCE','CHEQUES_READY')"),
    accounting: c("SELECT COUNT(*) c FROM commission_settlements WHERE reconciliation_status IN ('AWAITING_BANK_CASH','PARTIAL_RECEIVED')"),
    hr: c("SELECT COUNT(*) c FROM employees"),
    compliance: c("SELECT COUNT(*) c FROM deals WHERE cdd_status IN ('PENDING','EDD_REQUIRED','BLOCKED') AND origin_mode='LIVE'"),
    activities: c("SELECT COUNT(*) c FROM ops_tasks WHERE status='OPEN' AND assigned_role = ?", user.role),
    knowledge: c('SELECT COUNT(*) c FROM wiki_articles'),
    reporting: 0,
  };

  const deals = db.prepare("SELECT id, deal_ref FROM deals WHERE origin_mode='LIVE' AND stage NOT IN ('TRANSFERRED_DISBURSED','DECLINED','WITHDRAWN')").all() as { id: number; deal_ref: string }[];
  const attention = deals
    .map((d) => ({ ...d, w: getDealWorkflow(db, d.id) }))
    .filter((d) => d.w.alerts.some((a) => a.level === 'CRITICAL'))
    .slice(0, 6);

  const apps = APPS.filter((a) => !a.roles || a.roles.includes(user.role));
  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <OsBanner notice={sp.notice} error={sp.error} />
      <div>
        <h1 className="font-display text-2xl font-bold text-[#021125]">{tr(lang, 'Betterway OS', 'بيترواي')}</h1>
        <p className="text-sm text-slate-500">{tr(lang, 'Pick an app. Everything else is one click inside it.', 'اختر تطبيقاً.')}</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {apps.map((a) => (
          <a key={a.key} href={a.home} className="bw-card p-4 flex flex-col items-center text-center gap-2 hover:shadow-md hover:-translate-y-0.5 transition relative">
            <div className="h-14 w-14 rounded-2xl grid place-items-center text-white text-2xl font-bold" style={{ background: a.color }}>{a.glyph}</div>
            <div className="font-semibold text-sm text-[#021125]">{lang === 'ar' ? a.ar : a.en}</div>
            <div className="text-[11px] text-slate-500 leading-tight">{a.blurb}</div>
            {badge[a.key] > 0 && <span className="absolute top-2 end-2 min-w-5 h-5 px-1 rounded-full bg-[#D7B04E] text-[#021125] text-[10px] font-bold grid place-items-center">{badge[a.key]}</span>}
          </a>
        ))}
        <a href="/partners" className="bw-card p-4 text-center text-xs text-slate-600 hover:shadow-md">Partner Hub ↗</a>
        <a href="/portal" className="bw-card p-4 text-center text-xs text-slate-600 hover:shadow-md">Client Portal ↗</a>
      </div>

      <section>
        <h2 className="font-display font-bold text-sm text-[#021125] mb-2">{tr(lang, 'Needs attention now', 'يحتاج اهتماماً الآن')}</h2>
        {attention.length === 0 ? <div className="bw-card p-4 text-xs text-emerald-700">No critical alerts.</div> : (
          <div className="grid md:grid-cols-2 gap-2">
            {attention.map((d) => (
              <a key={d.id} href={`/os/deals/${d.id}`} className="bw-card p-3 text-xs border-s-4 border-red-500 hover:bg-red-50">
                <span className="font-semibold">{d.deal_ref}</span> · {d.w.alerts.find((a) => a.level === 'CRITICAL')?.text}
              </a>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
