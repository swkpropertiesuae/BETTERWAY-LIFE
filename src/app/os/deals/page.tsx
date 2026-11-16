import { getDb } from '@/server/db';
import { getActiveLang, requireStaffUser } from '@/server/auth/request';
import { formatAedWhole, tr } from '@/lib/format';
import { STAGES, STAGE_META } from '@/server/engines/workflow-engine';
import { getDealWorkflow } from '@/server/engines/workflow-engine';

export default async function Pipeline({ searchParams }: { searchParams: Promise<{ q?: string; mine?: string }> }) {
  const user = await requireStaffUser();
  const lang = await getActiveLang(user);
  const sp = await searchParams;
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT d.id, d.deal_ref, d.stage, d.transaction_type, d.target_loan_fils, d.advisor_id, a.full_name_en client, b.name_en bank
       FROM deals d LEFT JOIN applicants a ON a.household_id = d.household_id AND a.applicant_role='PRIMARY'
       LEFT JOIN banks b ON b.id = d.selected_bank_id WHERE d.origin_mode='LIVE' ORDER BY d.id DESC`,
    )
    .all() as { id: number; deal_ref: string; stage: string; transaction_type: string; target_loan_fils: number; advisor_id: number | null; client: string | null; bank: string | null }[];
  const q = (sp.q || '').toLowerCase();
  const list = rows
    .filter((r) => !q || `${r.deal_ref} ${r.client} ${r.bank}`.toLowerCase().includes(q))
    .filter((r) => sp.mine !== '1' || r.advisor_id === user.id)
    .map((r) => ({ ...r, w: getDealWorkflow(db, r.id) }));
  const cols = [...STAGES, 'DECLINED', 'WITHDRAWN'] as string[];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-xl font-bold text-[#021125]">{tr(lang, 'Pipeline', 'خط الصفقات')} <span className="text-slate-400 text-sm font-normal">{list.length}</span></h1>
        <form className="flex gap-2 text-xs">
          <input name="q" defaultValue={sp.q} placeholder="Filter…" className="bw-input" />
          <label className="flex items-center gap-1"><input type="checkbox" name="mine" value="1" defaultChecked={sp.mine === '1'} /> My deals</label>
          <button className="bw-btn-navy">Apply</button>
        </form>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {cols.map((s) => {
          const items = list.filter((r) => r.stage === s);
          return (
            <div key={s} className="w-64 shrink-0">
              <div className="flex justify-between text-[11px] font-semibold text-slate-600 px-1 mb-2">
                <span>{(STAGE_META as Record<string, { label: string }>)[s]?.label ?? s}</span><span>{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.map((r) => {
                  const crit = r.w.alerts.some((a) => a.level === 'CRITICAL');
                  return (
                    <a key={r.id} href={`/os/deals/${r.id}`} className={`block bw-card p-3 text-xs hover:shadow-md ${crit ? 'border-s-4 border-red-500' : ''}`}>
                      <div className="flex justify-between"><span className="font-semibold text-[#021125]">{r.client ?? r.deal_ref}</span><span className="font-num text-slate-400">{r.deal_ref.slice(-4)}</span></div>
                      <div className="text-slate-500">{r.transaction_type.replace('_', ' ')} · {formatAedWhole(r.target_loan_fils)}</div>
                      <div className="text-[#8A6518]">{r.bank ?? 'No bank yet'}</div>
                      <div className="mt-1 text-slate-600 truncate">→ {r.w.nextAction.text}</div>
                    </a>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
