import { notFound } from 'next/navigation';
import { getDb } from '@/server/db';
import { getActiveLang, requireStaffUser } from '@/server/auth/request';
import { formatAed, formatBps, tr } from '@/lib/format';
import { OsBanner } from '@/components/os-banner';
import { STAGE_META, getDealWorkflow, pathFor } from '@/server/engines/workflow-engine';

type R = Record<string, any>;
const TABS = ['overview', 'borrowers', 'documents', 'banks', 'property', 'money', 'activity'] as const;
const LEVEL: Record<string, string> = { CRITICAL: 'bg-red-50 text-red-800 border-red-200', WARN: 'bg-amber-50 text-amber-800 border-amber-200', INFO: 'bg-slate-50 text-slate-700 border-slate-200' };

const Field = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <div className="flex justify-between gap-3 py-1.5 border-b border-slate-100 text-xs"><span className="text-slate-500">{k}</span><span className="font-medium text-[#021125] text-end">{v ?? '—'}</span></div>
);

export default async function DealForm({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; notice?: string; error?: string }> }) {
  const user = await requireStaffUser();
  const lang = await getActiveLang(user);
  const { id } = await params;
  const sp = await searchParams;
  const dealId = Number(id);
  const db = getDb();
  const deal = db.prepare('SELECT d.*, b.name_en bank_name, u.full_name_en advisor FROM deals d LEFT JOIN banks b ON b.id=d.selected_bank_id LEFT JOIN users u ON u.id=d.advisor_id WHERE d.id = ?').get(dealId) as R | undefined;
  if (!deal) notFound();
  const tab = (TABS as readonly string[]).includes(sp.tab || '') ? sp.tab! : 'overview';
  const w = getDealWorkflow(db, dealId);
  const apps = db.prepare('SELECT * FROM applicants WHERE household_id = ? ORDER BY id').all(deal.household_id) as R[];
  const docs = db.prepare('SELECT * FROM vault_documents WHERE deal_id = ? ORDER BY id DESC').all(dealId) as R[];
  const subs = db.prepare('SELECT s.*, b.name_en bank FROM deal_submissions s JOIN banks b ON b.id=s.bank_id WHERE s.deal_id = ? ORDER BY s.id').all(dealId) as R[];
  const conv = db.prepare('SELECT * FROM conveyancing_cases WHERE deal_id = ?').get(dealId) as R | undefined;
  const settle = db.prepare('SELECT * FROM commission_settlements WHERE deal_id = ?').all(dealId) as R[];
  const kfs = db.prepare('SELECT applicant_id FROM kfs_acknowledgements WHERE deal_id = ?').all(dealId) as R[];
  const tasks = db.prepare("SELECT * FROM ops_tasks WHERE deal_id = ? ORDER BY id DESC LIMIT 20").all(dealId) as R[];
  const logs = db.prepare("SELECT l.*, u.full_name_en who FROM audit_logs l LEFT JOIN users u ON u.id=l.actor_user_id WHERE l.entity_type='deals' AND l.entity_id = ? ORDER BY l.id DESC LIMIT 30").all(String(dealId)) as R[];
  const client = apps.find((a) => a.applicant_role === 'PRIMARY')?.full_name_en ?? deal.deal_ref;
  const back = `/os/deals/${dealId}`;
  const real = w.blockers.filter((b) => !b.startsWith('Use "'));
  const hint = w.blockers.find((b) => b.startsWith('Use "'));

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <OsBanner notice={sp.notice} error={sp.error} />
      <div className="text-xs text-slate-500"><a className="underline" href="/os/deals">Pipeline</a> / {deal.deal_ref}</div>

      {/* control panel: title + action buttons + statusbar */}
      <div className="bw-card p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-xl font-bold text-[#021125]">{client}</h1>
            <div className="text-xs text-slate-500">{deal.deal_ref} · {String(deal.transaction_type).replace('_', ' ')} · {deal.community_name} · Advisor {deal.advisor ?? '—'}</div>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            {w.nextStage && (
              <form method="POST" action="/api/v1/actions">
                <input type="hidden" name="action" value="wf_advance" /><input type="hidden" name="dealId" value={dealId} /><input type="hidden" name="returnTo" value={back} />
                <button className="bw-btn-gold" disabled={w.blockers.length > 0}>→ {STAGE_META[w.nextStage].label}</button>
              </form>
            )}
            {w.stage === 'UNDERWRITING_READY' && <a className="bw-btn-navy" href={`/os/los?dealId=${dealId}`}>Submit to banks</a>}
            {['NOC_AND_CLEARANCE', 'CHEQUES_READY'].includes(w.stage) && <a className="bw-btn-navy" href={`/os/conveyancing?dealId=${dealId}`}>Cheque pack</a>}
            {w.stage === 'CHEQUES_READY' && <a className="bw-btn-navy" href="/os/erp">Record disbursal</a>}
            <details className="relative">
              <summary className="bw-btn-navy list-none cursor-pointer">Action ▾</summary>
              <form method="POST" action="/api/v1/actions" className="absolute end-0 mt-1 w-64 bg-white border border-slate-200 rounded-lg shadow-xl p-3 space-y-2 z-20">
                <input type="hidden" name="action" value="wf_exception" /><input type="hidden" name="dealId" value={dealId} /><input type="hidden" name="returnTo" value={back} />
                <select name="kind" className="bw-input w-full">{w.exceptions.filter((e) => e.allowed).map((e) => <option key={e.kind} value={e.kind}>{e.label}</option>)}</select>
                <select name="targetStage" className="bw-input w-full"><option value="">Target stage (step back / reopen)</option>
                  {pathFor(deal.transaction_type).slice(0, -1).map((s) => <option key={s} value={s}>{STAGE_META[s].label}</option>)}</select>
                <input name="reason" required placeholder="Reason (required)" className="bw-input w-full" />
                <button className="bw-btn-navy w-full">Apply</button>
              </form>
            </details>
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {w.track.map((t) => (
            <div key={t.stage} className={`px-2.5 py-1 text-[11px] rounded-full border ${t.state === 'done' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : t.state === 'current' ? 'bg-[#021125] border-[#021125] text-white font-semibold' : 'bg-white border-slate-200 text-slate-400'}`}>{t.label}</div>
          ))}
          {w.closed && <div className="px-2.5 py-1 text-[11px] rounded-full bg-red-50 text-red-800 border border-red-200 font-bold">{w.stage}</div>}
        </div>
      </div>

      {/* smart banner */}
      <div className="bw-card p-3 border-s-4 border-[#D7B04E] text-xs">
        <span className="text-slate-500">Next · {w.nextAction.owner}: </span><span className="font-semibold text-[#021125]">{w.nextAction.text}</span>
        {real.length > 1 && <ul className="list-disc ms-5 mt-1 text-red-700">{real.map((b) => <li key={b}>{b}</li>)}</ul>}
        {hint && <div className="text-slate-500 mt-1">{hint}</div>}
      </div>
      {w.alerts.map((a, i) => <div key={i} className={`rounded-lg border p-2.5 text-xs ${LEVEL[a.level]}`}><b>{a.code.replace('_', ' ')}</b> · {a.text}</div>)}

      <div className="flex gap-1 border-b border-slate-200 text-xs overflow-x-auto">
        {TABS.map((t) => <a key={t} href={`${back}?tab=${t}`} className={`px-3 py-2 capitalize shrink-0 ${tab === t ? 'border-b-2 border-[#D7B04E] font-semibold text-[#021125]' : 'text-slate-500 hover:text-slate-800'}`}>{t}{t === 'documents' && w.documents.missing.length ? ` (${w.documents.missing.length} missing)` : ''}</a>)}
      </div>

      {tab === 'overview' && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bw-card p-4"><h2 className="font-bold text-sm mb-2">Loan</h2>
            <Field k="Purchase price" v={formatAed(deal.purchase_price_fils)} /><Field k="Target loan" v={formatAed(deal.target_loan_fils)} />
            <Field k="LTV" v={formatBps(Math.round((deal.target_loan_fils / deal.purchase_price_fils) * 10000))} /><Field k="Tenure" v={`${deal.tenure_months / 12} yrs`} />
            <Field k="Selected bank" v={deal.bank_name} /><Field k="Finance" v={String(deal.finance_preference).replace('_', ' ')} /><Field k="First home" v={deal.is_first_home ? 'Yes' : 'No'} /></div>
          <div className="bw-card p-4"><h2 className="font-bold text-sm mb-2">Scenario tags</h2>
            <div className="flex flex-wrap gap-1 mb-3">{w.tags.map((t) => <span key={t} className="bw-badge">{t.replace('_', ' ')}</span>)}</div>
            <h2 className="font-bold text-sm mb-1">Playbooks ({w.playbooks.length})</h2>
            {w.playbooks.slice(0, 6).map((p) => <details key={p.id} className="text-xs py-1"><summary className="cursor-pointer font-medium">{p.title}</summary><ol className="list-decimal ms-5 mt-1 text-slate-600">{p.steps.map((s) => <li key={s}>{s}</li>)}</ol></details>)}
            <a className="text-xs underline" href="/os/workflow?view=playbooks">All playbooks</a></div>
        </div>
      )}

      {tab === 'borrowers' && (
        <div className="grid md:grid-cols-2 gap-4">{apps.map((a) => (
          <div key={a.id} className="bw-card p-4"><h2 className="font-bold text-sm mb-2">{a.full_name_en} <span className="bw-badge">{a.applicant_role}</span></h2>
            <Field k="Residency" v={a.residency_type} /><Field k="Employment" v={`${a.employment_type} · ${a.employer_name || '—'}`} />
            <Field k="Basic + allowances" v={formatAed(a.basic_salary_fils + a.allowances_fils)} /><Field k="Emirates ID expiry" v={a.eid_expiry_date} /><Field k="Passport expiry" v={a.passport_expiry_date} />
            <Field k="AECB score" v={a.aecb_score} /><Field k="PEP" v={a.is_pep ? 'Yes' : 'No'} />
            <Field k="KFS signed" v={kfs.some((k) => k.applicant_id === a.id) ? '✓ Yes' : '✗ No'} /></div>
        ))}</div>
      )}

      {tab === 'documents' && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bw-card p-4 text-xs"><h2 className="font-bold text-sm mb-2">Required</h2>
            {w.documents.required.map((r) => <div key={r} className="flex justify-between py-1 border-b border-slate-100"><span>{r}</span><span className={w.documents.missing.includes(r) ? 'text-red-700' : 'text-emerald-700'}>{w.documents.missing.includes(r) ? 'Missing' : '✓'}</span></div>)}</div>
          <div className="bw-card p-4 text-xs"><h2 className="font-bold text-sm mb-2">Vault ({docs.length})</h2>
            {docs.map((d) => <div key={d.id} className="py-1 border-b border-slate-100 flex justify-between"><span>{d.doc_category} · {d.file_name}</span><span className={d.ocr_validation_status === 'PASSED' ? 'text-emerald-700' : 'text-amber-700'}>{d.ocr_validation_status}</span></div>)}
            {docs.length === 0 && <div className="text-slate-500">Nothing uploaded. Client uploads in the portal; staff upload via Underwriting.</div>}</div>
        </div>
      )}

      {tab === 'banks' && (
        <div className="bw-card p-4 text-xs"><h2 className="font-bold text-sm mb-2">Bank submissions</h2>
          {subs.length === 0 ? <div className="text-slate-500">Not submitted yet. <a className="underline" href={`/os/los?dealId=${dealId}`}>Open underwriting</a></div> : subs.map((s) => (
            <div key={s.id} className="py-2 border-b border-slate-100 grid grid-cols-2 md:grid-cols-6 gap-2"><b>{s.bank}</b><span>{s.priority}</span><span>{s.status}</span><span>DBR {formatBps(s.calculated_dbr_bps)}</span><span>LTV {formatBps(s.calculated_ltv_bps)}</span><span>IPA {s.ipa_ref || '—'} {s.ipa_expires_at ? `exp ${s.ipa_expires_at}` : ''}</span></div>))}</div>
      )}

      {tab === 'property' && (
        <div className="bw-card p-4 grid md:grid-cols-2 gap-x-8">
          <div><Field k="Community" v={deal.community_name} /><Field k="Status" v={deal.property_status} /><Field k="Form F signed" v={conv?.form_f_signed_date} /><Field k="Form F expiry" v={conv?.form_f_expiry_date} /><Field k="FOL contingency date" v={conv?.fol_contingency_date} /><Field k="Title deed" v={conv?.title_deed_no} /></div>
          <div><Field k="Valuation" v={conv?.valuation_amount_fils ? `${formatAed(conv.valuation_amount_fils)} (${conv.valuation_firm})` : null} /><Field k="Shortfall action" v={conv?.valuation_shortfall_action} /><Field k="NOC" v={conv?.noc_status} /><Field k="Seller mortgage" v={conv?.seller_has_mortgage ? `Yes · ${conv.seller_bank_name}` : 'No'} /><Field k="Transfer appointment" v={conv?.transfer_appointment_at} />
            <a className="text-xs underline" href={`/os/conveyancing?dealId=${dealId}`}>Edit in Conveyancing</a></div>
        </div>
      )}

      {tab === 'money' && (
        <div className="bw-card p-4 text-xs">{settle.length === 0 ? <div className="text-slate-500">Nothing booked until disbursal.</div> : settle.map((s) => (
          <div key={s.id} className="grid grid-cols-2 md:grid-cols-4 gap-2 py-1"><span>Expected {formatAed(s.expected_subvention_ex_vat_fils)}</span><span>Received {formatAed(s.received_subvention_ex_vat_fils)}</span><span>{s.reconciliation_status}</span><span>Partner: {s.partner_payout_status}</span></div>))}</div>
      )}

      {tab === 'activity' && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bw-card p-4 text-xs"><h2 className="font-bold text-sm mb-2">Tasks</h2>{tasks.map((t) => <div key={t.id} className="py-1 border-b border-slate-100">{t.status === 'OPEN' ? '○' : '✓'} {String(t.title).replace('[WF] ', '')} <span className="text-slate-400">· {t.assigned_role}</span></div>)}</div>
          <div className="bw-card p-4 text-xs"><h2 className="font-bold text-sm mb-2">Log</h2>{logs.map((l) => <div key={l.id} className="py-1 border-b border-slate-100"><b>{l.action}</b> · {l.who ?? l.actor_role} <span className="text-slate-400">{l.created_at}</span></div>)}</div>
        </div>
      )}
    </div>
  );
}
