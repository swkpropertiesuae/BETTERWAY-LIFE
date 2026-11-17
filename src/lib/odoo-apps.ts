export interface CorporateSubModule {
  code: string;
  title: string;
  desc: string;
  href: string;
}

export interface CorporateDivision {
  id: string;
  code: string;
  name: string;
  tagline: string;
  primaryHref: string;
  matchPrefixes: string[];
  subApps: CorporateSubModule[];
}

export const ODOO_APPS: CorporateDivision[] = [
  {
    id: 'operations',
    code: 'DIV-01',
    name: 'Corporate Operations',
    tagline: 'Internal Task Assignment, Daily Activity Logs, Attendance & Operational Controls',
    primaryHref: '/os/operations',
    matchPrefixes: [
      '/os/operations',
      '/os/activities',
      '/os/steps/daily-report',
      '/os/wiki',
      '/os/golive',
    ],
    subApps: [
      {
        code: 'OPS-01',
        title: 'Internal Task Queue',
        desc: 'Assign, monitor, and close inter-departmental operational tasks and SLA deliverables.',
        href: '/os/activities',
      },
      {
        code: 'OPS-02',
        title: 'Operations Control Centre',
        desc: 'Consolidated department workbenches across rate cards, NOCs, disbursals, and visas.',
        href: '/os/operations',
      },
      {
        code: 'OPS-03',
        title: 'Daily Activity Reporting',
        desc: 'End-of-day advisory and operations activity log for management review.',
        href: '/os/steps/daily-report',
      },
      {
        code: 'OPS-04',
        title: 'Office Attendance Register',
        desc: 'Reception check-in register, shift punctuality tracking, and attendance exceptions.',
        href: '/os/reception-qr',
      },
      {
        code: 'OPS-05',
        title: 'Management Escalations',
        desc: 'Submit operational, budget, or policy requests for Managing Director authorization.',
        href: '/os/recycle-bin?tab=decisions',
      },
      {
        code: 'OPS-06',
        title: 'Operating Procedures & Calendar',
        desc: 'Standard operating playbooks, credit policy manuals, and UAE banking holidays.',
        href: '/os/workflow?view=playbooks',
      },
    ],
  },
  {
    id: 'crm',
    code: 'DIV-02',
    name: 'Client Origination (CRM)',
    tagline: 'Client Inquiry Intake, SLA Response Management, Qualification & Partner Referrals',
    primaryHref: '/os/crm',
    matchPrefixes: ['/os/crm', '/os/steps/add-lead', '/os/steps/call-lead', '/os/steps/convert-lead'],
    subApps: [
      {
        code: 'CRM-01',
        title: 'Client Inquiry Register',
        desc: 'Master register of incoming borrower inquiries, channel attribution, and assigned advisors.',
        href: '/os/crm',
      },
      {
        code: 'CRM-02',
        title: 'New Client Registration',
        desc: 'Record prospective borrower contact details, transaction type, and target property value.',
        href: '/os/steps/add-lead',
      },
      {
        code: 'CRM-03',
        title: 'Client Contact & SLA Log',
        desc: 'Record initial advisory contact and consultation notes against the 5-minute SLA standard.',
        href: '/os/steps/call-lead',
      },
      {
        code: 'CRM-04',
        title: 'Case File Conversion',
        desc: 'Promote qualified borrower inquiries into active mortgage underwriting files.',
        href: '/os/steps/convert-lead',
      },
    ],
  },
  {
    id: 'sales',
    code: 'DIV-03',
    name: 'Deals & Pipeline',
    tagline: 'Active Case Progression, Department Pipelines, Stage Gates & Ancillary Services',
    primaryHref: '/os/deals',
    matchPrefixes: ['/os/deals', '/os/workflow', '/os/cross-sell'],
    subApps: [
      {
        code: 'PIP-01',
        title: 'Master Deal Pipeline',
        desc: 'Stage-by-stage progression board across all active residential and commercial cases.',
        href: '/os/deals',
      },
      {
        code: 'PIP-02',
        title: 'Secondary Market Purchases',
        desc: 'Active mortgage files for completed residential properties and DLD trustee transfers.',
        href: '/os/deals?dept=ready',
      },
      {
        code: 'PIP-03',
        title: 'Off-Plan & Handover Finance',
        desc: 'Developer completion financing, Oqood conversion, and handover tranches.',
        href: '/os/deals?dept=offplan',
      },
      {
        code: 'PIP-04',
        title: 'Refinance, Buyout & Equity',
        desc: 'Liability buyouts, rate restructuring, and commercial/residential equity release.',
        href: '/os/deals?dept=buyout',
      },
      {
        code: 'PIP-05',
        title: 'Case Progression & Stage Controls',
        desc: 'Inspect mandatory documentary and compliance prerequisites per case stage.',
        href: '/os/workflow',
      },
      {
        code: 'PIP-06',
        title: 'Ancillary & Advisory Services',
        desc: 'Life/property Takaful referrals, DLD valuation coordination, and Golden Visa nomination.',
        href: '/os/cross-sell',
      },
    ],
  },
  {
    id: 'underwriting',
    code: 'DIV-04',
    name: 'Credit & Underwriting',
    tagline: 'Financial Fact-Find, 24-Bank CBUAE Eligibility Matrix, Dual-Bank IPA & Rate Governance',
    primaryHref: '/os/los',
    matchPrefixes: [
      '/os/los',
      '/os/loan-risk-pdc',
      '/os/banks-apl',
      '/os/steps/update-income',
      '/os/steps/compare-banks',
      '/os/steps/submit-ipa',
      '/os/steps/record-fol',
    ],
    subApps: [
      {
        code: 'UND-01',
        title: 'Underwriting Workstation',
        desc: 'Comprehensive borrower financial assessment, liability stress-testing, and bank matching.',
        href: '/os/los',
      },
      {
        code: 'UND-02',
        title: 'Loan Amortization & Credit Risk',
        desc: 'Fixed-to-floating EIBOR schedule, 100-point credit risk scorecard, dunning, and PDC vault.',
        href: '/os/loan-risk-pdc',
      },
      {
        code: 'UND-03',
        title: '24-Bank Eligibility Matrix',
        desc: 'Side-by-side DBR, LTV, and 5-year total cost evaluation across 24 UAE lenders.',
        href: '/os/steps/compare-banks',
      },
      {
        code: 'UND-04',
        title: 'Dual-Bank IPA Submission',
        desc: 'Package and transmit credit applications to primary and backup lending institutions.',
        href: '/os/steps/submit-ipa',
      },
      {
        code: 'UND-05',
        title: 'IPA & Final Offer Letter (FOL) Log',
        desc: 'Record lender pre-approval references, FOL issuance, and offer terms audit.',
        href: '/os/steps/record-fol',
      },
      {
        code: 'UND-06',
        title: 'Lender Rate Cards & Project APL',
        desc: 'Maker-checker rate card governance, EIBOR fixings, and Approved Project List (80 towers).',
        href: '/os/banks-apl',
      },
    ],
  },
  {
    id: 'transfer',
    code: 'DIV-05',
    name: 'Conveyancing & DLD',
    tagline: 'Property Valuation, Developer NOC, RERA Form F & Trustee Settlement Cheques',
    primaryHref: '/os/conveyancing',
    matchPrefixes: ['/os/conveyancing', '/os/steps/valuation-noc', '/os/steps/trustee-cheques'],
    subApps: [
      {
        code: 'CNV-01',
        title: 'Conveyancing & Settlement Desk',
        desc: 'Full settlement table, down-valuation variance analysis, and Form F contract terms.',
        href: '/os/conveyancing',
      },
      {
        code: 'CNV-02',
        title: 'Valuation & Developer NOC Tracker',
        desc: 'Record independent panel valuation results and developer NOC clearance.',
        href: '/os/steps/valuation-noc',
      },
      {
        code: 'CNV-03',
        title: 'DLD Trustee Cheque Schedule',
        desc: 'Exact manager’s cheque breakdown for mortgagee payoff, seller net, DLD 4%, and trustee.',
        href: '/os/steps/trustee-cheques',
      },
      {
        code: 'CNV-04',
        title: 'Property Title & PDC Vault',
        desc: 'DLD Title Deed / Oqood collateral registry, Makani, net yield, and post-dated cheque vault.',
        href: '/os/loan-risk-pdc?tab=realestate',
      },
    ],
  },
  {
    id: 'accounting',
    code: 'DIV-06',
    name: 'Finance & Treasury',
    tagline: 'Corporate Bank Accounts, Operating Expenses, Subvention Settlements, Splits & FTA Tax',
    primaryHref: '/os/accounts-expenses',
    matchPrefixes: [
      '/os/accounts-expenses',
      '/os/erp',
      '/os/withdrawals',
      '/os/steps/disburse-loan',
      '/os/steps/split-commission',
      '/os/steps/withdraw-deal',
    ],
    subApps: [
      {
        code: 'FIN-01',
        title: 'Corporate Accounts & Operating Expenses',
        desc: 'Treasury balances, vendor bill registration, office overheads, and tax classification.',
        href: '/os/accounts-expenses',
      },
      {
        code: 'FIN-02',
        title: 'General Ledger, VAT 201 & Corporate Tax',
        desc: '28-account double-entry trial balance, FTA VAT 201 return, 9% CT, and Peppol e-invoicing.',
        href: '/os/erp',
      },
      {
        code: 'FIN-03',
        title: 'Loan Disbursal & Subvention Accrual',
        desc: 'Post loan disbursal, recognize bank subvention receivable, and book clawback reserve.',
        href: '/os/steps/disburse-loan',
      },
      {
        code: 'FIN-04',
        title: 'Bordereau Receipt & Commission Split',
        desc: 'Reconcile bank wire receipts and allocate net commission (partner & 50/50 advisor split).',
        href: '/os/steps/split-commission',
      },
      {
        code: 'FIN-05',
        title: 'Case Withdrawals & Client Refunds',
        desc: 'Process fee refunds through approved corporate banking channels with executive sign-off.',
        href: '/os/withdrawals',
      },
    ],
  },
  {
    id: 'employees',
    code: 'DIV-07',
    name: 'Human Capital & WPS',
    tagline: 'Personnel Directory, MOHRE WPS Payroll, End-of-Service Provision & Residency Visas',
    primaryHref: '/os/hrm',
    matchPrefixes: ['/os/hrm', '/os/reception-qr', '/os/steps/check-in'],
    subApps: [
      {
        code: 'HRM-01',
        title: 'Personnel Roster & WPS Payroll',
        desc: 'Employee contracts, MOHRE .SIF generation, Emirati Nafis/GPSSA, and EOSB gratuity.',
        href: '/os/hrm',
      },
      {
        code: 'HRM-02',
        title: 'Office Attendance & Punctuality',
        desc: 'Daily shift check-in log, grace period monitoring, and reception stand QR management.',
        href: '/os/reception-qr',
      },
    ],
  },
  {
    id: 'compliance',
    code: 'DIV-08',
    name: 'Risk & Compliance',
    tagline: 'CBUAE Key Facts Statements (KFS), AML/CDD Screening, Sanadak & Regulatory Filings',
    primaryHref: '/os/compliance',
    matchPrefixes: ['/os/compliance', '/os/privacy', '/os/steps/sign-kfs', '/os/steps/id-check'],
    subApps: [
      {
        code: 'CMP-01',
        title: 'Compliance & MLRO Workbench',
        desc: 'Statutory submission gate status, Sanadak consumer register, and goAML STR/SAR filings.',
        href: '/os/compliance',
      },
      {
        code: 'CMP-02',
        title: 'Key Facts Statement (KFS) Execution',
        desc: 'Record mandatory CBUAE Key Facts Statement acknowledgements for all applicants.',
        href: '/os/steps/sign-kfs',
      },
      {
        code: 'CMP-03',
        title: 'AML, Sanctions & CDD Verification',
        desc: 'Verify applicant identity, source of funds documentation, and sanctions screening.',
        href: '/os/steps/id-check',
      },
      {
        code: 'CMP-04',
        title: 'Data Governance & Retention',
        desc: 'UAE PDPL data subject requests, incident response register, and document retention.',
        href: '/os/privacy',
      },
    ],
  },
  {
    id: 'market',
    code: 'DIV-09',
    name: 'Market Intelligence',
    tagline: 'Dubai Land Department (DLD) Valuation Index, 24-Corridor Analytics & Calculators',
    primaryHref: '/os/market',
    matchPrefixes: ['/os/market', '/os/toolkit', '/os/steps/market-guide', '/os/steps/calculator'],
    subApps: [
      {
        code: 'MKT-01',
        title: 'DLD 24-Corridor Valuation Index',
        desc: 'Benchmark price per sq.ft, rental yields, 15-year projections, and DLD transaction feed.',
        href: '/os/market',
      },
      {
        code: 'MKT-02',
        title: 'Mortgage & DLD Cost Calculator',
        desc: 'Compute buyer cash-to-close, DLD transfer fees, stress-tested DBR, and commission splits.',
        href: '/os/toolkit',
      },
    ],
  },
  {
    id: 'owner',
    code: 'DIV-10',
    name: 'Executive Governance',
    tagline: 'Executive Command Summary, Deletion Review Queue, Access Control & System Manuals',
    primaryHref: '/os/command',
    matchPrefixes: [
      '/os/command',
      '/os/recycle-bin',
      '/os/handover',
      '/os/bi-copilot',
      '/os/data',
      '/os/security',
      '/os/steps',
    ],
    subApps: [
      {
        code: 'GOV-01',
        title: 'Executive Command Summary',
        desc: 'Firm-wide loan volume, revenue forecast, SLA performance, and leadership briefings.',
        href: '/os/command',
      },
      {
        code: 'GOV-02',
        title: 'Deletion Review & Decision Queue',
        desc: 'Managing Director review of record deletion requests, manager decisions, and admin access.',
        href: '/os/recycle-bin',
      },
      {
        code: 'GOV-03',
        title: 'Statement & Policy Analytics',
        desc: 'Automated bank statement liability detection and UAE bank credit policy search.',
        href: '/os/bi-copilot',
      },
      {
        code: 'GOV-04',
        title: 'Data Migration & Reporting Hub',
        desc: 'Standardized CSV/Excel data import batches, validation queues, and regulatory exports.',
        href: '/os/data',
      },
      {
        code: 'GOV-05',
        title: 'Access Security & Backup Verification',
        desc: 'Multi-factor authentication (TOTP), active session audit, and database integrity drills.',
        href: '/os/security',
      },
      {
        code: 'GOV-06',
        title: 'Corporate Documentation & Directory',
        desc: 'System architecture specifications, operating manuals, and staff access directory.',
        href: '/os/handover',
      },
    ],
  },
];

export function findActiveOdooApp(pathname: string): CorporateDivision | null {
  if (!pathname || pathname === '/os') return null;
  if (pathname.startsWith('/os/app/')) {
    const id = pathname.replace('/os/app/', '').split('/')[0];
    return ODOO_APPS.find((a) => a.id === id) ?? ODOO_APPS[0]!;
  }
  for (const app of ODOO_APPS) {
    if (app.matchPrefixes.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
      return app;
    }
  }
  return ODOO_APPS[0]!;
}
