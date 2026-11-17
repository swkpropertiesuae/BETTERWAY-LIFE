import Link from 'next/link';
import { getDb } from '@/server/db';
import { requireStaffUser } from '@/server/auth/request';
import { formatAed, formatAedWhole } from '@/lib/format';
import { OsBanner } from '@/components/os-banner';
import { computeCorporateTaxSummary, computeVat201Summary, getTrialBalance } from '@/server/engines/ledger-tax-engine';
import { computeFinancialStatements } from '@/server/engines/commercial-workflows-engine';
import { Building2, CheckCircle2, CreditCard, FileText, Landmark, PlusCircle, Receipt, ShieldCheck } from 'lucide-react';

export const dynamic = 'force-dynamic';

const UAE_BROKERAGE_EXPENSE_PRESETS = [
  {
    badge: '01 · Office & Ejari',
    title: 'Office Rent, Ejari & Service Charges',
    vendorName: 'Al Nasr Plaza Commercial Real Estate',
    vendorTrn15: '100239485700003',
    expenseAccountCode: '6200',
    subtotalAed: 18500,
    inputVatAed: 925,
    inputVatCategory: 'RESIDUAL_OVERHEAD',
    ctDeductibility: 'FULL_100',
    ruleNote: '100% Corporate Tax Deductible · 5% Input VAT Apportioned',
  },
  {
    badge: '02 · DEWA & Internet',
    title: 'DEWA Electricity, Etisalat Fiber & Staff SIMs',
    vendorName: 'Etisalat by e& / DEWA Dubai',
    vendorTrn15: '100028374600003',
    expenseAccountCode: '6200',
    subtotalAed: 2400,
    inputVatAed: 120,
    inputVatCategory: 'RESIDUAL_OVERHEAD',
    ctDeductibility: 'FULL_100',
    ruleNote: '100% Corporate Tax Deductible · Monthly Utility & Telecom Bill',
  },
  {
    badge: '03 · Property Portals',
    title: 'Property Finder, Bayut & Dubizzle Package',
    vendorName: 'Property Finder FZ-LLC',
    vendorTrn15: '100394857600003',
    expenseAccountCode: '6300',
    marketingChannel: 'PROPERTY_FINDER',
    subtotalAed: 12000,
    inputVatAed: 600,
    inputVatCategory: 'DIRECT_TAXABLE',
    ctDeductibility: 'FULL_100',
    ruleNote: '100% Corporate Tax Deductible · Tracked in Channel ROI',
  },
  {
    badge: '04 · Digital Lead Ads',
    title: 'Meta (Instagram/FB), Google Ads & WhatsApp API',
    vendorName: 'Meta Platforms / Google Ireland UAE',
    vendorTrn15: '100495867100003',
    expenseAccountCode: '6300',
    marketingChannel: 'META',
    subtotalAed: 8500,
    inputVatAed: 425,
    inputVatCategory: 'DIRECT_TAXABLE',
    ctDeductibility: 'FULL_100',
    ruleNote: '100% Corporate Tax Deductible · Performance Lead Generation',
  },
  {
    badge: '05 · Licences & Regulatory',
    title: 'DED Trade Licence, RERA ORN & CBUAE Broker Fee',
    vendorName: 'Dubai Economy (DET) / DLD RERA',
    vendorTrn15: '',
    expenseAccountCode: '6200',
    subtotalAed: 15000,
    inputVatAed: 0,
    inputVatCategory: 'DIRECT_EXEMPT',
    ctDeductibility: 'FULL_100',
    ruleNote: '100% Corporate Tax Deductible · Sovereign Government Fee (0% VAT)',
  },
  {
    badge: '06 · Visas & Medical Insurance',
    title: 'Staff Employment Visa, MOHRE & DHA Health Insurance',
    vendorName: 'Daman / GDRFA Dubai / MOHRE',
    vendorTrn15: '100584736200003',
    expenseAccountCode: '6100',
    subtotalAed: 6800,
    inputVatAed: 340,
    inputVatCategory: 'RESIDUAL_OVERHEAD',
    ctDeductibility: 'FULL_100',
    ruleNote: '100% Mandatory Employer Cost under UAE Labour Law (No Staff Deduction)',
  },
  {
    badge: '07 · Client Hospitality & Site Visits',
    title: 'Client Meetings, Coffee, Valet & Site-Visit Transport',
    vendorName: 'DIFC & Downtown Client Hospitality',
    vendorTrn15: '100847362500003',
    expenseAccountCode: '6400',
    subtotalAed: 1600,
    inputVatAed: 80,
    inputVatCategory: 'RESIDUAL_OVERHEAD',
    ctDeductibility: 'ENTERTAINMENT_50',
    ruleNote: 'UAE Corporate Tax Art. 32: Capped at 50% Deductibility',
  },
  {
    badge: '08 · Software, CRM & IT',
    title: 'Cloud Hosting, AECB Portal, Laptops & Office Stationery',
    vendorName: 'UAE Cloud & Office Supplies LLC',
    vendorTrn15: '100736251400003',
    expenseAccountCode: '6200',
    subtotalAed: 3200,
    inputVatAed: 160,
    inputVatCategory: 'RESIDUAL_OVERHEAD',
    ctDeductibility: 'FULL_100',
    ruleNote: '100% Corporate Tax Deductible · 5% Input VAT',
  },
  {
    badge: '09 · Admin Fines / Penalties',
    title: 'RTA / Municipal / Late Filing Administrative Fine',
    vendorName: 'Authority Administrative Penalty',
    vendorTrn15: '',
    expenseAccountCode: '6500',
    subtotalAed: 1000,
    inputVatAed: 0,
    inputVatCategory: 'DIRECT_EXEMPT',
    ctDeductibility: 'NON_DEDUCTIBLE_0',
    ruleNote: 'UAE Corporate Tax Art. 33: Strictly 0% Non-Deductible (Added Back)',
  },
];

export default async function CompanyAccountsAndExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  await requireStaffUser();
  const sp = await searchParams;
  const db = getDb();

  const tb = getTrialBalance(db);
  const vat = computeVat201Summary(db);
  const ct = computeCorporateTaxSummary(db);
  const fs = computeFinancialStatements(db);

  const cashAccount = tb.find((a) => a.code === '1100');
  const bankCashBalanceFils = (cashAccount?.total_debit_fils ?? 0) - (cashAccount?.total_credit_fils ?? 0);

  const subventionRec = tb.find((a) => a.code === '1200');
  const subventionRecFils = (subventionRec?.total_debit_fils ?? 0) - (subventionRec?.total_credit_fils ?? 0);

  const clawbackRes = tb.find((a) => a.code === '2200');
  const clawbackResFils = (clawbackRes?.total_credit_fils ?? 0) - (clawbackRes?.total_debit_fils ?? 0);

  const vendorBills = db
    .prepare('SELECT * FROM vendor_bills ORDER BY id DESC LIMIT 20')
    .all() as Array<Record<string, unknown>>;

  const totalVendorBillsFils = vendorBills.reduce(
    (s, b) => s + Number(b.subtotal_fils || 0) + Number(b.input_vat_fils || 0),
    0,
  );

  const journalEntries = db
    .prepare('SELECT * FROM gl_journal_entries ORDER BY id DESC LIMIT 12')
    .all() as Array<Record<string, unknown>>;

  return (
    <div className="space-y-6">
      <OsBanner notice={sp.notice} error={sp.error} />

      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-800">
            <Landmark className="h-3.5 w-3.5" />
            Company Accounts, Office Expenses &amp; UAE Tax Operations
          </span>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mt-2">
            Company Bank Accounts, Additional Office Expenses &amp; Petty Cash
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1 max-w-3xl">
            Manage Betterway Mortgages LLC’s corporate bank accounts, record monthly office rent, DEWA, Etisalat,
            Property Finder/Bayut ads, staff visas, client hospitality, and track UAE 5% VAT &amp; 9% Corporate Tax
            automatically.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href="/os/print/invoice/1" className="bw-btn-navy">
            Print Official FTA Tax Invoice →
          </Link>
          <Link href="/os/erp" className="bw-btn-ghost">
            Open Full Double-Entry Ledger →
          </Link>
          <Link href="/os/withdrawals" className="bw-btn-gold">
            50/50 Splits &amp; Client Refunds →
          </Link>
        </div>
      </div>

      {/* SECTION 0: Live Income Statement (P&L) & Balance Sheet (Statement of Financial Position) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-3 text-xs">
          <div className="flex items-center justify-between border-b border-gray-200 pb-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                IFRS / UAE Corporate Financial Statement
              </span>
              <h2 className="text-base font-bold text-gray-900">Income Statement (Profit &amp; Loss — P&amp;L)</h2>
            </div>
            <span className="px-2.5 py-1 rounded bg-emerald-100 text-emerald-900 font-bold font-num">
              Gross Margin: {fs.incomeStatement.grossMarginPct}%
            </span>
          </div>

          <div className="space-y-1.5 font-num">
            {fs.incomeStatement.revenueLines.map((l) => (
              <div key={l.code} className="flex justify-between text-slate-700">
                <span className="font-sans">GL {l.code} · {l.name}</span>
                <span className="font-semibold text-slate-900">{formatAed(l.balanceFils)}</span>
              </div>
            ))}
            <div className="flex justify-between font-bold text-slate-900 border-t border-slate-100 pt-1.5">
              <span className="font-sans">Total Recognized Brokerage Revenue</span>
              <span>{formatAed(fs.incomeStatement.totalRevenueFils)}</span>
            </div>

            {fs.incomeStatement.directCostLines.map((l) => (
              <div key={l.code} className="flex justify-between text-slate-600">
                <span className="font-sans">GL {l.code} · {l.name}</span>
                <span className="text-rose-700">- {formatAed(l.balanceFils)}</span>
              </div>
            ))}
            <div className="flex justify-between font-bold text-slate-900 border-t border-slate-100 pt-1.5">
              <span className="font-sans">Gross Brokerage Margin</span>
              <span>{formatAed(fs.incomeStatement.grossMarginFils)}</span>
            </div>

            <div className="flex justify-between text-slate-600">
              <span className="font-sans">Operating, HR &amp; G&amp;A Expenses (GL 6100–6500)</span>
              <span className="text-rose-700">- {formatAed(fs.incomeStatement.totalOperatingExpensesFils)}</span>
            </div>
            <div className="flex justify-between font-semibold text-slate-800">
              <span className="font-sans">EBITDA / Operating Profit Before Tax</span>
              <span>{formatAed(fs.incomeStatement.ebitdaOperatingProfitFils)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span className="font-sans">UAE 9% Corporate Tax Provision (&gt; AED 375k)</span>
              <span className="text-rose-700">- {formatAed(fs.incomeStatement.corporateTaxProvisionFils)}</span>
            </div>
            <div className="flex justify-between font-bold text-sm text-slate-900 border-t-2 border-slate-300 pt-2">
              <span className="font-sans">Net Profit After UAE Corporate Tax</span>
              <span className="text-emerald-800">{formatAed(fs.incomeStatement.netProfitAfterTaxFils)}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-3 text-xs">
          <div className="flex items-center justify-between border-b border-gray-200 pb-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                IFRS / UAE Statement of Financial Position
              </span>
              <h2 className="text-base font-bold text-gray-900">Corporate Balance Sheet</h2>
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-100 text-emerald-900 font-bold font-num">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {fs.balanceSheet.accountingEquationBalanced ? 'Assets = Liabilities + Equity' : 'Check Ledger'}
            </span>
          </div>

          <div className="space-y-1.5 font-num">
            <div className="text-[10px] font-bold uppercase text-slate-500 font-sans">Assets (GL 1000–1999)</div>
            {fs.balanceSheet.assetLines.map((l) => (
              <div key={l.code} className="flex justify-between text-slate-700">
                <span className="font-sans">GL {l.code} · {l.name}</span>
                <span className="font-semibold text-slate-900">{formatAed(l.balanceFils)}</span>
              </div>
            ))}
            <div className="flex justify-between font-bold text-slate-900 border-t border-slate-100 pt-1">
              <span className="font-sans">Total Corporate Assets</span>
              <span>{formatAed(fs.balanceSheet.totalAssetsFils)}</span>
            </div>

            <div className="text-[10px] font-bold uppercase text-slate-500 font-sans pt-1">Liabilities &amp; Equity (GL 2000–3999)</div>
            {fs.balanceSheet.liabilityLines.map((l) => (
              <div key={l.code} className="flex justify-between text-slate-700">
                <span className="font-sans">GL {l.code} · {l.name}</span>
                <span>{formatAed(l.balanceFils)}</span>
              </div>
            ))}
            <div className="flex justify-between text-slate-700">
              <span className="font-sans">Total Equity &amp; Current Period Retained Earnings</span>
              <span>{formatAed(fs.balanceSheet.totalEquityFils)}</span>
            </div>
            <div className="flex justify-between font-bold text-sm text-slate-900 border-t-2 border-slate-300 pt-2">
              <span className="font-sans">Total Liabilities &amp; Shareholders&apos; Equity</span>
              <span className="text-emerald-800">{formatAed(fs.balanceSheet.totalLiabilitiesAndEquityFils)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Corporate Accounts & Treasury Balances */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500">1. Corporate Bank Cash (GL 1100)</span>
            <div className="h-8 w-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center">
              <Landmark className="h-4 w-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-gray-900 font-num mt-2">{formatAedWhole(bankCashBalanceFils)}</div>
          <div className="text-[11px] text-gray-500 mt-1 font-num">ENBD IBAN: AE470260001015829401201</div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500">2. Bank Subvention Receivable (GL 1200)</span>
            <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
              <CreditCard className="h-4 w-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-gray-900 font-num mt-2">{formatAedWhole(subventionRecFils)}</div>
          <div className="text-[11px] text-gray-500 mt-1">Awaiting bank bordereau wire</div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500">3. Logged Additional Expenses</span>
            <div className="h-8 w-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
              <Receipt className="h-4 w-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-gray-900 font-num mt-2">{formatAedWhole(totalVendorBillsFils)}</div>
          <div className="text-[11px] text-gray-500 mt-1">{vendorBills.length} recorded vendor &amp; office bills</div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500">4. Net VAT &amp; 9% Tax Provision</span>
            <div className="h-8 w-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-gray-900 font-num mt-2">
            {formatAedWhole(vat.netVatPayableFils + ct.corporateTaxPayableFils)}
          </div>
          <div className="text-[11px] text-gray-500 mt-1">
            Clawback Reserve: {formatAedWhole(clawbackResFils)}
          </div>
        </div>
      </div>

      {/* SECTION 1: 9 Pre-Built UAE Mortgage Brokerage Expense Presets (1-Click Log) */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Step 1 · Standard UAE Brokerage Expenses (1-Click Quick Log)
          </span>
          <h2 className="text-lg font-bold text-gray-900 mt-0.5">
            What Expenses Are Required in a UAE Mortgage Brokerage? (Click Any Box to Log)
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Every card below is pre-configured with the correct UAE General Ledger account, 5% FTA Input VAT treatment,
            and UAE 9% Corporate Tax deductibility rule.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {UAE_BROKERAGE_EXPENSE_PRESETS.map((preset) => (
            <form
              key={preset.badge}
              method="POST"
              action="/api/v1/actions"
              className="p-4 rounded-xl border border-gray-200 bg-gray-50/70 hover:bg-white hover:border-slate-300 transition flex flex-col justify-between gap-3"
            >
              <input type="hidden" name="action" value="create_vendor_bill" />
              <input type="hidden" name="returnTo" value="/os/accounts-expenses" />
              <input type="hidden" name="vendorName" value={preset.vendorName} />
              <input type="hidden" name="vendorTrn15" value={preset.vendorTrn15} />
              <input type="hidden" name="expenseAccountCode" value={preset.expenseAccountCode} />
              {preset.marketingChannel && (
                <input type="hidden" name="marketingChannel" value={preset.marketingChannel} />
              )}
              <input type="hidden" name="subtotalAed" value={preset.subtotalAed} />
              <input type="hidden" name="inputVatAed" value={preset.inputVatAed} />
              <input type="hidden" name="inputVatCategory" value={preset.inputVatCategory} />
              <input type="hidden" name="ctDeductibility" value={preset.ctDeductibility} />

              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 text-[10px] font-bold uppercase font-num">
                    {preset.badge}
                  </span>
                  <span className="font-num text-xs font-bold text-gray-900">
                    AED {preset.subtotalAed.toLocaleString()} {preset.inputVatAed > 0 ? `+ ${preset.inputVatAed} VAT` : ''}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-gray-900 mt-2">{preset.title}</h3>
                <p className="text-[11px] text-gray-500 mt-0.5">{preset.vendorName}</p>
                <p className="text-[11px] text-slate-800 font-medium mt-1.5">{preset.ruleNote}</p>
              </div>

              <button
                type="submit"
                className="w-full py-2 px-3 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer transition"
              >
                + Record This Expense (AED {(preset.subtotalAed + preset.inputVatAed).toLocaleString()})
              </button>
            </form>
          ))}
        </div>
      </div>

      {/* SECTION 2: Custom Additional Expense Form + Recorded Expenses Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Custom Expense Form */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <PlusCircle className="h-5 w-5 text-slate-700" />
            <h2 className="text-base font-bold text-gray-900">Record Any Custom Office or Company Expense</h2>
          </div>

          <form method="POST" action="/api/v1/actions" className="space-y-3 text-xs">
            <input type="hidden" name="action" value="create_vendor_bill" />
            <input type="hidden" name="returnTo" value="/os/accounts-expenses" />

            <label className="block">
              <span className="font-semibold text-gray-700">Vendor / Supplier Name</span>
              <input
                name="vendorName"
                required
                placeholder="e.g. Dubai Land Department / DEWA / Bayut / Office Pantry"
                className="bw-input mt-1 w-full"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="font-semibold text-gray-700">Expense Type (GL Account)</span>
                <select name="expenseAccountCode" className="bw-input mt-1 w-full">
                  <option value="6200">6200 · Office Rent, DEWA, IT &amp; Trade Licence</option>
                  <option value="6300">6300 · Marketing, Portals &amp; Lead Ads</option>
                  <option value="6400">6400 · Client Hospitality &amp; Transport (50% CT)</option>
                  <option value="6100">6100 · Staff Visas, Medical &amp; HR</option>
                  <option value="6500">6500 · Government / Admin Fines (0% CT)</option>
                </select>
              </label>

              <label className="block">
                <span className="font-semibold text-gray-700">Vendor 15-Digit VAT TRN</span>
                <input
                  name="vendorTrn15"
                  defaultValue="100394857600003"
                  placeholder="100xxxxxxxxx003"
                  className="bw-input mt-1 w-full font-num"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="font-semibold text-gray-700">Amount Before VAT (AED)</span>
                <input
                  type="number"
                  name="subtotalAed"
                  required
                  defaultValue={4500}
                  className="bw-input mt-1 w-full font-num"
                />
              </label>

              <label className="block">
                <span className="font-semibold text-gray-700">5% UAE Input VAT (AED)</span>
                <input
                  type="number"
                  name="inputVatAed"
                  defaultValue={225}
                  className="bw-input mt-1 w-full font-num"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="font-semibold text-gray-700">FTA Input VAT Category</span>
                <select name="inputVatCategory" className="bw-input mt-1 w-full">
                  <option value="RESIDUAL_OVERHEAD">General Office Overhead</option>
                  <option value="DIRECT_TAXABLE">Direct Taxable Supply</option>
                  <option value="DIRECT_EXEMPT">Exempt / Zero VAT</option>
                </select>
              </label>

              <label className="block">
                <span className="font-semibold text-gray-700">9% Corporate Tax Rule</span>
                <select name="ctDeductibility" className="bw-input mt-1 w-full">
                  <option value="FULL_100">100% Fully Deductible</option>
                  <option value="ENTERTAINMENT_50">50% Client Entertainment Cap</option>
                  <option value="NON_DEDUCTIBLE_0">0% Non-Deductible Fine</option>
                </select>
              </label>
            </div>

            <label className="flex items-center gap-2 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-[11px] font-semibold text-slate-700">
              <input type="checkbox" name="requireMakerCheckerGate" value="1" />
              Enforce Maker-Checker Approval Gate (&gt; AED 5,000 requires Owner / Manager sign-off before GL posting)
            </label>

            <button type="submit" className="bw-btn-gold w-full justify-center py-2.5">
              + Save Expense &amp; Post to Company Ledger
            </button>
          </form>
        </div>

        {/* Recorded Vendor Bills & Office Expenses Table */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-slate-700" />
              <h2 className="text-base font-bold text-gray-900">
                Recorded Company Expenses &amp; Vendor Bills ({vendorBills.length})
              </h2>
            </div>
            <span className="text-xs font-bold text-slate-700 font-num">
              Total: {formatAed(totalVendorBillsFils)}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500 uppercase text-[10px]">
                  <th className="py-2.5 px-3">Bill Ref</th>
                  <th className="py-2.5 px-3">Vendor / Expense</th>
                  <th className="py-2.5 px-3">GL Code</th>
                  <th className="py-2.5 px-3">Tax Rule</th>
                  <th className="py-2.5 px-3 text-right">Amount + VAT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {vendorBills.map((b) => (
                  <tr key={String(b.id)} className="hover:bg-gray-50">
                    <td className="py-2.5 px-3 font-num font-bold text-gray-900">{String(b.bill_number)}</td>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-gray-900">{String(b.vendor_name)}</div>
                      <div className="text-[11px] text-gray-500 font-num">
                        {String(b.bill_date)} {b.marketing_channel ? `· ${String(b.marketing_channel)}` : ''}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-num font-semibold text-slate-700">
                      GL {String(b.expense_account_code)}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-[10px] font-bold">
                        {String(b.ct_deductibility)}
                      </span>
                      {String(b.approval_status || 'APPROVED') === 'PENDING_OWNER_APPROVAL' && (
                        <form method="POST" action="/api/v1/actions" className="inline-flex items-center gap-1 ms-2">
                          <input type="hidden" name="action" value="decide_vendor_bill" />
                          <input type="hidden" name="billId" value={String(b.id)} />
                          <input type="hidden" name="returnTo" value="/os/accounts-expenses" />
                          <button
                            type="submit"
                            name="decision"
                            value="APPROVED"
                            className="px-2 py-0.5 rounded bg-emerald-700 text-white text-[10px] font-bold cursor-pointer"
                          >
                            Approve &amp; Post GL
                          </button>
                          <button
                            type="submit"
                            name="decision"
                            value="REJECTED"
                            className="px-2 py-0.5 rounded bg-rose-700 text-white text-[10px] font-bold cursor-pointer"
                          >
                            Reject
                          </button>
                        </form>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right font-num font-bold text-gray-900">
                      {formatAed(Number(b.subtotal_fils) + Number(b.input_vat_fils))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* SECTION 3: Recent Double-Entry Journal Postings */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-slate-700" />
            <h2 className="text-base font-bold text-gray-900">
              Recent Company Account Journal Entries ({journalEntries.length})
            </h2>
          </div>
          <Link href="/os/erp" className="text-xs font-semibold text-slate-700 hover:underline">
            View Full 28-Account Trial Balance →
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
          {journalEntries.map((je) => (
            <div key={String(je.id)} className="p-3.5 rounded-xl bg-gray-50 border border-gray-200">
              <div className="flex items-center justify-between">
                <span className="font-num font-bold text-slate-700">{String(je.entry_ref)}</span>
                <span className="font-num text-[11px] text-gray-500">{String(je.entry_date)}</span>
              </div>
              <div className="font-semibold text-gray-900 mt-1 truncate">{String(je.memo)}</div>
              <div className="text-[11px] text-gray-500 mt-0.5">Module: {String(je.source_module)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
