// Odoo-style app registry: one tile per app, each with its own menu bar.
export type AppDef = {
  key: string; en: string; ar: string; blurb: string; color: string; glyph: string;
  home: string; roles?: string[]; menus: { en: string; ar: string; href: string }[];
};

export const APPS: AppDef[] = [
  { key: 'sales', en: 'Sales', ar: 'المبيعات', blurb: 'Leads, pipeline, cross-sell', color: '#1D4ED8', glyph: 'S', home: '/os/crm',
    menus: [{ en: 'Leads', ar: 'العملاء', href: '/os/crm' }, { en: 'Pipeline', ar: 'خط الصفقات', href: '/os/deals' }, { en: 'Cross-sell', ar: 'خدمات مساندة', href: '/os/cross-sell' }] },
  { key: 'mortgage', en: 'Mortgage Desk', ar: 'مكتب الرهن', blurb: 'Deals, underwriting, banks', color: '#021125', glyph: 'M', home: '/os/deals',
    menus: [{ en: 'Pipeline', ar: 'خط الصفقات', href: '/os/deals' }, { en: 'Deal Desk', ar: 'مكتب الصفقات', href: '/os/workflow' }, { en: 'Underwriting', ar: 'الائتمان', href: '/os/los' }, { en: 'Banks & Rates', ar: 'البنوك والفائدة', href: '/os/banks-apl' }, { en: 'Playbooks', ar: 'الأدلة', href: '/os/workflow?view=playbooks' }] },
  { key: 'conveyancing', en: 'Conveyancing', ar: 'نقل الملكية', blurb: 'Form F, valuation, cheques', color: '#0F766E', glyph: 'C', home: '/os/conveyancing',
    menus: [{ en: 'Cases', ar: 'الحالات', href: '/os/conveyancing' }, { en: 'Deal Desk', ar: 'مكتب الصفقات', href: '/os/workflow' }] },
  { key: 'accounting', en: 'Accounting', ar: 'المحاسبة', blurb: 'Commissions, VAT, ledger', color: '#B45309', glyph: 'A', home: '/os/erp',
    roles: ['SUPER_ADMIN', 'FINANCE_ADMIN'], menus: [{ en: 'Ledger & Commissions', ar: 'الدفتر والعمولات', href: '/os/erp' }] },
  { key: 'hr', en: 'Employees', ar: 'الموظفون', blurb: 'Payroll, WPS, leave, EOSB', color: '#7C3AED', glyph: 'E', home: '/os/hrm',
    roles: ['SUPER_ADMIN', 'HR_MANAGER'], menus: [{ en: 'Staff & Payroll', ar: 'الموظفون والرواتب', href: '/os/hrm' }] },
  { key: 'compliance', en: 'Compliance', ar: 'الامتثال', blurb: 'KFS, AML, goAML, complaints', color: '#BE123C', glyph: 'K', home: '/os/compliance',
    roles: ['SUPER_ADMIN', 'COMPLIANCE_MLRO', 'CREDIT_UNDERWRITER'], menus: [{ en: 'Compliance', ar: 'الامتثال', href: '/os/compliance' }] },
  { key: 'activities', en: 'Activities', ar: 'المهام', blurb: 'My tasks and SLA wall', color: '#0369A1', glyph: 'T', home: '/os/activities',
    menus: [{ en: 'My Activities', ar: 'مهامي', href: '/os/activities' }, { en: 'Command Board', ar: 'غرفة العمليات', href: '/os/command' }] },
  { key: 'knowledge', en: 'Knowledge', ar: 'المعرفة', blurb: 'Bank policies and templates', color: '#4D7C0F', glyph: 'W', home: '/os/wiki',
    menus: [{ en: 'Wiki', ar: 'الموسوعة', href: '/os/wiki' }] },
  { key: 'reporting', en: 'Reporting', ar: 'التقارير', blurb: 'Forecast, BI, co-pilot', color: '#9A3412', glyph: 'R', home: '/os/bi-copilot',
    menus: [{ en: 'Executive BI', ar: 'ذكاء الأعمال', href: '/os/bi-copilot' }] },
];

export const appFor = (path: string) =>
  APPS.find((a) => a.menus.some((m) => path === m.href.split('?')[0] || path.startsWith(m.href.split('?')[0] + '/'))) ??
  (path.startsWith('/os/deals') ? APPS[1] : undefined);
