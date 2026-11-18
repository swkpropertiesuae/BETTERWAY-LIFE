import Link from 'next/link';
import { getDb } from '@/server/db';
import { requireStaffUser } from '@/server/auth/request';
import { formatAed, formatBps } from '@/lib/format';
import {
  generateBankRmFastPassCoverSheet,
  generateBuyerPreQualificationCertificate,
  generateThreeBankProposalComparison,
} from '@/server/engines/commercial-workflows-engine';
import { calculateUaeGratuityFils } from '@/server/engines/wps-gratuity-engine';
import { computeConveyancingPack } from '@/server/engines/conveyancing-engine';
import { PrintTriggerButton } from '@/components/print-trigger-button';
import { ArrowLeft, Building2, CheckCircle2, ShieldCheck } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function OfficialCorporateDocumentPrintPage({
  params,
}: {
  params: Promise<{ docType: string; id: string }>;
}) {
  await requireStaffUser();
  const { docType, id } = await params;
  const numId = Number(id || 1);
  const db = getDb();

  const company = db.prepare('SELECT * FROM company_settings WHERE id = 1').get() as Record<string, string>;
  const todayIso = new Date().toISOString().slice(0, 10);

  const hasDeal = Boolean(db.prepare('SELECT id FROM deals WHERE id = ? OR origin_mode = \'LIVE\' LIMIT 1').get(numId));
  if (!hasDeal && ['proposal', 'conveyancing', 'aip', 'coversheet'].includes(docType)) {
    return (
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="bw-card p-10 text-center space-y-3">
          <h2 className="text-base font-bold text-[var(--ink)]">
            No Active Mortgage Deal Available to Print ({docType.toUpperCase()})
          </h2>
          <p className="text-xs text-[var(--muted)] max-w-md mx-auto">
            Create a borrower lead in CRM (/os/crm) and convert it into an active mortgage deal first, then click Print to generate official branded A4 proposals, 60-day AIP certificates, BDM cover sheets, and DLD Manager&apos;s Cheque schedules.
          </p>
          <div className="pt-2 flex justify-center gap-2">
            <Link href="/os/crm" className="bw-btn-gold">
              + Open Leads &amp; 5m SLA Desk
            </Link>
            <Link href="/os/print/payslip/1" className="bw-btn-navy">
              Preview Staff MOHRE Payslip
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* Top Action Bar (Hidden in Print) */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl px-5 py-3 shadow-xs print:hidden">
        <div className="flex items-center gap-3">
          <Link
            href={
              docType === 'proposal'
                ? `/os/los?dealId=${numId}`
                : docType === 'invoice'
                  ? '/os/erp'
                  : docType === 'payslip'
                    ? '/os/hrm'
                    : `/os/conveyancing?dealId=${numId}`
            }
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Return to Workbench
          </Link>
          <span className="text-slate-300">|</span>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Official Corporate Document · {docType.toUpperCase()} #{numId}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href="/os/print/proposal/1" className="px-2.5 py-1 rounded border border-slate-200 text-[11px] font-semibold text-slate-700 hover:bg-slate-50">
            3-Bank Proposal
          </Link>
          <Link href="/os/print/aip/1" className="px-2.5 py-1 rounded border border-slate-200 text-[11px] font-semibold text-slate-700 hover:bg-slate-50">
            60-Day AIP Certificate
          </Link>
          <Link href="/os/print/coversheet/1" className="px-2.5 py-1 rounded border border-slate-200 text-[11px] font-semibold text-slate-700 hover:bg-slate-50">
            Bank BDM Cover Sheet
          </Link>
          <Link href="/os/print/invoice/1" className="px-2.5 py-1 rounded border border-slate-200 text-[11px] font-semibold text-slate-700 hover:bg-slate-50">
            FTA Tax Invoice
          </Link>
          <Link href="/os/print/payslip/1" className="px-2.5 py-1 rounded border border-slate-200 text-[11px] font-semibold text-slate-700 hover:bg-slate-50">
            MOHRE Payslip
          </Link>
          <Link href="/os/print/conveyancing/1" className="px-2.5 py-1 rounded border border-slate-200 text-[11px] font-semibold text-slate-700 hover:bg-slate-50">
            DLD Cheque Pack
          </Link>
          <PrintTriggerButton />
        </div>
      </div>

      {/* Printable A4 Sheet Container */}
      <div className="bg-white border border-slate-300 rounded-xl shadow-sm p-8 sm:p-10 space-y-6 print:border-0 print:shadow-none print:p-0">
        {/* Official Corporate Letterhead */}
        <div className="flex flex-wrap items-start justify-between gap-6 border-b-2 border-[#2a1418] pb-6">
          <div className="flex items-start gap-3.5">
            <img
              src="/brand/icon-gold-squircle.svg"
              alt="Betterway Mortgages"
              className="h-12 w-12 rounded-lg object-contain shrink-0"
            />
            <div>
              <img
                src="/brand/logo-navy-gold-transparent.svg"
                alt="Betterway Mortgages"
                className="h-6 w-auto object-contain mb-1"
              />
              <p className="text-xs text-slate-600 mt-0.5">
                {company?.office_address || 'Business Bay, Dubai, United Arab Emirates'}
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-num text-slate-700 mt-1.5">
                <span><strong>DED Licence:</strong> {company?.trade_licence_no || '984120'}</span>
                <span><strong>RERA ORN:</strong> {company?.rera_orn || '31048'}</span>
                <span><strong>CBUAE Reg:</strong> {company?.cbuae_broker_reg || 'CBUAE-MB-2024-118'}</span>
                <span><strong>FTA VAT TRN:</strong> {company?.vat_trn_15 || '100492817300003'}</span>
              </div>
            </div>
          </div>

          <div className="text-right font-num">
            <span className="inline-flex items-center gap-1 rounded bg-[#2a1418] text-[#d0b074] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider">
              <ShieldCheck className="h-3 w-3" />
              Verified Corporate Issue
            </span>
            <div className="text-xs font-bold text-slate-900 mt-2">Issue Date: {todayIso}</div>
            <div className="text-[11px] text-slate-500">Jurisdiction: Dubai / UAE Federal</div>
          </div>
        </div>

        {/* DOCUMENT 1: 3-BANK SIDE-BY-SIDE MORTGAGE PROPOSAL */}
        {docType === 'proposal' && (() => {
          const prop = generateThreeBankProposalComparison(db, numId);
          return (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-50 border border-slate-200 rounded-lg p-4">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    CBUAE Key Facts &amp; 3-Bank Institutional Mortgage Proposal
                  </div>
                  <div className="text-base font-bold text-slate-900 mt-0.5">
                    Borrower: {prop.clientName} · Reference: <span className="font-num">{prop.dealRef}</span>
                  </div>
                  <div className="text-xs text-slate-600 mt-0.5">
                    Segment: {prop.segment} · Tenure: {prop.tenureMonths} Months ({Math.round(prop.tenureMonths / 12)} Years) · CBUAE 3M EIBOR Benchmark: {formatBps(prop.eibor3mBps)}
                  </div>
                </div>
                <div className="text-right font-num">
                  <div className="text-xs text-slate-500">Purchase Price / Facility Required</div>
                  <div className="text-sm font-bold text-slate-900">
                    {formatAed(prop.propertyPriceFils)} / <span className="text-emerald-800">{formatAed(prop.loanAmountFils)}</span>
                  </div>
                  <div className="text-[11px] text-slate-600">
                    5-Yr Savings (#1 vs #3 Bank): <strong>{formatAed(prop.savingsBestVsThirdFils)}</strong>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs border border-slate-200">
                  <thead className="bg-[#2a1418] text-white">
                    <tr>
                      <th className="py-2.5 px-3 text-left">Comparison Parameter</th>
                      {prop.options.map((opt) => (
                        <th key={opt.rank} className="py-2.5 px-3 text-left border-l border-slate-700">
                          <div className="text-[#d0b074] text-[10px] uppercase font-num">Option 0{opt.rank} {opt.rank === 1 ? '· Recommended' : ''}</div>
                          <div className="text-sm font-bold">{opt.bankName}</div>
                          <div className="text-[10px] text-slate-300 font-num">{opt.productCode} · {opt.financeMode}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-num">
                    <tr>
                      <td className="py-2.5 px-3 font-sans font-semibold text-slate-700 bg-slate-50">Contract Structure &amp; Fixed Period</td>
                      {prop.options.map((opt) => (
                        <td key={opt.rank} className="py-2.5 px-3 border-l border-slate-200 font-sans">
                          <strong>{opt.fixedYears} Years Fixed</strong> ({opt.structure} · {opt.financeMode})
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-sans font-semibold text-slate-700 bg-slate-50">Initial Fixed Interest / Profit Rate</td>
                      {prop.options.map((opt) => (
                        <td key={opt.rank} className="py-2.5 px-3 border-l border-slate-200 font-bold text-slate-900">
                          {formatBps(opt.introRateBps)} p.a.
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-sans font-semibold text-slate-700 bg-slate-50">Post-Fixed Revert Rate (3M EIBOR + Margin)</td>
                      {prop.options.map((opt) => (
                        <td key={opt.rank} className="py-2.5 px-3 border-l border-slate-200 text-slate-700">
                          {formatBps(opt.revertRateBps)} p.a.
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-sans font-semibold text-slate-700 bg-slate-50">Monthly Installment (Intro Fixed Period)</td>
                      {prop.options.map((opt) => (
                        <td key={opt.rank} className="py-2.5 px-3 border-l border-slate-200 font-bold text-slate-900">
                          {formatAed(opt.introEmiFils)} / mo
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-sans font-semibold text-slate-700 bg-slate-50">Monthly Installment (Revert Period)</td>
                      {prop.options.map((opt) => (
                        <td key={opt.rank} className="py-2.5 px-3 border-l border-slate-200 text-slate-700">
                          {formatAed(opt.revertEmiFils)} / mo
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-sans font-semibold text-slate-700 bg-slate-50">CBUAE Stressed DBR (Max 50.00%) &amp; LTV</td>
                      {prop.options.map((opt) => (
                        <td key={opt.rank} className="py-2.5 px-3 border-l border-slate-200">
                          DBR: <strong>{formatBps(opt.stressedDbrBps)}</strong> · LTV: <strong>{formatBps(opt.ltvBps)}</strong>
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-sans font-semibold text-slate-700 bg-slate-50">Upfront Bank Arrangement &amp; Valuation Fees</td>
                      {prop.options.map((opt) => (
                        <td key={opt.rank} className="py-2.5 px-3 border-l border-slate-200">
                          {formatAed(opt.upfrontBankFeesFils)}
                        </td>
                      ))}
                    </tr>
                    <tr className="bg-emerald-50/60">
                      <td className="py-3 px-3 font-sans font-bold text-slate-900">True 60-Month Total Cost (EMIs + Fees)</td>
                      {prop.options.map((opt) => (
                        <td key={opt.rank} className="py-3 px-3 border-l border-slate-200 font-bold text-emerald-950">
                          <div>{formatAed(opt.fiveYearTotalCostFils)}</div>
                          <div className="text-[10px] text-slate-600 mt-0.5">
                            {opt.deltaVsBestRankFils === 0 ? 'Lowest 5-Year Total Cost' : `+ ${formatAed(opt.deltaVsBestRankFils)} vs Option 01`}
                          </div>
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-3 gap-4 text-xs bg-slate-50 p-4 rounded-lg border border-slate-200 font-num">
                <div>
                  <div className="text-slate-500 font-sans">DLD 4% Transfer + Admin Fee</div>
                  <div className="font-bold text-slate-900 mt-0.5">{formatAed(prop.dldTransferFeeFils)}</div>
                </div>
                <div>
                  <div className="text-slate-500 font-sans">DLD 0.25% Mortgage Registration</div>
                  <div className="font-bold text-slate-900 mt-0.5">{formatAed(prop.dldMortgageRegFeeFils)}</div>
                </div>
                <div>
                  <div className="text-slate-500 font-sans">Total Buyer Cash-to-Close Required</div>
                  <div className="font-bold text-slate-900 mt-0.5">{formatAed(prop.cashToCloseFils)}</div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* DOCUMENT 2: FTA TAX INVOICE (PEPPOL PINT-AE) */}
        {docType === 'invoice' && (() => {
          const inv = (db.prepare('SELECT * FROM tax_invoices WHERE id = ?').get(numId) ??
            db.prepare('SELECT * FROM tax_invoices ORDER BY id ASC LIMIT 1').get()) as Record<string, unknown>;
          return (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-50 border border-slate-200 rounded-lg p-4">
                <div>
                  <span className="px-2 py-0.5 rounded bg-slate-900 text-[#d0b074] text-[10px] font-bold uppercase font-num">
                    UAE Federal Tax Authority · Tax Invoice (Peppol PINT-AE UBL 2.1)
                  </span>
                  <h2 className="text-lg font-bold text-slate-900 mt-1 font-num">{String(inv?.invoice_number || 'BW-INV-2026-0001')}</h2>
                  <p className="text-xs text-slate-600">
                    Counterparty: <strong>{String(inv?.counterparty_name || 'Emirates NBD Bank PJSC')}</strong> · Buyer TRN: <span className="font-num">{String(inv?.counterparty_trn_15 || '100293847500003')}</span>
                  </p>
                </div>
                <div className="text-right font-num text-xs">
                  <div><strong>Supply Date:</strong> {String(inv?.supply_date || todayIso)}</div>
                  <div><strong>Peppol Status:</strong> {String(inv?.peppol_status || 'VALIDATED_XML')}</div>
                  <div><strong>Currency:</strong> AED (United Arab Emirates Dirham)</div>
                </div>
              </div>

              <table className="w-full text-xs border border-slate-200">
                <thead className="bg-[#2a1418] text-white">
                  <tr>
                    <th className="py-2.5 px-3 text-left">#</th>
                    <th className="py-2.5 px-3 text-left">Description of Regulated Mortgage Brokerage Supply</th>
                    <th className="py-2.5 px-3 text-right">Taxable Subtotal (AED)</th>
                    <th className="py-2.5 px-3 text-right">FTA VAT Rate</th>
                    <th className="py-2.5 px-3 text-right">Output VAT (AED)</th>
                    <th className="py-2.5 px-3 text-right">Total Payable (AED)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-num">
                  <tr>
                    <td className="py-3 px-3">01</td>
                    <td className="py-3 px-3 font-sans">
                      <div className="font-bold text-slate-900">Mortgage Origination &amp; Bank Subvention Settlement</div>
                      <div className="text-[11px] text-slate-500">Invoice Type: {String(inv?.invoice_type || 'TAX_INVOICE_380')} · Standard Rated Supply under UAE VAT Executive Regulations</div>
                    </td>
                    <td className="py-3 px-3 text-right font-semibold">{formatAed(Number(inv?.subtotal_fils || 2100000))}</td>
                    <td className="py-3 px-3 text-right">{formatBps(Number(inv?.vat_rate_bps || 500))}</td>
                    <td className="py-3 px-3 text-right font-semibold">{formatAed(Number(inv?.vat_fils || 105000))}</td>
                    <td className="py-3 px-3 text-right font-bold text-slate-900">{formatAed(Number(inv?.total_fils || 2205000))}</td>
                  </tr>
                </tbody>
              </table>

              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1">
                <div className="font-bold text-slate-900">Mandatory Corporate Bank Settlement Instructions (Zero Personal Account Policy):</div>
                <div className="font-num text-slate-700">
                  Beneficiary: <strong>{company?.legal_name || 'Betterway Mortgages LLC'}</strong> · Corporate IBAN: <strong>{company?.wps_iban || 'AE470260001015829401201'}</strong> (Emirates NBD Corporate Treasury)
                </div>
              </div>
            </div>
          );
        })()}

        {/* DOCUMENT 3: MOHRE EMPLOYEE MONTHLY PAYSLIP */}
        {docType === 'payslip' && (() => {
          const emp = (db.prepare('SELECT * FROM employees WHERE id = ?').get(numId) ??
            db.prepare('SELECT * FROM employees ORDER BY id ASC LIMIT 1').get()) as Record<string, unknown>;
          const basic = Number(emp?.basic_salary_fils || 1200000);
          const housing = Number(emp?.housing_allowance_fils || 500000);
          const transport = Number(emp?.transport_allowance_fils || 200000);
          const other = Number(emp?.other_allowance_fils || 100000);
          const grossFixed = basic + housing + transport + other;
          const isNational = Number(emp?.is_uae_national) === 1;
          const gpssaEmp = isNational ? Math.round((basic + housing) * 0.05) : 0;
          const netPayable = grossFixed - gpssaEmp;
          const serviceDays = Math.max(0, Math.floor((Date.now() - Date.parse(String(emp?.join_date || '2024-01-15') + 'T00:00:00Z')) / 86_400_000));
          const eosb = isNational
            ? null
            : calculateUaeGratuityFils({
                basicSalaryFils: basic,
                totalMonthlySalaryFils: grossFixed,
                grossServiceDays: serviceDays,
                unpaidLeaveDays: 0,
              });

          return (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-50 border border-slate-200 rounded-lg p-4">
                <div>
                  <span className="px-2 py-0.5 rounded bg-slate-900 text-[#d0b074] text-[10px] font-bold uppercase font-num">
                    MOHRE Wage Protection System (WPS) · Official Employee Payslip
                  </span>
                  <h2 className="text-lg font-bold text-slate-900 mt-1">
                    {String(emp?.full_name)} ({String(emp?.emp_code)})
                  </h2>
                  <p className="text-xs text-slate-600">
                    Designation: {String(emp?.designation)} · Department: {String(emp?.department)} · Joined: <span className="font-num">{String(emp?.join_date)}</span>
                  </p>
                </div>
                <div className="text-right font-num text-xs">
                  <div><strong>MOHRE Person ID (14d):</strong> {String(emp?.mohre_person_id_14)}</div>
                  <div><strong>Employee IBAN:</strong> {String(emp?.employee_iban_23)}</div>
                  <div><strong>Routing Agent Code:</strong> {String(emp?.routing_agent_id_9)}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="bg-[#2a1418] text-white px-4 py-2 font-bold">Earnings &amp; Allowances (AED)</div>
                  <div className="p-4 space-y-2 font-num">
                    <div className="flex justify-between"><span>Basic Salary (EOSB Base)</span><span className="font-semibold">{formatAed(basic)}</span></div>
                    <div className="flex justify-between"><span>Housing Allowance</span><span>{formatAed(housing)}</span></div>
                    <div className="flex justify-between"><span>Transport Allowance</span><span>{formatAed(transport)}</span></div>
                    <div className="flex justify-between"><span>Other Fixed Allowance</span><span>{formatAed(other)}</span></div>
                    <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-slate-900">
                      <span>Gross Fixed Remuneration</span>
                      <span>{formatAed(grossFixed)}</span>
                    </div>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="bg-[#2a1418] text-white px-4 py-2 font-bold">Statutory Deductions &amp; EOSB Accrual</div>
                  <div className="p-4 space-y-2 font-num">
                    <div className="flex justify-between">
                      <span>GPSSA UAE National Pension (5.0%)</span>
                      <span className="text-rose-700">- {formatAed(gpssaEmp)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Recoverable Draw Balance C/F</span>
                      <span>{formatAed(Number(emp?.draw_deficit_fils || 0))}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Accrued Statutory Gratuity (Art. 51)</span>
                      <span className="font-semibold text-emerald-800">
                        {eosb ? `${formatAed(eosb.gratuityFils)} (${eosb.netServiceYears} yrs)` : `GPSSA #${String(emp?.gpssa_number)}`}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-sm text-slate-900">
                      <span>Net WPS Bank Transfer Payable</span>
                      <span className="text-emerald-900">{formatAed(netPayable)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* DOCUMENT 4: DLD TRUSTEE CONVEYANCING & MANAGER'S CHEQUE SETTLEMENT PACK */}
        {docType === 'conveyancing' && (() => {
          const conv = computeConveyancingPack(db, numId);
          const chequeRows = [
            { code: 'MC-01', payee: 'Seller Mortgagee Bank (Liability Payoff)', source: 'Bank Facility / Buyer', notes: 'Clears existing first-rank mortgage per Liability Letter', amountFils: conv.cheques.sellerBankPayoffFils },
            { code: 'MC-02', payee: 'Property Seller (Net Equity Proceeds)', source: 'Bank Facility + Buyer Down Payment', notes: 'Net sale price less payoff & direct security deposit', amountFils: conv.cheques.sellerNetFils },
            { code: 'MC-03', payee: 'Dubai Land Department (DLD Transfer 4% + Admin)', source: 'Buyer Own Funds', notes: 'Statutory 4% DLD Title Deed Transfer + AED 580 Admin', amountFils: conv.cheques.dldTransferFils },
            { code: 'MC-04', payee: 'Dubai Land Department (0.25% Mortgage Reg)', source: 'Buyer Own Funds', notes: 'Statutory 0.25% Mortgage Registration + AED 290', amountFils: conv.cheques.mortgageRegFils },
            { code: 'MC-05', payee: 'DLD Real Estate Registration Trustee Office', source: 'Buyer Own Funds', notes: 'DLD Trustee Settlement Table Fee (Incl. 5% VAT)', amountFils: conv.cheques.trusteeFeeFils },
            { code: 'MC-06', payee: 'RERA Registered Brokerage (2% + 5% VAT)', source: 'Buyer Own Funds', notes: 'Form B / Form F Agency Commission Incl. 5% FTA VAT', amountFils: conv.cheques.agencyFeeInclVatFils },
          ];
          return (
            <div className="space-y-6">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="px-2 py-0.5 rounded bg-slate-900 text-[#d0b074] text-[10px] font-bold uppercase font-num">
                    Dubai Land Department (DLD) Trustee · Settlement &amp; Manager&apos;s Cheque Schedule
                  </span>
                  <h2 className="text-lg font-bold text-slate-900 mt-1">
                    {conv.dealRef} · DLD Transfer &amp; Mortgage Registration Pack
                  </h2>
                </div>
                <div className="text-right font-num text-xs">
                  <div><strong>Purchase Price:</strong> {formatAed(conv.purchasePriceFils)}</div>
                  <div><strong>Approved Bank Facility:</strong> {formatAed(conv.loanFils)}</div>
                  <div><strong>Buyer Cash Required:</strong> {formatAed(conv.cheques.buyerOwnFundsRequiredFils)}</div>
                </div>
              </div>

              <table className="w-full text-xs border border-slate-200">
                <thead className="bg-[#2a1418] text-white">
                  <tr>
                    <th className="py-2.5 px-3 text-left">Cheque #</th>
                    <th className="py-2.5 px-3 text-left">Payee / Beneficiary at DLD Trustee Table</th>
                    <th className="py-2.5 px-3 text-left">Funded By</th>
                    <th className="py-2.5 px-3 text-left">Settlement Purpose</th>
                    <th className="py-2.5 px-3 text-right">Exact Cheque Amount (AED)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-num">
                  {chequeRows.map((c) => (
                    <tr key={c.code}>
                      <td className="py-2.5 px-3 font-bold">{c.code}</td>
                      <td className="py-2.5 px-3 font-sans font-bold text-slate-900">{c.payee}</td>
                      <td className="py-2.5 px-3 font-sans">{c.source}</td>
                      <td className="py-2.5 px-3 font-sans text-slate-600">{c.notes}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900">{formatAed(c.amountFils)}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-100 font-bold text-slate-900">
                    <td colSpan={4} className="py-2.5 px-3 font-sans">Total Manager&apos;s Cheques Issued at DLD Trustee Table</td>
                    <td className="py-2.5 px-3 text-right">{formatAed(conv.cheques.totalManagerChequesFils)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          );
        })()}

        {/* DOCUMENT 5: OFFICIAL 60-DAY BUYER PRE-QUALIFICATION (AIP) CERTIFICATE */}
        {docType === 'aip' && (() => {
          const aip = generateBuyerPreQualificationCertificate(db, numId);
          return (
            <div className="space-y-6">
              <div className="bg-[#2a1418] text-white rounded-xl p-6 flex flex-wrap items-center justify-between gap-4 border border-[#d0b074]/40">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#d0b074] font-num">
                    Official 60-Day Mortgage Pre-Qualification Certificate (Agreement in Principle)
                  </span>
                  <h2 className="text-xl font-bold mt-1">
                    Verified Buyer: {aip.buyerDisplayName}
                  </h2>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Certificate Ref: <span className="font-num font-bold text-[#d0b074]">{aip.certificateRef}</span> · Valid Through: <span className="font-num font-bold">{aip.validUntilDate}</span> ({aip.validityDays} Calendar Days)
                  </p>
                </div>
                <div className="text-right font-num">
                  <div className="text-[11px] text-slate-300">Maximum Qualified Property Purchase Price</div>
                  <div className="text-2xl font-bold text-[#d0b074]">{formatAed(aip.maxQualifiedPropertyBudgetFils)}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-num">
                <div className="p-4 rounded-lg border border-slate-200 bg-slate-50">
                  <div className="text-slate-500 font-sans">Pre-Qualified Mortgage Facility</div>
                  <div className="text-base font-bold text-slate-900 mt-1">{formatAed(aip.maxApprovedLoanFacilityFils)}</div>
                  <div className="text-[11px] text-slate-600 mt-0.5">LTV Ratio: {formatBps(aip.calculatedLtvBps)} (Cap: {formatBps(aip.maxLtvCapBps)})</div>
                </div>
                <div className="p-4 rounded-lg border border-slate-200 bg-slate-50">
                  <div className="text-slate-500 font-sans">Verified Buyer Equity Down Payment</div>
                  <div className="text-base font-bold text-slate-900 mt-1">{formatAed(aip.buyerDownPaymentCommittedFils)}</div>
                  <div className="text-[11px] text-emerald-800 font-sans font-semibold mt-0.5">Source of Funds &amp; AML CDD Screened</div>
                </div>
                <div className="p-4 rounded-lg border border-slate-200 bg-slate-50">
                  <div className="text-slate-500 font-sans">CBUAE 50% DBR &amp; 7x LTI Clearance</div>
                  <div className="text-sm font-bold text-emerald-900 mt-1 font-sans">{aip.dbrStatus}</div>
                  <div className="text-[11px] text-slate-600 mt-0.5 font-sans">{aip.ltiStatus}</div>
                </div>
              </div>

              <div className="p-4 rounded-lg border border-slate-200 bg-white text-xs space-y-2">
                <div className="font-bold text-slate-900">Seller &amp; RERA Listing Agent Assurance Notice (Zero Confidential Income Disclosure):</div>
                <p className="text-slate-600 leading-relaxed">
                  This certificate confirms that <strong>{aip.buyerDisplayName}</strong> has completed a full financial, credit (AECB), and CBUAE Debt-Burden Ratio (DBR &le; 50%) underwriting assessment with <strong>Betterway Mortgages LLC</strong> across our 24-bank UAE panel (Primary Matched Lender: <strong>{aip.primaryMatchedBankName}</strong>). This certificate may be attached directly to <strong>Dubai REST Unified Form F (MOU)</strong> offers.
                </p>
                <div className="pt-2 border-t border-slate-100 flex flex-wrap justify-between gap-2 font-num text-[11px] text-slate-700">
                  <span><strong>Protected Referring Brokerage:</strong> {aip.referringPartnerAgency} (RERA ORN: {aip.referringPartnerOrn} · Agent: {aip.referringAgentBrn})</span>
                  <span><strong>Non-Circumvention ID:</strong> {aip.nonCircumventionGuaranteeRef}</span>
                </div>
              </div>
            </div>
          );
        })()}

        {/* DOCUMENT 6: HUSPY-STYLE BANK RM "FAST-PASS" CREDIT PACKAGING COVER SHEET */}
        {docType === 'coversheet' && (() => {
          const cs = generateBankRmFastPassCoverSheet(db, numId);
          return (
            <div className="space-y-6">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="px-2 py-0.5 rounded bg-[#2a1418] text-[#d0b074] text-[10px] font-bold uppercase font-num">
                    Bank Relationship Manager (BDM) Fast-Pass Underwriting Cover Sheet
                  </span>
                  <h2 className="text-lg font-bold text-slate-900 mt-1">
                    {cs.targetBankName} · Product: <span className="font-num">{cs.targetProductCode} ({cs.financeMode})</span>
                  </h2>
                  <p className="text-xs text-slate-600">
                    Packaging Ref: <span className="font-num font-bold">{cs.coverSheetRef}</span> · Assigned BDM: <strong>{cs.bdmContactName}</strong> ({cs.bdmEmail} · Target SLA: {cs.bdmSlaDays} Working Days)
                  </p>
                </div>
                <div className="text-right font-num text-xs">
                  <div><strong>Applicant:</strong> {cs.applicantName} ({cs.nationalityCode})</div>
                  <div><strong>Employer:</strong> {cs.employerName} ({cs.employerTier})</div>
                  <div><strong>AECB Score:</strong> <span className="font-bold text-emerald-800">{cs.aecbScore}</span></div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-num">
                <div className="p-3 rounded border border-slate-200 bg-slate-50">
                  <div className="text-[10px] text-slate-500 font-sans">Net Facility / Property Price</div>
                  <div className="font-bold text-slate-900 mt-0.5">{formatAed(cs.netLoanRequiredFils)}</div>
                  <div className="text-[10px] text-slate-500">LTV: {formatBps(cs.calculatedLtvBps)}</div>
                </div>
                <div className="p-3 rounded border border-slate-200 bg-slate-50">
                  <div className="text-[10px] text-slate-500 font-sans">Assessable Monthly Income</div>
                  <div className="font-bold text-slate-900 mt-0.5">{formatAed(cs.monthlyAssessableIncomeFils)}</div>
                  <div className="text-[10px] text-slate-500">LTI Multiple: {cs.ltiMultipleX}x (&le; 7.0x)</div>
                </div>
                <div className="p-3 rounded border border-slate-200 bg-slate-50">
                  <div className="text-[10px] text-slate-500 font-sans">CBUAE Stressed DBR (&le; 50%)</div>
                  <div className="font-bold text-emerald-800 mt-0.5">{formatBps(cs.stressedDbrBps)}</div>
                  <div className="text-[10px] text-slate-500">Intro EMI: {formatAed(cs.introEmiFils)}</div>
                </div>
                <div className="p-3 rounded border border-slate-200 bg-slate-50">
                  <div className="text-[10px] text-slate-500 font-sans">Age at Loan Maturity</div>
                  <div className="font-bold text-slate-900 mt-0.5">{cs.ageAtMaturityYears} Yrs</div>
                  <div className="text-[10px] text-slate-500">Policy Cap: {cs.maxMaturityAgeYears} Yrs</div>
                </div>
              </div>

              <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
                <div className="bg-[#2a1418] text-white px-4 py-2 font-bold">
                  Credit Underwriter Packaging Notes &amp; Policy Mitigants (24–48h Fast-Pass)
                </div>
                <ul className="p-4 space-y-2 list-disc list-inside text-slate-700">
                  {cs.mitigants.map((m, idx) => (
                    <li key={idx}>{m}</li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })()}

        {/* Official Corporate Signatory Footer */}
        <div className="pt-8 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs">
          <div className="space-y-6">
            <div className="font-bold text-slate-700 uppercase text-[10px] tracking-wider">Prepared &amp; Verified By</div>
            <div className="border-t border-slate-300 pt-2">
              <div className="font-bold text-slate-900">Corporate Operations &amp; Underwriting Desk</div>
              <div className="text-[11px] text-slate-500">Betterway Mortgages LLC · Dubai</div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="font-bold text-slate-700 uppercase text-[10px] tracking-wider">Executive Authorisation</div>
            <div className="border-t border-slate-300 pt-2">
              <div className="font-bold text-slate-900">Shabib Siraj / Mohammad Haseeb</div>
              <div className="text-[11px] text-slate-500">Managing Director / Operations Manager</div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="font-bold text-slate-700 uppercase text-[10px] tracking-wider">Counterparty / Client Acknowledgement</div>
            <div className="border-t border-slate-300 pt-2">
              <div className="font-bold text-slate-900">Authorised Signature &amp; Date</div>
              <div className="text-[11px] text-slate-500">Signed in accordance with CBUAE &amp; DLD regulations</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
