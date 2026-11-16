import { getDb } from '@/server/db';
import { getActiveLang, requireStaffUser } from '@/server/auth/request';
import { OsBanner } from '@/components/os-banner';
import { PageHeader } from '@/components/page-header';

type R = Record<string, any>;
export default async function GoLive({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string }> }) {
  const user = await requireStaffUser();
  await getActiveLang(user);
  const sp = await searchParams;
  const db = getDb();
  const items = db.prepare("SELECT * FROM go_live_items ORDER BY status = 'DONE', area, id").all() as R[];
  const hols = db.prepare('SELECT * FROM public_holidays ORDER BY day').all() as R[];
  const drOk = !!db.prepare("SELECT 1 FROM data_rows WHERE spec_no = 35 AND status = 'ACCEPTED' AND data_json LIKE '%\"status\":\"PASS\"%' AND data_json LIKE '%BACKUP_RESTORE%'").get();
  const mfaGap = (db.prepare("SELECT COUNT(*) c FROM users WHERE role IN ('SUPER_ADMIN','FINANCE_ADMIN','COMPLIANCE_MLRO','HR_MANAGER') AND status = 'ACTIVE' AND mfa_enabled = 0").get() as { c: number }).c;
  const done = items.filter((i) => i.status !== 'OPEN').length;
  const admin = user.role === 'SUPER_ADMIN';
  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <OsBanner notice={sp.notice} error={sp.error} />
      <PageHeader app="Data Hub" appHref="/os/data" title="Go-live checklist" sub="Decisions and data only Betterway can supply. Each item closes with evidence." />
      <div className="grid sm:grid-cols-3 gap-3 text-xs">
        <div className="bw-card p-4"><b>{done}/{items.length}</b> items closed</div>
        <div className="bw-card p-4">Backup and restore drill: <b className={drOk ? 'text-emerald-700' : 'text-amber-700'}>{drOk ? 'passed' : 'not run yet'}</b> <a className="underline" href="/os/data?spec=35">Run</a></div>
        <div className="bw-card p-4">Privileged users without MFA: <b className={mfaGap ? 'text-amber-700' : 'text-emerald-700'}>{mfaGap}</b> <a className="underline" href="/os/security">Manage</a></div>
      </div>
      <div className="bw-card divide-y divide-slate-100 text-xs">
        {items.map((i) => (
          <div key={i.id} className="p-3 flex flex-wrap items-center gap-3">
            <span className={`bw-badge ${i.status === 'DONE' ? 'bg-emerald-100 text-emerald-900' : i.status === 'NOT_APPLICABLE' ? 'bg-slate-200 text-slate-700' : 'bg-amber-100 text-amber-900'}`}>{i.status}</span>
            <span className="flex-1 min-w-[260px]"><span className="text-slate-400">{i.area} · {i.owner}</span><br />{i.item}{i.evidence && <span className="block text-emerald-700">Evidence: {i.evidence}</span>}</span>
            {admin && i.status === 'OPEN' && (
              <form method="POST" action="/api/v1/actions" className="flex gap-1"><input type="hidden" name="action" value="golive_update" /><input type="hidden" name="itemId" value={i.id} /><input type="hidden" name="returnTo" value="/os/golive" />
                <input name="evidence" required placeholder="Evidence / decision ref" className="bw-input !w-48" /><select name="status" className="bw-input !w-32"><option value="DONE">Done</option><option value="NOT_APPLICABLE">Not applicable</option></select><button className="bw-btn-navy">Close</button></form>
            )}
          </div>
        ))}
      </div>
      <div className="bw-card p-4 text-xs">
        <h2 className="font-bold text-sm mb-2">Public holidays (not business days for bank SLAs)</h2>
        <div className="flex flex-wrap gap-2 mb-2">{hols.length === 0 && <span className="text-slate-500">None added yet.</span>}{hols.map((h) => (
          <form key={h.day} method="POST" action="/api/v1/actions" className="bw-badge bg-slate-100 gap-2"><input type="hidden" name="action" value="remove_holiday" /><input type="hidden" name="day" value={h.day} /><input type="hidden" name="returnTo" value="/os/golive" />{h.day} {h.name}<button className="text-red-700" aria-label="Remove">×</button></form>))}</div>
        <form method="POST" action="/api/v1/actions" className="flex gap-2"><input type="hidden" name="action" value="add_holiday" /><input type="hidden" name="returnTo" value="/os/golive" /><input type="date" name="day" required className="bw-input !w-40" /><input name="name" required placeholder="Name (e.g. Eid Al Fitr)" className="bw-input !w-56" /><button className="bw-btn-gold">Add</button></form>
      </div>
    </div>
  );
}
