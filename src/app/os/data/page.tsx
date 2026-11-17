import { getDb } from '@/server/db';
import { getActiveLang, requireStaffUser } from '@/server/auth/request';
import { OsBanner } from '@/components/os-banner';
import { PageHeader } from '@/components/page-header';
import { SPECS, specByNo, rolesFor, type SpecType } from '@/server/data-hub/specs';
import { EXPORTABLE } from '@/server/data-hub/exports';
import { CONNECTORS, connectorState } from '@/lib/connectors';

type R = Record<string, any>;
const TYPES: SpecType[] = ['Setup', 'Migration', 'Export', 'Test'];
const PHASE: Record<string, string> = { Launch: 'bg-emerald-100 text-emerald-900', 'Phase 2': 'bg-sky-100 text-sky-900', Conditional: 'bg-slate-200 text-slate-700' };

export default async function DataHub({ searchParams }: { searchParams: Promise<{ type?: string; spec?: string; notice?: string; error?: string }> }) {
  const user = await requireStaffUser();
  await getActiveLang(user);
  const sp = await searchParams;
  const db = getDb();
  const type = (TYPES as string[]).includes(sp.type || '') ? (sp.type as SpecType) : sp.spec ? specByNo(Number(sp.spec))?.type ?? 'Setup' : 'Setup';
  const stats = new Map<number, R>(
    (db.prepare("SELECT spec_no, SUM(status='ACCEPTED') acc, SUM(status='HELD_FOR_REVIEW') held, SUM(status='REJECTED') rej FROM data_rows GROUP BY spec_no").all() as R[]).map((r) => [r.spec_no, r]),
  );
  const sel = sp.spec ? specByNo(Number(sp.spec)) : undefined;
  const batches = sel ? (db.prepare('SELECT b.*, u.full_name_en reviewer FROM data_batches b LEFT JOIN users u ON u.id = b.reviewer_id WHERE b.spec_no = ? ORDER BY b.id DESC LIMIT 10').all(sel.no) as R[]) : [];
  const problem = sel ? (db.prepare("SELECT * FROM data_rows WHERE spec_no = ? AND status IN ('HELD_FOR_REVIEW','REJECTED') ORDER BY id DESC LIMIT 25").all(sel.no) as R[]) : [];
  const good = sel ? (db.prepare("SELECT * FROM data_rows WHERE spec_no = ? AND status = 'ACCEPTED' ORDER BY id DESC LIMIT 15").all(sel.no) as R[]) : [];
  const outbox = db.prepare('SELECT * FROM notifications ORDER BY id DESC LIMIT 8').all() as R[];
  const exportsLog = db.prepare('SELECT * FROM data_exports ORDER BY id DESC LIMIT 8').all() as R[];
  const can = (no: number) => rolesFor(specByNo(no)!).includes(user.role);

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <OsBanner notice={sp.notice} error={sp.error} />
      <PageHeader app="Data Hub" appHref="/os/data" title="Data Hub" sub="Setup, migration, export and test files from the requirements register. Download a template, fill it in Excel, import it, review the rejects, sign off." />

      <div className="flex gap-1 border-b border-slate-200 text-xs">
        {TYPES.map((t) => <a key={t} href={`/os/data?type=${t}`} className={`px-3 py-2 ${t === type ? 'border-b-2 border-[#c9a257] font-semibold text-[#2a1418]' : 'text-slate-500'}`}>{t} ({SPECS.filter((s) => s.type === t).length})</a>)}
      </div>

      <div className="grid lg:grid-cols-[1fr_420px] gap-5">
        <div className="bw-card divide-y divide-slate-100">
          {SPECS.filter((s) => s.type === type).map((s) => {
            const st = stats.get(s.no);
            const exportable = EXPORTABLE.includes(s.no);
            return (
              <div key={s.no} className={`p-3 text-xs flex flex-wrap items-center gap-3 ${sel?.no === s.no ? 'bg-[#f3e9cf]' : ''}`}>
                <a href={`/os/data?spec=${s.no}`} className="flex-1 min-w-[240px]">
                  <div className="font-semibold text-[#2a1418]"><span className="font-num text-slate-400">{String(s.no).padStart(2, '0')}</span> {s.file}</div>
                  <div className="text-slate-500">{s.area} <span className={`bw-badge ${PHASE[s.phase]}`}>{s.phase}</span>{s.restricted && <span className="bw-badge bg-rose-100 text-rose-800 ms-1">restricted</span>}</div>
                  {st && <div className="text-slate-500">{st.acc ?? 0} accepted · {st.held ?? 0} held · {st.rej ?? 0} rejected</div>}
                </a>
                <a className="underline" href={`/api/v1/data/template/${s.no}`}>Template ↓</a>
                {s.type === 'Export' ? (
                  exportable && can(s.no) ? (
                    <form action={`/api/v1/data/export/${s.no}`} method="GET" className="flex gap-1">
                      <input name="purpose" placeholder={s.restricted ? 'Purpose (required)' : 'Purpose'} required={s.restricted} className="bw-input !w-36" />
                      <button className="bw-btn-navy">Export</button>
                    </form>
                  ) : <span className="text-slate-400">{exportable ? 'No access' : 'Template only'}</span>
                ) : can(s.no) ? (
                  <form action="/api/v1/data/import" method="POST" encType="multipart/form-data" className="flex gap-1 items-center">
                    <input type="hidden" name="spec" value={s.no} />
                    <input type="file" name="file" accept=".xlsx,.xlsm,.csv,.tsv,.txt,.json" required className="text-[11px] w-44" />
                    <button className="bw-btn-gold">Import</button>
                  </form>
                ) : <span className="text-slate-400">No access</span>}
              </div>
            );
          })}
        </div>

        <div className="space-y-4">
          {sel ? (
            <>
              <div className="bw-card p-4 text-xs">
                <h2 className="font-bold">{sel.file}</h2>
                <div className="text-slate-500 mt-1 leading-relaxed">{sel.columns.join(' · ')}</div>
                {sel.no === 35 && can(35) && (
                  <form method="POST" action="/api/v1/actions" className="mt-3">
                    <input type="hidden" name="action" value="run_dr_test" /><input type="hidden" name="returnTo" value="/os/data?spec=35" />
                    <button className="bw-btn-navy">Run backup + restore drill now</button>
                  </form>
                )}
                {sel.no === 34 && can(34) && (
                  <form method="POST" action="/api/v1/actions" className="mt-3">
                    <input type="hidden" name="action" value="generate_uat" /><input type="hidden" name="returnTo" value="/os/data?spec=34" />
                    <button className="bw-btn-navy">Generate UAT cases from playbooks</button>
                  </form>
                )}
              </div>
              {batches.length > 0 && (
                <div className="bw-card p-4 text-xs space-y-3">
                  <h2 className="font-bold">Import reconciliation</h2>
                  {batches.map((b) => (
                    <div key={b.id} className="border-b border-slate-100 pb-2">
                      <div className="flex justify-between"><b>#{b.id} {b.file_name}</b><span className="text-slate-400">{b.created_at}</span></div>
                      <div><a className="underline" href={`/api/v1/data/batch/${b.id}`}>Stored CSV ↓</a>{b.applied_rows > 0 && <span className="text-emerald-700"> · {b.applied_rows} records created in the OS</span>}</div>
                      <div>{b.source_rows} source = <span className="text-emerald-700">{b.accepted_rows} accepted</span> + <span className="text-amber-700">{b.held_rows} held</span> + <span className="text-red-700">{b.rejected_rows} rejected</span></div>
                      {b.reviewer_id ? <div className="text-slate-500">Signed off by {b.reviewer} · evidence {b.evidence_ref}</div> : can(sel.no) && (
                        <form method="POST" action="/api/v1/actions" className="flex gap-1 mt-1">
                          <input type="hidden" name="action" value="review_batch" /><input type="hidden" name="batchId" value={b.id} /><input type="hidden" name="returnTo" value={`/os/data?spec=${sel.no}`} />
                          <input name="evidenceRef" required placeholder="Evidence ref" className="bw-input" /><button className="bw-btn-navy">Sign off</button>
                        </form>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {problem.length > 0 && (
                <div className="bw-card p-4 text-xs"><h2 className="font-bold mb-2">Held / rejected rows</h2>
                  {problem.map((r) => <div key={r.id} className="py-1 border-b border-slate-100"><b>{r.status === 'REJECTED' ? '✗' : '⏸'} row {r.row_no}</b> {r.external_id} <div className="text-red-700">{(JSON.parse(r.errors_json) as string[]).join('; ')}</div></div>)}</div>
              )}
              {good.length > 0 && (
                <div className="bw-card p-4 text-xs"><h2 className="font-bold mb-2">Latest accepted rows</h2>
                  {good.map((r) => <div key={r.id} className="py-1 border-b border-slate-100 truncate">{r.external_id}{sel.no === 34 ? ` · ${JSON.parse(r.data_json).status}` : ''}</div>)}</div>
              )}
            </>
          ) : <div className="bw-card p-4 text-xs text-slate-500">Select a file to see its columns, batches and rejected rows.</div>}
          <div className="bw-card p-4 text-xs"><h2 className="font-bold mb-2">Notification outbox</h2>
            {outbox.length === 0 && <div className="text-slate-500">Empty. Messages appear when an approved template (Templates_and_Notification_Rules) matches a stage change.</div>}
            {outbox.map((n) => (
              <div key={n.id} className="py-1.5 border-b border-slate-100">
                <b>{n.status}</b> · {n.channel} · {n.recipient || '—'} · {n.trigger}<div className="text-slate-600 truncate">{n.body}</div>
                {n.status === 'QUEUED' && <form method="POST" action="/api/v1/actions" className="inline-flex gap-1 mt-1"><input type="hidden" name="notificationId" value={n.id} /><input type="hidden" name="returnTo" value="/os/data" /><button name="action" value="notification_sent" className="underline">Mark sent</button><button name="action" value="notification_skip" className="underline">Skip</button></form>}
              </div>
            ))}</div>
          <div className="bw-card p-4 text-xs"><h2 className="font-bold mb-2">Connectors</h2>
            {CONNECTORS.map((c) => <div key={c.key} className="py-1.5 border-b border-slate-100"><b>{c.name}</b> · {connectorState(c)}<div className="text-slate-500">Manual path: {c.manual}</div><div className="text-slate-400">{c.note}{c.env.length ? ` Env: ${c.env.join(', ')}` : ''}</div></div>)}</div>
          <div className="bw-card p-4 text-xs"><h2 className="font-bold mb-2">Recent exports</h2>
            {exportsLog.length === 0 && <div className="text-slate-500">None yet.</div>}
            {exportsLog.map((e) => <div key={e.id} className="py-1 border-b border-slate-100">spec {e.spec_no} · {e.actor_role} · {e.row_count} rows · “{e.purpose}” <span className="text-slate-400">{e.created_at}</span></div>)}</div>
        </div>
      </div>
    </div>
  );
}
