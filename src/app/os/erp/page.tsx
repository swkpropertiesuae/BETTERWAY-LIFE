import { getDb } from '@/server/db';
import { getActiveLang, requireStaffUser } from '@/server/auth/request';
import { formatAed, formatBps, tr } from '@/lib/format';
import { PageHeader } from '@/components/page-header';
import { OsBanner } from '@/components/os-banner';
import { computeCorporateTaxSummary, computeVat201Summary, getTrialBalance } from '@/server/engines/ledger-tax-engine';

export default async function ErpFinancePage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const user = await requireStaffUser();
  const lang = await getActiveLang(user);
  const sp = await searchParams;
  const db = getDb();

  const tb = getTrialBalance(db);
  const totalDebit = tb.reduce((s, r) => s + r.total_debit_fils, 0);
  const totalCredit = tb.reduce((s, r) => s + r.total_credit_fils, 0);

  const vat = computeVat201Summary(db);
  const ct = computeCorporateTaxSummary(db);

  const deals = db
    .prepare(
      `SELECT d.id, d.deal_ref, d.target_loan_fils, d.stage, h.primary_name
       FROM deals d JOIN households h ON h.id = d.household_id
       ORDER BY d.id DESC`,
    )
    .all() as { id: number; deal_ref: string; target_loan_fils: number; stage: string; primary_name: string }[];

  const settlements = db
    .prepare(
      `SELECT cs.*, d.deal_ref, d.origin_mode, b.short_name as bank_short, ag.company_name as partner_name
       FROM commission_settlements cs
       JOIN deals d ON d.id = cs.deal_id
       JOIN banks b ON b.id = cs.bank_id
       LEFT JOIN partner_agencies ag ON ag.id = cs.partner_agency_id
       ORDER BY cs.id DESC`,
    )
    .all() as Record<string, unknown>[];

  const partnerAgencies = db.prepare('SELECT * FROM partner_agencies ORDER BY id DESC').all() as Record<string, unknown>[];
  const invoices = db.prepare('SELECT * FROM tax_invoices ORDER BY id DESC').all() as Record<string, unknown>[];

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <OsBanner notice={sp.notice} error={sp.error} />

      <PageHeader app="Accounting" appHref="/os/erp" title="Ledger & Commissions" sub={tr(lang, 'Brokerage Treasury, Subvention Bordereau, FTA VAT 201 / 9% CT & Peppol PINT-AE', 'الخزينة، تسوية البنوك، ضريبة القيمة المضافة والشركات وفواتير PINT-AE')} />

      {/* FTA VAT 201 + 9% Corporate Tax Summary Cards */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bw-card p-5 space-y-2.5 text-xs">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-bold text-base text-[#021125]">FTA Form VAT 201 Return Summary</h2>
            <span className="bw-badge bg-emerald-100 text-emerald-900">Partial-Exemption Aware</span>
          </div>
          <div className="flex justify-between"><span>Standard-Rated Supplies (5%)</span><span className="font-num font-semibold">{formatAed(vat.standardRatedSuppliesFils)}</span></div>
          <div className="flex justify-between"><span>Zero-Rated / Exempt Supplies</span><span className="font-num">{formatAed(vat.zeroRatedSuppliesFils + vat.exemptSuppliesFils)}</span></div>
          <div className="flex justify-between"><span>Residual Input VAT Recovery Ratio</span><span className="font-num font-semibold">{vat.taxableRecoveryRatioPct}%</span></div>
          <div className="flex justify-between"><span>Output VAT Collected (5%)</span><span className="font-num font-semibold">{formatAed(vat.outputVatFils)}</span></div>
          <div className="flex justify-between"><span>Recoverable Input VAT (Partner + Overhead)</span><span className="font-num text-emerald-700">- {formatAed(vat.recoverableInputVatFils)}</span></div>
          <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-sm text-[#021125]">
            <span>Net FTA VAT Payable / (Refundable)</span>
            <span className="font-num">{formatAed(vat.netVatPayableFils)}</span>
          </div>
        </div>

        <div className="bw-card p-5 space-y-2.5 text-xs">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-bold text-base text-[#021125]">UAE 9% Corporate Tax Provision</h2>
            <span className="bw-badge bg-amber-100 text-[#8A6518]">AED 375,000 0% Bracket</span>
          </div>
          <div className="flex justify-between"><span>Recognized Brokerage Revenue</span><span className="font-num font-semibold">{formatAed(ct.totalRevenueFils)}</span></div>
          <div className="flex justify-between"><span>Operating & Commission Expenses</span><span className="font-num">- {formatAed(ct.totalExpenseFils)}</span></div>
          <div className="flex justify-between"><span>Non-Deductible Add-Backs (50% Ent. / Fines)</span><span className="font-num">+ {formatAed(ct.nonDeductibleAddBacksFils)}</span></div>
          <div className="flex justify-between"><span>FTA Taxable Income</span><span className="font-num font-semibold">{formatAed(ct.taxableIncomeFils)}</span></div>
          <div className="flex justify-between"><span>Subject to 9% Above AED 375,000</span><span className="font-num">{formatAed(ct.subjectTo9PctFils)}</span></div>
          <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-sm text-[#021125]">
            <span>Estimated 9% Corporate Tax Payable</span>
            <span className="font-num">{formatAed(ct.corporateTaxPayableFils)}</span>
          </div>
        </div>
      </div>

      {/* Disbursal -> Bordereau Pay-When-Paid -> Clawback Controls */}
      <div className="grid lg:grid-cols-3 gap-6">
        <form method="POST" action="/api/v1/actions" className="bw-card p-5 space-y-3 text-xs">
          <input type="hidden" name="action" value="record_disbursal" />
          <input type="hidden" name="returnTo" value="/os/erp" />
          <h3 className="font-display font-bold text-sm text-[#021125]">1. Record Bank Loan Disbursal</h3>
          <p className="text-slate-500">Books Bank Subvention Receivable (`GL 1200`) + 10% House Clawback Reserve (`GL 2200`). Partner & Advisor stay unpaid until bank cash arrives.</p>
          <select name="dealId" className="bw-input">
            {deals.map((d) => (
              <option key={d.id} value={d.id}>{d.deal_ref} — {d.primary_name}</option>
            ))}
          </select>
          <input name="disbursedLoanAed" type="number" defaultValue={2800000} placeholder="Disbursed Loan AED" className="bw-input font-num" />
          <div className="grid grid-cols-2 gap-2">
            <input type="date" name="disbursedDate" defaultValue="2026-11-16" className="bw-input font-num" />
            <input type="date" name="fixedExpiryDate" defaultValue="2028-11-16" className="bw-input font-num" />
          </div>
          <button type="submit" className="bw-btn-gold w-full">Post Disbursal & Reserve</button>
        </form>

        <form method="POST" action="/api/v1/actions" className="bw-card p-5 space-y-3 text-xs">
          <input type="hidden" name="action" value="record_bordereau_cash" />
          <input type="hidden" name="returnTo" value="/os/erp" />
          <h3 className="font-display font-bold text-sm text-[#021125]">2. Receive Bank Bordereau Cash</h3>
          <p className="text-slate-500">Pay-when-paid waterfall: releases Partner split (strictly on Bank Subvention) & Advisor commission pro-rata on received cash.</p>
          <select name="dealId" className="bw-input">
            {deals.map((d) => (
              <option key={d.id} value={d.id}>{d.deal_ref} — {d.primary_name}</option>
            ))}
          </select>
          <input name="receivedSubventionExVatAed" type="number" step="0.01" defaultValue={21000} placeholder="Bank Cash Received Ex-VAT (AED)" className="bw-input font-num" />
          <input name="batchRef" defaultValue="BORD-HSBC-NOV26" placeholder="Bordereau Batch Ref" className="bw-input font-num" />
          <button type="submit" className="bw-btn-navy w-full">Reconcile Cash & Release Splits</button>
        </form>

        <form method="POST" action="/api/v1/actions" className="bw-card p-5 space-y-3 text-xs">
          <input type="hidden" name="action" value="trigger_clawback" />
          <input type="hidden" name="returnTo" value="/os/erp" />
          <h3 className="font-display font-bold text-sm text-[#021125]">3. Early Refinance Clawback</h3>
          <p className="text-slate-500">Utilizes House `GL 2200` reserve and books recoverable Partner (`GL 1300`) & Advisor (`GL 1310`) debit balances for next-deal offset.</p>
          <select name="dealId" className="bw-input">
            {deals.map((d) => (
              <option key={d.id} value={d.id}>{d.deal_ref} — {d.primary_name}</option>
            ))}
          </select>
          <input name="clawbackClaimExVatAed" type="number" step="0.01" defaultValue={10000} placeholder="Bank Clawback Claim AED" className="bw-input font-num" />
          <input type="date" name="triggeredDate" defaultValue="2027-03-15" className="bw-input font-num" />
          <button type="submit" className="rounded-lg bg-rose-700 hover:bg-rose-800 text-white font-semibold py-2 px-3 w-full cursor-pointer">
            Book Clawback & Next-Deal Offset
          </button>
        </form>
      </div>

      {/* Commission Settlements Table */}
      <div className="bw-card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 font-display font-bold text-sm text-[#021125]">
          Commission Settlements, Partner Subvention Splits & Clawback Reserve Sub-Ledger
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-4 py-2.5 text-start">Deal / Bank</th>
                <th className="px-4 py-2.5 text-end">Subvention Ex-VAT</th>
                <th className="px-4 py-2.5 text-end">Cash Received</th>
                <th className="px-4 py-2.5 text-end">House 10% Reserve</th>
                <th className="px-4 py-2.5 text-end">Partner Released</th>
                <th className="px-4 py-2.5 text-end">Advisor Released</th>
                <th className="px-4 py-2.5 text-start">Partner Payout</th>
                <th className="px-4 py-2.5 text-start">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {settlements.map((s) => (
                <tr key={String(s.id)}>
                  <td className="px-4 py-2.5 font-semibold">
                    <span className="font-num">{String(s.deal_ref)}</span> · {String(s.bank_short)}
                    {s.origin_mode === 'LEGACY_BACKBOOK' && <span className="ms-1 bw-badge bg-slate-200 text-slate-700">BACKBOOK</span>}
                  </td>
                  <td className="px-4 py-2.5 text-end font-num">{formatAed(Number(s.expected_subvention_ex_vat_fils))}</td>
                  <td className="px-4 py-2.5 text-end font-num font-semibold">{formatAed(Number(s.received_subvention_ex_vat_fils))}</td>
                  <td className="px-4 py-2.5 text-end font-num">{formatAed(Number(s.house_clawback_provision_fils))}</td>
                  <td className="px-4 py-2.5 text-end font-num">{formatAed(Number(s.partner_released_ex_vat_fils))}</td>
                  <td className="px-4 py-2.5 text-end font-num">{formatAed(Number(s.advisor_released_fils))}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`bw-badge ${
                        s.partner_payout_status === 'ONBOARDING_HOLD'
                          ? 'bg-amber-100 text-amber-900'
                          : s.partner_payout_status === 'PAYABLE_READY'
                            ? 'bg-emerald-100 text-emerald-900'
                            : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {String(s.partner_payout_status)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-semibold">{String(s.reconciliation_status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Partner Agency ORN Verification & Hold Release */}
      <div className="bw-card p-5 space-y-3">
        <h2 className="font-display font-bold text-sm text-[#021125]">
          B2B RERA Partner Agencies — ORN Verification, Clawback Debit Balance & Hold Release
        </h2>
        <div className="space-y-2">
          {partnerAgencies.map((ag) => (
            <form
              key={String(ag.id)}
              method="POST"
              action="/api/v1/actions"
              className="rounded-lg border border-slate-200 p-3 grid sm:grid-cols-6 gap-2 items-center text-xs"
            >
              <input type="hidden" name="action" value="verify_partner_agency" />
              <input type="hidden" name="agencyId" value={String(ag.id)} />
              <input type="hidden" name="returnTo" value="/os/erp" />
              <div className="sm:col-span-2">
                <div className="font-bold text-[#021125]">{String(ag.company_name)}</div>
                <div className="font-num text-[11px] text-slate-500">
                  ORN: {String(ag.rera_orn)} · Split {formatBps(Number(ag.default_split_bps))} · Clawback Debit: {formatAed(Number(ag.clawback_debit_balance_fils))}
                </div>
              </div>
              <input name="bankName" defaultValue={String(ag.bank_name || 'Emirates NBD')} placeholder="Bank Name" className="bw-input" />
              <input name="iban" defaultValue={String(ag.iban || 'AE190260001029384756101')} placeholder="UAE IBAN" className="bw-input font-num" />
              <span
                className={`bw-badge justify-center ${
                  ag.verification_status === 'VERIFIED' ? 'bg-emerald-100 text-emerald-900' : 'bg-amber-100 text-amber-900'
                }`}
              >
                {String(ag.verification_status)} / {String(ag.agreement_status)}
              </span>
              <button type="submit" className="bw-btn-navy">Verify ORN & Release Holds</button>
            </form>
          ))}
        </div>
      </div>

      {/* Peppol PINT-AE Tax Invoices + Vendor Bill + Backbook CSV Importer */}
      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bw-card p-5 space-y-3">
          <h2 className="font-display font-bold text-sm text-[#021125]">
            UAE Peppol PINT-AE (`UBL 2.1`) Tax & Self-Billed Partner Invoices ({invoices.length})
          </h2>
          <div className="space-y-2">
            {invoices.map((inv) => (
              <div key={String(inv.id)} className="rounded border border-slate-200 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div>
                  <span className="font-num font-bold text-[#021125]">{String(inv.invoice_number)}</span> · {String(inv.counterparty_name)}
                  <div className="text-[11px] text-slate-500 font-num">
                    {String(inv.invoice_type)} · Total incl. VAT: {formatAed(Number(inv.total_fils))}
                  </div>
                </div>
                <a href={`/api/v1/exports/pint-ae/${String(inv.id)}`} className="bw-btn-navy text-xs">
                  ⬇ Download PINT-AE .XML
                </a>
              </div>
            ))}
          </div>

          <form method="POST" action="/api/v1/actions" className="pt-3 border-t border-slate-200 grid sm:grid-cols-4 gap-2 text-xs">
            <input type="hidden" name="action" value="create_pint_invoice" />
            <input type="hidden" name="returnTo" value="/os/erp" />
            <input name="counterpartyName" required placeholder="Bank / Client Legal Name" className="bw-input" />
            <input name="counterpartyTrn15" placeholder="15-Digit TRN" className="bw-input font-num" />
            <input name="subtotalAed" type="number" required placeholder="Subtotal AED" className="bw-input font-num" />
            <button type="submit" className="bw-btn-gold">+ Issue PINT-AE Invoice</button>
          </form>
        </div>

        <div className="lg:col-span-5 bw-card p-5 space-y-3 text-xs">
          <h2 className="font-display font-bold text-sm text-[#021125]">
            Legacy Back-Book CSV Importer (`LEGACY_BACKBOOK` Mode)
          </h2>
          <p className="text-slate-500">
            Imports historical closed mortgages into the 90-Day Pre-Revert Radar & Clawback Watchlist with <strong>zero</strong> current-period Revenue or FTA VAT distortion.
          </p>
          <form method="POST" action="/api/v1/actions" className="space-y-2">
            <input type="hidden" name="action" value="import_backbook_csv" />
            <input type="hidden" name="returnTo" value="/os/erp" />
            <textarea
              name="csvContent"
              rows={4}
              defaultValue={`deal_ref,client_name,phone,community,bank_key,loan_aed,rate_pct,disbursed_date,fixed_expiry_date,revert_margin_pct,floor_pct\nBW-LEG-901,Faisal Al Qasimi,+971504441122,Arabian Ranches,dib,3200000,3.89,2025-01-15,2027-01-15,1.65,2.99`}
              className="bw-input font-num text-[11px]"
            />
            <button type="submit" className="bw-btn-navy w-full">Import Back-Book CSV</button>
          </form>
        </div>
      </div>

      {/* Trial Balance */}
      <div className="bw-card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <span className="font-display font-bold text-sm text-[#021125]">28-Account UAE Double-Entry Trial Balance</span>
          <span className="bw-badge bg-emerald-100 text-emerald-900 font-num">
            Debits {formatAed(totalDebit)} = Credits {formatAed(totalCredit)}
          </span>
        </div>
        <div className="overflow-x-auto max-h-80">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 sticky top-0">
              <tr>
                <th className="px-4 py-2 text-start">GL Code</th>
                <th className="px-4 py-2 text-start">Account Name</th>
                <th className="px-4 py-2 text-start">Class</th>
                <th className="px-4 py-2 text-end">Total Debit</th>
                <th className="px-4 py-2 text-end">Total Credit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tb
                .filter((r) => r.total_debit_fils > 0 || r.total_credit_fils > 0)
                .map((r) => (
                  <tr key={r.code}>
                    <td className="px-4 py-2 font-num font-bold">{r.code}</td>
                    <td className="px-4 py-2">{r.name}</td>
                    <td className="px-4 py-2 text-slate-500">{r.account_type}</td>
                    <td className="px-4 py-2 text-end font-num">{formatAed(r.total_debit_fils)}</td>
                    <td className="px-4 py-2 text-end font-num">{formatAed(r.total_credit_fils)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

