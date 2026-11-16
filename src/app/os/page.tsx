import { getDb } from '@/server/db';
import { getActiveLang, requireStaffUser } from '@/server/auth/request';
import { formatAedWhole, tr } from '@/lib/format';
import { APPS } from '@/lib/apps';
import { OsBanner } from '@/components/os-banner';
import { AppIcon, Avatar, Bars, Gauge, Ring, Tile } from '@/components/ui';
import { getDealWorkflow, STAGE_META, type Stage } from '@/server/engines/workflow-engine';
import { TrendingUp, Landmark, Wallet, AlertTriangle, ListChecks, KeyRound } from 'lucide-react';

type R = Record<string, any>;
const GROUPS: [string, string[]][] = [
  ['Intake', ['FACT_FIND', 'KFS_PENDING', 'DOC_COLLECTION']],
  ['Credit', ['UNDERWRITING_READY', 'IPA_SUBMITTED', 'IPA_APPROVED']],
  ['Property', ['MOU_SIGNED', 'VALUATION_ORDERED', 'VALUATION_RECEIVED']],
  ['Offer', ['FOL_ISSUED', 'FOL_SIGNED']],
  ['Closing', ['NOC_AND_CLEARANCE', 'CHEQUES_READY']],
];

export default async function AppsHome({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string }> }) {
  const user = await requireStaffUser();
  const lang = await getActiveLang(user);
  const sp = await searchParams;
  const db = getDb();
  const one = (sql: string, ...a: (string | number)[]) => db.prepare(sql).get(...a) as R;
  const c = (sql: string, ...a: (string | number)[]) => Number(one(sql, ...a).c ?? 0);

  const live = db.prepare("SELECT id, deal_ref, stage, target_loan_fils FROM deals WHERE origin_mode='LIVE' AND stage NOT IN ('TRANSFERRED_DISBURSED','DECLINED','WITHDRAWN')").all() as R[];
  const wfs: R[] = live.map((d) => ({ ...d, w: getDealWorkflow(db, d.id) }));
  const critical = wfs.filter((d) => d.w.alerts.some((a: R) => a.level === 'CRITICAL'));
  const pipelineValue = live.reduce((a, d) => a + Number(d.target_loan_fils), 0);
  const month = new Date().toISOString().slice(0, 7);
  const disbMonth = one("SELECT COALESCE(SUM(disbursed_loan_fils),0) c FROM deals WHERE disbursed_at LIKE ?", `${month}%`).c;
  const awaiting = c("SELECT COUNT(*) c FROM commission_settlements WHERE reconciliation_status IN ('AWAITING_BANK_CASH','PARTIAL_RECEIVED')");
  const now = new Date().toISOString();
  const open = db.prepare("SELECT t.*, d.deal_ref FROM ops_tasks t LEFT JOIN deals d ON d.id = t.deal_id WHERE t.status='OPEN' AND t.assigned_role = ? ORDER BY t.due_at LIMIT 5").all(user.role) as R[];
  const openAll = c("SELECT COUNT(*) c FROM ops_tasks WHERE status='OPEN'");
  const overdueAll = c("SELECT COUNT(*) c FROM ops_tasks WHERE status='OPEN' AND due_at < ?", now);
  const onTime = openAll ? Math.round(((openAll - overdueAll) / openAll) * 100) : 100;
  const team = db.prepare("SELECT u.full_name_en n, u.role r, (SELECT COUNT(*) FROM ops_tasks t WHERE t.status='OPEN' AND t.assigned_role=u.role) k FROM users u WHERE u.role NOT IN ('CLIENT','PARTNER_AGENCY_ADMIN','PARTNER_AGENT') AND u.status='ACTIVE' LIMIT 8").all() as R[];
  const bars = GROUPS.map(([label, st]) => ({ label, value: live.filter((d) => st.includes(d.stage)).length }));
  const apps = APPS.filter((a) => !a.roles || a.roles.includes(user.role));
  const badge: Record<string, number> = {
    sales: c("SELECT COUNT(*) c FROM leads WHERE stage IN ('NEW','CONTACTED')"), mortgage: live.length, conveyancing: live.filter((d) => ['IPA_APPROVED', 'MOU_SIGNED', 'VALUATION_ORDERED', 'VALUATION_RECEIVED', 'FOL_ISSUED', 'FOL_SIGNED', 'NOC_AND_CLEARANCE', 'CHEQUES_READY'].includes(d.stage)).length,
    accounting: awaiting, hr: c('SELECT COUNT(*) c FROM employees'), compliance: c("SELECT COUNT(*) c FROM deals WHERE cdd_status IN ('PENDING','EDD_REQUIRED','BLOCKED') AND origin_mode='LIVE'"),
    activities: open.length, data: 0, knowledge: c('SELECT COUNT(*) c FROM wiki_articles'), reporting: 0,
  };
  const first = (lang === 'ar' && user.full_name_ar ? user.full_name_ar : user.full_name_en).split(' ')[0];
  const hour = new Date().getUTCHours() + 4; // Dubai
  const hello = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const date = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Dubai' });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <OsBanner notice={sp.notice} error={sp.error} />
      <div className="flex flex-wrap items-end justify-between gap-4 bw-rise">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-[#021125]">{tr(lang, `${hello}, `, 'أهلاً، ')}<span className="text-[#6b7fd6]">{first}</span></h1>
          <p className="text-sm text-slate-500 mt-1">{date} · {live.length} live deals · {critical.length ? `${critical.length} need attention` : 'nothing urgent'}</p>
        </div>
        <div className="flex items-center rounded-full bg-white/70 border border-white px-3 py-2 shadow-sm">
          <div className="flex -space-x-2">{team.map((t) => <Avatar key={t.n} name={t.n} />)}</div>
          <span className="text-[11px] text-slate-500 ms-3">{team.length} on the team</span>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <Tile tone="peach" title="Live deals" value={live.length} sub="in the pipeline" href="/os/deals" icon={<Landmark size={14} />} />
        <Tile tone="blue" title="Pipeline value" value={formatAedWhole(pipelineValue).replace('AED ', '')} sub="AED, target loans" icon={<TrendingUp size={14} />} />
        <Tile tone="lilac" title="Disbursed this month" value={formatAedWhole(disbMonth).replace('AED ', '')} sub="AED" icon={<Wallet size={14} />} />
        <Tile tone="mint" title="Bank cash awaited" value={awaiting} sub="settlements open" href="/os/erp" icon={<KeyRound size={14} />} />
        <Tile tone="pink" title="My open tasks" value={open.length} sub={`${openAll} team-wide`} href="/os/activities" icon={<ListChecks size={14} />} />
        <Tile tone={critical.length ? 'coral' : 'sand'} title="Critical alerts" value={critical.length} sub={critical.length ? 'open the first' : 'all clear'} href={critical[0] ? `/os/deals/${critical[0].id}` : '/os/deals'} icon={<AlertTriangle size={14} />} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="bw-card p-5 bw-rise bw-d1">
          <div className="flex justify-between items-center mb-3"><h2 className="font-display font-bold text-sm">Pipeline by phase</h2><a className="text-xs underline text-slate-500" href="/os/deals">Open</a></div>
          <Bars data={bars} highlight={bars.reduce((b, d, i, a) => (d.value > a[b].value ? i : b), 0)} />
        </div>
        <div className="bw-card p-5 bw-rise bw-d2 flex flex-col items-center justify-center text-center">
          <h2 className="font-display font-bold text-sm self-start mb-2">Tasks on time</h2>
          <Gauge value={onTime} color={onTime >= 80 ? '#5fc9a0' : onTime >= 50 ? '#e6b85c' : '#ef8a7a'} />
          <div className="text-[11px] text-slate-500 mt-1">{overdueAll} overdue of {openAll} open</div>
        </div>
        <div className="bw-card p-5 bw-rise bw-d3">
          <div className="flex justify-between items-center mb-2"><h2 className="font-display font-bold text-sm">Today for you</h2><a className="text-xs underline text-slate-500" href="/os/activities">All</a></div>
          {open.length === 0 && <div className="text-xs text-emerald-700">Nothing open. 🎉</div>}
          <div className="space-y-2">
            {open.map((t) => (
              <a key={t.id} href={t.deal_id ? `/os/deals/${t.deal_id}` : '/os/activities'} className="flex items-center gap-3 rounded-2xl bg-white/70 hover:bg-white p-2.5">
                <Ring value={t.due_at < now ? 100 : 40} color={t.due_at < now ? '#ef8a7a' : '#7c8fe0'} size={34}>{t.due_at < now ? '!' : '•'}</Ring>
                <span className="min-w-0 text-xs"><span className="block font-semibold text-[#021125] truncate">{String(t.title).replace('[WF] ', '')}</span><span className="text-slate-500">{t.deal_ref ?? 'General'} · {t.due_at.slice(5, 16).replace('T', ' ')}</span></span>
              </a>
            ))}
          </div>
        </div>
      </div>

      <section className="bw-rise bw-d2">
        <h2 className="font-display font-bold text-sm mb-3">Apps</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {apps.map((a, i) => (
            <a key={a.key} href={a.home} className="bw-card bw-lift p-4 flex items-center gap-3 transition" >
              <span className="relative grid place-items-center h-12 w-12 rounded-2xl text-white shrink-0" style={{ background: `linear-gradient(145deg, ${a.color}, ${a.color}cc)` }}>
                <AppIcon k={a.key} />
                {badge[a.key] > 0 && <span className="absolute -top-1.5 -end-1.5 min-w-5 h-5 px-1 rounded-full bg-[#D7B04E] text-[#021125] text-[10px] font-bold grid place-items-center ring-2 ring-white">{badge[a.key]}</span>}
              </span>
              <span className="min-w-0"><span className="block font-semibold text-sm text-[#021125]">{lang === 'ar' ? a.ar : a.en}</span><span className="block text-[11px] text-slate-500 leading-tight">{a.blurb}</span></span>
            </a>
          ))}
        </div>
      </section>

      {critical.length > 0 && (
        <section className="bw-rise bw-d3">
          <h2 className="font-display font-bold text-sm mb-3">Needs attention now</h2>
          <div className="grid md:grid-cols-2 gap-3">
            {critical.slice(0, 6).map((d) => (
              <a key={d.id} href={`/os/deals/${d.id}`} className="bw-card bw-lift p-3 text-xs flex items-center gap-3 border-s-4 border-red-400">
                <Ring value={100} color="#ef8a7a" size={34}>!</Ring>
                <span><b>{d.deal_ref}</b> · {STAGE_META[d.stage as Stage]?.label}<span className="block text-slate-600">{d.w.alerts.find((a: R) => a.level === 'CRITICAL')?.text}</span></span>
              </a>
            ))}
          </div>
        </section>
      )}
      <div className="text-[10px] text-slate-400 text-center">Roles: {user.role}</div>
    </div>
  );
}
