import { useState } from 'react';
import {
  ArrowUpRight,
  Building2,
  Calculator,
  CheckCircle2,
  CreditCard,
  FileSignature,
  FileText,
  Landmark,
  Printer,
  Send,
  Shield,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { Badge, Button, Card, Field, Input, PageHeader, Select } from '@/estate-os/components/ui';
import { money } from '@/estate-os/lib/format';

const UAE_BANKS = [
  { code: 'ENBD', name: 'Emirates NBD', fixedPct: 3.99, term: '3Yr Fixed', revert: '3M EIBOR + 1.75%', cardStress: 0.05 },
  { code: 'FAB', name: 'First Abu Dhabi Bank', fixedPct: 3.89, term: '3Yr Fixed', revert: '3M EIBOR + 1.65%', cardStress: 0.05 },
  { code: 'DIB', name: 'Dubai Islamic Bank (Ijara)', fixedPct: 4.15, term: '3Yr Ijara', revert: '3M EIBOR + 1.85%', cardStress: 0.05 },
  { code: 'ADCB', name: 'Abu Dhabi Commercial Bank', fixedPct: 4.09, term: '5Yr Hybrid', revert: '3M EIBOR + 1.79%', cardStress: 0.03 },
  { code: 'HSBC', name: 'HSBC UAE Premier', fixedPct: 3.95, term: '3Yr Fixed', revert: '3M EIBOR + 1.69%', cardStress: 0.03 },
  { code: 'MASHREQ', name: 'Mashreq Home Finance', fixedPct: 4.25, term: '2Yr Fixed', revert: '3M EIBOR + 1.90%', cardStress: 0.05 },
];

function calcEmi(principal: number, annualPct: number, years: number) {
  const r = annualPct / 100 / 12;
  const n = years * 12;
  if (r <= 0 || n <= 0) return Math.round(principal / Math.max(1, n));
  return Math.round((principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1));
}

export function CbuaeLosPage() {
  const [price, setPrice] = useState(3500000);
  const [downPct, setDownPct] = useState(20);
  const [salary, setSalary] = useState(55000);
  const [cards, setCards] = useState(60000);
  const [emiDebt, setEmiDebt] = useState(2500);
  const [years, setYears] = useState(25);

  const loan = Math.round(price * (1 - downPct / 100));
  const stressEmi = calcEmi(loan, 3.99 + 2.0, years);
  const cardStress = Math.round(cards * 0.05);
  const dbr = Number((((stressEmi + cardStress + emiDebt) / Math.max(1, salary)) * 100).toFixed(1));
  const ltiMax = salary * 12 * 7;

  return (
    <div className="page">
      <PageHeader
        eyebrow="[ UAE Central Bank 50.0% DBR Gate · 24-Bank Underwriting LOS ]"
        title={
          <>
            CBUAE Underwriting &amp; <span className="serif">24-Bank Rate Matrix</span>
          </>
        }
        sub="Stress-tested at +2.0% buffer with 3% vs 5% credit card limit rules, 7× Annual Income LTI cap, and instant 3-Bank Proposal PDF generation."
        actions={
          <>
            <a href="/os/print/proposal/1" className="btn btn-accent">
              <Printer size={15} /> 3-Bank Proposal PDF
            </a>
            <a href="/os/print/aip/1" className="btn">
              <Shield size={15} /> 60-Day Buyer AIP
            </a>
            <a href="/os/los" className="btn btn-primary">
              <Landmark size={15} /> Open Full 24-Bank LOS <ArrowUpRight size={14} />
            </a>
          </>
        }
      />

      <div className="grid g-kpi">
        <div className="card kpi">
          <div className="kpi-label">Target Facility ({100 - downPct}% LTV)</div>
          <div className="kpi-value">{money(loan)}</div>
          <div className="kpi-foot">Property: {money(price)}</div>
        </div>
        <div className="card kpi">
          <div className="kpi-label">Stressed DBR (+2% CBUAE Buffer)</div>
          <div className="kpi-value">{dbr}%</div>
          <div className="kpi-foot">
            <Badge tone={dbr <= 50 ? 'success' : 'danger'}>
              {dbr <= 50 ? 'Passes 50.0% Cap' : 'Exceeds 50.0% Cap'}
            </Badge>
          </div>
        </div>
        <div className="card kpi">
          <div className="kpi-label">7× Annual Income LTI Ceiling</div>
          <div className="kpi-value">{money(ltiMax)}</div>
          <div className="kpi-foot">Salary: {money(salary)}/mo</div>
        </div>
        <div className="card kpi">
          <div className="kpi-label">UAE 10-Yr Golden Visa</div>
          <div className="kpi-value">{price >= 2000000 ? 'Eligible' : 'Add Equity'}</div>
          <div className="kpi-foot">AED 2.0M+ DLD Title Threshold</div>
        </div>
      </div>

      <div className="grid g-main-side mt-16">
        <Card title="Ranked UAE Bank Matrix" sub="Live EMI & DBR comparison across conventional and Islamic Ijara products">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Bank</th>
                  <th>Fixed Rate</th>
                  <th>Reversion</th>
                  <th className="right">Monthly EMI</th>
                  <th className="right">Bank DBR</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {UAE_BANKS.map((b) => {
                  const emi = calcEmi(loan, b.fixedPct, years);
                  const bStress = calcEmi(loan, b.fixedPct + 2.0, years);
                  const bDbr = Number(
                    (((bStress + Math.round(cards * b.cardStress) + emiDebt) / Math.max(1, salary)) * 100).toFixed(1),
                  );
                  return (
                    <tr key={b.code}>
                      <td>
                        <b>{b.name}</b> <span className="faint mono">({b.code})</span>
                      </td>
                      <td className="mono">
                        {b.fixedPct.toFixed(2)}% · {b.term}
                      </td>
                      <td className="faint mono">{b.revert}</td>
                      <td className="right num">{money(emi, { compact: false })}</td>
                      <td className="right num mono">{bDbr}%</td>
                      <td>
                        <Badge tone={bDbr <= 50 ? 'success' : 'danger'} dot>
                          {bDbr <= 50 ? 'Eligible' : 'DBR Breach'}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Interactive Borrower & Property Controls" sub="Adjust inputs to stress-test DBR">
          <div className="stack">
            <Field label="Property Value (AED)">
              <Input
                type="number"
                value={price}
                onChange={(e) => setPrice(Number(e.target.value) || 0)}
              />
            </Field>
            <div className="grid g-2">
              <Field label="Down Payment (%)">
                <Input
                  type="number"
                  value={downPct}
                  onChange={(e) => setDownPct(Number(e.target.value) || 20)}
                />
              </Field>
              <Field label="Tenure (Years)">
                <Input
                  type="number"
                  value={years}
                  onChange={(e) => setYears(Math.min(25, Number(e.target.value) || 25))}
                />
              </Field>
            </div>
            <Field label="Verified Monthly Salary (AED)">
              <Input
                type="number"
                value={salary}
                onChange={(e) => setSalary(Number(e.target.value) || 1)}
              />
            </Field>
            <div className="grid g-2">
              <Field label="Credit Card Limits (AED)">
                <Input
                  type="number"
                  value={cards}
                  onChange={(e) => setCards(Number(e.target.value) || 0)}
                />
              </Field>
              <Field label="Existing EMIs (AED)">
                <Input
                  type="number"
                  value={emiDebt}
                  onChange={(e) => setEmiDebt(Number(e.target.value) || 0)}
                />
              </Field>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

export function ConveyancingDeskPage() {
  const [price, setPrice] = useState(4200000);
  const [loan, setLoan] = useState(3360000);
  const [sellerPayoff, setSellerPayoff] = useState(1950000);

  const dld4Pct = Math.round(price * 0.04) + 580;
  const mortgageReg = Math.round(loan * 0.0025) + 290;
  const trustee = 4200;
  const agencyFee = Math.round(price * 0.02 * 1.05);
  const sellerNet = Math.max(0, price - sellerPayoff);

  return (
    <div className="page">
      <PageHeader
        eyebrow="[ RERA Form F (MOU) · 72-Hour DLD Trustee Manager's Cheque Splitter ]"
        title={
          <>
            DLD Conveyancing &amp; <span className="serif">Cheque Pack</span>
          </>
        }
        sub="Exact fils calculation for Seller Liability Settlement, Seller Net Equity, DLD 4% Transfer, 0.25% Mortgage Registration, and Al Manara Registration Trustee fees."
        actions={
          <>
            <a href="/os/print/conveyancing/1" className="btn btn-accent">
              <Printer size={15} /> Print DLD Closing Sheet
            </a>
            <a href="/os/conveyancing" className="btn btn-primary">
              <Send size={15} /> Open Full Conveyancing Desk <ArrowUpRight size={14} />
            </a>
          </>
        }
      />

      <div className="grid g-main-side">
        <Card title="Day-of-Closing Manager's Cheque Breakdown" sub="Formatted for DLD Registration Trustee verification">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Cheque / Instrument</th>
                  <th>Funding Source</th>
                  <th className="right">Amount (AED)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><b>1. Seller Mortgagee Bank Payoff Cheque</b></td>
                  <td>Buyer Bank Disbursal</td>
                  <td className="right num">{money(sellerPayoff, { compact: false })}</td>
                </tr>
                <tr>
                  <td><b>2. Seller Net Proceeds Manager&apos;s Cheque</b></td>
                  <td>Buyer Bank + Buyer Equity</td>
                  <td className="right num">{money(sellerNet, { compact: false })}</td>
                </tr>
                <tr>
                  <td><b>3. Dubai Land Department (4% Transfer + AED 580)</b></td>
                  <td>Buyer Manager&apos;s Cheque</td>
                  <td className="right num">{money(dld4Pct, { compact: false })}</td>
                </tr>
                <tr>
                  <td><b>4. DLD Mortgage Registration (0.25% + AED 290)</b></td>
                  <td>Buyer Manager&apos;s Cheque</td>
                  <td className="right num">{money(mortgageReg, { compact: false })}</td>
                </tr>
                <tr>
                  <td><b>5. DLD Registration Trustee Fee (incl. 5% VAT)</b></td>
                  <td>Card / Cash at Trustee</td>
                  <td className="right num">{money(trustee, { compact: false })}</td>
                </tr>
                <tr>
                  <td><b>6. RERA Brokerage Agency Fee (2% + 5% VAT)</b></td>
                  <td>Buyer Manager&apos;s Cheque</td>
                  <td className="right num">{money(agencyFee, { compact: false })}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Adjust Closing Parameters" sub="Recalculates cheque splits instantly">
          <div className="stack">
            <Field label="Form F Purchase Price (AED)">
              <Input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value) || 0)} />
            </Field>
            <Field label="Approved Bank Loan (AED)">
              <Input type="number" value={loan} onChange={(e) => setLoan(Number(e.target.value) || 0)} />
            </Field>
            <Field label="Seller Liability Letter Payoff (AED)">
              <Input
                type="number"
                value={sellerPayoff}
                onChange={(e) => setSellerPayoff(Number(e.target.value) || 0)}
              />
            </Field>
          </div>
        </Card>
      </div>
    </div>
  );
}

export function ErpAccountingHubPage() {
  const desks = [
    {
      title: 'Double-Entry GL, FTA VAT 201 & 9% CT',
      sub: 'Trial Balance, Bordereau Pay-When-Paid, 180-Day Clawback Reserve & Peppol PINT-AE UBL 2.1 XML',
      href: '/os/erp',
      icon: TrendingUp,
      badge: 'GL 1100–6500',
    },
    {
      title: 'Company Expenses, P&L & Balance Sheet',
      sub: 'Maker-Checker > AED 5,000 approval gate, 15-digit FTA TRN check & full Financial Statements',
      href: '/os/accounts-expenses',
      icon: Wallet,
      badge: 'Assets = L + E',
    },
    {
      title: '50/50 Commission Splits & Deal Withdrawals',
      sub: '50% Betterway / 50% Advisor split after B2B Partner cut + strictly legal UAE payment channels',
      href: '/os/withdrawals',
      icon: FileSignature,
      badge: '50 / 50 Split',
    },
    {
      title: 'HR, MOHRE WPS (.SIF) Payroll & Gratuity',
      sub: 'Decree-Law 33/2021 21d/30d EOSB gratuity, Emirati GPSSA pension & 90/60/30-day Visa/BRN Radar',
      href: '/os/hrm',
      icon: Users,
      badge: 'WPS .SIF',
    },
    {
      title: 'Loans, Amortization & UAE PDC Safe Vault',
      sub: 'Fixed-to-Floating EIBOR schedule, Credit Risk scorecard & Post-Dated Cheque custody (GL 1150)',
      href: '/os/loan-risk-pdc',
      icon: CreditCard,
      badge: 'PDC Vault',
    },
    {
      title: 'Joint KFS Gate & Sealed FIU goAML Vault',
      sub: 'Multi-applicant CBUAE KFS hard-gate, DNFBP Sanctions screening & MLRO-only goAML XML',
      href: '/os/compliance',
      icon: Shield,
      badge: 'CBUAE & FIU',
    },
  ];

  const printDocs = [
    { label: '3-Bank Mortgage Proposal', href: '/os/print/proposal/1' },
    { label: '60-Day Buyer AIP Certificate', href: '/os/print/aip/1' },
    { label: 'Bank BDM Fast-Pass Cover Sheet', href: '/os/print/coversheet/1' },
    { label: 'DLD Form F Conveyancing Pack', href: '/os/print/conveyancing/1' },
    { label: 'FTA Tax Invoice (TRN Verified)', href: '/os/print/invoice/1' },
    { label: 'MOHRE WPS Staff Payslip', href: '/os/print/payslip/1' },
  ];

  return (
    <div className="page">
      <PageHeader
        eyebrow="[ UAE Corporate ERP · FTA VAT 201 · 9% Corporate Tax · MOHRE WPS · PDC Vault ]"
        title={
          <>
            Accounting, Tax, HR &amp; <span className="serif">Compliance Desks</span>
          </>
        }
        sub="Every SQLite-backed corporate ledger, statutory tax engine, payroll generator, and printable branded document."
      />

      <div className="grid g-3">
        {desks.map((d) => {
          const Icon = d.icon;
          return (
            <a key={d.href} href={d.href} className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="row row-between">
                <span className="icon-chip accent">
                  <Icon size={16} />
                </span>
                <Badge tone="accent">{d.badge}</Badge>
              </div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{d.title}</div>
              <div className="faint" style={{ fontSize: 12.5, flex: 1 }}>
                {d.sub}
              </div>
              <div className="row accent-text" style={{ fontSize: 12.5, fontWeight: 600 }}>
                Open SQLite Desk <ArrowUpRight size={14} />
              </div>
            </a>
          );
        })}
      </div>

      <Card title="6-Document Printable Corporate Suite (Betterway Master Brand Kit Letterhead)" className="mt-16">
        <div className="grid g-3">
          {printDocs.map((doc) => (
            <a key={doc.href} href={doc.href} className="btn" style={{ justifyContent: 'space-between' }}>
              <span className="row">
                <Printer size={14} /> {doc.label}
              </span>
              <ArrowUpRight size={14} />
            </a>
          ))}
        </div>
      </Card>
    </div>
  );
}
