export type ToolkitResidency = 'expat' | 'national' | 'non_resident';

export interface ToolkitInputs {
  priceAed: number;
  downPaymentPct: number;
  interestRatePct: number;
  tenureYears: number;
  monthlyIncomeAed: number;
  existingDebtAed: number;
  cardLimitsAed: number;
  residency: ToolkitResidency;
  firstHome: boolean;
  offPlan: boolean;
  currentLoanBalanceAed: number;
  currentRatePct: number;
  newRatePct: number;
  remainingYears: number;
  annualRentAed: number;
  areaSqft: number;
  serviceChargePerSqft: number;
  reraIndexAvgAed: number;
  jointOwners: number;
  grossSubventionAed: number;
  partnerSharePct: number;
  advisorSplitPct: number;
  bookingPct: number;
  constructionPct: number;
  handoverPct: number;
  postHandoverPct: number;
  brokerPct?: number;
  nocFeeAed?: number;
  useMortgage?: boolean;
}

export function calcMonthlyEmi(principal: number, annualRatePct: number, years: number): number {
  const n = Math.max(1, Math.round(years * 12));
  const r = annualRatePct / 100 / 12;
  if (principal <= 0) return 0;
  if (r <= 0) return Math.round(principal / n);
  return Math.round((principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1));
}

export function calcStatutoryMaxLtvPct(
  priceAed: number,
  residency: ToolkitResidency,
  firstHome: boolean,
  offPlan: boolean,
): number {
  if (offPlan) return 50;
  if (residency === 'non_resident') return 60;
  if (!firstHome) return residency === 'national' ? 65 : 60;
  if (residency === 'national') return priceAed <= 5_000_000 ? 85 : 75;
  return priceAed <= 5_000_000 ? 80 : 70;
}

export function calcReraIncreasePct(currentRent: number, indexAvg: number): {
  underMarketPct: number;
  maxIncreasePct: number;
  maxIncreaseAed: number;
  maxRenewalRentAed: number;
  bandLabel: string;
} {
  if (indexAvg <= 0 || currentRent >= indexAvg * 0.9) {
    return {
      underMarketPct: 0,
      maxIncreasePct: 0,
      maxIncreaseAed: 0,
      maxRenewalRentAed: currentRent,
      bandLabel: '0–10% below index → 0% increase allowed',
    };
  }
  const diffPct = ((indexAvg - currentRent) / indexAvg) * 100;
  let maxIncreasePct = 0;
  let bandLabel = '0–10% below index → 0% increase';
  if (diffPct > 40) {
    maxIncreasePct = 20;
    bandLabel = '>40% below index → 20% max increase (Decree 43/2013)';
  } else if (diffPct > 30) {
    maxIncreasePct = 15;
    bandLabel = '31–40% below index → 15% max increase (Decree 43/2013)';
  } else if (diffPct > 20) {
    maxIncreasePct = 10;
    bandLabel = '21–30% below index → 10% max increase (Decree 43/2013)';
  } else if (diffPct > 10) {
    maxIncreasePct = 5;
    bandLabel = '11–20% below index → 5% max increase (Decree 43/2013)';
  }
  const maxIncreaseAed = Math.round((currentRent * maxIncreasePct) / 100);
  return {
    underMarketPct: Number(diffPct.toFixed(1)),
    maxIncreasePct,
    maxIncreaseAed,
    maxRenewalRentAed: currentRent + maxIncreaseAed,
    bandLabel,
  };
}

export function computeToolkitAll(input: ToolkitInputs) {
  const useMortgage = input.useMortgage ?? true;
  const maxLtvPct = calcStatutoryMaxLtvPct(
    input.priceAed,
    input.residency,
    input.firstHome,
    input.offPlan,
  );
  const minDownPct = 100 - maxLtvPct;
  const effectiveDownPct = Math.max(minDownPct, Math.min(90, input.downPaymentPct));
  const loanAmount = useMortgage
    ? Math.round(input.priceAed * (1 - effectiveDownPct / 100))
    : 0;
  const downPaymentAed = input.priceAed - loanAmount;

  // 1. Cost-to-Close
  const dldTransferFeeAed = Math.round(input.priceAed * 0.04) + 580;
  const trusteeFeeAed = input.priceAed >= 500_000 ? 4_200 : 2_100;
  const mortgageRegFeeAed = useMortgage ? Math.round(loanAmount * 0.0025) + 290 : 0;
  const valuationFeeAed = useMortgage ? 3_150 : 0;
  const bankArrangementFeeAed = useMortgage ? Math.round(loanAmount * 0.0105) : 0;
  const brokerPct = input.brokerPct ?? 2;
  const agencyFeeIncVatAed = Math.round(input.priceAed * (brokerPct / 100) * 1.05);
  const nocFeeAed = input.nocFeeAed ?? 1_500;

  const totalFeesAed =
    dldTransferFeeAed +
    trusteeFeeAed +
    mortgageRegFeeAed +
    valuationFeeAed +
    bankArrangementFeeAed +
    agencyFeeIncVatAed +
    nocFeeAed;
  const cashRequired = downPaymentAed + totalFeesAed;
  const feesPctOfPrice = Number(((totalFeesAed / Math.max(1, input.priceAed)) * 100).toFixed(2));

  // 2. Mortgage & CBUAE DBR + Amortisation
  const years = Math.min(25, Math.max(1, input.tenureYears));
  const emi = calcMonthlyEmi(loanAmount, input.interestRatePct, years);
  const stressEmi = calcMonthlyEmi(loanAmount, input.interestRatePct + 2.0, years);
  const cardMonthlyLiability = Math.round(input.cardLimitsAed * 0.05);
  const totalStressedDebt = stressEmi + cardMonthlyLiability + input.existingDebtAed;
  const dbrPct = Number(
    ((totalStressedDebt / Math.max(1, input.monthlyIncomeAed)) * 100).toFixed(1),
  );
  const dbrOk = dbrPct <= 50;

  const maxMonthlyMortgage = Math.max(
    0,
    input.monthlyIncomeAed * 0.5 - cardMonthlyLiability - input.existingDebtAed,
  );
  const stressMonthlyR = (input.interestRatePct + 2.0) / 100 / 12;
  const nMonths = years * 12;
  const maxLoanByDbr =
    stressMonthlyR > 0
      ? Math.round(
          (maxMonthlyMortgage * (Math.pow(1 + stressMonthlyR, nMonths) - 1)) /
            (stressMonthlyR * Math.pow(1 + stressMonthlyR, nMonths)),
        )
      : maxMonthlyMortgage * nMonths;
  const maxLoanByLti = input.monthlyIncomeAed * 12 * 7;
  const maxLoanEligible = Math.max(0, Math.min(maxLoanByDbr, maxLoanByLti));
  const maxAffordablePrice = Math.round(maxLoanEligible / Math.max(0.1, maxLtvPct / 100));
  const totalInterestAed = Math.max(0, emi * nMonths - loanAmount);

  const schedule: Array<{ year: number; balance: number; principalPaid: number; interestPaid: number }> = [];
  let bal = loanAmount;
  let cumInterest = 0;
  const monthlyR = input.interestRatePct / 100 / 12;
  for (let y = 1; y <= years; y++) {
    for (let m = 0; m < 12; m++) {
      if (bal <= 0) break;
      const intM = bal * monthlyR;
      const prinM = Math.min(bal, Math.max(0, emi - intM));
      bal = Math.max(0, bal - prinM);
      cumInterest += intM;
    }
    schedule.push({
      year: y,
      balance: Math.round(bal),
      principalPaid: Math.round(loanAmount - bal),
      interestPaid: Math.round(cumInterest),
    });
  }

  // 3. Refinance / Buyout Switch Calculator
  const rawEarlyFee = Math.min(input.currentLoanBalanceAed * 0.01, 10_000);
  const earlySettlementFeeAed = Math.round(rawEarlyFee * 1.05); // CBUAE cap AED 10,000 + 5% VAT = max AED 10,500
  const buyoutNewRegAed = Math.round(input.currentLoanBalanceAed * 0.0025) + 290;
  const buyoutValuationAed = 3_150;
  const buyoutTrusteeAed = 2_100;
  const totalSwitchingCostAed =
    earlySettlementFeeAed + buyoutNewRegAed + buyoutValuationAed + buyoutTrusteeAed;
  const currentEmiAed = calcMonthlyEmi(
    input.currentLoanBalanceAed,
    input.currentRatePct,
    input.remainingYears,
  );
  const newBuyoutEmiAed = calcMonthlyEmi(
    input.currentLoanBalanceAed,
    input.newRatePct,
    input.remainingYears,
  );
  const monthlySavingsAed = Math.max(0, currentEmiAed - newBuyoutEmiAed);
  const breakEvenMonths =
    monthlySavingsAed > 0 ? Math.ceil(totalSwitchingCostAed / monthlySavingsAed) : 999;
  const netFiveYearSavingsAed = monthlySavingsAed * 60 - totalSwitchingCostAed;

  // 4. Off-Plan Payment Schedule
  const bookingAed = Math.round((input.priceAed * input.bookingPct) / 100);
  const constructionAed = Math.round((input.priceAed * input.constructionPct) / 100);
  const handoverAed = Math.round((input.priceAed * input.handoverPct) / 100);
  const postHandoverAed = Math.round((input.priceAed * input.postHandoverPct) / 100);
  const oqoodFeeAed = Math.round(input.priceAed * 0.04);

  // 5. Golden Visa Eligibility (AED 2,000,000 10-Yr Golden Visa / AED 750,000 2-Yr Investor Visa)
  const owners = Math.max(1, Math.round(input.jointOwners));
  const shareValueAed = Math.round(input.priceAed / owners);
  const goldenVisaEligible = shareValueAed >= 2_000_000;
  const investorVisaEligible = !goldenVisaEligible && shareValueAed >= 750_000;
  const gapToGoldenVisaAed = Math.max(0, 2_000_000 - shareValueAed);
  const visaTier = goldenVisaEligible
    ? '10-Year UAE Golden Visa Eligible'
    : investorVisaEligible
      ? '2-Year UAE Property Investor Visa Eligible'
      : 'Below AED 750,000 Property Visa Threshold';

  // 6. Commission & Subvention Waterfall
  const partnerPayoutAed = Math.round((input.grossSubventionAed * input.partnerSharePct) / 100);
  const netPoolAed = Math.max(0, input.grossSubventionAed - partnerPayoutAed);
  const advisorPayoutAed = Math.round((netPoolAed * input.advisorSplitPct) / 100);
  const betterwayRetainedAed = netPoolAed - advisorPayoutAed;
  const vat5PctAed = Math.round(input.grossSubventionAed * 0.05);
  const invoiceTotalIncVatAed = input.grossSubventionAed + vat5PctAed;

  // 7. Investment Yield, RERA Rental Index & Commercial DSCR
  const annualServiceChargesAed = Math.round(input.areaSqft * input.serviceChargePerSqft);
  const maintenanceReserveAed = Math.round(input.annualRentAed * 0.03);
  const netAnnualIncomeAed = Math.max(
    0,
    input.annualRentAed - annualServiceChargesAed - maintenanceReserveAed,
  );
  const grossYieldPct = Number(
    ((input.annualRentAed / Math.max(1, input.priceAed)) * 100).toFixed(2),
  );
  const netYieldPct = Number(
    ((netAnnualIncomeAed / Math.max(1, input.priceAed)) * 100).toFixed(2),
  );
  const annualDebtServiceAed = emi * 12;
  const dscrRatio =
    annualDebtServiceAed > 0
      ? Number((netAnnualIncomeAed / annualDebtServiceAed).toFixed(2))
      : 9.99;
  const rera = calcReraIncreasePct(input.annualRentAed, input.reraIndexAvgAed);

  const fmtAed = (n: number) => `AED ${Math.round(n).toLocaleString('en-US')}`;

  return {
    costToClose: {
      downPaymentAed,
      loanAmount,
      dldTransferFeeAed,
      trusteeFeeAed,
      mortgageRegFeeAed,
      valuationFeeAed,
      bankArrangementFeeAed,
      agencyFeeIncVatAed,
      nocFeeAed,
      totalFeesAed,
      feesPctOfPrice,
      cashRequired,
      lines: [
        { label: 'DLD 4% Transfer + Title Deed', amount: dldTransferFeeAed, note: '4% of price + AED 580' },
        { label: 'DLD Registration Trustee Fee', amount: trusteeFeeAed, note: 'AED 4,200 (incl. VAT)' },
        { label: 'DLD Mortgage Registration (0.25%)', amount: mortgageRegFeeAed, note: '0.25% of loan + AED 290' },
        { label: 'Bank Property Valuation', amount: valuationFeeAed, note: 'AED 3,150 (incl. VAT)' },
        { label: 'Bank Arrangement Fee (1.05%)', amount: bankArrangementFeeAed, note: '1% of loan + 5% VAT' },
        { label: `Agency Fee (${brokerPct}% + VAT)`, amount: agencyFeeIncVatAed, note: 'Form B brokerage + 5% VAT' },
        { label: 'Developer NOC Fee', amount: nocFeeAed, note: 'AED 500 – 5,000' },
      ],
    },
    mortgage: {
      maxLtvPct,
      minDownPct,
      effectiveDownPct,
      loanAmount,
      downPaymentAed,
      emi,
      stressEmi,
      cardMonthlyLiability,
      dbrPct,
      dbrOk,
      maxLoanEligible,
      maxAffordablePrice,
      totalInterestAed,
      schedule,
    },
    buyout: {
      earlySettlementFeeAed,
      buyoutNewRegAed,
      buyoutValuationAed,
      buyoutTrusteeAed,
      totalSwitchingCostAed,
      currentEmiAed,
      newBuyoutEmiAed,
      monthlySavingsAed,
      breakEvenMonths,
      netFiveYearSavingsAed,
    },
    offPlan: {
      bookingAed,
      constructionAed,
      handoverAed,
      postHandoverAed,
      oqoodFeeAed,
      totalScheduledPct:
        input.bookingPct + input.constructionPct + input.handoverPct + input.postHandoverPct,
    },
    visa: {
      shareValueAed,
      goldenVisaEligible,
      investorVisaEligible,
      gapToGoldenVisaAed,
      visaTier,
    },
    commission: {
      grossSubventionAed: input.grossSubventionAed,
      partnerPayoutAed,
      netPoolAed,
      advisorPayoutAed,
      betterwayRetainedAed,
      vat5PctAed,
      invoiceTotalIncVatAed,
    },
    yieldRera: {
      annualServiceChargesAed,
      maintenanceReserveAed,
      netAnnualIncomeAed,
      grossYieldPct,
      netYieldPct,
      dscrRatio,
      rera,
    },
    summaries: {
      cost: `*Betterway Mortgages — Buyer Cost-to-Close*\nProperty Price: ${fmtAed(input.priceAed)}\nDown Payment: ${fmtAed(downPaymentAed)}\nTotal Closing Fees: ${fmtAed(totalFeesAed)} (${feesPctOfPrice}%)\n*Total Upfront Cash Required:* ${fmtAed(cashRequired)}`,
      mortgage: `*Betterway Mortgages — CBUAE Pre-Qualification*\nProperty: ${fmtAed(input.priceAed)} | Loan: ${fmtAed(loanAmount)} (Max LTV ${maxLtvPct}%)\nMonthly EMI: ${fmtAed(emi)} @ ${input.interestRatePct}% for ${years} yrs\nStress DBR (+2%): ${dbrPct}% (${dbrOk ? 'Passes CBUAE ≤50% Rule ✓' : 'Exceeds 50% Cap ⚠'})\n*Max Eligible Loan:* ${fmtAed(maxLoanEligible)}`,
      buyout: `*Betterway Mortgages — Refinance & Buyout Analysis*\nBalance: ${fmtAed(input.currentLoanBalanceAed)} (${input.currentRatePct}% → ${input.newRatePct}%)\nMonthly EMI Savings: ${fmtAed(monthlySavingsAed)}/mo\nTotal Switching Costs (incl. AED 10.5k CBUAE Exit Cap): ${fmtAed(totalSwitchingCostAed)}\n*Break-Even:* ${breakEvenMonths} months | *5-Yr Net Savings:* ${fmtAed(netFiveYearSavingsAed)}`,
      offplan: `*Betterway Mortgages — Off-Plan Handover Schedule*\nUnit Price: ${fmtAed(input.priceAed)} | DLD Oqood (4%): ${fmtAed(oqoodFeeAed)}\nBooking: ${fmtAed(bookingAed)} (${input.bookingPct}%) | Construction: ${fmtAed(constructionAed)} (${input.constructionPct}%)\n*Handover Mortgage Tranche:* ${fmtAed(handoverAed)} (${input.handoverPct}%)`,
      visa: `*Betterway Mortgages — UAE Property Residency Check*\nProperty Share Value: ${fmtAed(shareValueAed)}\nVerdict: *${visaTier}*${gapToGoldenVisaAed > 0 ? `\nGap to AED 2M Golden Visa: ${fmtAed(gapToGoldenVisaAed)}` : ''}`,
      commission: `*Betterway Mortgages — Subvention & Commission Statement*\nGross Bank Subvention: ${fmtAed(input.grossSubventionAed)} (+5% VAT = ${fmtAed(invoiceTotalIncVatAed)})\nPartner Referral (${input.partnerSharePct}%): ${fmtAed(partnerPayoutAed)}\nNet Pool: ${fmtAed(netPoolAed)} → Advisor: ${fmtAed(advisorPayoutAed)} | Betterway Net: ${fmtAed(betterwayRetainedAed)}`,
      yield: `*Betterway Mortgages — Investment Yield & RERA Index*\nPrice: ${fmtAed(input.priceAed)} | Annual Rent: ${fmtAed(input.annualRentAed)}\nGross Yield: ${grossYieldPct}% | *Net Yield: ${netYieldPct}%* (Net ${fmtAed(netAnnualIncomeAed)}/yr, DSCR ${dscrRatio}x)\nRERA Renewal Cap: +${rera.maxIncreasePct}% (Max ${fmtAed(rera.maxRenewalRentAed)})`,
    },
  };
}
