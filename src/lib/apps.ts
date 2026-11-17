// SWK / Betterway Enterprise 12-Section App Registry (matches swkpropertiesOS Launcher & 2-Column Sidebar)
export type AppMenu = { en: string; ar: string; href: string; step?: number; desc?: string };
export type AppDef = {
  key: string;
  en: string;
  ar: string;
  blurb: string;
  color: string;
  tone: 'navy' | 'champ' | 'oasis' | 'ocean' | 'dune' | 'plum';
  glyph: string;
  home: string;
  roles?: string[];
  menus: AppMenu[];
};

export const APPS: AppDef[] = [
  {
    key: 'dashboards',
    en: 'Dashboards',
    ar: 'لوحات القيادة',
    blurb: 'Overview, 3-dept pipeline, approvals, delete bin & market pulse',
    color: '#0b1a33',
    tone: 'navy',
    glyph: 'D',
    home: '/os/command',
    menus: [
      { step: 1, en: 'Overview', ar: 'نظرة عامة', href: '/os/command', desc: 'Executive overview & 10-step operations' },
      { step: 2, en: 'Deal Pipeline', ar: 'خط الصفقات', href: '/os/deals', desc: '3-Department UAE mortgage pipeline' },
      { step: 3, en: 'Daily Operations', ar: 'العمليات اليومية', href: '/os/operations', desc: 'Company Operations Centre (10 tabs)' },
      { step: 4, en: 'Delete Bin', ar: 'سلة المحذوفات', href: '/os/recycle-bin', desc: 'Owner approval for deletions & decisions' },
      { step: 5, en: 'Withdrawals', ar: 'الانسحابات والاسترداد', href: '/os/withdrawals', desc: 'Deal cancellations & client refunds' },
      { step: 6, en: 'Market Pulse', ar: 'نبض السوق', href: '/os/market', desc: '24 Dubai areas, DLD sync & 15Y outlook' },
      { step: 7, en: 'Reception QR', ar: 'حضور المكتب QR', href: '/os/reception-qr', desc: '10am–7pm office QR scan & check-in' },
      { step: 8, en: 'My Activities', ar: 'مهامي', href: '/os/activities', desc: 'SLA tasks & follow-up wall' },
      { step: 9, en: 'AI Co-Pilot', ar: 'المساعد الذكي', href: '/os/bi-copilot', desc: 'Statement parser & policy co-pilot' },
      { step: 10, en: 'Handover Suite', ar: 'ملف التسليم', href: '/os/handover', desc: 'Executive dossier & staff guide' },
    ],
  },
  {
    key: 'mortgage',
    en: '24-Bank LOS',
    ar: 'الائتمان و24 بنكاً',
    blurb: '24-Bank underwriting, Deal Desk, 37 playbooks & Tower APL',
    color: '#9a7a42',
    tone: 'champ',
    glyph: 'M',
    home: '/os/los',
    menus: [
      { step: 1, en: '24-Bank LOS', ar: 'الائتمان', href: '/os/los', desc: 'Fact-find, DBR/LTV & 24-bank ranker' },
      { step: 2, en: 'Deal Desk', ar: 'مكتب الصفقات', href: '/os/workflow', desc: '14-stage workflow & 37 playbooks' },
      { step: 3, en: 'Banks & APL', ar: 'البنوك والأبراج', href: '/os/banks-apl', desc: 'Rate Maker-Checker, EIBOR & 80 Towers' },
      { step: 4, en: 'Pipeline', ar: 'خط الصفقات', href: '/os/deals', desc: '3-Department mortgage kanban' },
    ],
  },
  {
    key: 'sales',
    en: 'CRM',
    ar: 'إدارة العملاء',
    blurb: 'Omnichannel leads, 5-min SLA, WhatsApp & 360° cross-sell',
    color: '#174b3b',
    tone: 'oasis',
    glyph: 'C',
    home: '/os/crm',
    menus: [
      { step: 1, en: 'Leads & SLA', ar: 'العملاء المحتملون', href: '/os/crm', desc: '5-minute GST SLA & WhatsApp threader' },
      { step: 2, en: '360° Cross-Sell', ar: 'الخدمات المساندة', href: '/os/cross-sell', desc: 'External Life, DIFC Wills, FX & Golden Visa' },
      { step: 3, en: 'Partner Hub', ar: 'بوابة الوسطاء', href: '/partners', desc: 'RERA B2B broker lead drop & pre-qual' },
      { step: 4, en: 'Borrower Vault', ar: 'بوابة المقترض', href: '/portal', desc: 'Encrypted Smart Vault & KFS signing' },
    ],
  },
  {
    key: 'conveyancing',
    en: 'Conveyancing',
    ar: 'نقل الملكية',
    blurb: 'Form F (MOU), valuation rescue, NOC & 72h DLD cheques',
    color: '#9a7a42',
    tone: 'champ',
    glyph: 'V',
    home: '/os/conveyancing',
    menus: [
      { step: 1, en: '72h Cheques & NOC', ar: 'شيكات 72 ساعة', href: '/os/conveyancing', desc: 'Form F clauses, valuation & DLD trustee split' },
      { step: 2, en: 'Withdrawals', ar: 'الانسحابات', href: '/os/withdrawals', desc: 'Terms-based refund & Owner sign-off' },
      { step: 3, en: 'Deal Toolkit', ar: 'حاسبات العقار', href: '/os/toolkit', desc: 'Buyer cost-to-close & DLD fee sheet' },
    ],
  },
  {
    key: 'accounting',
    en: 'Accounting',
    ar: 'المحاسبة والضريبة',
    blurb: '50/50 & Partner splits, pay-when-paid, VAT 201, 9% CT & PINT-AE',
    color: '#174b3b',
    tone: 'oasis',
    glyph: 'A',
    home: '/os/erp',
    roles: ['SUPER_ADMIN', 'FINANCE_ADMIN'],
    menus: [
      { step: 1, en: 'ERP & Bordereau', ar: 'المحاسبة والعمولات', href: '/os/erp', desc: 'Disbursals, pay-when-paid, VAT & PINT-AE XML' },
      { step: 2, en: 'Withdrawals', ar: 'الاستردادات', href: '/os/withdrawals', desc: 'Legal UAE payment modes & client refunds' },
      { step: 3, en: 'Executive BI', ar: 'التوقعات المالية', href: '/os/bi-copilot', desc: 'Stage-weighted & clawback-adjusted cash' },
    ],
  },
  {
    key: 'compliance',
    en: 'Compliance',
    ar: 'الامتثال ومكافحة الغسل',
    blurb: 'Joint CBUAE KFS, AML/CDD, sealed goAML vault, Sanadak & PDPL',
    color: '#a33b20',
    tone: 'dune',
    glyph: 'K',
    home: '/os/compliance',
    roles: ['SUPER_ADMIN', 'COMPLIANCE_MLRO', 'CREDIT_UNDERWRITER'],
    menus: [
      { step: 1, en: 'KFS & goAML', ar: 'بيان الحقائق وgoAML', href: '/os/compliance', desc: 'Joint KFS gate, AML/CDD & sealed FIU XML' },
      { step: 2, en: 'Privacy & PDPL', ar: 'الخصوصية', href: '/os/privacy', desc: 'Retention purge & incident register' },
      { step: 3, en: 'MFA & Security', ar: 'التحقق الثنائي', href: '/os/security', desc: 'RFC 6238 TOTP authenticator setup' },
    ],
  },
  {
    key: 'hr',
    en: 'Employees',
    ar: 'الموارد البشرية',
    blurb: 'Staff roster, MOHRE WPS .SIF, statutory EOSB, Nafis & visas',
    color: '#1b4d7e',
    tone: 'ocean',
    glyph: 'E',
    home: '/os/hrm',
    roles: ['SUPER_ADMIN', 'HR_MANAGER', 'FINANCE_ADMIN'],
    menus: [
      { step: 1, en: 'WPS & EOSB', ar: 'حماية الأجور ونهاية الخدمة', href: '/os/hrm', desc: 'MOHRE .SIF generator, draws & gratuity' },
      { step: 2, en: 'Reception QR', ar: 'بصمة الحضور QR', href: '/os/reception-qr', desc: '10:00–19:00 attendance & 10:05 grace' },
      { step: 3, en: 'Daily Reports', ar: 'التقارير اليومية', href: '/os/operations', desc: 'Staff end-of-day activity logs' },
    ],
  },
  {
    key: 'field',
    en: 'Field & Market',
    ar: 'الميدان ونبض السوق',
    blurb: 'Reception QR check-in, 24-Area Market Pulse & Site-Visit Companion',
    color: '#9a7a42',
    tone: 'champ',
    glyph: 'F',
    home: '/os/market',
    menus: [
      { step: 1, en: 'Market Pulse', ar: 'نبض السوق 24 منطقة', href: '/os/market', desc: '24 Dubai areas, 15Y forecast & pitch lines' },
      { step: 2, en: 'Reception QR', ar: 'تسجيل الحضور QR', href: '/os/reception-qr', desc: 'Office Wi-Fi scan & check-in' },
      { step: 3, en: 'Deal Toolkit', ar: 'حاسبات الميدان', href: '/os/toolkit', desc: 'Instant WhatsApp quote & DLD calculator' },
    ],
  },
  {
    key: 'data',
    en: 'Data Hub',
    ar: 'مركز البيانات',
    blurb: '50 Excel specs, setup/migration imports, reconciliation & 18 exports',
    color: '#493d72',
    tone: 'plum',
    glyph: 'H',
    home: '/os/data',
    menus: [
      { step: 1, en: '50-File Data Hub', ar: 'مركز ملفات إكسل', href: '/os/data', desc: 'Setup, Migration & 18 Excel exports' },
      { step: 2, en: 'Go-Live Checklist', ar: 'قائمة الإطلاق', href: '/os/golive', desc: '16 go-live sign-off items & DR drill' },
    ],
  },
  {
    key: 'knowledge',
    en: 'Documents & Manual',
    ar: 'الموسوعة والأدلة',
    blurb: 'Handover dossier, UAE Deal Toolkit, bank policy wiki & SOPs',
    color: '#0b1a33',
    tone: 'navy',
    glyph: 'W',
    home: '/os/handover',
    menus: [
      { step: 1, en: 'Handover & Guide', ar: 'دليل التسليم والموظفين', href: '/os/handover', desc: 'Pin-to-pin engineering dossier & SOPs' },
      { step: 2, en: 'Deal Toolkit', ar: 'حاسبات الصفقة', href: '/os/toolkit', desc: '8 interactive UAE real estate & mortgage tools' },
      { step: 3, en: 'Policy Wiki', ar: 'موسوعة السياسات', href: '/os/wiki', desc: 'Versioned bank policy clauses & templates' },
    ],
  },
  {
    key: 'reporting',
    en: 'Reporting & AI',
    ar: 'التقارير والذكاء',
    blurb: 'Stage-weighted forecast, 6m statement parser & policy co-pilot',
    color: '#174b3b',
    tone: 'oasis',
    glyph: 'R',
    home: '/os/bi-copilot',
    menus: [
      { step: 1, en: 'BI & Co-Pilot', ar: 'ذكاء الأعمال والمساعد', href: '/os/bi-copilot', desc: 'Statement EMI/BNPL detector & citations' },
      { step: 2, en: 'Export Register', ar: 'سجل التقارير', href: '/os/data?type=Export', desc: '18 statutory & management Excel exports' },
    ],
  },
  {
    key: 'settings',
    en: 'Settings & Governance',
    ar: 'الإعدادات والحوكمة',
    blurb: 'Owner Delete Bin, Admin control, MFA, DR backup drill & go-live',
    color: '#0b1a33',
    tone: 'navy',
    glyph: 'S',
    home: '/os/recycle-bin',
    menus: [
      { step: 1, en: 'Delete Bin & Owner', ar: 'سلة المحذوفات والمالك', href: '/os/recycle-bin', desc: 'Shabib Siraj approvals & admin control' },
      { step: 2, en: 'Go-Live & DR Drill', ar: 'الإطلاق والنسخ الاحتياطي', href: '/os/golive', desc: 'SQLite backup/restore verification' },
      { step: 3, en: 'MFA & Security', ar: 'الأمان والتحقق', href: '/os/security', desc: 'TOTP 2FA & session governance' },
      { step: 4, en: 'Privacy & PDPL', ar: 'الخصوصية', href: '/os/privacy', desc: 'Retention & incident register' },
    ],
  },
];

export const appFor = (path: string): AppDef | undefined => {
  if (path === '/os') return undefined;
  if (path.startsWith('/os/deals')) return APPS[0];
  return (
    APPS.find((a) =>
      a.menus.some((m) => {
        const clean = m.href.split('?')[0];
        return path === clean || path.startsWith(clean + '/');
      }),
    ) ?? APPS[0]
  );
};
