import { getDb } from '@/server/db';
import { requireStaffUser } from '@/server/auth/request';
import { formatAedWhole } from '@/lib/format';
import { OsBanner } from '@/components/os-banner';
import {
  PERMITTED_UAE_PAYMENT_CHANNELS,
  computeSwk5050CommissionSplit,
  isSupremeOwner,
} from '@/server/engines/swk-enterprise-engine';

export const dynamic = 'force-dynamic';

export default async function WithdrawalsPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const user = await requireStaffUser();
  const sp = await searchParams;
  const db = getDb();

  const withdrawals = db
    .prepare(
      `SELECT w.*, d.deal_ref
       FROM deal_withdrawals w
       LEFT JOIN deals d ON d.id = w.deal_id
       ORDER BY w.id DESC`,
    )
    .all() as Array<Record<string, unknown>>;

  const deals = db
    .prepare(
      `SELECT d.id, d.deal_ref, h.primary_name AS client_name
       FROM deals d
       JOIN households h ON h.id = d.household_id
       WHERE d.origin_mode = 'LIVE'
       ORDER BY d.id ASC`,
    )
    .all() as Array<Record<string, unknown>>;

  const sampleSplit = computeSwk5050CommissionSplit({
    grossCommissionExVatFils: 4_500_000, // AED 45,000
    partnerShareBps: 2000, // 20% B2B Referral Partner Share
  });

  const supremeOwner = isSupremeOwner(user);

  return (
    <div className="space-y-6">
      <OsBanner notice={sp.notice} error={sp.error} />

      {/* Header Banner */}
      <div className="rounded-2xl bg-white text-gray-900 p-6 border border-gray-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-700">
            Step 09 · Legal UAE Escrow &amp; Refund Governance
          </div>
          <h1 className="font-display text-2xl md:text-3xl font-bold mt-1">
            Deal Withdrawals, Client Refunds &amp; 50/50 Commission Split
          </h1>
          <p className="text-xs text-gray-500 mt-1 max-w-2xl">
            Enforces <strong>Strictly Legal UAE Payment Modes</strong> (zero tolerance for personal advisor bank
            accounts), the <strong>50% Company / 50% Advisor Commission Split</strong>, and Owner-approved Deal
            Withdrawal &amp; Client Refund settlements.
          </p>
        </div>
      </div>

      {/* Strictly Legal UAE Payment Channels + 50/50 Commission Split Reference */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bw-card p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                CBUAE &amp; DLD Anti-Money Laundering Guardrail
              </span>
              <h2 className="font-display text-lg font-bold text-slate-900">
                {PERMITTED_UAE_PAYMENT_CHANNELS.length} Permitted Legal UAE Payment Channels
              </h2>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold">
              Personal Bank Accounts Strictly Blocked
            </span>
          </div>
          <div className="space-y-2 text-xs">
            {PERMITTED_UAE_PAYMENT_CHANNELS.map((ch, idx) => (
              <div
                key={ch}
                className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50 border border-slate-200/80"
              >
                <div>
                  <span className="font-num font-bold text-slate-700 mr-2">0{idx + 1}</span>
                  <span className="font-bold text-slate-900">{ch}</span>
                </div>
                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                  LEGAL UAE CHANNEL
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 50-50% Commission Split Formula Card */}
        <div className="bw-card p-5 space-y-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700">
              Betterway Mortgages &amp; SWK Standard Split
            </span>
            <h2 className="font-display text-lg font-bold text-slate-900">
              50% Company / 50% Advisor Commission Policy
            </h2>
            <p className="text-xs text-slate-600 mt-1">
              When a third-party B2B / A2A introducer is involved, their agreed referral share is deducted first from
              Gross Bank Subvention. The remaining net pool is split <strong>50% to Betterway Mortgages</strong> and{' '}
              <strong>50% to the closing Mortgage Advisor</strong>.
            </p>
          </div>

          <div className="p-4 rounded-[6px] bg-[#021125] text-white border border-[#3a2326] space-y-2 text-xs">
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#c9a257]">
              Live Split Illustration (AED 45,000 Gross Subvention · 20% B2B Partner)
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="p-2.5 rounded-lg bg-white/5">
                <div className="text-slate-400 text-[10px]">Gross Bank Subvention</div>
                <div className="font-num font-bold text-sm">
                  {formatAedWhole(sampleSplit.grossCommissionExVatFils)}
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-white/5">
                <div className="text-slate-400 text-[10px]">Less: External B2B Partner (20%)</div>
                <div className="font-num font-bold text-sm text-amber-300">
                  - {formatAedWhole(sampleSplit.partnerShareFils)}
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-emerald-500/15 border border-emerald-400/30">
                <div className="text-emerald-200 text-[10px]">Betterway 50% Retention</div>
                <div className="font-num font-bold text-sm text-emerald-300">
                  {formatAedWhole(sampleSplit.company50ShareFils)}
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-[#c9a257]/20 border border-slate-300">
                <div className="text-slate-300 text-[10px]">Advisor 50% Payout</div>
                <div className="font-num font-bold text-sm text-slate-300">
                  {formatAedWhole(sampleSplit.advisor50ShareFils)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Create Deal Withdrawal + Owner Approval Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bw-card p-5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700">
            Controlled Refund Workflow
          </span>
          <h2 className="font-display text-lg font-bold text-slate-900 mt-0.5 mb-3">
            Log Deal Withdrawal / Client Refund
          </h2>
          <form method="POST" action="/api/v1/actions" className="space-y-3 text-xs">
            <input type="hidden" name="action" value="create_deal_withdrawal" />
            <input type="hidden" name="returnTo" value="/os/withdrawals" />
            <label className="block">
              <span className="font-semibold text-slate-700">Mortgage Deal File</span>
              <select name="dealId" className="bw-input mt-1 w-full">
                {deals.map((d) => (
                  <option key={String(d.id)} value={String(d.id)}>
                    {String(d.deal_ref)} — {String(d.client_name)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="font-semibold text-slate-700">Department</span>
              <select name="department" className="bw-input mt-1 w-full">
                <option value="READY_SECONDARY">01 · Ready Property &amp; Secondary Transfer</option>
                <option value="OFFPLAN_HANDOVER">02 · Off-Plan &amp; Handover Financing</option>
                <option value="BUYOUT_COMMERCIAL">03 · Buyout, Equity &amp; Commercial</option>
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <label className="block">
                <span className="font-semibold text-slate-700">Collected Fee (AED)</span>
                <input type="number" name="collectedFeeAed" defaultValue={5250} className="bw-input mt-1 w-full" />
              </label>
              <label className="block">
                <span className="font-semibold text-slate-700">Incurred Cost (AED)</span>
                <input type="number" name="incurredCostAed" defaultValue={2100} className="bw-input mt-1 w-full" />
              </label>
            </div>
            <label className="block">
              <span className="font-semibold text-slate-700">Legal UAE Refund Channel</span>
              <select name="paymentChannel" className="bw-input mt-1 w-full">
                {PERMITTED_UAE_PAYMENT_CHANNELS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="font-semibold text-slate-700">Reason for Deal Withdrawal / Refund</span>
              <textarea
                name="withdrawalReason"
                rows={3}
                required
                placeholder="e.g. Property valuation came in 12% below MOU price; client exercising clause..."
                className="bw-input mt-1 w-full"
              />
            </label>
            <button type="submit" className="bw-btn-gold w-full justify-center">
              Submit Withdrawal for Owner Approval
            </button>
          </form>
        </div>

        <div className="lg:col-span-2 bw-card p-5">
          <h2 className="font-display text-lg font-bold text-slate-900 mb-3">
            Deal Withdrawal &amp; Client Refund Requests ({withdrawals.length})
          </h2>
          {withdrawals.length === 0 ? (
            <div className="p-6 rounded-xl bg-gray-50 border border-slate-200/80 text-xs text-slate-600">
              No deal withdrawals or client refunds currently pending. Use the form on the left to log a withdrawal
              request for Owner Shabib Siraj&apos;s approval.
            </div>
          ) : (
            <div className="space-y-3">
              {withdrawals.map((w) => (
                <div key={String(w.id)} className="p-4 rounded-xl bg-gray-50 border border-slate-200/80 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-num font-bold text-xs text-slate-700 mr-2">
                        {String(w.withdrawal_ref)} ({String(w.deal_ref || `Deal #${w.deal_id}`)})
                      </span>
                      <span className="font-bold text-slate-900 text-sm">{String(w.client_name)}</span>
                    </div>
                    <span className="font-num font-bold text-xs text-slate-900">
                      Refundable: {formatAedWhole(Number(w.refundable_fils))} · {String(w.status)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">
                    <strong>Reason:</strong> {String(w.withdrawal_reason)} · Channel:{' '}
                    <code>{String(w.payment_channel)}</code>
                  </p>
                  {w.status === 'PENDING_OWNER' && supremeOwner && (
                    <form
                      method="POST"
                      action="/api/v1/actions"
                      className="pt-2 border-t border-slate-200/70 flex flex-wrap items-center gap-2 text-xs"
                    >
                      <input type="hidden" name="action" value="decide_deal_withdrawal" />
                      <input type="hidden" name="withdrawalId" value={String(w.id)} />
                      <input type="hidden" name="returnTo" value="/os/withdrawals" />
                      <input
                        type="text"
                        name="ownerNotes"
                        defaultValue="Approved via Corporate Bank IBAN transfer by Shabib Siraj"
                        className="bw-input flex-1"
                      />
                      <button
                        type="submit"
                        name="decision"
                        value="APPROVED_REFUNDED"
                        className="px-3 py-1.5 rounded-lg bg-emerald-700 text-white font-bold cursor-pointer"
                      >
                        Approve &amp; Settle Refund
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
          )}
        </div>
      </div>
    </div>
  );
}
