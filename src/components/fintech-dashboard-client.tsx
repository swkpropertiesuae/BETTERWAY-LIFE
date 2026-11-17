'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  Calculator,
  CheckCircle2,
  FileText,
  FolderLock,
  Kanban,
  Landmark,
  LayoutDashboard,
  PanelRightOpen,
  Printer,
  Send,
  Shield,
  ShieldCheck,
  Table2,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import {
  CORPORATE_NAV_SECTIONS,
  DEFAULT_DRAWER_DEALS,
  openDealDrawer,
  type DrawerDealRecord,
} from '@/components/swk-shell';

export interface FintechDashboardProps {
  metrics: {
    bankCashFils: number;
    subventionReceivableFils: number;
    pdcVaultFils: number;
    pdcVaultCount: number;
    clawbackReserveFils: number;
    totalRevenueFils: number;
    totalExpensesFils: number;
    netProfitFils: number;
    netVatPayableFils: number;
    corporateTaxFils: number;
    activePipelineFils: number;
    dealsCount: number;
    leadsCount: number;
    eibor3mPct: string;
    isBalanced?: boolean;
    totalAssetsFils?: number;
  };
  liveDeals?: DrawerDealRecord[];
  liveCommissions?: Array<{
    dealId: string;
    client: string;
    bank: string;
    loanAed: number;
    grossPct: string;
    grossAed: number;
    partnerCutAed: number;
    advisorSplitAed: number;
    vat5PctAed: number;
    status: 'Draft' | 'Sent to Bank' | 'Paid';
    clawbackEnd: string;
  }>;
  recentTransactions: Array<{
    id: string;
    merchant: string;
    subtitle: string;
    category: string;
    transactionId: string;
    amountAed: number;
    date: string;
    href: string;
  }>;
  monthlySeries: Array<{
    month: string;
    currentYearAed: number;
    lastYearAed: number;
  }>;
}

const PIPELINE_FUNNEL_STAGES = [
  { stage: '1. Lead Intake & Consent', files: 68, volumeM: '142.5M', avgDays: 0.8, pct: 100, status: 'optimal' },
  { stage: '2. KYC & AECB Collection', files: 54, volumeM: '114.2M', avgDays: 3.2, pct: 79, status: 'optimal' },
  { stage: '3. CBUAE 50% DBR & KFS Gate', files: 46, volumeM: '96.8M', avgDays: 1.8, pct: 68, status: 'optimal' },
  { stage: '4. Bank Underwriting (IPA)', files: 34, volumeM: '71.4M', avgDays: 5.8, pct: 50, status: 'warning' },
  { stage: '5. RICS Valuation & FOL', files: 21, volumeM: '44.6M', avgDays: 4.1, pct: 31, status: 'optimal' },
  { stage: '6. Developer NOC & Liability Letter', files: 14, volumeM: '29.8M', avgDays: 4.6, pct: 21, status: 'warning' },
  { stage: '7. DLD Trustee Disbursal', files: 11, volumeM: '24.0M', avgDays: 1.5, pct: 16, status: 'optimal' },
];

const URGENT_SLA_FEED = [
  {
    id: 'sla-1',
    severity: 'warning' as const,
    title: 'IPA Expiring in 6 days — Ahmed Al-Mansoori — ENBD',
    subtitle: 'AED 3.36M • Dubai Hills Villa • FOL signature pending',
    actionLabel: 'Nudge Client',
    dealIdx: 0,
  },
  {
    id: 'sla-2',
    severity: 'critical' as const,
    title: 'DBR 52.1% Cap Exceeded — Elena Rostova — Mashreq',
    subtitle: 'AED 1.90M • Requires AED 80k card limit reduction before IPA',
    actionLabel: 'Restructure DBR',
    dealIdx: 3,
  },
  {
    id: 'sla-3',
    severity: 'warning' as const,
    title: 'Liability Letter Overdue (5d) — Khalid Al-Qassimi — DIB',
    subtitle: 'AED 4.87M • Palm Jumeirah Ijara Buyout • Chase Seller Bank',
    actionLabel: 'Chase Bank BDM',
    dealIdx: 2,
  },
  {
    id: 'sla-4',
    severity: 'optimal' as const,
    title: 'DLD Trustee Booked Tomorrow 10:00 AM — James Thornton — FAB',
    subtitle: 'AED 1.84M • Al Manara Trustee • 4 Manager Cheques Verified',
    actionLabel: 'Closing Sheet',
    dealIdx: 1,
  },
];

const BANK_MATRIX_CATALOG = [
  {
    code: 'ENBD',
    name: 'Emirates NBD',
    fixedRatePct: 3.99,
    fixedTerm: '3Yr Fixed',
    reversionLabel: '3M EIBOR + 1.75%',
    arrangementFeeDesc: '1.05% (Zero on Buyout)',
    earlySettlementRule: 'Min(1%, AED 10,000) + VAT',
    cardStressRate: 0.05,
    subventionPct: 1.0,
  },
  {
    code: 'FAB',
    name: 'First Abu Dhabi Bank',
    fixedRatePct: 3.89,
    fixedTerm: '3Yr Fixed',
    reversionLabel: '3M EIBOR + 1.65%',
    arrangementFeeDesc: '1.05% (50% Waiver Salary)',
    earlySettlementRule: 'Min(1%, AED 10,000) + VAT',
    cardStressRate: 0.05,
    subventionPct: 0.95,
  },
  {
    code: 'DIB',
    name: 'Dubai Islamic Bank (Ijara)',
    fixedRatePct: 4.15,
    fixedTerm: '3Yr Ijara Profit',
    reversionLabel: '3M EIBOR + 1.85%',
    arrangementFeeDesc: 'AED 0 Processing Fee',
    earlySettlementRule: 'Min(1%, AED 10,000) + VAT',
    cardStressRate: 0.05,
    subventionPct: 1.1,
  },
  {
    code: 'ADCB',
    name: 'Abu Dhabi Commercial Bank',
    fixedRatePct: 4.09,
    fixedTerm: '5Yr Hybrid',
    reversionLabel: '3M EIBOR + 1.79%',
    arrangementFeeDesc: '1.05% Standard',
    earlySettlementRule: 'Min(1%, AED 10,000) + VAT',
    cardStressRate: 0.03,
    subventionPct: 1.0,
  },
  {
    code: 'HSBC',
    name: 'HSBC UAE Premier',
    fixedRatePct: 3.95,
    fixedTerm: '3Yr Fixed',
    reversionLabel: '3M EIBOR + 1.69%',
    arrangementFeeDesc: '0.525% Premier Discount',
    earlySettlementRule: 'Min(1%, AED 10,000) + VAT',
    cardStressRate: 0.03,
    subventionPct: 0.85,
  },
  {
    code: 'MASHREQ',
    name: 'Mashreq Home Finance',
    fixedRatePct: 4.25,
    fixedTerm: '2Yr Fixed',
    reversionLabel: '3M EIBOR + 1.90%',
    arrangementFeeDesc: '1.05% Standard',
    earlySettlementRule: 'Min(1%, AED 10,000) + VAT',
    cardStressRate: 0.05,
    subventionPct: 1.15,
  },
];

const VAULT_CHECKLIST_ITEMS = [
  {
    id: 'doc-1',
    category: 'Identity & Residency',
    title: 'UAE Emirates ID (Front & Back) — 784-1986-4928172-1',
    status: 'VERIFIED' as const,
    ocrFields: [
      { key: 'Full Name (EN)', val: 'AHMED SULTAN AL-MANSOORI' },
      { key: 'Identity Number', val: '784-1986-4928172-1' },
      { key: 'Nationality', val: 'United Arab Emirates (Tier-1 National)' },
      { key: 'Expiry Date', val: '14/08/2029 (Valid — 1,001 days remaining)' },
    ],
  },
  {
    id: 'doc-2',
    category: 'Income & Bank Statements',
    title: '6-Month Emirates NBD Salary Account Statements (IBAN AE47026...)',
    status: 'VERIFIED' as const,
    ocrFields: [
      { key: 'Avg 6-Mo Salary Credit', val: 'AED 68,000.00 / month (WPS Verified)' },
      { key: 'Employer Match', val: 'ADNOC Offshore PJSC (Approved Tier-A)' },
      { key: 'Undisclosed EMI / BNPL', val: 'AED 0.00 detected (Tabby/Tamara Clean)' },
      { key: 'Bounced Cheques (24M)', val: '0 Dishonoured Cheques' },
    ],
  },
  {
    id: 'doc-3',
    category: 'AECB & Liabilities',
    title: 'Al Etihad Credit Bureau (AECB) Consumer Credit Report',
    status: 'VERIFIED' as const,
    ocrFields: [
      { key: 'AECB Credit Score', val: '782 / 900 (3-Star Low Risk)' },
      { key: 'Active Credit Card Limits', val: 'AED 60,000 (Stressed at 5% = AED 3,000/mo)' },
      { key: 'Auto Finance EMI', val: 'AED 1,200.00 / month' },
      { key: 'Total Stressed Obligations', val: 'AED 4,200.00 / month' },
    ],
  },
  {
    id: 'doc-4',
    category: 'Property (Form F / Title Deed)',
    title: 'DLD Form F (MOU) & Dubai Hills Title Deed #104928',
    status: 'PENDING_PAGE' as const,
    ocrFields: [
      { key: 'Community & Plot', val: 'Dubai Hills Estate • Golf Place Villa 42' },
      { key: 'Agreed Purchase Price', val: 'AED 4,200,000.00' },
      { key: 'RICS Panel Valuation', val: 'AED 4,250,000.00 (Cavendish Maxwell)' },
      { key: 'MOU Expiry Date', val: '28/11/2026 (11 Days Remaining)' },
    ],
  },
];

const DLD_CLOSING_STEPS = [
  { label: 'Valuation Ordered', date: '04 Nov', done: true },
  { label: 'Valuation Completed', date: '07 Nov', done: true },
  { label: 'FOL Issued', date: '11 Nov', done: true },
  { label: 'Liability Letter Requested', date: '13 Nov', done: true },
  { label: 'Developer NOC Issued', date: '15 Nov', done: true },
  { label: 'DLD Trustee Booked', date: '18 Nov 10:00', done: false, active: true },
];

const DEFAULT_COMMISSION_ROWS = [
  {
    dealId: 'BW-2026-001',
    client: 'Ahmed Al-Mansoori',
    bank: 'ENBD',
    loanAed: 3360000,
    grossPct: '1.00%',
    grossAed: 33600,
    partnerCutAed: 5000,
    advisorSplitAed: 14300,
    vat5PctAed: 1680,
    status: 'Paid' as const,
    clawbackEnd: '15 May 2027',
  },
  {
    dealId: 'BW-2026-002',
    client: 'James Thornton',
    bank: 'FAB',
    loanAed: 1840000,
    grossPct: '0.95%',
    grossAed: 17480,
    partnerCutAed: 2480,
    advisorSplitAed: 7500,
    vat5PctAed: 874,
    status: 'Sent to Bank' as const,
    clawbackEnd: '18 May 2027',
  },
  {
    dealId: 'BW-2026-003',
    client: 'Khalid Al-Qassimi',
    bank: 'DIB',
    loanAed: 4875000,
    grossPct: '1.10%',
    grossAed: 53625,
    partnerCutAed: 8625,
    advisorSplitAed: 22500,
    vat5PctAed: 2681,
    status: 'Draft' as const,
    clawbackEnd: '02 Jun 2027',
  },
];

function calcMonthlyEmi(principal: number, annualRatePct: number, years: number): number {
  const r = annualRatePct / 100 / 12;
  const n = years * 12;
  if (r <= 0 || n <= 0) return Math.round(principal / Math.max(1, n));
  return Math.round((principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1));
}

type CommandSectionTab =
  | 'overview'
  | 'pipeline'
  | 'cbuae'
  | 'vault'
  | 'closing'
  | 'ledger'
  | 'all';

export function FintechDashboardClient({
  metrics,
  liveDeals = [],
  liveCommissions = [],
}: FintechDashboardProps) {
  const [activeTab, setActiveTab] = useState<CommandSectionTab>('overview');
  const [pipelineView, setPipelineView] = useState<'table' | 'kanban'>('table');
  const [nudgedIds, setNudgedIds] = useState<Record<string, boolean>>({});

  const mergedDeals: DrawerDealRecord[] = liveDeals;
  const mergedCommissions = liveCommissions;

  // Live CBUAE Eligibility & Multi-Bank Comparison Split-Screen state
  const [propValueAed, setPropValueAed] = useState(3200000);
  const [downPaymentPct, setDownPaymentPct] = useState(20);
  const [monthlySalaryAed, setMonthlySalaryAed] = useState(52000);
  const [cardLimitsAed, setCardLimitsAed] = useState(60000);
  const [existingEmiAed, setExistingEmiAed] = useState(2500);
  const [tenureYears, setTenureYears] = useState(25);
  const [selectedBanks, setSelectedBanks] = useState<string[]>(['ENBD', 'FAB', 'ADCB']);

  // Document Vault & OCR Split-Viewer state
  const [activeDocId, setActiveDocId] = useState('doc-1');
  const [docStatuses, setDocStatuses] = useState<Record<string, string>>({
    'doc-1': 'VERIFIED',
    'doc-2': 'VERIFIED',
    'doc-3': 'VERIFIED',
    'doc-4': 'PENDING_PAGE',
  });
  const [vaultBanner, setVaultBanner] = useState<string | null>(null);

  // Derived CBUAE calculations
  const loanAmountAed = Math.round(propValueAed * (1 - downPaymentPct / 100));
  const downPaymentAed = propValueAed - loanAmountAed;
  const stressedCardLiability = Math.round(cardLimitsAed * 0.05);
  const baseStressEmi = calcMonthlyEmi(loanAmountAed, 3.99 + 2.0, tenureYears);
  const totalStressedOutflow = baseStressEmi + stressedCardLiability + existingEmiAed;
  const calculatedDbrPct = Number(
    ((totalStressedOutflow / Math.max(1, monthlySalaryAed)) * 100).toFixed(1),
  );

  // Max Loan Eligible under 50% DBR cap & 7x Annual Salary LTI cap
  const maxMonthlyForMortgage = Math.max(
    0,
    monthlySalaryAed * 0.5 - stressedCardLiability - existingEmiAed,
  );
  const stressMonthlyRate = (3.99 + 2.0) / 100 / 12;
  const totalMonths = tenureYears * 12;
  const maxLoanByDbr = Math.round(
    (maxMonthlyForMortgage * (Math.pow(1 + stressMonthlyRate, totalMonths) - 1)) /
      (stressMonthlyRate * Math.pow(1 + stressMonthlyRate, totalMonths)),
  );
  const maxLoanByLti7x = monthlySalaryAed * 12 * 7;
  const maxLoanEligibleAed = Math.min(maxLoanByDbr, maxLoanByLti7x);

  // Total Upfront Cash Required
  const dld4PctFee = Math.round(propValueAed * 0.04) + 580;
  const trusteeFee = 4200;
  const valuationFee = 3150;
  const mortgageRegFee = Math.round(loanAmountAed * 0.0025) + 290;
  const totalUpfrontCashAed =
    downPaymentAed + dld4PctFee + trusteeFee + valuationFee + mortgageRegFee;

  const activeDoc =
    VAULT_CHECKLIST_ITEMS.find((d) => d.id === activeDocId) ?? VAULT_CHECKLIST_ITEMS[0]!;

  const toggleBankSelection = (code: string) => {
    setSelectedBanks((prev) =>
      prev.includes(code)
        ? prev.filter((c) => c !== code)
        : prev.length >= 3
          ? [...prev.slice(1), code]
          : [...prev, code],
    );
  };

  const showSection = (tab: CommandSectionTab) => activeTab === 'all' || activeTab === tab;

  const dubaiDateFormatted = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dubai',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  return (
    <div className="space-y-5 max-w-[1680px] mx-auto">
      {/* =====================================================================
          1. DARK OBSIDIAN DUBAI SKYLINE HERO BANNER (matching swkpropertiesOS Dashboard.tsx)
         ===================================================================== */}
      <section
        className="relative overflow-hidden rounded-[26px] text-white"
        style={{ background: 'linear-gradient(120deg, #111 0%, #1c1c1c 60%, #3a1d10 125%)' }}
      >
        <div
          className="absolute inset-0 opacity-[.28] bg-cover bg-center mix-blend-luminosity"
          style={{
            backgroundImage: 'url(/media/hero/dubai-skyline-hero.webp)',
            backgroundPosition: 'center 40%',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(90deg, rgba(10,10,10,.95) 0%, rgba(20,20,20,.78) 45%, rgba(20,20,20,.25) 100%)',
          }}
        />
        <div
          className="absolute -top-24 right-[12%] w-[420px] h-[420px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(255,91,31,.30), transparent 65%)' }}
        />
        <img
          src="/brand/skyline-front.svg"
          alt=""
          aria-hidden
          className="absolute bottom-0 left-0 w-full h-[70px] opacity-[.18] pointer-events-none"
        />

        <div className="relative grid gap-5 lg:grid-cols-[1.45fr_1fr] items-center p-5 sm:p-6">
          <div>
            <div className="font-mono text-[11px] font-bold tracking-[.14em] uppercase text-[#ff8a3d]">
              {dubaiDateFormatted}
            </div>
            <h1 className="m-0 mt-1.5 font-display font-bold text-white text-[22px] sm:text-[26px] leading-[1.15]">
              Good morning, <span className="swk-shimmer-text">Shabib</span>
            </h1>
            <p className="mt-1.5 mb-0 text-[13px] text-[#c7d2e4] max-w-[640px] leading-relaxed">
              {metrics.dealsCount} live database mortgage files · {metrics.leadsCount} active enquiries · 3M EIBOR{' '}
              {metrics.eibor3mPct}% · Double-Entry Trial Balance {metrics.isBalanced !== false ? '✓ Balanced' : 'Check'}.
            </p>
            <div className="flex flex-wrap gap-2 mt-4">
              <Link href="/os/crm" className="bw-btn-gold">
                <span>+ New Lead</span>
              </Link>
              <Link
                href="/os/los"
                className="inline-flex items-center gap-1.5 h-[36px] px-3.5 rounded-[9px] text-[13px] font-semibold text-white bg-white/10 border border-white/20 hover:bg-white/20 transition"
              >
                <Landmark className="size-3.5" />
                <span>24-Bank Underwriting</span>
              </Link>
              <Link
                href="/os/toolkit"
                className="inline-flex items-center gap-1.5 h-[36px] px-3.5 rounded-[9px] text-[13px] font-semibold text-white bg-white/10 border border-white/20 hover:bg-white/20 transition"
              >
                <Calculator className="size-3.5" />
                <span>Deal Toolkit</span>
              </Link>
              <Link
                href="/os/home"
                className="inline-flex items-center gap-1.5 h-[36px] px-3.5 rounded-[9px] text-[13px] font-semibold text-[#ffe4d6] bg-white/10 border border-[#ff5b1f]/40 hover:bg-[#ff5b1f]/25 transition"
              >
                <span>All Apps Launcher</span>
                <ArrowUpRight className="size-3.5" />
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            {[
              {
                l: 'Pipeline',
                v:
                  metrics.activePipelineFils > 0
                    ? `AED ${(metrics.activePipelineFils / 100000000).toFixed(2)}M`
                    : 'AED 0',
              },
              {
                l: 'Subvention Rec.',
                v: `AED ${Math.round(metrics.subventionReceivableFils / 100).toLocaleString('en-US')}`,
              },
              {
                l: 'Active Files',
                v: `${metrics.dealsCount} Deals`,
              },
            ].map((s) => (
              <div key={s.l} className="swk-glass px-3.5 py-3">
                <div className="font-mono text-[10.5px] font-semibold uppercase tracking-[.12em] text-[#ffd9c4]">
                  {s.l}
                </div>
                <div className="font-display font-num text-[17px] sm:text-[19px] font-bold text-white mt-1 whitespace-nowrap">
                  {s.v}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =====================================================================
          2. THREE CORE OPERATIONAL DEPARTMENTS (matching swkpropertiesOS Dashboard.tsx)
         ===================================================================== */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        {[
          {
            code: 'READY & BUYOUT',
            title: '1. Secondary Ready Purchases & Refinance',
            sub: 'Buyer / Partner A2A Intake → CBUAE 50% DBR & KFS Gate → 24-Bank IPA → Form F (MOU) & RICS Valuation → DLD Manager Cheques → 50/50 Split',
            to: '/os/deals?dept=ready',
            accent: '#c9420f',
          },
          {
            code: 'OFFPLAN',
            title: '2. Off-Plan Handover & Developer Oqood',
            sub: 'Developer Handover Notice → 50% Construction LTV / Completion Finance → Snagging & BCC → Developer NOC → Escrow Tranche Release',
            to: '/os/handover',
            accent: '#148a4b',
          },
          {
            code: 'COMMERCIAL & HNW',
            title: '3. Commercial, Equity Release & Non-Resident',
            sub: 'Corporate Trade Licence & 2Yr Audit → DSCR & Rental NOI Stress → Non-Resident 60% LTV Matrix → Cross-Sell Takaful, DIFC Wills & Golden Visa',
            to: '/os/los',
            accent: '#1c1c1c',
          },
        ].map((dept) => (
          <Link
            key={dept.code}
            href={dept.to}
            className="bw-card p-4 border-t-4 hover:shadow-md transition flex flex-col justify-between group"
            style={{ borderTopColor: dept.accent }}
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10.5px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[var(--surface-2)] text-[var(--ink)] border border-[var(--line)]">
                  DEPT · {dept.code}
                </span>
                <ArrowUpRight className="size-4 text-[var(--muted)] group-hover:text-[var(--ink)] transition" />
              </div>
              <div className="font-display font-bold text-[15px] text-[var(--ink)] mt-2">{dept.title}</div>
              <p className="text-[12.5px] text-[var(--muted)] mt-1 leading-relaxed">{dept.sub}</p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-[var(--line)] flex items-center justify-between text-[12.5px] font-bold text-[#148a4b]">
              <span>Open Department Pipeline</span>
              <span>→</span>
            </div>
          </Link>
        ))}
      </div>

      {/* =====================================================================
          3. 10-STEP SEQUENTIAL UAE MORTGAGE EXECUTION BUTTONS (matching Dashboard.tsx)
         ===================================================================== */}
      <div className="bw-card p-4">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <div>
            <div className="swk-eyebrow">STEP-BY-STEP COMPANY OPERATIONS</div>
            <h2 className="font-display font-bold text-[15px] text-[var(--ink)] m-0 mt-0.5">
              Sequential UAE Mortgage Execution Buttons (Click Any Step)
            </h2>
          </div>
          <Link href="/os/home" className="bw-btn-ghost">
            Open Full App Launcher →
          </Link>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { step: 'Step 01', title: 'Omnichannel Lead Intake', sub: 'Website, Partner BRN & WhatsApp (5m SLA)', to: '/os/crm' },
            { step: 'Step 02', title: 'Unified Inbox & AI Concierge', sub: 'WhatsApp, Email & Private Team Notes', to: '/os/inbox' },
            { step: 'Step 03', title: 'Joint KFS & AML / PEP Gate', sub: 'Mandatory CBUAE KFS & Sanctions Check', to: '/os/compliance' },
            { step: 'Step 04', title: '24-Bank Underwriting & LOS', sub: '50% DBR, 3% vs 5% Card Stress & 7x LTI', to: '/os/los' },
            { step: 'Step 05', title: 'Bank Rates & Tower APL', sub: 'Maker-Checker Rate Cards & Project APL', to: '/os/banks-apl' },
            { step: 'Step 06', title: 'DLD Form F, NOC & Cheques', sub: 'RICS Valuation, NOC & Manager Cheques', to: '/os/conveyancing' },
            { step: 'Step 07', title: 'Loans & Security PDC Vault', sub: 'EIBOR Amortization & Safe PDC Register', to: '/os/loan-risk-pdc' },
            { step: 'Step 08', title: 'Double-Entry GL & FTA VAT', sub: 'Trial Balance, VAT 201 & Peppol PINT-AE', to: '/os/erp' },
            { step: 'Step 09', title: '50–50% Commission & Refunds', sub: '50% Betterway / 50% Advisor + Partner Share', to: '/os/withdrawals' },
            { step: 'Step 10', title: 'Attendance QR, WPS & Bin', sub: '10:05 AM GST QR, MOHRE .SIF & Delete Bin', to: '/os/reception-qr' },
          ].map((st) => (
            <Link
              key={st.step}
              href={st.to}
              className="p-3 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] hover:bg-[#fff0e8] hover:border-[#c9420f] transition flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#1c1c1c] text-[#ffe4d6]">
                    {st.step}
                  </span>
                  <ArrowUpRight className="size-3.5 text-[var(--muted)] group-hover:text-[var(--ink)]" />
                </div>
                <div className="font-bold text-[13px] text-[var(--ink)] mt-2 leading-snug">{st.title}</div>
                <div className="text-[11.5px] text-[var(--muted)] mt-0.5 leading-snug">{st.sub}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* =====================================================================
          4. LEADERSHIP GOVERNANCE, OFFICE HOURS & BRIEFINGS BAR
         ===================================================================== */}
      <div className="bw-card p-4 bg-[var(--surface-2)]">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="space-y-0.5">
            <div className="text-[13px] font-bold text-[var(--ink)] flex items-center gap-1.5">
              <ShieldCheck className="size-4 text-[#148a4b]" />
              Betterway Leadership Governance, Office Hours (Mon–Fri 10am–7pm · Sat 10am–4pm · 10:05 AM Grace) &amp; Briefings
            </div>
            <div className="text-[12.5px] text-[var(--muted)]">
              <strong>Owner:</strong> Shabib Siraj (Full Control &amp; Final Approver) · <strong>Manager:</strong> Mohammad Haseeb (Operations) · <strong>Advisors:</strong> 50–50% Net Commission Split
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Link href="/os/reception-qr" className="bw-btn-ghost">
              10:05 AM Attendance &amp; QR
            </Link>
            <Link href="/os/team" className="bw-btn-ghost">
              Team &amp; Workload
            </Link>
            <Link href="/os/recycle-bin" className="bw-btn-gold">
              Pending Delete Bin
            </Link>
            <Link href="/os/withdrawals" className="bw-btn-navy">
              50/50 Splits &amp; Withdrawals
            </Link>
          </div>
        </div>
      </div>

      {/* =====================================================================
          5. INTERACTIVE 6-TAB INSTITUTIONAL DEEP DIVE WORKSPACE BAR
         ===================================================================== */}
      <div className="bw-card p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="swk-eyebrow">UNDERWRITING &amp; OPERATIONS DEEP-DIVE</div>
            <h2 className="font-display font-bold text-[15px] text-[var(--ink)] m-0 mt-0.5">
              Private Banking &amp; Origination Command Tabs
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link href="/os/inbox" className="bw-btn-ghost">
              <span>Unified Inbox</span>
            </Link>
            {mergedDeals[0] ? (
              <button
                type="button"
                onClick={() => openDealDrawer(mergedDeals[0]!)}
                className="bw-btn-ghost"
              >
                <PanelRightOpen className="size-3.5 text-[#ff5b1f]" />
                <span>Inspect Deal Drawer</span>
              </button>
            ) : (
              <Link href="/os/deals" className="bw-btn-ghost">
                <PanelRightOpen className="size-3.5 text-[#ff5b1f]" />
                <span>Open Deal Pipeline</span>
              </Link>
            )}
            <Link href="/os/print/proposal/1" className="bw-btn-navy">
              <Printer className="size-3.5 text-[#ff8a3d]" />
              <span>Print 3-Bank Proposal</span>
            </Link>
          </div>
        </div>

        {/* Clean Corporate Module Switcher Bar */}
        <div className="flex items-center justify-between gap-2 pt-3 border-t border-[var(--line)] overflow-x-auto">
          <div className="flex items-center gap-1">
            {[
              { id: 'overview', label: 'A. Executive Command', icon: LayoutDashboard },
              { id: 'pipeline', label: `B. Mortgage Pipeline (${mergedDeals.length})`, icon: Kanban },
              { id: 'cbuae', label: 'C. CBUAE Eligibility & Banks', icon: Calculator },
              { id: 'vault', label: 'D. Document & OCR Vault', icon: FolderLock },
              { id: 'closing', label: 'E. DLD Closing & Cheques', icon: Send },
              { id: 'ledger', label: 'F. Commission & VAT Ledger', icon: TrendingUp },
            ].map((t) => {
              const Icon = t.icon;
              const isAct = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id as CommandSectionTab)}
                  className={`inline-flex items-center gap-1.5 rounded-[9px] px-3 py-1.5 text-[12.5px] font-semibold whitespace-nowrap transition cursor-pointer ${
                    isAct
                      ? 'bg-[#1c1c1c] text-white'
                      : 'text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--ink)]'
                  }`}
                >
                  <Icon className={`size-3.5 ${isAct ? 'text-[#ff8a3d]' : 'text-[var(--muted)]'}`} />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setActiveTab(activeTab === 'all' ? 'overview' : 'all')}
            className={`px-3 py-1.5 rounded-[9px] font-mono text-[11px] font-semibold whitespace-nowrap border cursor-pointer ${
              activeTab === 'all'
                ? 'bg-[#ff5b1f] text-white border-[#ff5b1f]'
                : 'border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            {activeTab === 'all' ? 'Compact Tab View' : 'Show All 6 Sections'}
          </button>
        </div>
      </div>

      {/* =====================================================================
          A. EXECUTIVE COMMAND DASHBOARD (Top-Level View)
         ===================================================================== */}
      {showSection('overview') && (
        <section className="space-y-4">
          {/* Top Row: 4 Live SQLite Stat Cards with Sparklines & Tabular Monospace Figures */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                label: 'Active Pipeline Volume',
                value:
                  metrics.activePipelineFils > 0
                    ? `AED ${(metrics.activePipelineFils / 100000000).toFixed(2)}M`
                    : 'AED 0',
                sub: `${metrics.dealsCount} live mortgage files in SQLite`,
                badge: 'Live DB',
                badgeStyle: 'bg-[#F0FDFA] text-[#148a4b] border-[#148a4b]/30',
                sparkColor: '#148a4b',
                sparkPoints: '0,24 20,20 40,22 60,14 80,16 100,6',
                onClick: () => setActiveTab('pipeline'),
              },
              {
                label: 'Active Enquiries & Leads',
                value: `${metrics.leadsCount} Leads`,
                sub: '5-Minute GST Response SLA Enforced',
                badge: '5m SLA',
                badgeStyle: 'bg-[#fff0e8] text-[#c9420f] border-[#ff5b1f]/30',
                sparkColor: '#ff5b1f',
                sparkPoints: '0,26 20,22 40,18 60,15 80,10 100,5',
                onClick: () => setActiveTab('cbuae'),
              },
              {
                label: 'Treasury Cash (GL 1100)',
                value: `AED ${Math.round(metrics.bankCashFils / 100).toLocaleString('en-US')}`,
                sub: `Subvention Rec: AED ${Math.round(metrics.subventionReceivableFils / 100).toLocaleString('en-US')}`,
                badge: metrics.isBalanced !== false ? '✓ Balanced' : 'Check',
                badgeStyle: 'bg-[#F0FDFA] text-[#148a4b] border-[#148a4b]/30',
                sparkColor: '#1c1c1c',
                sparkPoints: '0,22 20,18 40,20 60,12 80,9 100,4',
                onClick: () => setActiveTab('closing'),
              },
              {
                label: 'Net Profit After Tax',
                value: `AED ${Math.round(metrics.netProfitFils / 100).toLocaleString('en-US')}`,
                sub: `PDC Vault (${metrics.pdcVaultCount}): AED ${Math.round(metrics.pdcVaultFils / 100).toLocaleString('en-US')}`,
                badge: 'FTA VAT & CT',
                badgeStyle: 'bg-[#FFFBEB] text-[#D97706] border-[#D97706]/30',
                sparkColor: '#D97706',
                sparkPoints: '0,25 20,19 40,15 60,17 80,8 100,6',
                onClick: () => setActiveTab('ledger'),
              },
            ].map((kpi) => (
              <button
                key={kpi.label}
                type="button"
                onClick={kpi.onClick}
                className="bw-card bw-lift p-4 text-left flex flex-col justify-between gap-3 cursor-pointer"
              >
                <div className="flex items-start justify-between gap-2 w-full">
                  <span className="text-xs font-semibold text-[#64748B]">{kpi.label}</span>
                  <span
                    className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded border ${kpi.badgeStyle}`}
                  >
                    {kpi.badge}
                  </span>
                </div>

                <div className="flex items-end justify-between gap-2 w-full">
                  <div>
                    <div className="font-mono text-2xl font-bold tracking-tight text-[#0F172A] dark:text-[#F8FAFC]">
                      {kpi.value}
                    </div>
                    <div className="font-mono text-[11px] text-[#64748B] mt-0.5">{kpi.sub}</div>
                  </div>

                  <svg viewBox="0 0 100 30" className="w-20 h-7 shrink-0 overflow-visible">
                    <polyline
                      fill="none"
                      stroke={kpi.sparkColor}
                      strokeWidth="2"
                      points={kpi.sparkPoints}
                    />
                  </svg>
                </div>
              </button>
            ))}
          </div>

          {/* Middle Split: Left (65%) Pipeline Funnel & Bottleneck Bar + Right (35%) Urgent SLA & Expiry Feed */}
          <div className="grid grid-cols-12 gap-4">
            {/* Left 65% (8 cols): Pipeline Funnel & Bottleneck Bar */}
            <div className="col-span-12 lg:col-span-8 bw-card p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E8F0] dark:border-[#1E293B] pb-3">
                <div>
                  <h2 className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                    Pipeline Funnel &amp; Stage Bottleneck Bar
                  </h2>
                  <p className="text-[11px] text-[#64748B]">
                    Conversion drop-off and average turnaround days across UAE mortgage origination stages
                  </p>
                </div>
                <span className="font-mono text-xs font-semibold text-[#0D9488]">
                  Avg End-to-End Cycle: 21.8 Days
                </span>
              </div>

              <div className="space-y-2.5">
                {PIPELINE_FUNNEL_STAGES.map((s) => (
                  <div key={s.stage} className="grid grid-cols-12 items-center gap-3 text-xs">
                    <div className="col-span-5 sm:col-span-4 font-semibold text-[#0F172A] dark:text-[#F8FAFC] truncate">
                      {s.stage}
                    </div>
                    <div className="col-span-4 sm:col-span-5">
                      <div className="h-2.5 w-full rounded-[3px] bg-[#F1F5F9] dark:bg-[#1E293B] overflow-hidden">
                        <div
                          className={`h-full rounded-[3px] ${
                            s.status === 'warning'
                              ? 'bg-[#D97706]'
                              : 'bg-[#0F172A] dark:bg-[#2DD4BF]'
                          }`}
                          style={{ width: `${s.pct}%` }}
                        />
                      </div>
                    </div>
                    <div className="col-span-3 flex items-center justify-end gap-2 font-mono text-[11px]">
                      <span className="font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                        {s.files} ({s.volumeM})
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded font-semibold ${
                          s.status === 'warning'
                            ? 'bg-[#FFFBEB] text-[#D97706]'
                            : 'bg-[#F0FDFA] text-[#0D9488]'
                        }`}
                      >
                        {s.avgDays}d
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Live Corporate Treasury & Accounting Health Strip inside Overview */}
              <div className="pt-3 border-t border-[#E2E8F0] dark:border-[#1E293B] grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <Link
                  href="/os/accounts-expenses"
                  className="rounded-[6px] border border-[#E2E8F0] dark:border-[#1E293B] bg-[#F8FAFC] dark:bg-[#090D16] p-2.5 hover:border-[#0D9488]"
                >
                  <span className="text-[10px] font-bold uppercase text-[#64748B] block">
                    Treasury Cash (GL 1100)
                  </span>
                  <strong className="font-mono text-sm text-[#0F172A] dark:text-[#F8FAFC]">
                    AED {Math.round(metrics.bankCashFils / 100).toLocaleString('en-US')}
                  </strong>
                </Link>
                <Link
                  href="/os/erp"
                  className="rounded-[6px] border border-[#E2E8F0] dark:border-[#1E293B] bg-[#F8FAFC] dark:bg-[#090D16] p-2.5 hover:border-[#0D9488]"
                >
                  <span className="text-[10px] font-bold uppercase text-[#64748B] block">
                    Subvention Rec. (GL 1200)
                  </span>
                  <strong className="font-mono text-sm text-[#0D9488]">
                    AED {Math.round(metrics.subventionReceivableFils / 100).toLocaleString('en-US')}
                  </strong>
                </Link>
                <Link
                  href="/os/loan-risk-pdc"
                  className="rounded-[6px] border border-[#E2E8F0] dark:border-[#1E293B] bg-[#F8FAFC] dark:bg-[#090D16] p-2.5 hover:border-[#0D9488]"
                >
                  <span className="text-[10px] font-bold uppercase text-[#64748B] block">
                    PDC Safe Vault ({metrics.pdcVaultCount})
                  </span>
                  <strong className="font-mono text-sm text-[#0F172A] dark:text-[#F8FAFC]">
                    AED {Math.round(metrics.pdcVaultFils / 100).toLocaleString('en-US')}
                  </strong>
                </Link>
                <Link
                  href="/os/accounts-expenses"
                  className="rounded-[6px] border border-[#E2E8F0] dark:border-[#1E293B] bg-[#F8FAFC] dark:bg-[#090D16] p-2.5 hover:border-[#0D9488]"
                >
                  <span className="text-[10px] font-bold uppercase text-[#64748B] block">
                    Net Profit After Tax
                  </span>
                  <strong className="font-mono text-sm text-[#0D9488]">
                    AED {Math.round(metrics.netProfitFils / 100).toLocaleString('en-US')}
                  </strong>
                </Link>
              </div>
            </div>

            {/* Right 35% (4 cols): Urgent SLA & Expiry Feed */}
            <div className="col-span-12 lg:col-span-4 bw-card p-5 flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
                <div>
                  <h2 className="text-sm font-bold text-[var(--ink)]">
                    Active Files &amp; SLA Feed
                  </h2>
                  <p className="text-[11px] text-[var(--muted)]">
                    Live database mortgage files &amp; drawer inspection
                  </p>
                </div>
                <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-[#fff0e8] text-[#c9420f] border border-[#ff5b1f]/30">
                  {mergedDeals.length} Live
                </span>
              </div>

              {mergedDeals.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center py-10 px-4 space-y-3">
                  <div className="text-xs font-bold text-[var(--ink)]">
                    No active mortgage files in pipeline yet
                  </div>
                  <p className="text-xs text-[var(--muted)] max-w-xs">
                    Production database is clean and ready for commercial intake. Log your first borrower inquiry in CRM to start a mortgage file.
                  </p>
                  <Link href="/os/crm" className="bw-btn-gold">
                    + Log First Borrower Lead →
                  </Link>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {mergedDeals.slice(0, 4).map((deal) => {
                    const isNudged = nudgedIds[deal.id];
                    return (
                      <div
                        key={deal.id}
                        className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-3 text-xs space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => openDealDrawer(deal)}
                            className="text-left font-bold text-[var(--ink)] hover:underline cursor-pointer"
                          >
                            {deal.borrowerName} ({deal.dealRef}) — {deal.selectedBank}
                          </button>
                        </div>
                        <p className="font-mono text-[11px] text-[var(--muted)]">
                          AED {(deal.loanAmountAed / 1000000).toFixed(2)}M • {deal.propertyTitle} • Stage: {deal.stage}
                        </p>
                        <div className="flex items-center justify-between pt-1">
                          <button
                            type="button"
                            onClick={() => openDealDrawer(deal)}
                            className="text-[11px] font-semibold text-[#148a4b] hover:underline cursor-pointer"
                          >
                            Open Deal Drawer →
                          </button>
                          <button
                            type="button"
                            onClick={() => setNudgedIds((prev) => ({ ...prev, [deal.id]: true }))}
                            className="px-2.5 py-1 rounded-md bg-[#1c1c1c] text-white font-semibold text-[11px] cursor-pointer"
                          >
                            {isNudged ? '✓ Nudge Dispatched' : 'Nudge Client'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* =====================================================================
          B. MORTGAGE PIPELINE (Dual-View: High-Density Table + Kanban)
         ===================================================================== */}
      {showSection('pipeline') && (
        <section className="bw-card p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] dark:border-[#1E293B] pb-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                  Mortgage Pipeline (Click Any Client to Open Slide-Over Deal Drawer)
                </h2>
                <span className="bw-badge font-mono">{mergedDeals.length} Active Files</span>
              </div>
              <p className="text-xs text-[#64748B]">
                Information-dense borrower rows with Residency Pill, LTV tag, DBR Health Pill (50% Cap), and Document Readiness Ring
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-[6px] border border-[#E2E8F0] dark:border-[#1E293B] bg-[#F8FAFC] dark:bg-[#090D16] p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setPipelineView('table')}
                  className={`inline-flex items-center gap-1.5 rounded-[4px] px-3 py-1 font-semibold cursor-pointer ${
                    pipelineView === 'table'
                      ? 'bg-[#0F172A] text-white dark:bg-[#F8FAFC] dark:text-[#090D16]'
                      : 'text-[#64748B]'
                  }`}
                >
                  <Table2 className="size-3.5" />
                  <span>Data Grid</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPipelineView('kanban')}
                  className={`inline-flex items-center gap-1.5 rounded-[4px] px-3 py-1 font-semibold cursor-pointer ${
                    pipelineView === 'kanban'
                      ? 'bg-[#0F172A] text-white dark:bg-[#F8FAFC] dark:text-[#090D16]'
                      : 'text-[#64748B]'
                  }`}
                >
                  <Kanban className="size-3.5" />
                  <span>Kanban Board</span>
                </button>
              </div>
              <Link href="/os/deals" className="bw-btn-ghost">
                <span>Full Pipeline Desk</span>
                <ArrowUpRight className="size-3.5" />
              </Link>
            </div>
          </div>

          {pipelineView === 'table' ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#E2E8F0] dark:border-[#1E293B] text-[11px] font-bold uppercase text-[#64748B]">
                    <th className="py-2.5 pr-3">Borrower &amp; Residency</th>
                    <th className="py-2.5 px-3">Property &amp; Loan Tag</th>
                    <th className="py-2.5 px-3">Bank &amp; Rate</th>
                    <th className="py-2.5 px-3">DBR Health Pill</th>
                    <th className="py-2.5 px-3">Doc Readiness Ring</th>
                    <th className="py-2.5 pl-3 text-right">Stage &amp; Drawer</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0] dark:divide-[#1E293B]">
                  {mergedDeals.map((deal) => {
                    const pctDocs = Math.round((deal.docsVerified / deal.docsTotal) * 100);
                    const r = 10;
                    const circ = 2 * Math.PI * r;
                    const dash = (pctDocs / 100) * circ;
                    return (
                      <tr
                        key={`${deal.id}-${deal.dealRef}`}
                        onClick={() => openDealDrawer(deal)}
                        className="hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B]/60 transition cursor-pointer"
                      >
                        <td className="py-3 pr-3">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                              {deal.borrowerName}
                            </span>
                            <span className="rounded-[4px] border border-[#E2E8F0] dark:border-[#1E293B] bg-[#F8FAFC] dark:bg-[#090D16] px-1.5 py-0.5 text-[10px] font-semibold text-[#64748B]">
                              {deal.residency}
                            </span>
                          </div>
                          <div className="font-mono text-[11px] text-[#64748B]">
                            {deal.dealRef} • EID {deal.eidNumber}
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <div className="font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                            {deal.propertyTitle}
                          </div>
                          <div className="font-mono text-[11px] text-[#0D9488] font-semibold">
                            AED {(deal.loanAmountAed / 1000000).toFixed(2)}M • {deal.ltvPct}% LTV
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <span className="inline-flex items-center gap-1.5 rounded-[4px] bg-[#0F172A] text-white dark:bg-[#F8FAFC] dark:text-[#090D16] px-2 py-0.5 font-mono text-[11px] font-bold">
                            {deal.selectedBank}
                          </span>
                          <span className="ml-2 font-mono text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                            {deal.rateLabel}
                          </span>
                        </td>

                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex items-center rounded-[4px] px-2 py-0.5 font-mono text-xs font-bold border ${
                              deal.dbrPct <= 45
                                ? 'bg-[#F0FDFA] text-[#0D9488] border-[#0D9488]/30'
                                : deal.dbrPct <= 50
                                  ? 'bg-[#FFFBEB] text-[#D97706] border-[#D97706]/30'
                                  : 'bg-[#FEF2F2] text-[#DC2626] border-[#DC2626]/30'
                            }`}
                          >
                            {deal.dbrPct.toFixed(1)}% DBR
                            {deal.dbrPct > 50 ? ' (Cap Exceeded)' : ''}
                          </span>
                        </td>

                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <svg className="size-6 -rotate-90" viewBox="0 0 28 28">
                              <circle
                                cx="14"
                                cy="14"
                                r={r}
                                fill="none"
                                stroke="#E2E8F0"
                                strokeWidth="3"
                              />
                              <circle
                                cx="14"
                                cy="14"
                                r={r}
                                fill="none"
                                stroke="#0D9488"
                                strokeWidth="3"
                                strokeDasharray={`${dash} ${circ}`}
                                strokeLinecap="round"
                              />
                            </svg>
                            <span className="font-mono text-[11px] font-semibold">
                              {deal.docsVerified}/{deal.docsTotal} Docs
                            </span>
                            <span className="rounded bg-[#F1F5F9] dark:bg-[#1E293B] px-1.5 py-0.5 font-mono text-[10px] text-[#64748B]">
                              {deal.daysInStage}d in stage
                            </span>
                          </div>
                        </td>

                        <td className="py-3 pl-3 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openDealDrawer(deal);
                            }}
                            className="bw-btn-ghost text-[11px]"
                          >
                            <span>{deal.stage}</span>
                            <PanelRightOpen className="size-3.5 text-[#0D9488]" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {mergedDeals.map((deal) => (
                <div
                  key={`${deal.id}-${deal.dealRef}`}
                  onClick={() => openDealDrawer(deal)}
                  className="rounded-[6px] border border-[#E2E8F0] dark:border-[#1E293B] bg-[#F8FAFC] dark:bg-[#090D16] p-3.5 space-y-2.5 hover:border-[#0D9488] transition cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-[#0F172A] text-white">
                      {deal.stage}
                    </span>
                    <span className="font-mono text-[10px] text-[#64748B]">
                      {deal.daysInStage}d in stage
                    </span>
                  </div>
                  <div>
                    <p className="font-bold text-sm text-[#0F172A] dark:text-[#F8FAFC]">
                      {deal.borrowerName}
                    </p>
                    <p className="text-[11px] text-[#64748B] truncate">{deal.propertyTitle}</p>
                  </div>
                  <div className="flex items-center justify-between font-mono text-xs">
                    <span className="font-bold text-[#0D9488]">
                      AED {(deal.loanAmountAed / 1000000).toFixed(2)}M ({deal.ltvPct}% LTV)
                    </span>
                    <span className="font-semibold">
                      {deal.selectedBank} • {deal.rateLabel}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-[#E2E8F0] dark:border-[#1E293B] text-[11px] font-mono">
                    <span
                      className={`px-1.5 py-0.5 rounded font-bold ${
                        deal.dbrPct <= 45
                          ? 'bg-[#F0FDFA] text-[#0D9488]'
                          : deal.dbrPct <= 50
                            ? 'bg-[#FFFBEB] text-[#D97706]'
                            : 'bg-[#FEF2F2] text-[#DC2626]'
                      }`}
                    >
                      {deal.dbrPct.toFixed(1)}% DBR
                    </span>
                    <span className="text-[#64748B]">
                      {deal.docsVerified}/{deal.docsTotal} Docs Verified
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* =====================================================================
          C. LIVE CBUAE ELIGIBILITY & MULTI-BANK COMPARISON SPLIT-SCREEN
         ===================================================================== */}
      {showSection('cbuae') && (
        <section className="grid grid-cols-12 gap-4">
          {/* Left Panel (5 cols): Interactive Input Controls & Live CBUAE Gauges */}
          <div className="col-span-12 lg:col-span-5 bw-card p-5 space-y-4">
            <div className="border-b border-[#E2E8F0] dark:border-[#1E293B] pb-3">
              <span className="font-mono text-[10px] font-bold uppercase text-[#0D9488]">
                Live CBUAE Underwriting Engine
              </span>
              <h2 className="text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                Eligibility &amp; 50.0% DBR Stress Calculator
              </h2>
            </div>

            {/* 3 Instant Live Gauges at the Top */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="rounded-[6px] border border-[#E2E8F0] dark:border-[#1E293B] bg-[#F8FAFC] dark:bg-[#090D16] p-3">
                <span className="text-[10px] font-bold uppercase text-[#64748B]">
                  Max Loan Eligible
                </span>
                <p className="font-mono text-sm sm:text-base font-bold text-[#0D9488] mt-0.5">
                  AED {(maxLoanEligibleAed / 1000000).toFixed(2)}M
                </p>
              </div>

              <div className="rounded-[6px] border border-[#E2E8F0] dark:border-[#1E293B] bg-[#F8FAFC] dark:bg-[#090D16] p-3">
                <span className="text-[10px] font-bold uppercase text-[#64748B]">
                  Calculated DBR %
                </span>
                <p
                  className={`font-mono text-sm sm:text-base font-bold mt-0.5 ${
                    calculatedDbrPct <= 45
                      ? 'text-[#0D9488]'
                      : calculatedDbrPct <= 50
                        ? 'text-[#D97706]'
                        : 'text-[#DC2626]'
                  }`}
                >
                  {calculatedDbrPct}%{' '}
                  <span className="text-[10px] font-normal text-[#64748B]">/ 50%</span>
                </p>
              </div>

              <div className="rounded-[6px] border border-[#E2E8F0] dark:border-[#1E293B] bg-[#F8FAFC] dark:bg-[#090D16] p-3">
                <span className="text-[10px] font-bold uppercase text-[#64748B]">
                  Upfront Cash Req.
                </span>
                <p className="font-mono text-sm sm:text-base font-bold text-[#0F172A] dark:text-[#F8FAFC] mt-0.5">
                  AED {Math.round(totalUpfrontCashAed / 1000).toLocaleString('en-US')}k
                </p>
              </div>
            </div>

            {/* Hard Visual Marker at 50.0% CBUAE Ceiling */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-mono">
                <span className="text-[#64748B]">Stressed DBR Gauge (+2.0% CBUAE Buffer)</span>
                <span className="font-bold text-[#DC2626]">50.0% CBUAE Hard Ceiling</span>
              </div>
              <div className="relative h-3 w-full rounded bg-[#F1F5F9] dark:bg-[#1E293B] overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    calculatedDbrPct <= 45
                      ? 'bg-[#0D9488]'
                      : calculatedDbrPct <= 50
                        ? 'bg-[#D97706]'
                        : 'bg-[#DC2626]'
                  }`}
                  style={{ width: `${Math.min(100, (calculatedDbrPct / 65) * 100)}%` }}
                />
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-[#DC2626]"
                  style={{ left: `${(50 / 65) * 100}%` }}
                />
              </div>
            </div>

            {/* Interactive Sliders & Numeric Inputs */}
            <div className="space-y-3 text-xs pt-1">
              <div>
                <div className="flex justify-between font-semibold mb-1">
                  <span>Property Value (AED)</span>
                  <span className="font-mono font-bold">
                    AED {propValueAed.toLocaleString('en-US')}
                  </span>
                </div>
                <input
                  type="range"
                  min={800000}
                  max={15000000}
                  step={100000}
                  value={propValueAed}
                  onChange={(e) => setPropValueAed(Number(e.target.value))}
                  className="w-full accent-[#0F172A]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="font-semibold text-[#64748B]">Down Payment (%)</span>
                  <input
                    type="number"
                    min={15}
                    max={80}
                    value={downPaymentPct}
                    onChange={(e) => setDownPaymentPct(Number(e.target.value) || 20)}
                    className="bw-input font-mono font-bold mt-1"
                  />
                </label>
                <label className="block">
                  <span className="font-semibold text-[#64748B]">Tenure (Years, Max 25)</span>
                  <input
                    type="number"
                    min={5}
                    max={25}
                    value={tenureYears}
                    onChange={(e) => setTenureYears(Math.min(25, Number(e.target.value) || 25))}
                    className="bw-input font-mono font-bold mt-1"
                  />
                </label>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <label className="block">
                  <span className="font-semibold text-[#64748B]">Monthly Salary</span>
                  <input
                    type="number"
                    value={monthlySalaryAed}
                    onChange={(e) => setMonthlySalaryAed(Number(e.target.value) || 1)}
                    className="bw-input font-mono font-bold mt-1"
                  />
                </label>
                <label className="block">
                  <span className="font-semibold text-[#64748B]">Card Limits</span>
                  <input
                    type="number"
                    value={cardLimitsAed}
                    onChange={(e) => setCardLimitsAed(Number(e.target.value) || 0)}
                    className="bw-input font-mono font-bold mt-1"
                  />
                </label>
                <label className="block">
                  <span className="font-semibold text-[#64748B]">Existing EMIs</span>
                  <input
                    type="number"
                    value={existingEmiAed}
                    onChange={(e) => setExistingEmiAed(Number(e.target.value) || 0)}
                    className="bw-input font-mono font-bold mt-1"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Right Panel (7 cols): Ranked UAE Bank Matrix Cards */}
          <div className="col-span-12 lg:col-span-7 bw-card p-5 flex flex-col justify-between space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E8F0] dark:border-[#1E293B] pb-3">
              <div>
                <span className="font-mono text-[10px] font-bold uppercase text-[#0D9488]">
                  Multi-Bank Comparison Matrix ({selectedBanks.length}/3 Selected)
                </span>
                <h2 className="text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                  Ranked UAE Bank Offers for AED {loanAmountAed.toLocaleString('en-US')} Loan
                </h2>
              </div>

              <Link
                href={`/os/print/proposal/1?banks=${selectedBanks.join(',')}`}
                className="bw-btn-gold"
              >
                <Printer className="size-3.5" />
                <span>Generate Branded Client Proposal ({selectedBanks.length})</span>
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {BANK_MATRIX_CATALOG.map((bank) => {
                const emi = calcMonthlyEmi(loanAmountAed, bank.fixedRatePct, tenureYears);
                const stressEmi = calcMonthlyEmi(
                  loanAmountAed,
                  bank.fixedRatePct + 2.0,
                  tenureYears,
                );
                const bankCardStress = Math.round(cardLimitsAed * bank.cardStressRate);
                const bankDbr = Number(
                  (
                    ((stressEmi + bankCardStress + existingEmiAed) /
                      Math.max(1, monthlySalaryAed)) *
                    100
                  ).toFixed(1),
                );
                const isSelected = selectedBanks.includes(bank.code);
                const isEligible = bankDbr <= 50.0;

                return (
                  <div
                    key={bank.code}
                    onClick={() => toggleBankSelection(bank.code)}
                    className={`rounded-[6px] border p-3.5 text-xs space-y-2 transition cursor-pointer ${
                      isSelected
                        ? 'border-[#0D9488] bg-[#F0FDFA]/50 dark:bg-[#0D9488]/10'
                        : 'border-[#E2E8F0] dark:border-[#1E293B] bg-white dark:bg-[#111827]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="accent-[#0D9488]"
                        />
                        <span className="font-mono font-bold px-1.5 py-0.5 rounded bg-[#0F172A] text-white text-[10px]">
                          {bank.code}
                        </span>
                        <span className="font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                          {bank.name}
                        </span>
                      </div>
                      <span
                        className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          isEligible
                            ? 'bg-[#F0FDFA] text-[#0D9488]'
                            : 'bg-[#FEF2F2] text-[#DC2626]'
                        }`}
                      >
                        {bankDbr}% DBR
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-1 font-mono">
                      <div>
                        <span className="text-[10px] text-[#64748B] block">Fixed Rate</span>
                        <strong className="text-sm text-[#0F172A] dark:text-[#F8FAFC]">
                          {bank.fixedRatePct.toFixed(2)}%
                        </strong>
                        <span className="block text-[10px] text-[#64748B]">{bank.fixedTerm}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#64748B] block">Monthly EMI</span>
                        <strong className="text-sm text-[#0D9488]">
                          AED {emi.toLocaleString('en-US')}
                        </strong>
                        <span className="block text-[10px] text-[#64748B]">
                          Card @ {bank.cardStressRate * 100}%
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#64748B] block">Reversion</span>
                        <strong className="text-[11px] text-[#0F172A] dark:text-[#F8FAFC]">
                          {bank.reversionLabel}
                        </strong>
                        <span className="block text-[10px] text-[#64748B]">
                          Early: {bank.earlySettlementRule}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* =====================================================================
          D. INTELLIGENT DOCUMENT VAULT & OCR SPLIT-VIEWER
         ===================================================================== */}
      {showSection('vault') && (
        <section className="bw-card p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E8F0] dark:border-[#1E293B] pb-3">
            <div>
              <span className="font-mono text-[10px] font-bold uppercase text-[#0D9488]">
                AES-256-GCM Encrypted Vault &amp; Local Stirling-PDF Worker
              </span>
              <h2 className="text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                Intelligent Document Vault &amp; In-App OCR Split-Viewer
              </h2>
            </div>
            {vaultBanner && (
              <span className="font-mono text-xs font-semibold px-3 py-1 rounded bg-[#F0FDFA] text-[#0D9488] border border-[#0D9488]/30">
                {vaultBanner}
              </span>
            )}
          </div>

          <div className="grid grid-cols-12 gap-4">
            {/* Left Column (4 cols): Categorized Checklist */}
            <div className="col-span-12 lg:col-span-4 space-y-2">
              {VAULT_CHECKLIST_ITEMS.map((item) => {
                const st = docStatuses[item.id] || item.status;
                const isAct = item.id === activeDocId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveDocId(item.id)}
                    className={`w-full text-left rounded-[6px] border p-3 text-xs transition cursor-pointer ${
                      isAct
                        ? 'border-[#0F172A] dark:border-[#2DD4BF] bg-[#F8FAFC] dark:bg-[#090D16]'
                        : 'border-[#E2E8F0] dark:border-[#1E293B]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase text-[#64748B]">
                        {item.category}
                      </span>
                      <span
                        className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          st === 'VERIFIED'
                            ? 'bg-[#F0FDFA] text-[#0D9488]'
                            : st === 'REJECTED_WA'
                              ? 'bg-[#FEF2F2] text-[#DC2626]'
                              : 'bg-[#FFFBEB] text-[#D97706]'
                        }`}
                      >
                        {st}
                      </span>
                    </div>
                    <p className="font-semibold text-[#0F172A] dark:text-[#F8FAFC] mt-1">
                      {item.title}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Center Column (5 cols): In-App PDF & OCR Inspector */}
            <div className="col-span-12 lg:col-span-5 rounded-[6px] border border-[#E2E8F0] dark:border-[#1E293B] bg-[#F8FAFC] dark:bg-[#090D16] p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-[#E2E8F0] dark:border-[#1E293B] pb-2.5">
                <div>
                  <span className="font-mono text-[10px] font-bold text-[#0D9488] uppercase">
                    In-App OCR Key-Value Overlay
                  </span>
                  <h3 className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                    {activeDoc.title}
                  </h3>
                </div>
                <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B]">
                  Confidence: 99.4%
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2">
                {activeDoc.ocrFields.map((f) => (
                  <div
                    key={f.key}
                    className="flex items-center justify-between rounded-[4px] bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] px-3 py-2 text-xs"
                  >
                    <span className="text-[#64748B]">{f.key}</span>
                    <span className="font-mono font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                      {f.val}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column (3 cols): Compliance & Action Bar */}
            <div className="col-span-12 lg:col-span-3 flex flex-col justify-between rounded-[6px] border border-[#E2E8F0] dark:border-[#1E293B] p-4 space-y-3">
              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase text-[#64748B]">
                  Compliance &amp; Bank Portal Actions
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setDocStatuses((prev) => ({ ...prev, [activeDoc.id]: 'VERIFIED' }));
                    setVaultBanner(`✓ Verified ${activeDoc.category} for bank submission.`);
                  }}
                  className="w-full bw-btn-gold justify-center"
                >
                  <CheckCircle2 className="size-3.5" />
                  <span>Verify Document</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setDocStatuses((prev) => ({ ...prev, [activeDoc.id]: 'REJECTED_WA' }));
                    setVaultBanner(
                      'WhatsApp Template sent: "Page 3 of ENBD statement missing — please re-upload."',
                    );
                  }}
                  className="w-full bw-btn-ghost justify-center border-[#DC2626]/40 text-[#DC2626]"
                >
                  <XCircle className="size-3.5" />
                  <span>Reject via WhatsApp Reason</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setVaultBanner(
                      '✓ Stirling-PDF Worker merged & compressed 12 KYC/Income files into 4.2MB Bank Bundle.',
                    )
                  }
                  className="w-full bw-btn-navy justify-center"
                >
                  <FolderLock className="size-3.5" />
                  <span>Merge &amp; Compress (Stirling-PDF)</span>
                </button>
              </div>

              <Link
                href="/os/compliance"
                className="text-center text-xs font-semibold text-[#0D9488] hover:underline"
              >
                Open Full KFS &amp; goAML Vault →
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* =====================================================================
          E. DLD TRANSFER & MANAGER'S CHEQUE DAY-OF-CLOSING SHEET
         ===================================================================== */}
      {showSection('closing') && (
        <section className="bw-card p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] dark:border-[#1E293B] pb-3">
            <div>
              <span className="font-mono text-[10px] font-bold uppercase text-[#0D9488]">
                Al Manara DLD Registration Trustee
              </span>
              <h2 className="text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                DLD Transfer &amp; Manager&apos;s Cheque Day-of-Closing Sheet
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/os/conveyancing" className="bw-btn-ghost">
                <span>Conveyancing Desk</span>
              </Link>
              <Link href="/os/print/conveyancing/1" className="bw-btn-navy">
                <Printer className="size-3.5 text-[#2DD4BF]" />
                <span>Print Closing Sheet</span>
              </Link>
            </div>
          </div>

          {/* 6-Stage Visual Timeline Stepper */}
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
            {DLD_CLOSING_STEPS.map((st, idx) => (
              <div
                key={st.label}
                className={`rounded-[6px] border p-2.5 text-[11px] ${
                  st.done
                    ? 'border-[#0D9488]/40 bg-[#F0FDFA] text-[#0D9488]'
                    : st.active
                      ? 'border-[#D97706] bg-[#FFFBEB] text-[#D97706]'
                      : 'border-[#E2E8F0] text-[#64748B]'
                }`}
              >
                <div className="font-mono text-[10px] font-bold">
                  0{idx + 1} • {st.date}
                </div>
                <div className="font-semibold text-[#0F172A] dark:text-[#F8FAFC] mt-0.5 leading-tight">
                  {st.label}
                </div>
              </div>
            ))}
          </div>

          {/* Manager's Cheque Breakdown Ledger Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E2E8F0] dark:border-[#1E293B] text-[10px] font-bold uppercase text-[#64748B]">
                  <th className="py-2.5">Payee / Instrument</th>
                  <th className="py-2.5">Funding Source</th>
                  <th className="py-2.5">Verification Status</th>
                  <th className="py-2.5 text-right">Amount (AED)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] dark:divide-[#1E293B] font-mono">
                {[
                  ['1. Seller Liability Settlement Cheque (ADCB)', 'ENBD Disbursal', 'Verified against Liability Letter', '1,950,000.00'],
                  ['2. Seller Net Equity Manager Cheque', 'ENBD + Buyer', 'Matched to Form F Price', '2,250,000.00'],
                  ['3. Dubai Land Department (4% Transfer + AED 580)', 'Buyer Manager Chq', 'DLD e-Voucher Ready', '168,580.00'],
                  ['4. DLD Registration Trustee Fee (incl. VAT)', 'Buyer Card / Cash', 'Al Manara Trustee Confirmed', '4,200.00'],
                  ['5. RERA Brokerage Commission (2% + 5% VAT)', 'Buyer Manager Chq', 'Held in Safe Vault Custody', '88,200.00'],
                ].map(([payee, src, ver, amt]) => (
                  <tr key={payee}>
                    <td className="py-2.5 font-sans font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                      {payee}
                    </td>
                    <td className="py-2.5 text-[#64748B] text-[11px]">{src}</td>
                    <td className="py-2.5 font-sans text-[11px] text-[#0D9488] font-medium">{ver}</td>
                    <td className="py-2.5 text-right font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                      AED {amt}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* =====================================================================
          F. COMMISSION, CLAWBACK & UAE VAT LEDGER
         ===================================================================== */}
      {showSection('ledger') && (
        <section className="bw-card p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E8F0] dark:border-[#1E293B] pb-3">
            <div>
              <span className="font-mono text-[10px] font-bold uppercase text-[#0D9488]">
                Pay-When-Paid Waterfall &amp; 5% FTA VAT 201
              </span>
              <h2 className="text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                Commission, Clawback &amp; UAE VAT Ledger
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/os/accounts-expenses" className="bw-btn-ghost">
                <span>P&amp;L &amp; Balance Sheet</span>
              </Link>
              <Link href="/os/erp" className="bw-btn-navy">
                <span>Open Full GL &amp; VAT Desk</span>
                <ArrowUpRight className="size-3.5 text-[#2DD4BF]" />
              </Link>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E2E8F0] dark:border-[#1E293B] text-[10px] font-bold uppercase text-[#64748B]">
                  <th className="py-2.5">Deal / Client</th>
                  <th className="py-2.5">Bank &amp; Loan</th>
                  <th className="py-2.5 text-right">Gross Subvention</th>
                  <th className="py-2.5 text-right">Partner Cut</th>
                  <th className="py-2.5 text-right">Net Advisor 50%</th>
                  <th className="py-2.5 text-right">5% FTA VAT</th>
                  <th className="py-2.5 text-right">Status &amp; Clawback End</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] dark:divide-[#1E293B] font-mono">
                {mergedCommissions.map((row, idx) => (
                  <tr key={`${row.dealId}-${idx}`}>
                    <td className="py-2.5">
                      <div className="font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                        {row.dealId}
                      </div>
                      <div className="font-sans text-[11px] text-[#64748B]">{row.client}</div>
                    </td>
                    <td className="py-2.5">
                      <div className="font-bold">{row.bank}</div>
                      <div className="text-[11px] text-[#64748B]">
                        AED {(row.loanAed / 1000000).toFixed(2)}M ({row.grossPct})
                      </div>
                    </td>
                    <td className="py-2.5 text-right font-bold">
                      AED {row.grossAed.toLocaleString('en-US')}
                    </td>
                    <td className="py-2.5 text-right text-[#64748B]">
                      -AED {row.partnerCutAed.toLocaleString('en-US')}
                    </td>
                    <td className="py-2.5 text-right font-bold text-[#0D9488]">
                      AED {row.advisorSplitAed.toLocaleString('en-US')}
                    </td>
                    <td className="py-2.5 text-right text-[#0F172A] dark:text-[#F8FAFC]">
                      AED {row.vat5PctAed.toLocaleString('en-US')}
                    </td>
                    <td className="py-2.5 text-right">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          row.status === 'Paid'
                            ? 'bg-[#F0FDFA] text-[#0D9488]'
                            : row.status === 'Sent to Bank'
                              ? 'bg-[#FFFBEB] text-[#D97706]'
                              : 'bg-[#F1F5F9] text-[#64748B]'
                        }`}
                      >
                        {row.status}
                      </span>
                      <div className="text-[10px] text-[#64748B] mt-0.5">{row.clawbackEnd}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
