'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Award,
  Building2,
  Calculator,
  Check,
  Copy,
  FileSignature,
  Home,
  Landmark,
  Percent,
  Printer,
  Repeat,
  Scale,
  Shield,
  TrendingUp,
} from 'lucide-react';
import { computeToolkitAll, calcMonthlyEmi, type ToolkitResidency } from '@/lib/uae-deal-toolkit';

type ToolTabKey =
  | 'bank_match'
  | 'cost'
  | 'mortgage'
  | 'buyout'
  | 'offplan'
  | 'visa'
  | 'commission'
  | 'yield';

const TOOL_TABS: { key: ToolTabKey; label: string; badge: string }[] = [
  { key: 'bank_match', label: '24-Bank CBUAE Match', badge: 'LOS' },
  { key: 'cost', label: 'Buyer Cost-to-Close', badge: 'DLD 4%' },
  { key: 'mortgage', label: 'Pre-Qual & Amortisation', badge: '50% DBR' },
  { key: 'buyout', label: 'Refinance & Buyout Switch', badge: '10k Cap' },
  { key: 'offplan', label: 'Off-Plan Schedule', badge: 'Oqood' },
  { key: 'visa', label: 'Golden Visa Check', badge: 'AED 2M' },
  { key: 'commission', label: 'Commission Waterfall', badge: 'FTA VAT' },
  { key: 'yield', label: 'Yield, RERA & DSCR', badge: 'ROI' },
];

const TOOLKIT_BANKS = [
  {
    code: 'ENBD',
    name: 'Emirates NBD',
    fixedRatePct: 3.99,
    fixedTerm: '3Yr Fixed',
    reversionLabel: '3M EIBOR + 1.75%',
    bankFeeDesc: '1.05% (AED 0 on Buyout)',
    earlySettlement: 'Min(1%, AED 10,000) + VAT',
    cardStressRate: 0.05,
  },
  {
    code: 'FAB',
    name: 'First Abu Dhabi Bank',
    fixedRatePct: 3.89,
    fixedTerm: '3Yr Fixed',
    reversionLabel: '3M EIBOR + 1.65%',
    bankFeeDesc: '1.05% (50% Salary Transfer Waiver)',
    earlySettlement: 'Min(1%, AED 10,000) + VAT',
    cardStressRate: 0.05,
  },
  {
    code: 'DIB',
    name: 'Dubai Islamic Bank (Ijara)',
    fixedRatePct: 4.15,
    fixedTerm: '3Yr Ijara Profit',
    reversionLabel: '3M EIBOR + 1.85%',
    bankFeeDesc: 'AED 0 Processing Fee Promo',
    earlySettlement: 'Min(1%, AED 10,000) + VAT',
    cardStressRate: 0.05,
  },
  {
    code: 'ADCB',
    name: 'Abu Dhabi Commercial Bank',
    fixedRatePct: 4.09,
    fixedTerm: '5Yr Hybrid',
    reversionLabel: '3M EIBOR + 1.79%',
    bankFeeDesc: '1.05% Standard',
    earlySettlement: 'Min(1%, AED 10,000) + VAT',
    cardStressRate: 0.03,
  },
  {
    code: 'HSBC',
    name: 'HSBC UAE Premier',
    fixedRatePct: 3.95,
    fixedTerm: '3Yr Fixed',
    reversionLabel: '3M EIBOR + 1.69%',
    bankFeeDesc: '0.525% Premier Discount',
    earlySettlement: 'Min(1%, AED 10,000) + VAT',
    cardStressRate: 0.03,
  },
  {
    code: 'MASHREQ',
    name: 'Mashreq Home Finance',
    fixedRatePct: 4.25,
    fixedTerm: '2Yr Fixed',
    reversionLabel: '3M EIBOR + 1.90%',
    bankFeeDesc: '1.05% Standard',
    earlySettlement: 'Min(1%, AED 10,000) + VAT',
    cardStressRate: 0.05,
  },
];

const fmtAed = (n: number) => `AED ${Math.round(n).toLocaleString('en-US')}`;

export default function ToolkitPage() {
  const [activeTab, setActiveTab] = useState<ToolTabKey>('bank_match');
  const [copied, setCopied] = useState(false);

  // Shared & per-tool state
  const [priceAed, setPriceAed] = useState(3_200_000);
  const [downPaymentPct, setDownPaymentPct] = useState(20);
  const [interestRatePct, setInterestRatePct] = useState(3.99);
  const [tenureYears, setTenureYears] = useState(25);
  const [monthlyIncomeAed, setMonthlyIncomeAed] = useState(52_000);
  const [cardLimitsAed, setCardLimitsAed] = useState(60_000);
  const [existingDebtAed, setExistingDebtAed] = useState(2_500);
  const [residency, setResidency] = useState<ToolkitResidency>('expat');
  const [firstHome, setFirstHome] = useState(true);
  const [offPlan, setOffPlan] = useState(false);
  const [useMortgage, setUseMortgage] = useState(true);
  const [brokerPct, setBrokerPct] = useState(2);
  const [nocFeeAed, setNocFeeAed] = useState(1_500);

  // Refinance / Buyout
  const [currentLoanBalanceAed, setCurrentLoanBalanceAed] = useState(2_200_000);
  const [currentRatePct, setCurrentRatePct] = useState(5.49);
  const [newRatePct, setNewRatePct] = useState(3.89);
  const [remainingYears, setRemainingYears] = useState(20);

  // Off-Plan Schedule
  const [bookingPct, setBookingPct] = useState(20);
  const [constructionPct, setConstructionPct] = useState(40);
  const [handoverPct, setHandoverPct] = useState(40);
  const [postHandoverPct, setPostHandoverPct] = useState(0);

  // Golden Visa
  const [jointOwners, setJointOwners] = useState(1);

  // Commission Waterfall
  const [grossSubventionAed, setGrossSubventionAed] = useState(32_000);
  const [partnerSharePct, setPartnerSharePct] = useState(25);
  const [advisorSplitPct, setAdvisorSplitPct] = useState(50);

  // Yield & RERA
  const [annualRentAed, setAnnualRentAed] = useState(210_000);
  const [areaSqft, setAreaSqft] = useState(1_450);
  const [serviceChargePerSqft, setServiceChargePerSqft] = useState(18);
  const [reraIndexAvgAed, setReraIndexAvgAed] = useState(245_000);

  const [selectedBanks, setSelectedBanks] = useState<string[]>(['ENBD', 'FAB', 'ADCB']);

  const calc = useMemo(
    () =>
      computeToolkitAll({
        priceAed,
        downPaymentPct,
        interestRatePct,
        tenureYears,
        monthlyIncomeAed,
        existingDebtAed,
        cardLimitsAed,
        residency,
        firstHome,
        offPlan,
        currentLoanBalanceAed,
        currentRatePct,
        newRatePct,
        remainingYears,
        annualRentAed,
        areaSqft,
        serviceChargePerSqft,
        reraIndexAvgAed,
        jointOwners,
        grossSubventionAed,
        partnerSharePct,
        advisorSplitPct,
        bookingPct,
        constructionPct,
        handoverPct,
        postHandoverPct,
        brokerPct,
        nocFeeAed,
        useMortgage,
      }),
    [
      priceAed,
      downPaymentPct,
      interestRatePct,
      tenureYears,
      monthlyIncomeAed,
      existingDebtAed,
      cardLimitsAed,
      residency,
      firstHome,
      offPlan,
      currentLoanBalanceAed,
      currentRatePct,
      newRatePct,
      remainingYears,
      annualRentAed,
      areaSqft,
      serviceChargePerSqft,
      reraIndexAvgAed,
      jointOwners,
      grossSubventionAed,
      partnerSharePct,
      advisorSplitPct,
      bookingPct,
      constructionPct,
      handoverPct,
      postHandoverPct,
      brokerPct,
      nocFeeAed,
      useMortgage,
    ],
  );

  const toggleBank = (code: string) => {
    setSelectedBanks((prev) =>
      prev.includes(code)
        ? prev.filter((c) => c !== code)
        : prev.length >= 3
          ? [...prev.slice(1), code]
          : [...prev, code],
    );
  };

  const activeSummaryText = useMemo(() => {
    switch (activeTab) {
      case 'cost':
        return calc.summaries.cost;
      case 'mortgage':
      case 'bank_match':
        return calc.summaries.mortgage;
      case 'buyout':
        return calc.summaries.buyout;
      case 'offplan':
        return calc.summaries.offplan;
      case 'visa':
        return calc.summaries.visa;
      case 'commission':
        return calc.summaries.commission;
      case 'yield':
        return calc.summaries.yield;
    }
  }, [activeTab, calc]);

  const copyWhatsAppSummary = async () => {
    try {
      await navigator.clipboard.writeText(activeSummaryText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="bw-card p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-[6px] bg-[#021125] text-[#d7b04e] px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase">
              SWK-Grade 8-Tool UAE Deal &amp; Mortgage Suite
            </span>
            <span className="font-mono text-xs text-[#8a6518] font-semibold">
              CBUAE · DLD · RERA Decree 43/2013 · ICP Golden Visa · FTA VAT 5%
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#021125] mt-1">
            UAE Mortgage &amp; Real Estate Deal Utility Toolkit
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={copyWhatsAppSummary} className="bw-btn-gold cursor-pointer">
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            <span>{copied ? 'Copied for WhatsApp' : 'Copy WhatsApp Summary'}</span>
          </button>
          <button type="button" onClick={() => window.print()} className="bw-btn-ghost cursor-pointer">
            <Printer className="size-3.5" />
            <span>Print Sheet</span>
          </button>
          <Link href="/os/print/aip/1" className="bw-btn-ghost">
            <Shield className="size-3.5 text-[#8a6518]" />
            <span>60-Day AIP Certificate</span>
          </Link>
          <Link href={`/os/print/proposal/1?banks=${selectedBanks.join(',')}`} className="bw-btn-navy">
            <Printer className="size-3.5" />
            <span>Client Proposal ({selectedBanks.length})</span>
          </Link>
        </div>
      </div>

      {/* 8-Tab Segmented Navigation */}
      <div className="flex flex-wrap gap-1.5 rounded-2xl bg-white p-2 border border-[#e2e6ea] shadow-2xs">
        {TOOL_TABS.map((t) => {
          const isOn = activeTab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 cursor-pointer ${
                isOn
                  ? 'bg-[#021125] text-white shadow-sm'
                  : 'bg-transparent text-[#4a5868] hover:bg-[#f8f9fa] hover:text-[#021125]'
              }`}
            >
              <span>{t.label}</span>
              <span
                className={`px-1.5 py-0.5 rounded text-[9.5px] font-mono font-bold ${
                  isOn ? 'bg-[#d7b04e] text-[#021125]' : 'bg-[#f3efe7] text-[#8a6518]'
                }`}
              >
                {t.badge}
              </span>
            </button>
          );
        })}
      </div>

      {/* ====================================================================
          TAB 1: 24-BANK CBUAE MATCH & MULTI-BANK COMPARISON
          ==================================================================== */}
      {activeTab === 'bank_match' && (
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-5 bw-card p-5 space-y-4">
            <div className="grid grid-cols-3 gap-2.5">
              <div className="rounded-xl border border-[#e2e6ea] bg-[#f8f9fa] p-3">
                <span className="text-[10px] font-bold uppercase text-[#64748B]">Max Loan Eligible</span>
                <p className="font-mono text-base font-bold text-[#021125] mt-0.5">
                  AED {(calc.mortgage.maxLoanEligible / 1_000_000).toFixed(2)}M
                </p>
              </div>
              <div className="rounded-xl border border-[#e2e6ea] bg-[#f8f9fa] p-3">
                <span className="text-[10px] font-bold uppercase text-[#64748B]">Stress DBR %</span>
                <p
                  className={`font-mono text-base font-bold mt-0.5 ${
                    calc.mortgage.dbrPct <= 45
                      ? 'text-emerald-700'
                      : calc.mortgage.dbrPct <= 50
                        ? 'text-amber-600'
                        : 'text-rose-600'
                  }`}
                >
                  {calc.mortgage.dbrPct}% <span className="text-[10px] font-normal text-[#64748B]">/ 50%</span>
                </p>
              </div>
              <div className="rounded-xl border border-[#e2e6ea] bg-[#f8f9fa] p-3">
                <span className="text-[10px] font-bold uppercase text-[#64748B]">Total Upfront Cash</span>
                <p className="font-mono text-base font-bold text-[#021125] mt-0.5">
                  AED {Math.round(calc.costToClose.cashRequired / 1000).toLocaleString('en-US')}k
                </p>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between font-mono text-[11px]">
                <span className="text-[#64748B]">
                  Contract EMI: {fmtAed(calc.mortgage.emi)} • Stress EMI (+2%): {fmtAed(calc.mortgage.stressEmi)}
                </span>
                <span className="font-bold text-rose-600">50.0% CBUAE Ceiling</span>
              </div>
              <div className="relative h-3 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    calc.mortgage.dbrPct <= 45
                      ? 'bg-emerald-600'
                      : calc.mortgage.dbrPct <= 50
                        ? 'bg-amber-500'
                        : 'bg-rose-600'
                  }`}
                  style={{ width: `${Math.min(100, (calc.mortgage.dbrPct / 65) * 100)}%` }}
                />
                <div className="absolute top-0 bottom-0 w-0.5 bg-rose-600" style={{ left: `${(50 / 65) * 100}%` }} />
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <label className="block">
                <div className="flex justify-between font-semibold mb-1">
                  <span>Property Value (AED)</span>
                  <span className="font-mono font-bold">{fmtAed(priceAed)}</span>
                </div>
                <input
                  type="range"
                  min={500000}
                  max={15000000}
                  step={50000}
                  value={priceAed}
                  onChange={(e) => setPriceAed(Number(e.target.value))}
                  className="w-full accent-[#021125]"
                />
              </label>

              <div className="grid grid-cols-3 gap-2">
                <label className="block">
                  <span className="text-[11px] font-semibold">Down Payment %</span>
                  <input
                    type="number"
                    min={15}
                    max={80}
                    value={downPaymentPct}
                    onChange={(e) => setDownPaymentPct(Number(e.target.value))}
                    className="bw-input font-mono mt-1"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] font-semibold">Rate (% p.a.)</span>
                  <input
                    type="number"
                    step={0.05}
                    value={interestRatePct}
                    onChange={(e) => setInterestRatePct(Number(e.target.value))}
                    className="bw-input font-mono mt-1"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] font-semibold">Tenure (Max 25y)</span>
                  <input
                    type="number"
                    min={5}
                    max={25}
                    value={tenureYears}
                    onChange={(e) => setTenureYears(Number(e.target.value))}
                    className="bw-input font-mono mt-1"
                  />
                </label>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <label className="block">
                  <span className="text-[11px] font-semibold">Net Income / mo</span>
                  <input
                    type="number"
                    step={1000}
                    value={monthlyIncomeAed}
                    onChange={(e) => setMonthlyIncomeAed(Number(e.target.value))}
                    className="bw-input font-mono mt-1"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] font-semibold">Card Limits</span>
                  <input
                    type="number"
                    step={5000}
                    value={cardLimitsAed}
                    onChange={(e) => setCardLimitsAed(Number(e.target.value))}
                    className="bw-input font-mono mt-1"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] font-semibold">Other EMIs / mo</span>
                  <input
                    type="number"
                    step={500}
                    value={existingDebtAed}
                    onChange={(e) => setExistingDebtAed(Number(e.target.value))}
                    className="bw-input font-mono mt-1"
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-7 bw-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-sm text-[#021125]">
                Ranked UAE Bank Offers (Select up to 3 for Client Proposal PDF)
              </h2>
              <span className="font-mono text-xs text-[#8a6518] font-semibold">
                Loan: {fmtAed(calc.mortgage.loanAmount)} ({100 - calc.mortgage.effectiveDownPct}% LTV)
              </span>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              {TOOLKIT_BANKS.map((b) => {
                const bEmi = calcMonthlyEmi(calc.mortgage.loanAmount, b.fixedRatePct, tenureYears);
                const bStress = calcMonthlyEmi(calc.mortgage.loanAmount, b.fixedRatePct + 2.0, tenureYears);
                const bCardLiab = Math.round(cardLimitsAed * b.cardStressRate);
                const bDbr = Number(
                  (((bStress + bCardLiab + existingDebtAed) / Math.max(1, monthlyIncomeAed)) * 100).toFixed(1),
                );
                const selected = selectedBanks.includes(b.code);
                return (
                  <div
                    key={b.code}
                    onClick={() => toggleBank(b.code)}
                    className={`rounded-2xl border p-4 cursor-pointer transition ${
                      selected
                        ? 'border-[#021125] bg-[#faf3e0]/45 shadow-sm'
                        : 'border-[#e2e6ea] bg-white hover:border-[#d7b04e]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-mono text-[10px] font-bold uppercase text-[#8a6518]">
                          {b.fixedTerm}
                        </span>
                        <h3 className="font-bold text-sm text-[#021125]">{b.name}</h3>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-lg font-bold text-[#021125]">{b.fixedRatePct}%</div>
                        <div className="text-[10px] text-slate-500">{b.reversionLabel}</div>
                      </div>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span>
                        EMI: <strong className="font-mono">{fmtAed(bEmi)}/mo</strong>
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded font-mono text-[10.5px] font-bold ${
                          bDbr <= 50 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        DBR {bDbr}% ({b.cardStressRate * 100}% CC rule)
                      </span>
                    </div>
                    <div className="mt-1.5 text-[11px] text-slate-500 flex items-center justify-between">
                      <span>{b.bankFeeDesc}</span>
                      {selected && <span className="font-bold text-[#021125]">✓ In Proposal</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          TAB 2: BUYER COST-TO-CLOSE (SWK TOOLKIT TAB 1)
          ==================================================================== */}
      {activeTab === 'cost' && (
        <div className="grid grid-cols-12 gap-5">
          <div className="col-span-12 lg:col-span-5 bw-card p-5 space-y-4 text-xs">
            <h2 className="font-bold text-base text-[#021125]">
              Transaction Parameters (DLD 4%, Trustee, Mortgage Reg &amp; Agency)
            </h2>
            <label className="block">
              <span className="font-semibold">Purchase Price (AED)</span>
              <input
                type="number"
                step={50000}
                value={priceAed}
                onChange={(e) => setPriceAed(Number(e.target.value))}
                className="bw-input font-mono mt-1"
              />
            </label>
            <div className="flex items-center justify-between py-1">
              <label className="flex items-center gap-2 font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={useMortgage}
                  onChange={(e) => setUseMortgage(e.target.checked)}
                />
                <span>Financed with UAE Bank Mortgage</span>
              </label>
              <span className="px-2.5 py-0.5 rounded-full bg-[#faf3e0] text-[#8a6518] font-bold text-[11px]">
                {useMortgage ? 'Mortgage Buyer' : 'Cash Buyer'}
              </span>
            </div>
            {useMortgage && (
              <label className="block">
                <span className="font-semibold">Down Payment (%) — Loan {fmtAed(calc.costToClose.loanAmount)}</span>
                <input
                  type="number"
                  min={15}
                  max={90}
                  value={downPaymentPct}
                  onChange={(e) => setDownPaymentPct(Number(e.target.value))}
                  className="bw-input font-mono mt-1"
                />
              </label>
            )}
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="font-semibold">Agency Commission (% + VAT)</span>
                <input
                  type="number"
                  step={0.25}
                  value={brokerPct}
                  onChange={(e) => setBrokerPct(Number(e.target.value))}
                  className="bw-input font-mono mt-1"
                />
              </label>
              <label className="block">
                <span className="font-semibold">Developer NOC Fee (AED)</span>
                <input
                  type="number"
                  step={250}
                  value={nocFeeAed}
                  onChange={(e) => setNocFeeAed(Number(e.target.value))}
                  className="bw-input font-mono mt-1"
                />
              </label>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-7 bw-card p-5 space-y-4">
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-2xl bg-[#021125] text-white">
                <div className="text-[10.5px] uppercase tracking-wider text-[#d7b04e]">Total Cash to Close</div>
                <div className="font-mono text-xl font-bold mt-1">{fmtAed(calc.costToClose.cashRequired)}</div>
                <div className="text-[11px] text-white/70 mt-1">Down payment + all closing costs</div>
              </div>
              <div className="p-4 rounded-2xl bg-[#f8f9fa] border border-[#e2e6ea]">
                <div className="text-[10.5px] uppercase tracking-wider text-slate-500">Total Closing Fees</div>
                <div className="font-mono text-xl font-bold text-[#021125] mt-1">
                  {fmtAed(calc.costToClose.totalFeesAed)}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  {calc.costToClose.feesPctOfPrice}% of purchase price
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-[#f8f9fa] border border-[#e2e6ea]">
                <div className="text-[10.5px] uppercase tracking-wider text-slate-500">Down Payment Equity</div>
                <div className="font-mono text-xl font-bold text-[#021125] mt-1">
                  {fmtAed(calc.costToClose.downPaymentAed)}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  {useMortgage ? `${calc.mortgage.effectiveDownPct}% statutory equity` : '100% cash purchase'}
                </div>
              </div>
            </div>

            <div className="divide-y divide-slate-100 rounded-2xl border border-[#e2e6ea] bg-white p-4 text-xs">
              {calc.costToClose.lines.map((line) => (
                <div key={line.label} className="py-2.5 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-[#021125]">{line.label}</div>
                    <div className="text-[11px] text-slate-500">{line.note}</div>
                  </div>
                  <span className="font-mono font-bold text-[#021125]">{fmtAed(line.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          TAB 3: CBUAE PRE-QUALIFICATION & 25-YEAR AMORTISATION
          ==================================================================== */}
      {activeTab === 'mortgage' && (
        <div className="grid grid-cols-12 gap-5">
          <div className="col-span-12 lg:col-span-5 bw-card p-5 space-y-3.5 text-xs">
            <h2 className="font-bold text-base text-[#021125]">Borrower &amp; CBUAE Statutory Profile</h2>
            <label className="block">
              <span className="font-semibold">Property Price (AED)</span>
              <input
                type="number"
                step={100000}
                value={priceAed}
                onChange={(e) => setPriceAed(Number(e.target.value))}
                className="bw-input font-mono mt-1"
              />
            </label>
            <label className="block">
              <span className="font-semibold">Residency Status</span>
              <select
                value={residency}
                onChange={(e) => setResidency(e.target.value as ToolkitResidency)}
                className="bw-input mt-1"
              >
                <option value="expat">UAE Expat Resident (80% LTV ≤5M / 70% &gt;5M)</option>
                <option value="national">UAE National (85% LTV ≤5M / 75% &gt;5M)</option>
                <option value="non_resident">Non-Resident Overseas Investor (60% LTV)</option>
              </select>
            </label>
            <div className="flex flex-wrap gap-5 py-1">
              <label className="flex items-center gap-2 font-semibold cursor-pointer">
                <input type="checkbox" checked={firstHome} onChange={(e) => setFirstHome(e.target.checked)} />
                <span>First Home</span>
              </label>
              <label className="flex items-center gap-2 font-semibold cursor-pointer">
                <input type="checkbox" checked={offPlan} onChange={(e) => setOffPlan(e.target.checked)} />
                <span>Off-Plan Under Construction (50% LTV Cap)</span>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="font-semibold">Monthly Income (AED)</span>
                <input
                  type="number"
                  step={2500}
                  value={monthlyIncomeAed}
                  onChange={(e) => setMonthlyIncomeAed(Number(e.target.value))}
                  className="bw-input font-mono mt-1"
                />
              </label>
              <label className="block">
                <span className="font-semibold">Existing Monthly Debts</span>
                <input
                  type="number"
                  step={500}
                  value={existingDebtAed}
                  onChange={(e) => setExistingDebtAed(Number(e.target.value))}
                  className="bw-input font-mono mt-1"
                />
              </label>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-7 bw-card p-5 space-y-4">
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-2xl bg-[#021125] text-white">
                <div className="text-[10.5px] uppercase tracking-wider text-[#d7b04e]">Monthly Instalment (EMI)</div>
                <div className="font-mono text-xl font-bold mt-1">{fmtAed(calc.mortgage.emi)}</div>
                <div className="text-[11px] text-white/70 mt-1">
                  Loan {fmtAed(calc.mortgage.loanAmount)} @ {interestRatePct}%
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-[#faf3e0] border border-[#d7b04e]/40">
                <div className="text-[10.5px] uppercase tracking-wider text-[#8a6518]">Statutory Max LTV</div>
                <div className="font-mono text-xl font-bold text-[#021125] mt-1">{calc.mortgage.maxLtvPct}%</div>
                <div className="text-[11px] text-[#8a6518] mt-1">
                  Min down payment {calc.mortgage.minDownPct}% required
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-[#f8f9fa] border border-[#e2e6ea]">
                <div className="text-[10.5px] uppercase tracking-wider text-slate-500">Max Affordable Price</div>
                <div className="font-mono text-xl font-bold text-[#021125] mt-1">
                  {fmtAed(calc.mortgage.maxAffordablePrice)}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">At 50% CBUAE DBR ceiling</div>
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto rounded-xl border border-[#e2e6ea]">
              <table className="w-full text-xs">
                <thead className="bg-[#f8f9fa] text-slate-500 sticky top-0">
                  <tr>
                    <th className="py-2 px-3 text-left">Year</th>
                    <th className="py-2 px-3 text-right">Remaining Balance</th>
                    <th className="py-2 px-3 text-right">Cumulative Principal</th>
                    <th className="py-2 px-3 text-right">Cumulative Interest</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {calc.mortgage.schedule.filter((_, i) => i % 2 === 0 || i === calc.mortgage.schedule.length - 1).map((row) => (
                    <tr key={row.year}>
                      <td className="py-2 px-3 font-bold text-[#021125]">Year {row.year}</td>
                      <td className="py-2 px-3 text-right">{fmtAed(row.balance)}</td>
                      <td className="py-2 px-3 text-right text-emerald-700">{fmtAed(row.principalPaid)}</td>
                      <td className="py-2 px-3 text-right text-slate-600">{fmtAed(row.interestPaid)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          TAB 4: REFINANCE & BUYOUT SWITCH CALCULATOR
          ==================================================================== */}
      {activeTab === 'buyout' && (
        <div className="grid grid-cols-12 gap-5">
          <div className="col-span-12 lg:col-span-5 bw-card p-5 space-y-3.5 text-xs">
            <h2 className="font-bold text-base text-[#021125]">
              CBUAE Mortgage Buyout &amp; Switching Parameters
            </h2>
            <label className="block">
              <span className="font-semibold">Current Outstanding Loan Balance (AED)</span>
              <input
                type="number"
                step={50000}
                value={currentLoanBalanceAed}
                onChange={(e) => setCurrentLoanBalanceAed(Number(e.target.value))}
                className="bw-input font-mono mt-1"
              />
            </label>
            <div className="grid grid-cols-3 gap-2">
              <label className="block">
                <span className="font-semibold">Current Rate %</span>
                <input
                  type="number"
                  step={0.1}
                  value={currentRatePct}
                  onChange={(e) => setCurrentRatePct(Number(e.target.value))}
                  className="bw-input font-mono mt-1"
                />
              </label>
              <label className="block">
                <span className="font-semibold">New Buyout Rate %</span>
                <input
                  type="number"
                  step={0.1}
                  value={newRatePct}
                  onChange={(e) => setNewRatePct(Number(e.target.value))}
                  className="bw-input font-mono mt-1"
                />
              </label>
              <label className="block">
                <span className="font-semibold">Remaining Years</span>
                <input
                  type="number"
                  min={1}
                  max={25}
                  value={remainingYears}
                  onChange={(e) => setRemainingYears(Number(e.target.value))}
                  className="bw-input font-mono mt-1"
                />
              </label>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-7 bw-card p-5 space-y-4">
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-2xl bg-[#021125] text-white">
                <div className="text-[10.5px] uppercase tracking-wider text-[#d7b04e]">5-Year Net Savings</div>
                <div className="font-mono text-xl font-bold mt-1">{fmtAed(calc.buyout.netFiveYearSavingsAed)}</div>
                <div className="text-[11px] text-white/70 mt-1">After all CBUAE &amp; DLD switching fees</div>
              </div>
              <div className="p-4 rounded-2xl bg-[#f8f9fa] border border-[#e2e6ea]">
                <div className="text-[10.5px] uppercase tracking-wider text-slate-500">Monthly EMI Savings</div>
                <div className="font-mono text-xl font-bold text-emerald-700 mt-1">
                  {fmtAed(calc.buyout.monthlySavingsAed)}/mo
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  {fmtAed(calc.buyout.currentEmiAed)} → {fmtAed(calc.buyout.newBuyoutEmiAed)}
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-[#faf3e0] border border-[#d7b04e]/40">
                <div className="text-[10.5px] uppercase tracking-wider text-[#8a6518]">Break-Even Horizon</div>
                <div className="font-mono text-xl font-bold text-[#021125] mt-1">
                  {calc.buyout.breakEvenMonths} months
                </div>
                <div className="text-[11px] text-[#8a6518] mt-1">
                  Switching costs: {fmtAed(calc.buyout.totalSwitchingCostAed)}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-[#e2e6ea] p-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <span>CBUAE Statutory Early Settlement Fee (1% capped at AED 10,000 + 5% VAT)</span>
                <b className="font-mono">{fmtAed(calc.buyout.earlySettlementFeeAed)}</b>
              </div>
              <div className="flex justify-between">
                <span>DLD New Mortgage Registration (0.25% + AED 290)</span>
                <b className="font-mono">{fmtAed(calc.buyout.buyoutNewRegAed)}</b>
              </div>
              <div className="flex justify-between">
                <span>Bank Valuation &amp; Trustee Release Fees</span>
                <b className="font-mono">
                  {fmtAed(calc.buyout.buyoutValuationAed + calc.buyout.buyoutTrusteeAed)}
                </b>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          TAB 5: OFF-PLAN HANDOVER & PAYMENT SCHEDULE
          ==================================================================== */}
      {activeTab === 'offplan' && (
        <div className="grid grid-cols-12 gap-5">
          <div className="col-span-12 lg:col-span-5 bw-card p-5 space-y-3 text-xs">
            <h2 className="font-bold text-base text-[#021125]">Developer Off-Plan Milestone Split</h2>
            <label className="block">
              <span className="font-semibold">SPA Unit Price (AED)</span>
              <input
                type="number"
                step={50000}
                value={priceAed}
                onChange={(e) => setPriceAed(Number(e.target.value))}
                className="bw-input font-mono mt-1"
              />
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <label className="block">
                <span className="font-semibold">Booking (%)</span>
                <input
                  type="number"
                  value={bookingPct}
                  onChange={(e) => setBookingPct(Number(e.target.value))}
                  className="bw-input font-mono mt-1"
                />
              </label>
              <label className="block">
                <span className="font-semibold">Construction (%)</span>
                <input
                  type="number"
                  value={constructionPct}
                  onChange={(e) => setConstructionPct(Number(e.target.value))}
                  className="bw-input font-mono mt-1"
                />
              </label>
              <label className="block">
                <span className="font-semibold">Handover Mortgage (%)</span>
                <input
                  type="number"
                  value={handoverPct}
                  onChange={(e) => setHandoverPct(Number(e.target.value))}
                  className="bw-input font-mono mt-1"
                />
              </label>
              <label className="block">
                <span className="font-semibold">Post-Handover (%)</span>
                <input
                  type="number"
                  value={postHandoverPct}
                  onChange={(e) => setPostHandoverPct(Number(e.target.value))}
                  className="bw-input font-mono mt-1"
                />
              </label>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-7 bw-card p-5 space-y-4">
            <div className="grid sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-[#f8f9fa] border border-[#e2e6ea]">
                <div className="text-slate-500">Booking ({bookingPct}%)</div>
                <div className="font-mono font-bold text-base text-[#021125] mt-1">
                  {fmtAed(calc.offPlan.bookingAed)}
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-[#f8f9fa] border border-[#e2e6ea]">
                <div className="text-slate-500">Construction ({constructionPct}%)</div>
                <div className="font-mono font-bold text-base text-[#021125] mt-1">
                  {fmtAed(calc.offPlan.constructionAed)}
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-[#021125] text-white">
                <div className="text-[#d7b04e]">Handover Mortgage ({handoverPct}%)</div>
                <div className="font-mono font-bold text-base mt-1">{fmtAed(calc.offPlan.handoverAed)}</div>
              </div>
              <div className="p-3.5 rounded-xl bg-[#faf3e0] border border-[#d7b04e]/40">
                <div className="text-[#8a6518]">DLD Oqood (4%)</div>
                <div className="font-mono font-bold text-base text-[#021125] mt-1">
                  {fmtAed(calc.offPlan.oqoodFeeAed)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          TAB 6: GOLDEN VISA ELIGIBILITY CHECK (AED 2M / AED 750K)
          ==================================================================== */}
      {activeTab === 'visa' && (
        <div className="grid grid-cols-12 gap-5">
          <div className="col-span-12 lg:col-span-5 bw-card p-5 space-y-3 text-xs">
            <h2 className="font-bold text-base text-[#021125]">
              UAE Property Residency Visa Check (DLD / ICP Rules)
            </h2>
            <label className="block">
              <span className="font-semibold">Title Deed / Oqood Property Value (AED)</span>
              <input
                type="number"
                step={50000}
                value={priceAed}
                onChange={(e) => setPriceAed(Number(e.target.value))}
                className="bw-input font-mono mt-1"
              />
            </label>
            <label className="block">
              <span className="font-semibold">Number of Joint Owners on Title Deed</span>
              <input
                type="number"
                min={1}
                max={6}
                value={jointOwners}
                onChange={(e) => setJointOwners(Number(e.target.value))}
                className="bw-input font-mono mt-1"
              />
            </label>
          </div>

          <div className="col-span-12 lg:col-span-7 bw-card p-5 space-y-4">
            <div className="p-6 rounded-2xl bg-[#021125] text-white flex items-center justify-between gap-4">
              <div>
                <span className="text-xs font-mono uppercase tracking-wider text-[#d7b04e]">
                  Residency Eligibility Verdict
                </span>
                <h3 className="text-2xl font-bold mt-1">{calc.visa.visaTier}</h3>
                <p className="text-xs text-slate-300 mt-1">
                  Qualifying share per owner: <strong className="font-mono">{fmtAed(calc.visa.shareValueAed)}</strong>
                  {calc.visa.gapToGoldenVisaAed > 0
                    ? ` · Gap to AED 2M Golden Visa: ${fmtAed(calc.visa.gapToGoldenVisaAed)}`
                    : ' · Meets AED 2,000,000 DLD Golden Visa threshold ✓'}
                </p>
              </div>
              <Award size={42} className="text-[#d7b04e] shrink-0" />
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          TAB 7: COMMISSION & SUBVENTION WATERFALL (FTA 5% VAT)
          ==================================================================== */}
      {activeTab === 'commission' && (
        <div className="grid grid-cols-12 gap-5">
          <div className="col-span-12 lg:col-span-5 bw-card p-5 space-y-3 text-xs">
            <h2 className="font-bold text-base text-[#021125]">
              Pay-When-Paid Bank Subvention &amp; Partner Split
            </h2>
            <label className="block">
              <span className="font-semibold">Gross Bank Subvention ex-VAT (AED)</span>
              <input
                type="number"
                step={1000}
                value={grossSubventionAed}
                onChange={(e) => setGrossSubventionAed(Number(e.target.value))}
                className="bw-input font-mono mt-1"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="font-semibold">Partner Agency Share (%)</span>
                <input
                  type="number"
                  min={0}
                  max={60}
                  value={partnerSharePct}
                  onChange={(e) => setPartnerSharePct(Number(e.target.value))}
                  className="bw-input font-mono mt-1"
                />
              </label>
              <label className="block">
                <span className="font-semibold">Advisor Net Pool Split (%)</span>
                <input
                  type="number"
                  min={10}
                  max={80}
                  value={advisorSplitPct}
                  onChange={(e) => setAdvisorSplitPct(Number(e.target.value))}
                  className="bw-input font-mono mt-1"
                />
              </label>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-7 bw-card p-5 space-y-4">
            <div className="grid sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-[#f8f9fa] border border-[#e2e6ea]">
                <div className="text-slate-500">Gross Subvention</div>
                <div className="font-mono font-bold text-base text-[#021125] mt-1">
                  {fmtAed(calc.commission.grossSubventionAed)}
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-[#f8f9fa] border border-[#e2e6ea]">
                <div className="text-slate-500">Partner ORN/BRN ({partnerSharePct}%)</div>
                <div className="font-mono font-bold text-base text-[#021125] mt-1">
                  {fmtAed(calc.commission.partnerPayoutAed)}
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-[#faf3e0] border border-[#d7b04e]/40">
                <div className="text-[#8a6518]">Advisor Share ({advisorSplitPct}%)</div>
                <div className="font-mono font-bold text-base text-[#021125] mt-1">
                  {fmtAed(calc.commission.advisorPayoutAed)}
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-[#021125] text-white">
                <div className="text-[#d7b04e]">Betterway Net Retained</div>
                <div className="font-mono font-bold text-base mt-1">
                  {fmtAed(calc.commission.betterwayRetainedAed)}
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-[#d7b04e]/50 bg-[#faf3e0]/50 p-4 text-xs flex items-center justify-between">
              <span>
                FTA Tax Invoice Total (Gross {fmtAed(calc.commission.grossSubventionAed)} + 5% VAT{' '}
                {fmtAed(calc.commission.vat5PctAed)})
              </span>
              <strong className="font-mono text-base text-[#021125]">
                {fmtAed(calc.commission.invoiceTotalIncVatAed)}
              </strong>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          TAB 8: INVESTMENT YIELD, RERA INDEX (DECREE 43/2013) & DSCR
          ==================================================================== */}
      {activeTab === 'yield' && (
        <div className="grid grid-cols-12 gap-5">
          <div className="col-span-12 lg:col-span-5 bw-card p-5 space-y-3 text-xs">
            <h2 className="font-bold text-base text-[#021125]">
              Investment Yield, RERA Rental Index &amp; DSCR
            </h2>
            <div className="grid grid-cols-2 gap-2.5">
              <label className="block">
                <span className="font-semibold">Property Price (AED)</span>
                <input
                  type="number"
                  step={50000}
                  value={priceAed}
                  onChange={(e) => setPriceAed(Number(e.target.value))}
                  className="bw-input font-mono mt-1"
                />
              </label>
              <label className="block">
                <span className="font-semibold">Current Annual Rent (AED)</span>
                <input
                  type="number"
                  step={5000}
                  value={annualRentAed}
                  onChange={(e) => setAnnualRentAed(Number(e.target.value))}
                  className="bw-input font-mono mt-1"
                />
              </label>
              <label className="block">
                <span className="font-semibold">Built-Up Area (Sqft)</span>
                <input
                  type="number"
                  step={50}
                  value={areaSqft}
                  onChange={(e) => setAreaSqft(Number(e.target.value))}
                  className="bw-input font-mono mt-1"
                />
              </label>
              <label className="block">
                <span className="font-semibold">Service Charge (AED/Sqft)</span>
                <input
                  type="number"
                  step={1}
                  value={serviceChargePerSqft}
                  onChange={(e) => setServiceChargePerSqft(Number(e.target.value))}
                  className="bw-input font-mono mt-1"
                />
              </label>
            </div>
            <label className="block">
              <span className="font-semibold">DLD RERA Rental Index Benchmark Rent (AED/yr)</span>
              <input
                type="number"
                step={5000}
                value={reraIndexAvgAed}
                onChange={(e) => setReraIndexAvgAed(Number(e.target.value))}
                className="bw-input font-mono mt-1"
              />
            </label>
          </div>

          <div className="col-span-12 lg:col-span-7 bw-card p-5 space-y-4">
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-2xl bg-[#021125] text-white">
                <div className="text-[10.5px] uppercase tracking-wider text-[#d7b04e]">Net Rental Yield</div>
                <div className="font-mono text-2xl font-bold mt-1">{calc.yieldRera.netYieldPct}%</div>
                <div className="text-[11px] text-white/70 mt-1">
                  Gross {calc.yieldRera.grossYieldPct}% · Net {fmtAed(calc.yieldRera.netAnnualIncomeAed)}/yr
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-[#f8f9fa] border border-[#e2e6ea]">
                <div className="text-[10.5px] uppercase tracking-wider text-slate-500">
                  RERA Renewal Cap (Decree 43/2013)
                </div>
                <div className="font-mono text-2xl font-bold text-[#021125] mt-1">
                  +{calc.yieldRera.rera.maxIncreasePct}%
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Max Renewal Rent: {fmtAed(calc.yieldRera.rera.maxRenewalRentAed)}
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-[#faf3e0] border border-[#d7b04e]/40">
                <div className="text-[10.5px] uppercase tracking-wider text-[#8a6518]">Buy-to-Let DSCR</div>
                <div className="font-mono text-2xl font-bold text-[#021125] mt-1">{calc.yieldRera.dscrRatio}x</div>
                <div className="text-[11px] text-[#8a6518] mt-1">
                  {calc.yieldRera.dscrRatio >= 1.25 ? 'Passes 1.25x DSCR Rule ✓' : 'Below 1.25x DSCR'}
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-[#e2e6ea] p-3.5 text-xs text-slate-600">
              <strong>RERA Band Ruling:</strong> {calc.yieldRera.rera.bandLabel} · Annual Service Charges:{' '}
              <b className="font-mono">{fmtAed(calc.yieldRera.annualServiceChargesAed)}</b>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
