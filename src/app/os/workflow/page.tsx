import { getDb } from '@/server/db';
import { getActiveLang, requireStaffUser } from '@/server/auth/request';
import { tr } from '@/lib/format';
import { OsBanner } from '@/components/os-banner';
import { STAGES, STAGE_META, getDealWorkflow, pathFor, type Stage } from '@/server/engines/workflow-engine';
import { PLAYBOOKS } from '@/server/engines/scenarios';

const LEVEL = { CRITICAL: 'bg-red-50 text-red-800 border-red-200', WARN: 'bg-amber-50 text-amber-800 border-amber-200', INFO: 'bg-slate-50 text-slate-700 border-slate-200' } as const;
const GROUPS = ['CORE', 'BORROWER', 'PROPERTY', 'FINANCE', 'EXCEPTION', 'POST_COMPLETION'] as const;

export default async function WorkflowPage({
  searchParams,
}: {
  searchParams: Promise<{ dealId?: string; view?: string; notice?: string; error?: string }>;
}) {
  const user = await requireStaffUser();
  const lang = await getActiveLang(user);
  const sp = await searchParams;
  const db = getDb();

  const deals = db
    .prepare(
      `SELECT d.id, d.deal_ref, d.stage, d.transaction_type, a.full_name_en AS client
       FROM deals d LEFT JOIN applicants a ON a.household_id = d.household_id AND a.applicant_role = 'PRIMARY'
       WHERE d.origin_mode = 'LIVE' ORDER BY d.id DESC`,
    )
    .all() as { id: number; deal_ref: string; stage: string; transaction_type: string; client: string | null }[];

  const rows = deals.map((d) => {
    const w = getDealWorkflow(db, d.id);
    return { ...d, w, crit: w.alerts.filter((a) => a.level === 'CRITICAL').length };
  });
  const selId = sp.dealId ? Number(sp.dealId) : rows[0]?.id;
  const sel = rows.find((r) => r.id === selId);
  const showPlaybooks = sp.view === 'playbooks';
  const back = `/os/workflow?dealId=${selId ?? ''}`;

  return (
    <div className="space-y-6">
      <OsBanner notice={sp.notice} error={sp.error} />
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-[#8A6518]">
            {tr(lang, 'Deal Desk · one track for every mortgage case', 'مكتب الصفقات · مسار واحد لكل حالة')}
          </div>
          <h1 className="font-display text-2xl font-bold text-[#021125] mt-1">
            {showPlaybooks ? tr(lang, 'Scenario Playbooks', 'أدلة الحالات') : tr(lang, 'Where every deal is, what blocks it, who acts next', 'أين كل صفقة وما يعيقها ومن يتحرك')}
          </h1>
        </div>
        <div className="flex gap-2 text-xs">
          <a href="/os/workflow" className={showPlaybooks ? 'bw-btn-navy' : 'bw-btn-gold'}>{tr(lang, 'Deal Desk', 'مكتب الصفقات')}</a>
          <a href="/os/workflow?view=playbooks" className={showPlaybooks ? 'bw-btn-gold' : 'bw-btn-navy'}>{tr(lang, 'Playbooks', 'الأدلة')} ({PLAYBOOKS.length})</a>
        </div>
      </div>

      {showPlaybooks ? (
        <div className="space-y-6">
          {GROUPS.map((g) => (
            <section key={g}>
              <h2 className="font-display font-bold text-sm text-[#021125] mb-2">{g.replace('_', ' ')}</h2>
              <div className="grid md:grid-cols-2 gap-3">
                {PLAYBOOKS.filter((p) => p.group === g).map((p) => (
                  <div key={p.id} className="bw-card p-4 text-xs">
                    <div className="flex justify-between gap-2">
                      <div className="font-semibold text-[#021125]">{p.title}</div>
                      <span className="font-num text-[10px] text-[#8A6518]">{p.id}</span>
                    </div>
                    <div className="text-slate-500 mt-1">{p.trigger}</div>
                    <ol className="list-decimal ms-4 mt-2 space-y-0.5 text-slate-700">{p.steps.map((s) => <li key={s}>{s}</li>)}</ol>
                    <div className="mt-2 text-[10px] text-slate-500">Owner: {p.owner} · Screen: {p.where}</div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="grid lg:grid-cols-[320px_1fr] gap-5">
          <div className="bw-card divide-y divide-slate-100 max-h-[75vh] overflow-auto">
            {rows.length === 0 && <div className="p-4 text-xs text-slate-500">No live deals yet. Convert a lead in CRM.</div>}
            {rows.map((r) => (
              <a key={r.id} href={`/os/workflow?dealId=${r.id}`} className={`block p-3 text-xs hover:bg-slate-50 ${r.id === selId ? 'bg-[#F8F1DC]' : ''}`}>
                <div className="flex justify-between"><span className="font-semibold text-[#021125]">{r.deal_ref}</span>
                  {r.crit > 0 && <span className="text-red-700 font-bold">{r.crit} ⚠</span>}</div>
                <div className="text-slate-600">{r.client ?? '—'} · {r.transaction_type.replace('_', ' ')}</div>
                <div className="text-[#8A6518]">{r.w.closed ? r.stage : STAGE_META[r.stage as Stage]?.label}</div>
                <div className="text-slate-500 truncate">→ {r.w.nextAction.text}</div>
              </a>
            ))}
          </div>

          {sel && (
            <div className="space-y-4">
              <div className="bw-card p-4">
                <div className="flex flex-wrap gap-1">
                  {sel.w.track.map((t) => (
                    <div key={t.stage} className={`px-2 py-1 rounded text-[10px] font-medium border ${t.state === 'done' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : t.state === 'current' ? 'bg-[#021125] border-[#021125] text-white' : 'bg-white border-slate-200 text-slate-400'}`}>
                      {t.label}
                    </div>
                  ))}
                  {sel.w.closed && <div className="px-2 py-1 rounded text-[10px] font-bold bg-red-50 text-red-800 border border-red-200">{sel.w.stage}</div>}
                </div>
                <div className="mt-3 text-xs flex flex-wrap gap-1">
                  {sel.w.tags.map((t) => <span key={t} className="bw-badge">{t.replace('_', ' ')}</span>)}
                </div>
              </div>

              <div className="bw-card p-4 border-s-4 border-[#D7B04E]">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">Next action · owner {sel.w.nextAction.owner}{sel.w.nextAction.slaHours ? ` · SLA ${sel.w.nextAction.slaHours}h` : ''}</div>
                <div className="font-semibold text-[#021125] mt-1">{sel.w.nextAction.text}</div>
                {sel.w.blockers.filter((b) => !b.startsWith('Use "')).length > 0 && (
                  <ul className="mt-2 text-xs text-red-700 list-disc ms-4">
                    {sel.w.blockers.filter((b) => !b.startsWith('Use "')).map((b) => <li key={b}>{b}</li>)}
                  </ul>
                )}
                {sel.w.blockers.some((b) => b.startsWith('Use "')) && <div className="mt-2 text-xs text-slate-600">{sel.w.blockers.find((b) => b.startsWith('Use "'))}</div>}
                {sel.w.nextStage && (
                  <form method="POST" action="/api/v1/actions" className="mt-3">
                    <input type="hidden" name="action" value="wf_advance" />
                    <input type="hidden" name="dealId" value={sel.id} />
                    <input type="hidden" name="returnTo" value={back} />
                    <button className="bw-btn-gold" disabled={sel.w.blockers.length > 0}>Move to {STAGE_META[sel.w.nextStage].label}</button>
                  </form>
                )}
              </div>

              {sel.w.alerts.length > 0 && (
                <div className="space-y-2">
                  {sel.w.alerts.map((a, i) => (
                    <div key={i} className={`rounded-lg border p-3 text-xs ${LEVEL[a.level]}`}>
                      <span className="font-bold">{a.code.replace('_', ' ')}</span> · {a.text} {a.playbook && <a className="underline ms-1" href="/os/workflow?view=playbooks">{a.playbook}</a>}
                    </div>
                  ))}
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-4">
                <div className="bw-card p-4 text-xs">
                  <div className="font-display font-bold text-sm text-[#021125] mb-2">Documents ({sel.w.documents.required.length - sel.w.documents.missing.length}/{sel.w.documents.required.length})</div>
                  {sel.w.documents.missing.length === 0 ? <div className="text-emerald-700">All required documents present.</div> : (
                    <ul className="list-disc ms-4 text-red-700">{sel.w.documents.missing.map((m) => <li key={m}>{m}</li>)}</ul>
                  )}
                </div>
                <div className="bw-card p-4 text-xs">
                  <div className="font-display font-bold text-sm text-[#021125] mb-2">Exceptions</div>
                  <form method="POST" action="/api/v1/actions" className="space-y-2">
                    <input type="hidden" name="action" value="wf_exception" />
                    <input type="hidden" name="dealId" value={sel.id} />
                    <input type="hidden" name="returnTo" value={back} />
                    <select name="kind" className="bw-input w-full">
                      {sel.w.exceptions.filter((e) => e.allowed).map((e) => <option key={e.kind} value={e.kind}>{e.label}</option>)}
                    </select>
                    <select name="targetStage" className="bw-input w-full">
                      <option value="">Target stage (step back / reopen)</option>
                      {pathFor(deals.find((d) => d.id === sel.id)?.transaction_type ?? 'READY_PURCHASE').filter((s) => STAGES.includes(s)).slice(0, -1).map((s) => <option key={s} value={s}>{STAGE_META[s].label}</option>)}
                    </select>
                    <input name="reason" required placeholder="Reason (required)" className="bw-input w-full" />
                    <button className="bw-btn-navy w-full">Apply</button>
                  </form>
                </div>
              </div>

              <div className="bw-card p-4 text-xs">
                <div className="font-display font-bold text-sm text-[#021125] mb-2">Playbooks that apply to this deal ({sel.w.playbooks.length})</div>
                <div className="grid md:grid-cols-2 gap-3">
                  {sel.w.playbooks.map((p) => (
                    <div key={p.id} className="rounded border border-slate-200 p-3">
                      <div className="font-semibold">{p.title} <span className="text-[#8A6518] font-num text-[10px]">{p.id}</span></div>
                      <ol className="list-decimal ms-4 mt-1 text-slate-700">{p.steps.map((s) => <li key={s}>{s}</li>)}</ol>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
