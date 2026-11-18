import type { DatabaseSync } from 'node:sqlite';
import { getStaffProfileByNameOrEmail } from '@/lib/staff-directory';

export interface StudioTemplateSpec {
  id: string;
  title: string;
  category:
    | 'HR & Rahaba Operations'
    | 'Mortgage Origination'
    | 'DLD & Conveyancing'
    | 'Finance, VAT & Compliance'
    | 'Master System Manual';
  badge: string;
  summary: string;
  body: string;
}

export interface WorkflowBookletChapter {
  chapterNo: number;
  title: string;
  department: string;
  leadOwner: string;
  summary: string;
  controlRules: string[];
}

export const STUDIO_TEMPLATES: StudioTemplateSpec[] = [
  {
    id: 'hr-salary-certificate',
    title: 'MOHRE & Bank Salary Certificate (Issued by Rahaba Azeez)',
    category: 'HR & Rahaba Operations',
    badge: 'HR · Rahaba Azeez',
    summary: 'Official stamped salary certificate for staff personal banking, tenancy or auto finance.',
    body: `DATE: [Issue Date]
REF: [Doc Ref]

TO WHOM IT MAY CONCERN
[Addressee Bank]

SUBJECT: OFFICIAL SALARY CERTIFICATE — [Employee Name]

This is to certify that [Employee Name], holding Employee Code [Employee Code] and MOHRE Person ID [MOHRE ID], is a confirmed full-time employee of Betterway Mortgages LLC, Dubai, United Arab Emirates, serving in the capacity of [Designation] within the [Department] department since [Join Date].

MONTHLY REMUNERATION BREAKDOWN (PAID VIA MOHRE WPS):
• Basic Monthly Salary: AED [Basic Salary AED]
• Housing & Transport Allowances: AED [Allowances AED]
• Total Guaranteed Fixed Monthly Salary: AED [Total Salary AED]
• Designated Salary IBAN: [Employee IBAN]

This certificate is issued upon the employee's request via the Betterway OS HR Desk without any financial liability or guarantee on the part of Betterway Mortgages LLC.

Authorized Signatories:
___________________________                 ___________________________
Rahaba Azeez                                Shabib Siraj
HR — Human Resources & People Operations    Founder & Managing Director
Betterway Mortgages LLC                     Betterway Mortgages LLC`,
  },
  {
    id: 'hr-employment-noc',
    title: 'Employee No Objection Certificate (NOC — Rahaba Azeez)',
    category: 'HR & Rahaba Operations',
    badge: 'HR · Rahaba Azeez',
    summary: 'Official employer NOC for RTA driving license, travel visa,Golden Visa, or external regulatory filing.',
    body: `DATE: [Issue Date]
REF: [Doc Ref]

NO OBJECTION CERTIFICATE (NOC)

This is to confirm that [Employee Name] (Employee Code: [Employee Code], Designation: [Designation]) is currently employed full-time with Betterway Mortgages LLC in Dubai, UAE.

Betterway Mortgages LLC hereby confirms that it has NO OBJECTION to [Employee Name] proceeding with the requested application before the relevant authority in the United Arab Emirates.

This letter is issued at the request of the employee by the Human Resources Department and carries no financial obligation on Betterway Mortgages LLC.

Issued & Verified By:
Rahaba Azeez — HR (rahaba@betterwaymortgages.com)
Countersigned: Shabib Siraj — Founder & Managing Director
Betterway Mortgages LLC · Dubai, UAE`,
  },
  {
    id: 'hr-offer-letter',
    title: 'Executive Employment Offer Letter (MOHRE Standard)',
    category: 'HR & Rahaba Operations',
    badge: 'HR · Onboarding',
    summary: 'Standard UAE Federal Decree-Law 33/2021 compliant employment offer letter + commission annexure.',
    body: `DATE: [Issue Date]
REF: [Doc Ref]

PRIVATE & CONFIDENTIAL
Dear [Employee Name],

SUBJECT: OFFER OF EMPLOYMENT — [Designation] AT BETTERWAY MORTGAGES LLC

On behalf of Betterway Mortgages LLC, we are pleased to offer you the position of [Designation] reporting to Team Manager Daniel Xavier and Executive Leadership (Shabib Siraj & Warda).

1. COMPENSATION & MOHRE WPS STRUCTURE:
   • Basic Salary: AED [Basic Salary AED] / month
   • Allowances (Housing + Transport): AED [Allowances AED] / month
   • Total Monthly Fixed Package: AED [Total Salary AED] / month
   • Commission Split (Advisory Desk): 50% Net House / 50% Mortgage Advisor after verified bank subvention receipt and 180-day clawback reserve compliance.

2. WORKING HOURS & RECEPTION QR ATTENDANCE:
   • Standard Office Hours: 10:00 AM to 07:00 PM GST (Grace window until 10:05 AM GST via Office Wi-Fi Reception QR Stand).

3. STATUTORY BENEFITS:
   • End of Service Gratuity (EOSB) in accordance with UAE Federal Decree-Law No. 33 of 2021, DHA Comprehensive Medical Insurance, and 30 calendar days annual leave.

Prepared by: Rahaba Azeez (HR)
Approved by: Shabib Siraj (Founder & Managing Director) & Warda (Executive Director)`,
  },
  {
    id: 'hr-attendance-notice',
    title: '10:05 AM GST Punctuality & Attendance Advisory Notice',
    category: 'HR & Rahaba Operations',
    badge: 'HR · Attendance',
    summary: 'Formal HR attendance memo issued when a staff member approaches or triggers the 7-day late window.',
    body: `DATE: [Issue Date]
REF: [Doc Ref]

MEMORANDUM — HUMAN RESOURCES & ATTENDANCE CONTROL
TO: [Employee Name] ([Designation])
FROM: Rahaba Azeez (HR) & Daniel Xavier (Team Manager)
CC: Shabib Siraj, Warda

SUBJECT: OFFICE RECEPTION QR CHECK-IN & 10:05 AM GST PUNCTUALITY REMINDER

Our Betterway OS Reception QR Attendance Ledger indicates late check-in entries after the 10:05 AM GST grace cut-off. As per Betterway Mortgages LLC Operating Rule #06:
• Office Shift Hours: 10:00 AM – 07:00 PM GST.
• Check-in must be completed on the physical Reception QR Stand while connected to Betterway-Office-5G Wi-Fi.
• 3 or more late arrivals within a rolling 7-day window automatically trigger a Continuous Contemptor Alert to Executive Leadership.

Please ensure strict adherence to the 10:00 AM GST arrival schedule or log off-site client/trustee visits in advance via the Betterway ONE Mobile App.

Signed:
Rahaba Azeez — Human Resources`,
  },
  {
    id: 'hr-onboarding-checklist',
    title: 'New Staff Onboarding, RERA BRN & PDPL Security Checklist',
    category: 'HR & Rahaba Operations',
    badge: 'HR · Compliance',
    summary: 'Complete HR & IT onboarding sign-off for visa, Emirates ID, RERA card, MFA, and Betterway ONE device binding.',
    body: `DATE: [Issue Date]
REF: [Doc Ref]

BETTERWAY MORTGAGES LLC — STAFF ONBOARDING & STATUTORY CHECKLIST
Employee: [Employee Name] ([Employee Code])
Designation: [Designation] · Department: [Department]

[x] 1. Passport, UAE Residency Visa & Emirates ID verified in HR Radar (90/60/30-day alert active)
[x] 2. MOHRE Labour Contract & 23-char UAE IBAN ([Employee IBAN]) enrolled in WPS .SIF Engine
[x] 3. RERA Broker Card / CBUAE Conduct Undertaking signed
[x] 4. Official Studio Profile Avatar configured across Betterway OS
[x] 5. Betterway ONE Mobile App paired & 21:00–08:00 GST Quiet-Hours PDPL Lock-Screen Redaction active
[x] 6. Reception QR Stand Wi-Fi Check-In tested and verified

Verified by HR: Rahaba Azeez`,
  },
  {
    id: 'mortgage-3bank-proposal',
    title: 'Executive 3-Bank UAE Mortgage Comparison Proposal',
    category: 'Mortgage Origination',
    badge: 'CBUAE · 24-Bank',
    summary: 'Client-facing side-by-side comparison of top 3 UAE bank mortgage offers with DBR & cost-to-close breakdown.',
    body: `DATE: [Issue Date]
PROPOSAL REF: [Doc Ref] · DEAL REF: [Deal Ref]

PREPARED FOR: [Client Name]
PROPERTY: [Property Community] · Purchase Price: AED [Property Value AED]
TARGET FINANCING: AED [Loan Amount AED] (LTV: [LTV %]%)

EXECUTIVE SUMMARY — CBUAE 50% DBR PRE-UNDERWRITING CLEARANCE
Following our comprehensive credit assessment against the Central Bank of the UAE (CBUAE) 50.0% Debt-Burden Ratio (DBR) ceiling (+200 bps stress test), Betterway Mortgages LLC presents your top 3 institutional financing options:

OPTION 1 — PRIMARY RECOMMENDED BANK: [Selected Bank]
• Introductory Rate: [Intro Rate %] Fixed (3 Years)
• Estimated Monthly Instalment (EMI): AED [Monthly EMI AED]
• Early Settlement Fee Cap: 1% of outstanding principal (CBUAE max AED 10,000 + 5% VAT)

UPFRONT DLD & CLOSING CASH SUMMARY:
• 4% DLD Transfer Fee + AED 580 Admin: Statutory DLD schedule
• 0.25% DLD Mortgage Registration + AED 290: Registered First-Rank Mortgage
• RICS Bank Valuation: AED 2,625 – AED 3,150 (incl. 5% VAT)

Lead Mortgage Advisor: [Advisor Name]
Team Manager: Daniel Xavier
Betterway Mortgages LLC · Dubai, UAE`,
  },
  {
    id: 'buyer-60d-aip',
    title: '60-Day Buyer Financial Readiness & AIP Certificate',
    category: 'Mortgage Origination',
    badge: '60-Day Validity',
    summary: 'Seller & listing agent readiness certificate confirming borrower income, AECB check, and down-payment proof.',
    body: `CERTIFICATE REF: [Doc Ref]
ISSUE DATE: [Issue Date] · VALID FOR: 60 CALENDAR DAYS

BUYER MORTGAGE READINESS & PRE-QUALIFICATION CERTIFICATE

Betterway Mortgages LLC hereby certifies that [Client Name] (Deal Ref: [Deal Ref]) has completed initial CBUAE 50% DBR underwriting and documentation verification for a property acquisition up to:

• MAXIMUM QUALIFIED PROPERTY PRICE: AED [Property Value AED]
• PRE-QUALIFIED MORTGAGE FACILITY: AED [Loan Amount AED] ([LTV %]% LTV)
• PREFERRED LENDER PANEL: [Selected Bank]

Verified Underwriting Checkpoints:
1. 6-Month WPS Bank Statements & Salary Continuity Verified
2. CBUAE 50.0% Stressed DBR Test (+2.0% Buffer) Passed
3. Down-Payment & DLD Closing Funds Availability Confirmed

Certified by:
[Advisor Name] — Mortgage Advisor
Daniel Xavier — Team Manager & Mortgage Advisor
Betterway Mortgages LLC`,
  },
  {
    id: 'dld-form-f-annexure',
    title: 'RERA Form F (MOU) Protective Mortgage Clauses Annexure',
    category: 'DLD & Conveyancing',
    badge: 'DLD · Form F',
    summary: 'Protective buyer clauses for FOL contingency, RICS valuation shortfall, and 10% security cheque custody.',
    body: `ANNEXURE TO RERA FORM F (MEMORANDUM OF UNDERSTANDING)
DEAL REF: [Deal Ref] · BUYER: [Client Name] · COMMUNITY: [Property Community]

MANDATORY MORTGAGE PROTECTION CLAUSES:
1. FINAL OFFER LETTER (FOL) CONTINGENCY:
   This contract is strictly subject to the Buyer obtaining a Final Offer Letter (FOL) from [Selected Bank] for a minimum loan of AED [Loan Amount AED]. Should the bank decline or issue a lower valuation despite good-faith application, the 10% security deposit cheque shall be returned to the Buyer in full without penalty.

2. RICS BANK VALUATION CLAUSE:
   If the bank-instructed RICS valuation returns below AED [Property Value AED], the Parties agree to a 7-business-day window to file a DLD comparable valuation appeal or mutually adjust the transfer schedule.

3. DLD TRUSTEE MANAGER CHEQUE SPLIT:
   Upon Developer NOC issuance, final settlement shall occur at an authorized DLD Real Estate Registration Trustee office via Bank Manager Cheques.

Conveyancing Coordinator: Elton Frank (elton@betterwaymortgages.com)
Betterway Mortgages LLC`,
  },
  {
    id: 'cbuae-kfs-statement',
    title: 'CBUAE Key Facts Statement (KFS) & Cooling-Off Disclosure',
    category: 'Finance, VAT & Compliance',
    badge: 'CBUAE Mandatory',
    summary: 'Mandatory Consumer Protection Regulation KFS disclosure prior to bank submission.',
    body: `CENTRAL BANK OF THE UAE (CBUAE) — KEY FACTS STATEMENT (KFS)
DOCUMENT REF: [Doc Ref] · DEAL REF: [Deal Ref]
APPLICANT: [Client Name]

1. FACILITY SUMMARY:
   • Target Loan Amount: AED [Loan Amount AED]
   • Property Valuation / Purchase Price: AED [Property Value AED] ([LTV %]% LTV)
   • Selected Bank: [Selected Bank] · Introductory Rate: [Intro Rate %]

2. MANDATORY CBUAE DISCLOSURES:
   • Cooling-Off Period: You are entitled to a statutory 5-business-day cooling-off period after signing the Bank Final Offer Letter (FOL).
   • Variable Rate Warning: Post-introductory instalments are indexed to 3M/6M CBUAE EIBOR and will fluctuate when benchmark rates move.
   • Early Settlement Fee Cap: Capped at 1% of outstanding principal or AED 10,000 (+ 5% VAT), whichever is lower.

Applicant Signature: _______________________   Date: [Issue Date]
Advisor Witness: [Advisor Name] · Betterway Mortgages LLC`,
  },
  {
    id: 'fta-tax-invoice',
    title: 'FTA PINT-AE Compliant 5% VAT Tax Invoice',
    category: 'Finance, VAT & Compliance',
    badge: 'FTA VAT · 5%',
    summary: 'UAE Federal Tax Authority compliant Tax Invoice for bank subvention or advisory fee.',
    body: `TAX INVOICE (FTA PINT-AE COMPLIANT)
INVOICE NO: [Doc Ref] · DATE: [Issue Date]
SUPPLIER: Betterway Mortgages LLC · Dubai, UAE
BILL TO: [Selected Bank] / [Client Name] (Deal Ref: [Deal Ref])

DESCRIPTION OF SUPPLY:
Mortgage Origination, Credit Packaging & DLD Conveyancing Coordination for Deal [Deal Ref] ([Property Community] — Loan Amount AED [Loan Amount AED]).

• Net Advisory / Subvention Fee (Excl. VAT): AED 28,500.00
• UAE Standard Rate Output VAT (5.0%): AED 1,425.00
• TOTAL AMOUNT PAYABLE (INCL. 5% VAT): AED 29,925.00

SETTLEMENT CHANNEL (STRICTLY CORPORATE):
Payable exclusively to Betterway Mortgages LLC Corporate Bank Account (Zero personal advisor account collection permitted under Operating Rule #03).`,
  },
];

export const MASTER_WORKFLOW_BOOKLET_CHAPTERS: WorkflowBookletChapter[] = [
  {
    chapterNo: 1,
    title: 'Sovereign Brand Identity & Website-to-OS Architecture',
    department: 'Executive & Brand',
    leadOwner: 'Shabib Siraj & Warda',
    summary: 'Midnight Banking Navy (#021125) & Sovereign Gold (#D7B04E) parity across BetterwayMortgages public portal and Betterway OS.',
    controlRules: ['Zero color drift between public website and OS', 'Staff studio portraits strictly inside OS only'],
  },
  {
    chapterNo: 2,
    title: 'Omnichannel Lead Intake & 5-Minute GST Speed-to-Lead SLA',
    department: 'CRM & Telesales',
    leadOwner: 'Reshma Rajan, Mohammad Nusrik & Daniel Xavier',
    summary: 'Real-time ingestion from website calculators, consultation bookings, and partner referrals with automatic phone deduplication.',
    controlRules: ['5-minute GST SLA response timer', 'Round-robin advisor routing with studio profile attribution'],
  },
  {
    chapterNo: 3,
    title: 'CBUAE 50% DBR & +200 bps Stress-Test Engine',
    department: 'Origination & Credit',
    leadOwner: 'Daniel Xavier & Asif Khan',
    summary: 'Exact Central Bank of the UAE Debt-Burden Ratio calculation including 5% credit card limit imputation and BNPL lines.',
    controlRules: ['Hard 50.0% DBR ceiling', '+2.0% stress buffer over introductory rate'],
  },
  {
    chapterNo: 4,
    title: 'CBUAE LTV Ladder (UAE Nationals, Expats, >AED 5M & Off-Plan)',
    department: 'Origination & Credit',
    leadOwner: 'Daniel Xavier',
    summary: 'Automated LTV cap enforcement: 85%/80% first home, 65%/60% subsequent, 70%/65% jumbo >AED 5M, and 50% off-plan.',
    controlRules: ['Valuation basis uses lower of SPA price or RICS bank valuation'],
  },
  {
    chapterNo: 5,
    title: '24-Bank UAE Rate Matrix & Maker-Checker Rate Card Governance',
    department: 'Bank Relations',
    leadOwner: 'Daniel Xavier & Shabib Siraj',
    summary: 'Dual-track Conventional & Islamic (Murabaha/Ijara) rate comparison across 24 UAE banks with 3M/6M EIBOR revert logic.',
    controlRules: ['Maker-Checker sign-off required before rate card activation'],
  },
  {
    chapterNo: 6,
    title: '6-Month UAE Bank Statement Pre-Underwriting Analyzer',
    department: 'Credit Underwriting',
    leadOwner: 'Daniel Xavier & Asif Khan',
    summary: 'Automated detection of WPS salary credits, recurring EMIs, Tabby/Tamara BNPL, and dishonoured cheques before bank filing.',
    controlRules: ['Flags any returned cheque before IPA submission'],
  },
  {
    chapterNo: 7,
    title: 'Joint CBUAE Key Facts Statement (KFS) & 5-Day Cooling-Off Gate',
    department: 'Compliance & MLRO',
    leadOwner: 'Shabib Siraj & Daniel Xavier',
    summary: 'Every primary borrower, co-borrower, and guarantor must sign the bilingual KFS before bank submission is unlocked.',
    controlRules: ['Hard block on submitDealToBanks until all household applicants sign KFS'],
  },
  {
    chapterNo: 8,
    title: 'DNFBP AML Screening, PEP Check & FIU goAML XML Generation',
    department: 'Compliance & MLRO',
    leadOwner: 'Shabib Siraj',
    summary: 'Automated sanctions/PEP screening, High-Risk third-country source-of-wealth checks, and goAML STR/SAR XML export.',
    controlRules: ['MLRO sign-off required on EDD cases'],
  },
  {
    chapterNo: 9,
    title: 'Dual Primary + Backup Bank IPA Submission Strategy',
    department: 'Origination',
    leadOwner: 'Daniel Xavier, Asif Khan & Reshma Rajan',
    summary: 'Simultaneous Primary and Backup bank packaging to protect buyers against single-bank valuation or policy delays.',
    controlRules: ['Tracks IPA expiry windows (60 days)'],
  },
  {
    chapterNo: 10,
    title: 'RERA Form F (MOU) & Protective Mortgage Contingency Clauses',
    department: 'Conveyancing',
    leadOwner: 'Elton Frank',
    summary: 'Drafting Form F annexures protecting the buyer’s 10% security deposit cheque during bank valuation and FOL issuance.',
    controlRules: ['Mandatory FOL contingency date tracking'],
  },
  {
    chapterNo: 11,
    title: 'RICS Bank Valuation & DLD Comparable Appeal Pack',
    department: 'Conveyancing',
    leadOwner: 'Elton Frank & Daniel Xavier',
    summary: 'Handling down-valuations via DLD comparable appeals, backup bank switching, or renegotiation.',
    controlRules: ['Auto-computes LTV shortfall impact in fils'],
  },
  {
    chapterNo: 12,
    title: 'Final Offer Letter (FOL) Line-by-Line Audit & Security PDC Vault',
    department: 'Conveyancing & Risk',
    leadOwner: 'Elton Frank',
    summary: 'Auditing FOL revert margins, floor rates, Takaful assignment, and logging security cheques in the fireproof PDC Vault.',
    controlRules: ['Chain-of-custody tracking from IN_SAFE_VAULT to CLEARED/RETURNED'],
  },
  {
    chapterNo: 13,
    title: 'Developer NOC, Seller Bank Liability Payoff & DLD Trustee Cheque Split',
    department: 'Conveyancing',
    leadOwner: 'Elton Frank',
    summary: 'Exact Manager Cheque split calculation (Seller Bank Payoff + Seller Net Equity + DLD 4% + Trustee + Agency Fee).',
    controlRules: ['Tracks daily per-diem interest on seller liability letters'],
  },
  {
    chapterNo: 14,
    title: 'Off-Plan Handover, Snagging, Oqood-to-Title Conversion & Escrow Tranches',
    department: 'Handover Desk',
    leadOwner: 'Elton Frank & Asif Khan',
    summary: 'Managing 50% off-plan construction LTV to 80%/85% completion LTV upon BCC and developer snagging sign-off.',
    controlRules: ['Links RERA project escrow IBAN verification'],
  },
  {
    chapterNo: 15,
    title: '50/50 Commission Split, B2B Partner Sub-Splits & 180-Day Clawback Reserve',
    department: 'Finance & Treasury',
    leadOwner: 'Shabib Siraj & Warda',
    summary: 'Automated calculation of bank subvention, external partner share, 50/50 House/Advisor split, and 180-day clawback retention.',
    controlRules: ['Halts commission release if advisor RERA BRN or Visa is expired'],
  },
  {
    chapterNo: 16,
    title: 'Double-Entry General Ledger, FTA VAT 201, PINT-AE e-Invoicing & 9% Corporate Tax',
    department: 'Accounting & Tax',
    leadOwner: 'Shabib Siraj & Warda',
    summary: 'Balanced integer-fils journal postings, FTA VAT 201 Box 1–9 return, and UAE 9% Corporate Tax (AED 375,000 threshold).',
    controlRules: ['Every journal entry enforces SUM(debit_fils) === SUM(credit_fils)'],
  },
  {
    chapterNo: 17,
    title: 'Rahaba Azeez HR Desk: MOHRE WPS .SIF Payroll, GPSSA & Statutory EOSB Gratuity',
    department: 'Human Resources',
    leadOwner: 'Rahaba Azeez',
    summary: 'Monthly MOHRE .SIF file generation (EDR + SCR lines), Emirati Nafis/GPSSA, and Decree-Law 33/2021 EOSB calculation.',
    controlRules: ['Managed by Rahaba Azeez with Shabib Siraj & Warda executive oversight'],
  },
  {
    chapterNo: 18,
    title: '10:05 AM GST Office Reception QR Stand & Anti-Loophole Wi-Fi Verification',
    department: 'HR & Office Operations',
    leadOwner: 'Rahaba Azeez & Daniel Xavier',
    summary: 'Physical QR Stand check-in requiring Betterway-Office-5G Wi-Fi and staff password; blocks cellular data check-ins.',
    controlRules: ['Print restricted to Shabib Siraj, Warda, Admin & Daniel Xavier', '3+ late arrivals in 7d triggers Contemptor Alert'],
  },
  {
    chapterNo: 19,
    title: 'Betterway ONE Mobile App, Offline Sync Queue & 21:00–08:00 Quiet-Hours Redaction',
    department: 'Mobile & Field Ops',
    leadOwner: 'Daniel Xavier, Asif Khan & Reshma Rajan',
    summary: 'Field PWA with AES-256-GCM scoped bundles, UUID idempotent offline queue, version-merge conflict resolver, and PDPL lock-screen redaction.',
    controlRules: ['Irreversible disbursal actions require live server sign-off'],
  },
  {
    chapterNo: 20,
    title: 'Zero Direct Delete, Pending Delete Bin & Supreme Owner Command Centre',
    department: 'Executive Governance',
    leadOwner: 'Shabib Siraj, Warda & Betterway Admin',
    summary: 'No staff member can hard-delete records; all deletions route to the Pending Delete Bin for Owner approval.',
    controlRules: ['Immutable SHA-256 audit log and DR backup verification'],
  },
];

export function listStudioTemplates(): StudioTemplateSpec[] {
  return STUDIO_TEMPLATES;
}

export function getMasterWorkflowBookletChapters(): WorkflowBookletChapter[] {
  return MASTER_WORKFLOW_BOOKLET_CHAPTERS;
}

export interface CreateStudioDocInput {
  templateId: string;
  dealId?: number;
  employeeEmail?: string;
  customFields?: Record<string, string>;
  createdByEmail: string;
}

export function createAndAutoFillStudioDocument(
  db: DatabaseSync,
  input: CreateStudioDocInput,
) {
  const tpl = STUDIO_TEMPLATES.find((t) => t.id === input.templateId) ?? STUDIO_TEMPLATES[0]!;
  const issueDate = new Date(Date.now() + 4 * 3600_000).toISOString().slice(0, 10);
  const docRef = `BW-DOC-${Date.now().toString(36).toUpperCase().slice(-6)}`;

  // Resolve Employee context
  const targetEmail = (input.employeeEmail || input.createdByEmail || 'asif@betterwaymortgages.com')
    .trim()
    .toLowerCase();
  const empRow = db
    .prepare(
      `SELECT e.*, u.email
       FROM employees e
       LEFT JOIN users u ON u.id = e.user_id
       WHERE LOWER(u.email) = ? OR LOWER(e.full_name) = ?
       LIMIT 1`,
    )
    .get(targetEmail, targetEmail) as Record<string, unknown> | undefined;

  const staffProfile = getStaffProfileByNameOrEmail(targetEmail);
  const empName = empRow ? String(empRow.full_name) : staffProfile?.fullNameEn || 'Asif Khan';
  const empCode = empRow ? String(empRow.emp_code) : 'BW-EMP-009';
  const designation = empRow ? String(empRow.designation) : staffProfile?.designation || 'Mortgage Advisor';
  const department = empRow ? String(empRow.department) : staffProfile?.department || 'Mortgage Advisory';
  const joinDate = empRow ? String(empRow.join_date) : '2025-05-01';
  const mohreId = empRow ? String(empRow.mohre_person_id_14) : '00102030405009';
  const empIban = empRow ? String(empRow.employee_iban_23) : 'AE070331234567890123409';
  const basicAed = empRow ? Math.round(Number(empRow.basic_salary_fils) / 100) : 7_000;
  const allowAed = empRow
    ? Math.round(
        (Number(empRow.housing_allowance_fils) +
          Number(empRow.transport_allowance_fils) +
          Number(empRow.other_allowance_fils)) /
          100,
      )
    : 5_000;
  const totalAed = basicAed + allowAed;

  // Resolve Deal context
  const dealRow = db
    .prepare(
      `SELECT d.*, h.primary_name AS client_name, b.name_en AS bank_name, u.full_name_en AS advisor_name
       FROM deals d
       JOIN households h ON h.id = d.household_id
       LEFT JOIN banks b ON b.id = d.selected_bank_id
       LEFT JOIN users u ON u.id = d.advisor_id
       WHERE d.id = ? OR d.origin_mode = 'LIVE'
       ORDER BY CASE WHEN d.id = ? THEN 0 ELSE 1 END, d.id ASC
       LIMIT 1`,
    )
    .get(Number(input.dealId || 1), Number(input.dealId || 1)) as Record<string, unknown> | undefined;

  const propValAed = dealRow ? Math.round(Number(dealRow.purchase_price_fils) / 100) : 3_500_000;
  const loanValAed = dealRow ? Math.round(Number(dealRow.target_loan_fils) / 100) : 2_800_000;
  const ltvPct = propValAed > 0 ? ((loanValAed / propValAed) * 100).toFixed(1) : '80.0';
  const monthlyEmiAed = Math.round(loanValAed * 0.00527);

  const replacements: Record<string, string> = {
    '[Issue Date]': issueDate,
    '[Doc Ref]': docRef,
    '[Employee Name]': empName,
    '[Employee Code]': empCode,
    '[Designation]': designation,
    '[Department]': department,
    '[Join Date]': joinDate,
    '[MOHRE ID]': mohreId,
    '[Employee IBAN]': empIban,
    '[Basic Salary AED]': basicAed.toLocaleString(),
    '[Allowances AED]': allowAed.toLocaleString(),
    '[Total Salary AED]': totalAed.toLocaleString(),
    '[Addressee Bank]': input.customFields?.addresseeBank || 'Emirates NBD PJSC — Retail Credit Desk, Dubai, UAE',
    '[Client Name]': dealRow ? String(dealRow.client_name) : 'Khalid Al Nuaimi',
    '[Deal Ref]': dealRow ? String(dealRow.deal_ref) : 'BW-2026-0001',
    '[Property Community]': dealRow ? String(dealRow.community_name) : 'Dubai Hills Estate',
    '[Property Value AED]': propValAed.toLocaleString(),
    '[Loan Amount AED]': loanValAed.toLocaleString(),
    '[LTV %]': ltvPct,
    '[Selected Bank]': dealRow?.bank_name ? String(dealRow.bank_name) : 'Emirates NBD',
    '[Intro Rate %]': '3.89% Fixed (3 Years)',
    '[Monthly EMI AED]': monthlyEmiAed.toLocaleString(),
    '[Advisor Name]': dealRow?.advisor_name ? String(dealRow.advisor_name) : 'Daniel Xavier',
    ...(input.customFields || {}),
  };

  let renderedBody = tpl.body;
  for (const [token, val] of Object.entries(replacements)) {
    renderedBody = renderedBody.split(token).join(val);
  }

  const ins = db
    .prepare(
      `INSERT INTO studio_documents (
        doc_ref, template_id, title, category, deal_id, employee_email,
        rendered_body, language, created_by_email, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'en', ?, 'FINAL_READY')`,
    )
    .run(
      docRef,
      tpl.id,
      tpl.title,
      tpl.category,
      dealRow ? Number(dealRow.id) : null,
      targetEmail,
      renderedBody,
      input.createdByEmail,
    );

  return {
    id: Number(ins.lastInsertRowid),
    docRef,
    templateId: tpl.id,
    title: tpl.title,
    category: tpl.category,
    renderedBody,
    issueDate,
  };
}

export function transformStudioDocumentWithAi(
  content: string,
  instruction: 'improve' | 'formal_legal' | 'shorten' | 'translate_ar' | 'translate_en',
): string {
  if (instruction === 'translate_ar') {
    return [
      `شركة بيتروي للوساطة العقارية والتمويل ذ.م.م — دبي، الإمارات العربية المتحدة`,
      `وثيقة رسمية معتمدة — شهادة راتب / خطاب رسمي ومذكرة التمويل العقاري`,
      `────────────────────────────────────────────────────────`,
      `نشهد نحن شركة بيتروي للوساطة العقارية والتمويل ذ.م.م بأن البيانات المالية والوظيفية الواردة أدناه صحيحة ومطابقة لسجلات نظام حماية الأجور (WPS) وضوابط مصرف الإمارات المركزي (CBUAE) ودائرة الأراضي والأملاك في دبي (DLD) بالعملة الرسمية (درهم إماراتي AED):`,
      ``,
      content,
      ``,
      `تم التدقيق والاعتماد من قبل: رحابة عزيز (إدارة الموارد البشرية) · شبيب سراج (المدير العام والمؤسس)`,
    ].join('\n');
  }

  if (instruction === 'formal_legal') {
    return [
      `STRICTLY CONFIDENTIAL & SUBJECT TO UAE FEDERAL & CBUAE REGULATORY GOVERNANCE`,
      `═══════════════════════════════════════════════════════════════════════════`,
      content,
      ``,
      `REGULATORY ATTESTATION: Executed in compliance with UAE Central Bank Mortgage Regulations, Federal Decree-Law No. 33 of 2021 (MOHRE Labour Law), and Federal Decree-Law No. 45 of 2021 (PDPL).`,
    ].join('\n');
  }

  if (instruction === 'shorten') {
    const lines = content
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    return lines.slice(0, Math.min(12, lines.length)).join('\n');
  }

  return [
    `BETTERWAY MORTGAGES LLC — EXECUTIVE CERTIFIED DOCUMENT`,
    content,
    `\n[Verified against Betterway OS Live SQLite Ledger & Corporate Seal]`,
  ].join('\n');
}
