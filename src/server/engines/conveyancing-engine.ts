import type { DatabaseSync } from 'node:sqlite';
import { configuredFees } from './fees';

export type ConveyancingPack = {
  dealId: number;
  dealRef: string;
  purchasePriceFils: number;
  loanFils: number;
  cheques: {
    sellerBankPayoffFils: number;
    sellerNetFils: number;
    dldTransferFils: number;
    mortgageRegFils: number;
    trusteeFeeFils: number;
    agencyFeeInclVatFils: number;
    totalManagerChequesFils: number;
    buyerOwnFundsRequiredFils: number;
  };
  valuationShortfall: {
    hasShortfall: boolean;
    valuationAmountFils: number;
    shortfallVsPriceFils: number;
    reducedMaxLoanAt80LtvFils: number;
    buyerCashBridgeFils: number;
  };
  deadlines: {
    formFExpiryDate: string | null;
    folContingencyDate: string | null;
    liabilityLetterExpiresAt: string | null;
  };
};

export function computeConveyancingPack(db: DatabaseSync, dealId: number, bufferPerDiemDays = 0): ConveyancingPack {
  const deal = db.prepare('SELECT * FROM deals WHERE id = ?').get(dealId) as Record<string, unknown> | undefined;
  if (!deal) throw new Error(`Deal ${dealId} not found`);

  const conv = (db.prepare('SELECT * FROM conveyancing_cases WHERE deal_id = ?').get(dealId) ?? {}) as Record<string, unknown>;

  const priceFils = Number(deal.purchase_price_fils);
  const loanFils = Number(deal.target_loan_fils);
  const isHandover = deal.transaction_type === 'OFFPLAN_HANDOVER';

  const sellerHasMortgage = Number(conv.seller_has_mortgage || 0) === 1;
  const sellerBankPayoffFils = sellerHasMortgage
    ? Number(conv.liability_letter_payoff_fils || 0) + Math.max(0, bufferPerDiemDays) * Number(conv.liability_per_diem_fils || 0)
    : 0;
  const depositPaidDirectFils = Number(conv.deposit_paid_direct_fils || 0);
  const sellerNetFils = Math.max(0, priceFils - sellerBankPayoffFils - depositPaidDirectFils);

  // Statutory DLD fees in integer fils:
  // Ready purchase: 4% of price + AED 580 (58,000 fils); Off-plan handover (Oqood already paid): AED 580 title deed issuance
  // Any of these can be replaced by Fees_and_Closing_Costs rows (Data Hub); defaults apply when none is configured.
  const cfg = configuredFees(db, deal);
  const dldTransferFils = cfg.get('DLD_TRANSFER')?.fils ?? (isHandover ? 58_000 : Math.round(priceFils * 0.04) + 58_000);
  // Mortgage registration: 0.25% of loan + AED 290 (29,000 fils)
  const mortgageRegFils = cfg.get('MORTGAGE_REGISTRATION')?.fils ?? (loanFils > 0 ? Math.round(loanFils * 0.0025) + 29_000 : 0);
  // Trustee fee: AED 4,200 (420,000 fils) for price >= AED 500k, else AED 2,100 (210,000 fils)
  const trusteeFeeFils = cfg.get('TRUSTEE')?.fils ?? (priceFils >= 50_000_000 ? 420_000 : 210_000);
  // Agency commission: 2% + 5% VAT (= 2.1%) on secondary purchase when enabled
  const includeAgency = !isHandover && Number(conv.include_agency_fee ?? 1) === 1;
  const agencyFeeInclVatFils = includeAgency ? (cfg.get('AGENCY')?.fils ?? Math.round(priceFils * 0.021)) : 0;

  const totalManagerChequesFils =
    sellerBankPayoffFils + sellerNetFils + dldTransferFils + mortgageRegFils + trusteeFeeFils + agencyFeeInclVatFils;
  const buyerOwnFundsRequiredFils = Math.max(0, totalManagerChequesFils - loanFils);

  const valuationAmountFils = Number(conv.valuation_amount_fils || priceFils);
  const shortfallVsPriceFils = Math.max(0, priceFils - valuationAmountFils);
  const hasShortfall = valuationAmountFils > 0 && shortfallVsPriceFils > 0;
  const targetLtvRatio = priceFils > 0 ? loanFils / priceFils : 0.8;
  const reducedMaxLoanAt80LtvFils = Math.round(valuationAmountFils * targetLtvRatio);
  const buyerCashBridgeFils = hasShortfall ? Math.max(0, loanFils - reducedMaxLoanAt80LtvFils) : 0;

  return {
    dealId,
    dealRef: String(deal.deal_ref),
    purchasePriceFils: priceFils,
    loanFils,
    cheques: {
      sellerBankPayoffFils,
      sellerNetFils,
      dldTransferFils,
      mortgageRegFils,
      trusteeFeeFils,
      agencyFeeInclVatFils,
      totalManagerChequesFils,
      buyerOwnFundsRequiredFils,
    },
    valuationShortfall: {
      hasShortfall,
      valuationAmountFils,
      shortfallVsPriceFils,
      reducedMaxLoanAt80LtvFils,
      buyerCashBridgeFils,
    },
    deadlines: {
      formFExpiryDate: (conv.form_f_expiry_date as string) || null,
      folContingencyDate: (conv.fol_contingency_date as string) || null,
      liabilityLetterExpiresAt: (conv.liability_letter_expires_at as string) || null,
    },
  };
}

export function generateFormFSpecialConditions(params: {
  minValuationFils: number;
  ltvPct: number;
  folDays: number;
  contractValidityDays: number;
  sellerHasMortgage: boolean;
  sellerBankName?: string;
}) {
  const aedStr = `AED ${(params.minValuationFils / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const bankLabel = params.sellerBankName?.trim() || '[SELLER BANK]';

  const en = [
    'SPECIAL CONDITION 1 — SUBJECT TO BANK VALUATION & FINAL OFFER LETTER (FOL):',
    `1.1 This Contract F is strictly conditional upon the Buyer obtaining: (a) an accredited bank property valuation of no less than ${aedStr}; and (b) an unconditional written Final Offer Letter ("FOL") from a CBUAE-licensed lender for at least ${params.ltvPct}% of the Purchase Price within ${params.folDays} calendar days.`,
    '1.2 Failing written price adjustment within 5 working days of a valuation shortfall or upon bank FOL decline not caused by Buyer willful default, this Contract F terminates without penalty and the uncashed 10% Security Deposit Cheque shall be returned within 48 hours.',
    '',
    `SPECIAL CONDITION 2 — ${params.sellerHasMortgage ? 'SELLER MORTGAGE CLEARANCE & ' : ''}AUTOMATIC EXTENSION:`,
    ...(params.sellerHasMortgage
      ? [
          `2.1 The Seller confirms the Property is mortgaged to ${bankLabel} and undertakes to request the official Liability Letter within 2 working days of Buyer's signed FOL.`,
        ]
      : []),
    `2.${params.sellerHasMortgage ? '2' : '1'} Contract validity is ${params.contractValidityDays} calendar days, with an automatic 15-calendar-day penalty-free extension for bank, developer NOC, or DLD administrative delays.`,
    '',
    'SPECIAL CONDITION 3 — STAKEHOLDER DEPOSIT CUSTODY:',
    '3.1 The Buyer 10% Security Deposit Cheque shall be held strictly uncashed in trust by the RERA-licensed Brokerage until DLD Trustee Transfer.',
  ].join('\n');

  const ar = [
    'الشرط الخاص الأول — خاضع لتقييم البنك وخطاب العرض النهائي:',
    `1.1 يخضع هذا العقد (نموذج إف) لحصول المشتري على تقييم عقاري معتمد لا يقل عن ${aedStr} وصدور خطاب عرض نهائي غير مشروط من بنك مرخص من مصرف الإمارات المركزي بنسبة لا تقل عن ${params.ltvPct}% خلال ${params.folDays} يوماً تقويمياً.`,
    '1.2 في حال انخفاض التقييم دون اتفاق خطي أو تعذر صدور خطاب العرض النهائي دون تقصير متعمد من المشتري، يُفسخ العقد دون غرامة ويُعاد شيك التأمين (10%) غير مصروف خلال 48 ساعة.',
    '',
    'الشرط الخاص الثاني — براءة الذمة وتمديد المهلة:',
    ...(params.sellerHasMortgage
      ? [`2.1 يقر البائع بأن العقار مرهون لدى (${bankLabel}) ويلتزم بطلب شهادة المديونية خلال يومي عمل من توقيع خطاب العرض النهائي.`]
      : []),
    `2.${params.sellerHasMortgage ? '2' : '1'} مدة سريان العقد ${params.contractValidityDays} يوماً تقويمياً مع تمديد تلقائي لمدة 15 يوماً إضافياً دون غرامة لأي تأخير إجرائي خارج عن إرادة الطرفين.`,
  ].join('\n');

  return { en, ar };
}
