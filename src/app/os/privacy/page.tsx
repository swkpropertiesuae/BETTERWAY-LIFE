import { getDb } from '@/server/db';
import { getActiveLang, requireStaffUser } from '@/server/auth/request';
import { OsBanner } from '@/components/os-banner';
import { PageHeader } from '@/components/page-header';
import { retentionDue } from '@/server/engines/privacy';

type R = Record<string, any>;
export default async function Privacy({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string }> }) {
  const user = await requireStaffUser();
  await getActiveLang(user);
  const sp = await searchParams;
  const db = getDb();
  const items = db.prepare("SELECT * FROM incidents ORDER BY status = 'CLOSED', due_at LIMIT 40").all() as R[];
  const { due, manual } = retentionDue(db);
  const isMlro = user.role === 'COMPLIANCE_MLRO';
  const today = new Date().toISOString().slice(0, 10);
  const sel = 'bw-input';
  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      <OsBanner notice={sp.notice} error={sp.error} />
      <PageHeader app="Compliance" appHref="/os/compliance" title="Privacy, incidents and retention" sub="Incident and data-request register, and records due for deletion under your retention rules." />
      <div className="grid lg:grid-cols-[360px_1fr] gap-4">
        <form method="POST" action="/api/v1/actions" className="bw-card p-4 space-y-2 text-xs h-fit">
          <h2 className="font-bold text-sm">Log an incident or data request</h2>
          <input type="hidden" name="action" value="open_incident" /><input type="hidden" name="returnTo" value="/os/privacy" />
          <select name="kind" className={sel}><option value="INCIDENT">Incident (security / data breach / outage)</option><option value="DATA_REQUEST">Data request (client rights)</option></select>
          <select name="subtype" className={sel}><option>DATA_BREACH</option><option>LOST_DEVICE</option><option>WRONG_RECIPIENT</option><option>SYSTEM_OUTAGE</option><option>ACCESS</option><option>ERASURE</option><option>CORRECTION</option><option>OBJECTION</option><option>OTHER</option></select>
          <select name="severity" className={sel}><option>NORMAL</option><option>LOW</option><option>HIGH</option><option>CRITICAL</option></select>
          <input name="subject" placeholder="Who / what (masked case or client name)" className={sel} />
          <textarea name="description" required rows={3} placeholder="What happened or what was requested" className={sel} />
          <button className="bw-btn-gold w-full">Open</button>
          <p className="text-[10px] text-slate-500">Due dates are internal targets (data request 30 days, critical incident 1 day). Confirm legal deadlines with counsel.</p>
        </form>
        <div className="bw-card p-4 text-xs">
          <h2 className="font-bold text-sm mb-2">Register ({items.filter((i) => i.status !== 'CLOSED').length} open)</h2>
          {items.length === 0 && <div className="text-slate-500">Nothing logged.</div>}
          {items.map((i) => (
            <div key={i.id} className="py-2 border-b border-slate-100 flex flex-wrap items-center gap-2 justify-between">
              <span><b>{i.ref}</b> · {i.kind}:{i.subtype} · {i.severity} · {i.status}<span className={i.status !== 'CLOSED' && i.due_at < today ? 'text-red-700' : 'text-slate-500'}> · due {i.due_at}</span><span className="block text-slate-600">{i.description}</span></span>
              {i.status !== 'CLOSED' && ['SUPER_ADMIN', 'COMPLIANCE_MLRO'].includes(user.role) && (
                <form method="POST" action="/api/v1/actions" className="flex gap-1"><input type="hidden" name="action" value="close_incident" /><input type="hidden" name="incidentId" value={i.id} /><input type="hidden" name="returnTo" value="/os/privacy" /><input name="closureRef" required placeholder="Closure evidence ref" className="bw-input !w-40" /><button className="bw-btn-navy">Close</button></form>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="bw-card p-4 text-xs">
        <h2 className="font-bold text-sm mb-2">Retention: records past their period ({due.length})</h2>
        {due.length === 0 && <div className="text-slate-500">Nothing due. Rules come from Privacy_Retention_and_Vendor_Register in the Data Hub.</div>}
        {['VAULT_DOCUMENT', 'LEAD'].map((t) => {
          const list = due.filter((d) => d.recordType === t);
          return list.length ? (
            <div key={t} className="mb-3"><b>{t.replace('_', ' ')}</b>
              <ul className="list-disc ms-5 text-slate-600">{list.slice(0, 15).map((d) => <li key={d.id}>{d.label} · closed {d.closedAt.slice(0, 10)} · rule {d.ruleMonths} months</li>)}</ul>
              {isMlro ? <form method="POST" action="/api/v1/actions" className="flex gap-1 mt-1"><input type="hidden" name="action" value="retention_purge" /><input type="hidden" name="recordType" value={t} /><input type="hidden" name="ids" value={list.map((d) => d.id).join(',')} /><input type="hidden" name="returnTo" value="/os/privacy" /><input name="approvalRef" required placeholder="Approval ref (deletion cannot be undone)" className="bw-input !w-72" /><button className="bw-btn-navy">Delete these {list.length}</button></form> : <div className="text-slate-500 mt-1">Only the MLRO can approve deletion.</div>}
            </div>
          ) : null;
        })}
        {manual.length > 0 && <div className="text-slate-500">{manual.map((m) => <div key={m}>• {m}</div>)}</div>}
      </div>
    </div>
  );
}
