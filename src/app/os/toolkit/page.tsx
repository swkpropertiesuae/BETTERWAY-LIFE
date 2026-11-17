'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Calculator, Printer, Shield } from 'lucide-react';

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

function calcMonthlyEmi(principal: number, annualRatePct: number, years: number): number {
  const r = annualRatePct / 100 / 12;
  const n = years * 12;
  if (r <= 0 || n <= 0) return Math.round(principal / Math.max(1, n));
  return Math.round((principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1));
}

export default function ToolkitPage() {
  const [priceAed, setPriceAed] = useState(3200000);
  const [downPaymentPct, setDownPaymentPct] = useState(20);
  const [interestRatePct, setInterestRatePct] = useState(3.99);
  const [tenureYears, setTenureYears] = useState(25);
  const [monthlyIncomeAed, setMonthlyIncomeAed] = useState(52000);
  const [cardLimitsAed, setCardLimitsAed] = useState(60000);
  const [existingDebtAed, setExistingDebtAed] = useState(2500);
  const [grossSubventionAed, setGrossSubventionAed] = useState(32000);
  const [partnerShareAed, setPartnerShareAed] = useState(5000);
  const [selectedBanks, setSelectedBanks] = useState<string[]>(['ENBD', 'FAB', 'ADCB']);

  const loanAmount = Math.round(priceAed * (1 - downPaymentPct / 100));
  const downPaymentAed = priceAed - loanAmount;

  const emiContract = calcMonthlyEmi(loanAmount, interestRatePct, tenureYears);
  const emiStress = calcMonthlyEmi(loanAmount, interestRatePct + 2.0, tenureYears);
  const stressedCardLiability = Math.round(cardLimitsAed * 0.05);

  const dbrPct = Number(
    (
      ((emiStress + stressedCardLiability + existingDebtAed) / Math.max(1, monthlyIncomeAed)) *
      100
    ).toFixed(1),
  );

  // Max Loan Eligible under 50.0% CBUAE DBR ceiling & 7x Annual LTI ceiling
  const maxMonthlyMortgage = Math.max(
    0,
    monthlyIncomeAed * 0.5 - stressedCardLiability - existingDebtAed,
  );
  const stressR = (interestRatePct + 2.0) / 100 / 12;
  const nMonths = tenureYears * 12;
  const maxLoanByDbr = Math.round(
    (maxMonthlyMortgage * (Math.pow(1 + stressR, nMonths) - 1)) /
      (stressR * Math.pow(1 + stressR, nMonths)),
  );
  const maxLoanEligible = Math.min(maxLoanByDbr, monthlyIncomeAed * 12 * 7);

  // DLD & Upfront Purchase Costs
  const dldFee4Pct = Math.round(priceAed * 0.04) + 580;
  const trusteeFee = priceAed >= 500000 ? 4200 : 2100;
  const mortgageRegFee = Math.round(loanAmount * 0.0025) + 290;
  const bankValuationFee = 3150;
  const agencyFeeIncVat = Math.round(priceAed * 0.02 * 1.05);
  const totalUpfrontCash =
    downPaymentAed + dldFee4Pct + trusteeFee + mortgageRegFee + bankValuationFee + agencyFeeIncVat;

  // 50/50 Commission Split
  const netPool = Math.max(0, grossSubventionAed - partnerShareAed);
  const betterwayShare50 = Math.round(netPool * 0.5);
  const advisorShare50 = netPool - betterwayShare50;
  const goldenVisaEligible = priceAed >= 2000000;

  const toggleBank = (code: string) => {
    setSelectedBanks((prev) =>
      prev.includes(code)
        ? prev.filter((c) => c !== code)
        : prev.length >= 3
          ? [...prev.slice(1), code]
          : [...prev, code],
    );
  };

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="bw-card p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-[4px] bg-[#2a1418] text-white dark:bg-[#faf6f0] dark:text-[#231115] px-2 py-0.5 font-mono text-[10px] font-bold uppercase">
              Eligibility &amp; Rate Engine
            </span>
            <span className="font-mono text-xs text-[#7a1f2b] font-semibold">
              CBUAE 50.0% DBR Ceiling • 7x Annual LTI Cap • 4% DLD Cost-to-Close
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#2a1418] dark:text-[#faf6f0] mt-1">
            Live CBUAE Eligibility &amp; Multi-Bank Comparison Split-Screen
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href="/os/print/aip/1" className="bw-btn-ghost">
            <Shield className="size-3.5 text-[#7a1f2b]" />
            <span>60-Day Buyer AIP Certificate</span>
          </Link>
          <Link
            href={`/os/print/proposal/1?banks=${selectedBanks.join(',')}`}
            className="bw-btn-gold"
          >
            <Printer className="size-3.5" />
            <span>Generate Branded Client Proposal ({selectedBanks.length})</span>
          </Link>
        </div>
      </div>

      {/* Split-Screen: Left Panel (Interactive Input Controls + Live Gauges) | Right Panel (Ranked UAE Bank Matrix Cards) */}
      <div className="grid grid-cols-12 gap-4">
        {/* Left Panel (5 cols) */}
        <div className="col-span-12 lg:col-span-5 bw-card p-5 space-y-4">
          {/* 3 Instant Live Gauges at the Top */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="rounded-[6px] border border-[#e7dccd] dark:border-[#3a2326] bg-[#faf6f0] dark:bg-[#231115] p-3">
              <span className="text-[10px] font-bold uppercase text-[#766661]">
                Max Loan Eligible
              </span>
              <p className="font-mono text-base font-bold text-[#7a1f2b] mt-0.5">
                AED {(maxLoanEligible / 1000000).toFixed(2)}M
              </p>
            </div>
            <div className="rounded-[6px] border border-[#e7dccd] dark:border-[#3a2326] bg-[#faf6f0] dark:bg-[#231115] p-3">
              <span className="text-[10px] font-bold uppercase text-[#766661]">
                Calculated DBR %
              </span>
              <p
                className={`font-mono text-base font-bold mt-0.5 ${
                  dbrPct <= 45
                    ? 'text-[#7a1f2b]'
                    : dbrPct <= 50
                      ? 'text-[#a8741a]'
                      : 'text-[#c8321f]'
                }`}
              >
                {dbrPct}% <span className="text-[10px] font-normal text-[#766661]">/ 50%</span>
              </p>
            </div>
            <div className="rounded-[6px] border border-[#e7dccd] dark:border-[#3a2326] bg-[#faf6f0] dark:bg-[#231115] p-3">
              <span className="text-[10px] font-bold uppercase text-[#766661]">
                Total Upfront Cash
              </span>
              <p className="font-mono text-base font-bold text-[#2a1418] dark:text-[#faf6f0] mt-0.5">
                AED {Math.round(totalUpfrontCash / 1000).toLocaleString('en-US')}k
              </p>
            </div>
          </div>

          {/* Hard Visual Marker at 50.0% CBUAE Ceiling */}
          <div className="space-y-1">
            <div className="flex justify-between font-mono text-[11px]">
              <span className="text-[#766661]">
                Contract EMI: AED {emiContract.toLocaleString('en-US')} • Stress EMI (+2%): AED{' '}
                {emiStress.toLocaleString('en-US')}
              </span>
              <span className="font-bold text-[#c8321f]">50.0% CBUAE Ceiling</span>
            </div>
            <div className="relative h-3 w-full rounded bg-[#f1ebe1] dark:bg-[#3a2326] overflow-hidden">
              <div
                className={`h-full transition-all ${
                  dbrPct <= 45
                    ? 'bg-[#7a1f2b]'
                    : dbrPct <= 50
                      ? 'bg-[#a8741a]'
                      : 'bg-[#c8321f]'
                }`}
                style={{ width: `${Math.min(100, (dbrPct / 65) * 100)}%` }}
              />
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-[#c8321f]"
                style={{ left: `${(50 / 65) * 100}%` }}
              />
            </div>
          </div>

          {/* Sliders & Numeric Inputs */}
          <div className="space-y-3 text-xs">
            <label className="block">
              <div className="flex justify-between font-semibold mb-1">
                <span>Property Value (AED)</span>
                <span className="font-mono font-bold">
                  AED {priceAed.toLocaleString('en-US')}
                </span>
              </div>
              <input
                type="range"
                min={800000}
                max={15000000}
                step={100000}
                value={priceAed}
                onChange={(e) => setPriceAed(Number(e.target.value))}
                className="w-full accent-[#2a1418] mb-1.5"
              />
              <input
                type="number"
                value={priceAed}
                onChange={(e) => setPriceAed(Number(e.target.value) || 0)}
                className="bw-input font-mono font-bold"
              />
            </label>

            <div className="grid grid-cols-3 gap-2.5">
              <label className="block">
                <span className="font-semibold text-[#766661]">Down Payment %</span>
                <input
                  type="number"
                  value={downPaymentPct}
                  onChange={(e) => setDownPaymentPct(Number(e.target.value) || 20)}
                  className="bw-input font-mono font-bold mt-1"
                />
              </label>
              <label className="block">
                <span className="font-semibold text-[#766661]">Base Rate (%)</span>
                <input
                  type="number"
                  step="0.05"
                  value={interestRatePct}
                  onChange={(e) => setInterestRatePct(Number(e.target.value) || 3.99)}
                  className="bw-input font-mono font-bold mt-1"
                />
              </label>
              <label className="block">
                <span className="font-semibold text-[#766661]">Tenure (Yrs)</span>
                <input
                  type="number"
                  max={25}
                  value={tenureYears}
                  onChange={(e) => setTenureYears(Math.min(25, Number(e.target.value) || 25))}
                  className="bw-input font-mono font-bold mt-1"
                />
              </label>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <label className="block">
                <span className="font-semibold text-[#766661]">Monthly Salary</span>
                <input
                  type="number"
                  value={monthlyIncomeAed}
                  onChange={(e) => setMonthlyIncomeAed(Number(e.target.value) || 1)}
                  className="bw-input font-mono font-bold mt-1"
                />
              </label>
              <label className="block">
                <span className="font-semibold text-[#766661]">Card Limits</span>
                <input
                  type="number"
                  value={cardLimitsAed}
                  onChange={(e) => setCardLimitsAed(Number(e.target.value) || 0)}
                  className="bw-input font-mono font-bold mt-1"
                />
              </label>
              <label className="block">
                <span className="font-semibold text-[#766661]">Existing EMIs</span>
                <input
                  type="number"
                  value={existingDebtAed}
                  onChange={(e) => setExistingDebtAed(Number(e.target.value) || 0)}
                  className="bw-input font-mono font-bold mt-1"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-[#e7dccd] dark:border-[#3a2326]">
              <label className="block">
                <span className="font-semibold text-[#766661]">Gross Bank Subvention (AED)</span>
                <input
                  type="number"
                  value={grossSubventionAed}
                  onChange={(e) => setGrossSubventionAed(Number(e.target.value) || 0)}
                  className="bw-input font-mono font-bold mt-1"
                />
              </label>
              <label className="block">
                <span className="font-semibold text-[#766661]">B2B Partner Share (AED)</span>
                <input
                  type="number"
                  value={partnerShareAed}
                  onChange={(e) => setPartnerShareAed(Number(e.target.value) || 0)}
                  className="bw-input font-mono font-bold mt-1"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Right Panel (7 cols): Ranked UAE Bank Matrix Cards + DLD Upfront Cash & 50/50 Split */}
        <div className="col-span-12 lg:col-span-7 space-y-4">
          <div className="bw-card p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e7dccd] dark:border-[#3a2326] pb-3">
              <div>
                <h2 className="text-sm font-bold text-[#2a1418] dark:text-[#faf6f0]">
                  Ranked UAE Bank Matrix Cards (Select Top 3 for Client Proposal)
                </h2>
                <p className="text-[11px] text-[#766661]">
                  Facility Amount: <strong className="font-mono">AED {loanAmount.toLocaleString('en-US')}</strong> ({100 - downPaymentPct}% LTV)
                </p>
              </div>
              <span
                className={`font-mono text-xs font-bold px-2 py-0.5 rounded ${
                  goldenVisaEligible
                    ? 'bg-[#f8ecec] text-[#7a1f2b]'
                    : 'bg-[#f9f3e3] text-[#a8741a]'
                }`}
              >
                {goldenVisaEligible ? '✓ 10-Yr Golden Visa Eligible (AED 2M+)' : 'Below AED 2M Golden Visa'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {TOOLKIT_BANKS.map((bank) => {
                const emi = calcMonthlyEmi(loanAmount, bank.fixedRatePct, tenureYears);
                const stress = calcMonthlyEmi(loanAmount, bank.fixedRatePct + 2.0, tenureYears);
                const cardStress = Math.round(cardLimitsAed * bank.cardStressRate);
                const bankDbr = Number(
                  (((stress + cardStress + existingDebtAed) / Math.max(1, monthlyIncomeAed)) * 100).toFixed(1),
                );
                const isSel = selectedBanks.includes(bank.code);
                return (
                  <div
                    key={bank.code}
                    onClick={() => toggleBank(bank.code)}
                    className={`rounded-[6px] border p-3.5 text-xs space-y-2 transition cursor-pointer ${
                      isSel
                        ? 'border-[#7a1f2b] bg-[#f8ecec]/50 dark:bg-[#7a1f2b]/10'
                        : 'border-[#e7dccd] dark:border-[#3a2326]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isSel}
                          onChange={() => {}}
                          className="accent-[#7a1f2b]"
                        />
                        <span className="font-mono font-bold px-1.5 py-0.5 rounded bg-[#2a1418] text-white text-[10px]">
                          {bank.code}
                        </span>
                        <span className="font-bold text-[#2a1418] dark:text-[#faf6f0]">
                          {bank.name}
                        </span>
                      </div>
                      <span
                        className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          bankDbr <= 50
                            ? 'bg-[#f8ecec] text-[#7a1f2b]'
                            : 'bg-[#fbebe7] text-[#c8321f]'
                        }`}
                      >
                        {bankDbr}% DBR
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 font-mono pt-1">
                      <div>
                        <span className="text-[10px] text-[#766661] block">Fixed Rate</span>
                        <strong className="text-sm">{bank.fixedRatePct.toFixed(2)}%</strong>
                        <span className="text-[10px] text-[#766661] block">{bank.fixedTerm}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#766661] block">Monthly EMI</span>
                        <strong className="text-sm text-[#7a1f2b]">
                          AED {emi.toLocaleString('en-US')}
                        </strong>
                        <span className="text-[10px] text-[#766661] block">
                          Card @ {bank.cardStressRate * 100}%
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#766661] block">Revert &amp; Fee</span>
                        <strong className="text-[11px]">{bank.reversionLabel}</strong>
                        <span className="text-[10px] text-[#766661] block">
                          {bank.earlySettlement}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* DLD Cost-to-Close + 50/50 Split Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bw-card p-4 space-y-2 text-xs">
              <div className="font-bold text-[#2a1418] dark:text-[#faf6f0] border-b border-[#e7dccd] dark:border-[#3a2326] pb-2">
                DLD &amp; Upfront Cash Breakdown
              </div>
              {[
                [`Down Payment (${downPaymentPct}%)`, downPaymentAed],
                ['DLD 4% Transfer + AED 580', dldFee4Pct],
                ['DLD Registration Trustee Fee', trusteeFee],
                ['DLD Mortgage Reg (0.25% + AED 290)', mortgageRegFee],
                ['Bank RICS Valuation (incl. VAT)', bankValuationFee],
                ['RERA Agency Fee (2% + 5% VAT)', agencyFeeIncVat],
              ].map(([lbl, val]) => (
                <div key={String(lbl)} className="flex justify-between">
                  <span className="text-[#766661]">{lbl}</span>
                  <span className="font-mono font-bold">
                    AED {Number(val).toLocaleString('en-US')}
                  </span>
                </div>
              ))}
              <div className="flex justify-between pt-2 border-t border-[#e7dccd] dark:border-[#3a2326] font-mono font-bold text-[#7a1f2b]">
                <span>Total Upfront Cash Required</span>
                <span>AED {totalUpfrontCash.toLocaleString('en-US')}</span>
              </div>
            </div>

            <div className="bw-card p-4 flex flex-col justify-between space-y-3 text-xs">
              <div>
                <div className="font-bold text-[#2a1418] dark:text-[#faf6f0] border-b border-[#e7dccd] dark:border-[#3a2326] pb-2">
                  Betterway 50/50 Commission Waterfall
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3 font-mono">
                  <div className="rounded-[6px] border border-[#7a1f2b]/30 bg-[#f8ecec] p-3">
                    <span className="text-[10px] font-bold uppercase text-[#7a1f2b] block">
                      Betterway 50%
                    </span>
                    <strong className="text-base text-[#2a1418]">
                      AED {betterwayShare50.toLocaleString('en-US')}
                    </strong>
                  </div>
                  <div className="rounded-[6px] border border-[#e7dccd] dark:border-[#3a2326] bg-[#faf6f0] dark:bg-[#231115] p-3">
                    <span className="text-[10px] font-bold uppercase text-[#766661] block">
                      Advisor 50% Split
                    </span>
                    <strong className="text-base text-[#2a1418] dark:text-[#faf6f0]">
                      AED {advisorShare50.toLocaleString('en-US')}
                    </strong>
                  </div>
                </div>
              </div>

              <Link
                href={`/os/print/proposal/1?banks=${selectedBanks.join(',')}`}
                className="bw-btn-navy justify-center w-full"
              >
                <Printer className="size-3.5 text-[#c9a257]" />
                <span>Open Printable 3-Bank Client Proposal</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
