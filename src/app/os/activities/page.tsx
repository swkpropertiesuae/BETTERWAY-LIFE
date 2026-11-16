import { getDb } from '@/server/db';
import { getActiveLang, requireStaffUser } from '@/server/auth/request';
import { tr } from '@/lib/format';
import { OsBanner } from '@/components/os-banner';

export default async function Activities({ searchParams }: { searchParams: Promise<{ all?: string; notice?: string; error?: string }> }) {
  const user = await requireStaffUser();
  const lang = await getActiveLang(user);
  const sp = await searchParams;
  const db = getDb();
  const all = sp.all === '1' && user.role === 'SUPER_ADMIN';
  const tasks = db
    .prepare(
      `SELECT t.*, d.deal_ref FROM ops_tasks t LEFT JOIN deals d ON d.id = t.deal_id
       WHERE t.status = 'OPEN' ${all ? '' : 'AND t.assigned_role = ?'} ORDER BY t.due_at ASC`,
    )
    .all(...(all ? [] : [user.role])) as { id: number; deal_id: number | null; deal_ref: string | null; title: string; priority: string; due_at: string; assigned_role: string }[];
  const now = new Date().toISOString();
  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <OsBanner notice={sp.notice} error={sp.error} />
      <div className="flex justify-between items-center">
        <h1 className="font-display text-xl font-bold text-[#021125]">{tr(lang, 'My Activities', 'مهامي')} <span className="text-slate-400 text-sm font-normal">{tasks.length}</span></h1>
        {user.role === 'SUPER_ADMIN' && <a className="text-xs underline" href={all ? '/os/activities' : '/os/activities?all=1'}>{all ? 'Mine' : 'Everyone'}</a>}
      </div>
      <div className="bw-card divide-y divide-slate-100">
        {tasks.length === 0 && <div className="p-6 text-sm text-emerald-700">Nothing open. 🎉</div>}
        {tasks.map((t) => (
          <div key={t.id} className="p-3 flex items-center gap-3 text-xs">
            <span className={`h-2.5 w-2.5 rounded-full ${t.due_at < now ? 'bg-red-500' : t.priority === 'CRITICAL' ? 'bg-amber-500' : 'bg-slate-300'}`} />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-[#021125] truncate">{t.title.replace('[WF] ', '')}</div>
              <div className="text-slate-500">{t.deal_id ? <a className="underline" href={`/os/deals/${t.deal_id}`}>{t.deal_ref}</a> : 'General'} · due {t.due_at.slice(0, 16).replace('T', ' ')}{all ? ` · ${t.assigned_role}` : ''}</div>
            </div>
            <form method="POST" action="/api/v1/actions">
              <input type="hidden" name="action" value="complete_ops_task" /><input type="hidden" name="taskId" value={t.id} /><input type="hidden" name="returnTo" value="/os/activities" />
              <button className="bw-btn-navy">Done</button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}
