export type Lang = 'en' | 'ar';

export function formatAed(fils: number | null | undefined): string {
  const safe = Number(fils ?? 0);
  const sign = safe < 0 ? '-' : '';
  const abs = Math.abs(safe) / 100;
  return `${sign}AED ${abs.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatAedWhole(fils: number | null | undefined): string {
  const safe = Math.round(Number(fils ?? 0) / 100);
  const sign = safe < 0 ? '-' : '';
  return `${sign}AED ${Math.abs(safe).toLocaleString('en-US')}`;
}

export function formatBps(bps: number | null | undefined): string {
  return `${(Number(bps ?? 0) / 100).toFixed(2)}%`;
}

export function formatMicroPct(micro: number | null | undefined): string {
  return `${(Number(micro ?? 0) / 100_000).toFixed(5)}%`;
}

export function tr(lang: Lang, en: string, ar: string): string {
  return lang === 'ar' ? ar : en;
}

export const DEAL_STAGE_LABELS: Record<string, { en: string; ar: string }> = {
  FACT_FIND: { en: 'Fact-Find', ar: 'جمع البيانات' },
  KFS_PENDING: { en: 'KFS Pending', ar: 'بانتظار بيان الحقائق' },
  DOC_COLLECTION: { en: 'Smart Vault Docs', ar: 'جمع المستندات' },
  UNDERWRITING_READY: { en: 'Underwriting Ready', ar: 'جاهز للائتمان' },
  IPA_SUBMITTED: { en: 'IPA Submitted', ar: 'تم تقديم الموافقة المبدئية' },
  IPA_APPROVED: { en: 'IPA Approved', ar: 'صدرت الموافقة المبدئية' },
  MOU_SIGNED: { en: 'Contract F Signed', ar: 'توقيع عقد إف' },
  VALUATION_ORDERED: { en: 'Valuation Ordered', ar: 'طلب التقييم العقاري' },
  VALUATION_RECEIVED: { en: 'Valuation Received', ar: 'استلام التقييم' },
  FOL_ISSUED: { en: 'FOL Issued', ar: 'صدور العرض النهائي' },
  FOL_SIGNED: { en: 'FOL Signed', ar: 'توقيع العرض النهائي' },
  NOC_AND_CLEARANCE: { en: 'NOC & Clearance', ar: 'عدم الممانعة وبراءة الذمة' },
  CHEQUES_READY: { en: '72h Cheques Ready', ar: 'جاهزية الشيكات المصرفية' },
  TRANSFERRED_DISBURSED: { en: 'Disbursed & Transferred', ar: 'تم الصرف ونقل الملكية' },
  DECLINED: { en: 'Declined', ar: 'مرفوض' },
  WITHDRAWN: { en: 'Withdrawn', ar: 'منسحب' },
};

export const ROLE_LABELS: Record<string, { en: string; ar: string }> = {
  SUPER_ADMIN: { en: 'Managing Director', ar: 'المدير التنفيذي' },
  SALES_ADVISOR: { en: 'Mortgage Advisor', ar: 'مستشار الرهن العقاري' },
  CREDIT_UNDERWRITER: { en: 'Credit Underwriter', ar: 'محلل الائتمان' },
  PROGRESSION_MANAGER: { en: 'Conveyancing & Progression', ar: 'مدير المتابعة ونقل الملكية' },
  COMPLIANCE_MLRO: { en: 'Compliance & MLRO', ar: 'مسؤول الامتثال ومكافحة الغسل' },
  FINANCE_ADMIN: { en: 'Finance & Tax Controller', ar: 'المراقب المالي والضريبي' },
  HR_MANAGER: { en: 'UAE HR & WPS Manager', ar: 'مدير الموارد البشرية وحماية الأجور' },
  PARTNER_AGENCY_ADMIN: { en: 'RERA Agency Owner (ORN)', ar: 'مالك مكتب الوساطة العقارية' },
  PARTNER_AGENT: { en: 'RERA Broker Agent (BRN)', ar: 'وسيط عقاري مرخص' },
  CLIENT: { en: 'Borrower / Homeowner', ar: 'المقترض / مالك العقار' },
};
