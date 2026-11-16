import { getDb } from '@/server/db';
import { getActiveLang, requireStaffUser } from '@/server/auth/request';
import { formatAed, tr } from '@/lib/format';
import { OsBanner } from '@/components/os-banner';
import { computeConveyancingPack, generateFormFSpecialConditions } from '@/server/engines/conveyancing-engine';

export default async function ConveyancingPage({
  searchParams,
}: {
  searchParams: Promise<{ dealId?: string; perDiemDays?: string; notice?: string; error?: string }>;
}) {
  const user = await requireStaffUser();
  const lang = await getActiveLang(user);
  const sp = await searchParams;
  const db = getDb();

  const deals = db
    .prepare(
      `SELECT d.id, d.deal_ref, d.purchase_price_fils, d.target_loan_fils, d.transaction_type, h.primary_name
       FROM deals d JOIN households h ON h.id = d.household_id
       WHERE d.origin_mode = 'LIVE' ORDER BY d.id ASC`,
    )
    .all() as Record<string, unknown>[];

  const dealId = sp.dealId ? Number(sp.dealId) : Number(deals[0]?.id || 1);
  const deal = (deals.find((d) => Number(d.id) === dealId) ?? deals[0]) as Record<string, unknown>;
  const conv = (db.prepare('SELECT * FROM conveyancing_cases WHERE deal_id = ?').get(dealId) ?? {}) as Record<string, unknown>;

  const bufferDays = Number(sp.perDiemDays || 2);
  const pack = computeConveyancingPack(db, dealId, bufferDays);

  const ltvPct = Math.round((Number(deal.target_loan_fils) * 100) / Math.max(1, Number(deal.purchase_price_fils)));
  const clauses = generateFormFSpecialConditions({
    minValuationFils: Number(deal.purchase_price_fils),
    ltvPct,
    folDays: 21,
    contractValidityDays: 45,
    sellerHasMortgage: Number(conv.seller_has_mortgage || 0) === 1,
    sellerBankName: String(conv.seller_bank_name || ''),
  });

  return (
    <div className="space-y-6">
      <OsBanner notice={sp.notice} error={sp.error} />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-[#8A6518]">
            {tr(lang, 'Module 04 · RERA Conveyancing, Valuation Rescue & 72h Cheque Splitter', 'الوحدة 04 · نقل الملكية وعقد إف وتقسيم شيكات أمين التسجيل')}
          </div>
          <h1 className="font-display text-2xl font-bold text-[#021125] mt-1">
            {pack.dealRef} — {String(deal.primary_name)} · DLD Trustee Settlement Desk
          </h1>
        </div>

        <div className="flex flex-wrap gap-2">
          {deals.map((d) => (
            <a
              key={String(d.id)}
              href={`/os/conveyancing?dealId=${String(d.id)}`}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold border ${
                Number(d.id) === dealId ? 'bg-[#021125] text-white border-[#021125]' : 'bg-white text-slate-700 border-slate-300'
              }`}
            >
              <span className="font-num">{String(d.deal_ref)}</span> · {String(d.primary_name)}
            </a>
          ))}
        </div>
      </div>

      {/* 72-Hour DLD Trustee Manager's Cheque Exact Fils Breakdown */}
      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 bw-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-bold text-base text-[#021125]">
              72-Hour DLD Registration Trustee Manager&apos;s Cheque Splitter
            </h2>
            <span className="bw-badge bg-amber-100 text-[#8A6518]">Exact Integer Fils</span>
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            <div className="py-2 flex justify-between">
              <span className="text-slate-600">1. Seller Mortgagee Bank Payoff ({bufferDays}d per-diem buffer)</span>
              <span className="font-num font-semibold text-[#021125]">{formatAed(pack.cheques.sellerBankPayoffFils)}</span>
            </div>
            <div className="py-2 flex justify-between">
              <span className="text-slate-600">2. Seller Net Proceeds Manager&apos;s Cheque</span>
              <span className="font-num font-semibold text-[#021125]">{formatAed(pack.cheques.sellerNetFils)}</span>
            </div>
            <div className="py-2 flex justify-between">
              <span className="text-slate-600">3. Dubai Land Department Transfer (4% + AED 580 / Handover AED 580)</span>
              <span className="font-num font-semibold text-[#021125]">{formatAed(pack.cheques.dldTransferFils)}</span>
            </div>
            <div className="py-2 flex justify-between">
              <span className="text-slate-600">4. DLD Mortgage Registration (0.25% of Loan + AED 290)</span>
              <span className="font-num font-semibold text-[#021125]">{formatAed(pack.cheques.mortgageRegFils)}</span>
            </div>
            <div className="py-2 flex justify-between">
              <span className="text-slate-600">5. DLD Registration Trustee Fee (incl. VAT)</span>
              <span className="font-num font-semibold text-[#021125]">{formatAed(pack.cheques.trusteeFeeFils)}</span>
            </div>
            <div className="py-2 flex justify-between">
              <span className="text-slate-600">6. RERA Brokerage Commission Cheque (2% + 5% VAT)</span>
              <span className="font-num font-semibold text-[#021125]">{formatAed(pack.cheques.agencyFeeInclVatFils)}</span>
            </div>
            <div className="py-3 flex justify-between bg-slate-50 px-2 rounded font-bold text-sm text-[#021125]">
              <span>Total Settlement Table Outflow</span>
              <span className="font-num">{formatAed(pack.cheques.totalManagerChequesFils)}</span>
            </div>
            <div className="py-2.5 flex justify-between text-emerald-900 font-semibold">
              <span>Less: Buyer Bank Mortgage Disbursal</span>
              <span className="font-num">- {formatAed(pack.loanFils)}</span>
            </div>
            <div className="py-2.5 flex justify-between text-[#8A6518] font-bold text-sm">
              <span>Net Buyer Own Manager&apos;s Cheques Required at Trustee</span>
              <span className="font-num">{formatAed(pack.cheques.buyerOwnFundsRequiredFils)}</span>
            </div>
          </div>

          {pack.valuationShortfall.hasShortfall && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-950 space-y-1">
              <div className="font-bold">
                ⚠ Down-Valuation Alert: Panel Valuation ({formatAed(pack.valuationShortfall.valuationAmountFils)}) is below Contract F Price by {formatAed(pack.valuationShortfall.shortfallVsPriceFils)}
              </div>
              <div>
                Reduced Max Bank Loan: <strong className="font-num">{formatAed(pack.valuationShortfall.reducedMaxLoanAt80LtvFils)}</strong> ·
                Buyer Cash Bridge Needed (if unappealed): <strong className="font-num">{formatAed(pack.valuationShortfall.buyerCashBridgeFils)}</strong>
              </div>
            </div>
          )}
        </div>

        {/* Conveyancing Case Editor */}
        <div className="lg:col-span-6 bw-card p-5 space-y-3">
          <h2 className="font-display font-bold text-base text-[#021125]">
            Update Contract F, Seller Liability Letter, Valuation & NOC Milestones
          </h2>
          <form method="POST" action="/api/v1/actions" className="grid grid-cols-2 gap-2.5 text-xs">
            <input type="hidden" name="action" value="update_conveyancing" />
            <input type="hidden" name="dealId" value={dealId} />
            <input type="hidden" name="returnTo" value={`/os/conveyancing?dealId=${dealId}`} />

            <div>
              <label className="block font-semibold mb-1">Form F Expiry Date</label>
              <input type="date" name="formFExpiryDate" defaultValue={String(conv.form_f_expiry_date || '2026-12-20')} className="bw-input font-num" />
            </div>
            <div>
              <label className="block font-semibold mb-1">FOL Contingency Deadline</label>
              <input type="date" name="folContingencyDate" defaultValue={String(conv.fol_contingency_date || '2026-11-26')} className="bw-input font-num" />
            </div>
            <div>
              <label className="block font-semibold mb-1">10% Security Cheque No.</label>
              <input name="depositChequeNo" defaultValue={String(conv.deposit_cheque_no || 'CHQ-884120')} className="bw-input font-num" />
            </div>
            <div>
              <label className="block font-semibold mb-1">10% Security Cheque (AED)</label>
              <input name="depositChequeAed" type="number" defaultValue={Number(conv.deposit_cheque_fils || 0) / 100} className="bw-input font-num" />
            </div>
            <div>
              <label className="block font-semibold mb-1">Seller Mortgaged?</label>
              <select name="sellerHasMortgage" defaultValue={String(conv.seller_has_mortgage ?? 0)} className="bw-input">
                <option value="1">Yes — Liability Letter Required</option>
                <option value="0">No — Unencumbered Title</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">Seller Bank Name</label>
              <input name="sellerBankName" defaultValue={String(conv.seller_bank_name || '')} className="bw-input" />
            </div>
            <div>
              <label className="block font-semibold mb-1">Seller Payoff Amount (AED)</label>
              <input name="liabilityPayoffAed" type="number" defaultValue={Number(conv.liability_letter_payoff_fils || 0) / 100} className="bw-input font-num" />
            </div>
            <div>
              <label className="block font-semibold mb-1">Daily Per-Diem Interest (AED)</label>
              <input name="liabilityPerDiemAed" type="number" defaultValue={Number(conv.liability_per_diem_fils || 0) / 100} className="bw-input font-num" />
            </div>
            <div>
              <label className="block font-semibold mb-1">Bank Valuation Received (AED)</label>
              <input
                name="valuationAmountAed"
                type="number"
                defaultValue={Number(conv.valuation_amount_fils || deal.purchase_price_fils) / 100}
                className="bw-input font-num"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Shortfall Rescue Strategy</label>
              <select name="valuationShortfallAction" defaultValue={String(conv.valuation_shortfall_action || 'NONE')} className="bw-input">
                <option value="NONE">Valuation Met Price</option>
                <option value="APPEAL_FILED">3-Comp Valuation Appeal Filed</option>
                <option value="SWITCHED_BACKUP_BANK">Switched to Backup Bank Panel</option>
                <option value="PRICE_RENEGOTIATED">Contract F Addendum Price Reduction</option>
                <option value="BUYER_TOP_UP">Buyer Cash Bridge Confirmed</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">Developer E-NOC Status</label>
              <select name="nocStatus" defaultValue={String(conv.noc_status || 'NOT_STARTED')} className="bw-input">
                <option value="NOT_STARTED">NOT_STARTED</option>
                <option value="APPLIED">APPLIED</option>
                <option value="ISSUED">ISSUED</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">DLD Trustee Office</label>
              <input name="trusteeOffice" defaultValue={String(conv.trustee_office || 'Al Manara Registration Trustee')} className="bw-input" />
            </div>

            <div className="col-span-2 pt-1">
              <button type="submit" className="bw-btn-gold w-full">
                Save Conveyancing Milestones & Recalculate Manager&apos;s Cheques
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Bilingual Contract F Special Conditions */}
      <div className="bw-card p-5 space-y-3">
        <h2 className="font-display font-bold text-base text-[#021125]">
          Auto-Generated Bilingual Dubai REST Contract F (MOU) Protective Special Conditions
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          <pre className="whitespace-pre-wrap rounded-lg bg-slate-50 border border-slate-200 p-4 text-xs text-slate-800 font-sans">
            {clauses.en}
          </pre>
          <pre dir="rtl" className="whitespace-pre-wrap rounded-lg bg-slate-50 border border-slate-200 p-4 text-xs text-slate-800 font-sans">
            {clauses.ar}
          </pre>
        </div>
      </div>
    </div>
  );
}
