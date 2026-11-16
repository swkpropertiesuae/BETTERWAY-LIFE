import { getDb } from '@/server/db';
import { getActiveLang, requireStaffUser } from '@/server/auth/request';
import { formatAedWhole, tr } from '@/lib/format';
import { Avatar } from '@/components/ui';
import { STAGES, STAGE_META } from '@/server/engines/workflow-engine';

const TINT = ['bg-[#fbe9d3]/70', 'bg-[#dbe7fb]/70', 'bg-[#e8def9]/70', 'bg-[#fbdcee]/70', 'bg-[#d8f2e6]/70', 'bg-[#f3ecd4]/70'];
const DOT = ['#f0b38a', '#9db8f2', '#c4a8f0', '#f0a3cf', '#8fd9b8', '#e6c97a'];
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
        <h1 className="font-display text-2xl font-extrabold text-[#021125]">{tr(lang, 'Pipeline', 'خط الصفقات')} <span className="text-slate-400 text-sm font-normal">{list.length}</span></h1>
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
            <div key={s} className={`w-64 shrink-0 rounded-3xl p-2.5 ${TINT[cols.indexOf(s) % TINT.length]}`}>
              <div className="flex justify-between items-center text-[11px] font-bold text-[#021125] px-1.5 mb-2">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: DOT[cols.indexOf(s) % DOT.length] }} />{(STAGE_META as Record<string, { label: string }>)[s]?.label ?? s}</span><span className="grid place-items-center h-5 min-w-5 px-1 rounded-full bg-white/80">{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.map((r) => {
                  const crit = r.w.alerts.some((a) => a.level === 'CRITICAL');
                  return (
                    <a key={r.id} href={`/os/deals/${r.id}`} className={`block bw-card bw-lift p-3 text-xs transition ${crit ? 'ring-2 ring-red-300' : ''}`}>
                      <div className="flex items-center gap-2"><Avatar name={r.client ?? r.deal_ref} size={26} /><span className="font-semibold text-[#021125] flex-1 truncate">{r.client ?? r.deal_ref}</span><span className="font-num text-slate-400">{r.deal_ref.slice(-4)}</span></div>
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
