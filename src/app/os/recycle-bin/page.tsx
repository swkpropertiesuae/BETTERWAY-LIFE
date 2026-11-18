import Link from 'next/link';
import { getDb } from '@/server/db';
import { requireStaffUser } from '@/server/auth/request';
import { formatAedWhole } from '@/lib/format';
import { OsBanner } from '@/components/os-banner';
import { canAccessAdminGovernance, isSupremeOwner } from '@/server/engines/swk-enterprise-engine';

export const dynamic = 'force-dynamic';

export default async function RecycleBinPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; notice?: string; error?: string }>;
}) {
  const user = await requireStaffUser();
  const sp = await searchParams;
  const activeTab = sp.tab || 'bin';
  const db = getDb();

  const binRequests = db
    .prepare('SELECT * FROM recycle_bin_requests ORDER BY id DESC')
    .all() as Array<Record<string, unknown>>;

  const managerDecisions = db
    .prepare('SELECT * FROM manager_admin_decisions ORDER BY id DESC')
    .all() as Array<Record<string, unknown>>;

  const adminUser = db
    .prepare("SELECT id, email, full_name_en, role, status, created_at FROM users WHERE email = 'admin@betterwaymortgages.com'")
    .get() as Record<string, unknown> | undefined;

  const pendingDeleteCount = binRequests.filter((b) => b.status === 'PENDING').length;
  const restoredCount = binRequests.filter((b) => b.status === 'REJECTED_RESTORED').length;
  const deletedCount = binRequests.filter((b) => b.status === 'APPROVED_DELETED').length;
  const pendingDecisionCount = managerDecisions.filter((d) => d.status === 'PENDING').length;

  const canDecide = canAccessAdminGovernance(user);
  const supremeOwner = isSupremeOwner(user);

  return (
    <div className="space-y-6">
      <OsBanner notice={sp.notice} error={sp.error} />

      {/* Header Banner */}
      <div className="rounded-2xl bg-white text-gray-900 p-6 border border-gray-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-700">
            Step 09 · Zero-Delete Safeguard &amp; Tier-1 Owner Governance
          </div>
          <h1 className="font-display text-2xl md:text-3xl font-bold mt-1">
            Pending Delete Bin &amp; Owner Approvals
          </h1>
          <p className="text-xs text-gray-500 mt-1 max-w-2xl">
            Every record deletion across Betterway Mortgages OS is intercepted into this Recycle Bin. Only Supreme
            Owner <strong>Shabib Siraj</strong> (<code>shabib@betterwaymortgages.com</code>) can permanently purge or
            restore records, approve Manager Admin Decisions, and supervise the Tier-2 Admin account (
            <code>admin@betterwaymortgages.com</code>).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-lg bg-[#c9a257]/20 border border-slate-300 text-xs font-bold text-slate-300">
            {supremeOwner
              ? 'Supreme Owner Mode (Shabib Siraj)'
              : canDecide
              ? 'Tier-2 Admin Governance'
              : 'Staff Submit-Only Mode'}
          </span>
        </div>
      </div>

      {/* 4 KPI Cards (Matches swkpropertiesOS hb-05-delete-bin.png) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bw-card p-4 border-amber-200">
          <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
            Pending Owner Deletion Approval
          </div>
          <div className="font-display text-2xl font-bold text-slate-900 mt-1">{pendingDeleteCount}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Frozen in bin awaiting Shabib Siraj</div>
        </div>
        <div className="bw-card p-4 border-emerald-200">
          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
            Rejected &amp; Restored Records
          </div>
          <div className="font-display text-2xl font-bold text-slate-900 mt-1">{restoredCount}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Protected from accidental loss</div>
        </div>
        <div className="bw-card p-4 border-rose-200">
          <div className="text-[10px] font-bold uppercase tracking-wider text-rose-700">
            Approved &amp; Deleted by Owner
          </div>
          <div className="font-display text-2xl font-bold text-slate-900 mt-1">{deletedCount}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Permanently purged with audit trail</div>
        </div>
        <div className="bw-card p-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-700">
            Pending Manager Admin Decisions
          </div>
          <div className="font-display text-2xl font-bold text-slate-900 mt-1">{pendingDecisionCount}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Submitted by Operations / BDM</div>
        </div>
      </div>

      {/* 3 Segmented Tabs */}
      <div className="flex flex-wrap items-center gap-2 bg-white p-2 rounded-xl border border-slate-200/90 shadow-sm">
        {[
          { id: 'bin', label: `Pending Delete Bin (${binRequests.length})` },
          { id: 'decisions', label: `Manager Admin Decisions (${managerDecisions.length})` },
          { id: 'admin_control', label: 'Owner Supervisory Control over Admin Account' },
        ].map((t) => (
          <Link
            key={t.id}
            href={`/os/recycle-bin?tab=${t.id}`}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition ${
              activeTab === t.id
                ? 'bg-slate-900 text-white border border-slate-300'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* TAB 1: Pending Delete Bin */}
      {activeTab === 'bin' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bw-card p-5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700">
              Zero-Direct-Delete Policy
            </span>
            <h2 className="font-display text-lg font-bold text-slate-900 mt-0.5 mb-3">
              Request Record Deletion to Bin
            </h2>
            <form method="POST" action="/api/v1/actions" className="space-y-3 text-xs">
              <input type="hidden" name="action" value="queue_delete_to_bin" />
              <input type="hidden" name="returnTo" value="/os/recycle-bin?tab=bin" />
              <label className="block">
                <span className="font-semibold text-slate-700">Entity Type</span>
                <select name="entityType" className="bw-input mt-1 w-full">
                  <option value="leads">Lead Record</option>
                  <option value="deals">Mortgage Deal File</option>
                  <option value="commission_settlements">Commission Settlement</option>
                  <option value="vault_documents">Vault Document</option>
                </select>
              </label>
              <label className="block">
                <span className="font-semibold text-slate-700">Record ID</span>
                <input type="text" name="entityId" defaultValue="3" className="bw-input mt-1 w-full" />
              </label>
              <label className="block">
                <span className="font-semibold text-slate-700">Record Title &amp; Client Name</span>
                <input
                  type="text"
                  name="recordTitle"
                  required
                  placeholder="e.g. Lead #3 — Duplicate Portal Inquiry"
                  className="bw-input mt-1 w-full"
                />
              </label>
              <label className="block">
                <span className="font-semibold text-slate-700">Mandatory Deletion Reason (Min 5 chars)</span>
                <textarea
                  name="deleteReason"
                  rows={3}
                  required
                  placeholder="Explain why this record should be removed for Owner Shabib Siraj..."
                  className="bw-input mt-1 w-full"
                />
              </label>
              <button type="submit" className="bw-btn-gold w-full justify-center">
                Send to Pending Delete Bin
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 bw-card p-5">
            <h2 className="font-display text-lg font-bold text-slate-900 mb-3">
              Recycle Bin Queue ({binRequests.length})
            </h2>
            <div className="space-y-3">
              {binRequests.map((req) => (
                <div key={String(req.id)} className="p-4 rounded-xl bg-gray-50 border border-slate-200/80 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-800 text-[10px] font-bold mr-2">
                        {String(req.entity_type)} #{String(req.entity_id)}
                      </span>
                      <span className="font-bold text-slate-900 text-sm">{String(req.record_title)}</span>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        req.status === 'PENDING'
                          ? 'bg-amber-100 text-amber-800'
                          : req.status === 'REJECTED_RESTORED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {String(req.status)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">
                    <strong>Reason:</strong> {String(req.delete_reason)} · Requested by{' '}
                    <strong>{String(req.requested_by_name)}</strong>
                  </p>
                  {req.status === 'PENDING' && supremeOwner && (
                    <form
                      method="POST"
                      action="/api/v1/actions"
                      className="pt-2 border-t border-slate-200/70 flex flex-wrap items-center gap-2 text-xs"
                    >
                      <input type="hidden" name="action" value="decide_recycle_bin" />
                      <input type="hidden" name="binId" value={String(req.id)} />
                      <input type="hidden" name="returnTo" value="/os/recycle-bin?tab=bin" />
                      <input
                        type="text"
                        name="ownerNotes"
                        defaultValue="Reviewed by Owner Shabib Siraj"
                        className="bw-input flex-1"
                      />
                      <button
                        type="submit"
                        name="decision"
                        value="REJECTED_RESTORED"
                        className="px-3 py-1.5 rounded-lg bg-emerald-700 text-white font-bold cursor-pointer"
                      >
                        Reject &amp; Restore
                      </button>
                      <button
                        type="submit"
                        name="decision"
                        value="APPROVED_DELETED"
                        className="px-3 py-1.5 rounded-lg bg-rose-700 text-white font-bold cursor-pointer"
                      >
                        Approve Permanent Delete
                      </button>
                    </form>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Manager Admin Decisions */}
      {activeTab === 'decisions' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bw-card p-5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700">
              Operations Manager → Owner Queue
            </span>
            <h2 className="font-display text-lg font-bold text-slate-900 mt-0.5 mb-3">
              Submit Manager Admin Decision
            </h2>
            <form method="POST" action="/api/v1/actions" className="space-y-3 text-xs">
              <input type="hidden" name="action" value="submit_manager_decision" />
              <input type="hidden" name="returnTo" value="/os/recycle-bin?tab=decisions" />
              <label className="block">
                <span className="font-semibold text-slate-700">Decision Category</span>
                <select name="category" className="bw-input mt-1 w-full">
                  <option value="Bank Subvention & 50/50 Split Release">Bank Subvention &amp; 50/50 Split Release</option>
                  <option value="Final DLD Trustee Handover Clearance">Final DLD Trustee Handover Clearance</option>
                  <option value="Operational Policy / Budget Decision">Operational Policy / Budget Decision</option>
                  <option value="Bank Rate / Fee Exception">Bank Rate / Fee Exception</option>
                </select>
              </label>
              <label className="block">
                <span className="font-semibold text-slate-700">Decision Subject</span>
                <input
                  type="text"
                  name="subject"
                  required
                  placeholder="e.g. Approve 50/50 Advisor Split on BW-2026-0001"
                  className="bw-input mt-1 w-full"
                />
              </label>
              <label className="block">
                <span className="font-semibold text-slate-700">Amount (AED)</span>
                <input type="number" name="amountAed" defaultValue={22500} className="bw-input mt-1 w-full" />
              </label>
              <label className="block">
                <span className="font-semibold text-slate-700">Detailed Justification</span>
                <textarea
                  name="reason"
                  rows={3}
                  required
                  placeholder="Provide bank bordereau reference, FOL status, and calculation..."
                  className="bw-input mt-1 w-full"
                />
              </label>
              <button type="submit" className="bw-btn-gold w-full justify-center">
                Submit for Owner Shabib Siraj Approval
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 bw-card p-5">
            <h2 className="font-display text-lg font-bold text-slate-900 mb-3">
              Manager Admin Decisions Awaiting Owner ({managerDecisions.length})
            </h2>
            <div className="space-y-3">
              {managerDecisions.map((d) => (
                <div key={String(d.id)} className="p-4 rounded-xl bg-gray-50 border border-slate-200/80 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="px-2 py-0.5 rounded bg-slate-900 text-white text-[10px] font-bold mr-2">
                        {String(d.decision_ref)} · {String(d.category)}
                      </span>
                      <span className="font-bold text-slate-900 text-sm">{String(d.subject)}</span>
                    </div>
                    <span className="font-num font-bold text-slate-900 text-xs">
                      {formatAedWhole(Number(d.amount_fils))} · {String(d.status)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">
                    {String(d.reason)} — Submitted by <strong>{String(d.submitted_by_name)}</strong>
                  </p>
                  {d.status === 'PENDING' && supremeOwner && (
                    <form
                      method="POST"
                      action="/api/v1/actions"
                      className="pt-2 border-t border-slate-200/70 flex flex-wrap items-center gap-2 text-xs"
                    >
                      <input type="hidden" name="action" value="decide_manager_decision" />
                      <input type="hidden" name="decisionId" value={String(d.id)} />
                      <input type="hidden" name="returnTo" value="/os/recycle-bin?tab=decisions" />
                      <input
                        type="text"
                        name="ownerComment"
                        defaultValue="Approved by Owner Shabib Siraj"
                        className="bw-input flex-1"
                      />
                      <button
                        type="submit"
                        name="decision"
                        value="APPROVED"
                        className="px-3 py-1.5 rounded-lg bg-emerald-700 text-white font-bold cursor-pointer"
                      >
                        Approve Decision
                      </button>
                      <button
                        type="submit"
                        name="decision"
                        value="REJECTED"
                        className="px-3 py-1.5 rounded-lg bg-rose-700 text-white font-bold cursor-pointer"
                      >
                        Reject
                      </button>
                    </form>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Supreme Owner Supervisory Control over Admin Account */}
      {activeTab === 'admin_control' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bw-card p-5 space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700">
              Tier-1 Supreme Owner Authority
            </span>
            <h2 className="font-display text-lg font-bold text-slate-900">
              Tier-2 Admin Account Status (<code>admin@betterwaymortgages.com</code>)
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              In accordance with the <strong>swkpropertiesOS</strong> governance model,{' '}
              <code>shabib@betterwaymortgages.com</code> is the Tier-1 Supreme Owner and holds full supervisory control
              over the Tier-2 System Admin account <code>admin@betterwaymortgages.com</code>. The Admin account can
              never modify or suspend the Supreme Owner.
            </p>
            {adminUser && (
              <div className="p-4 rounded-xl bg-gray-50 border border-slate-200 space-y-1.5 text-xs">
                <div>
                  <strong>Account Name:</strong> {String(adminUser.full_name_en)}
                </div>
                <div>
                  <strong>Email:</strong> <code>{String(adminUser.email)}</code>
                </div>
                <div>
                  <strong>Status:</strong>{' '}
                  <span
                    className={`px-2 py-0.5 rounded font-bold ${
                      String(adminUser.status) === 'ACTIVE'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {String(adminUser.status)}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="bw-card p-5">
            <h2 className="font-display text-lg font-bold text-slate-900 mb-3">
              Execute Supervisory Action on <code>admin@betterwaymortgages.com</code>
            </h2>
            <form method="POST" action="/api/v1/actions" className="space-y-3 text-xs">
              <input type="hidden" name="action" value="owner_admin_control" />
              <input type="hidden" name="returnTo" value="/os/recycle-bin?tab=admin_control" />
              <label className="block">
                <span className="font-semibold text-slate-700">Supervisory Action</span>
                <select name="controlAction" className="bw-input mt-1 w-full">
                  <option value="activate">Activate / Unlock Admin Account</option>
                  <option value="suspend">Suspend Admin Account Immediately</option>
                  <option value="force_signout">Force Sign-Out All Admin Sessions</option>
                  <option value="reset_password">Reset Admin Password</option>
                </select>
              </label>
              <label className="block">
                <span className="font-semibold text-slate-700">Owner Supervisory Note</span>
                <input
                  type="text"
                  name="notes"
                  defaultValue="Executed by Supreme Owner Shabib Siraj"
                  className="bw-input mt-1 w-full"
                />
              </label>
              <button type="submit" className="bw-btn-gold w-full justify-center">
                Execute Supreme Owner Control Action
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
