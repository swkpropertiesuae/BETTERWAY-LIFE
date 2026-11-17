export interface WorkflowStepDef {
  stepNumber: number;
  slug: string;
  shortTitle: string;
  title: string;
  category: 'Morning & Leads' | 'ID Check & Bank Approval' | 'Property Transfer & Payout' | 'Daily Report & Owner Control';
  whatIsThis: string;
  howToFollow: [string, string, string];
  fullModuleHref: string;
  fullModuleLabel: string;
}

export const STEP_WORKFLOWS: WorkflowStepDef[] = [
  {
    stepNumber: 1,
    slug: 'check-in',
    shortTitle: '01 · Morning QR Check-In',
    title: 'Step 1: Morning Office QR Check-In (Before 10:05 AM)',
    category: 'Morning & Leads',
    whatIsThis:
      'Every morning when you arrive at the office (10:00 AM start, 10:05 AM grace period), click Check-In here so your attendance is marked On Time.',
    howToFollow: [
      'Check that your arrival time is before 10:05 AM Dubai time.',
      'Click the orange "Complete Morning Check-In" button below.',
      'Click "Next Step" to start adding and calling today’s clients.',
    ],
    fullModuleHref: '/os/reception-qr',
    fullModuleLabel: 'Open Full Attendance & QR Page',
  },
  {
    stepNumber: 2,
    slug: 'add-lead',
    shortTitle: '02 · Add New Client',
    title: 'Step 2: Add a New Client Inquiry (Lead)',
    category: 'Morning & Leads',
    whatIsThis:
      'Whenever a new buyer asks for a mortgage (from WhatsApp, Bayut, Property Finder, or a Broker Partner), save their name and phone number here.',
    howToFollow: [
      'Type the client’s full name, phone number, and property price.',
      'Pick how they found us (WhatsApp, Website, Bayut, or Partner) and what they are buying.',
      'Click "Save New Client" — this starts the 5-minute callback timer.',
    ],
    fullModuleHref: '/os/crm',
    fullModuleLabel: 'Open Full Leads & CRM Board',
  },
  {
    stepNumber: 3,
    slug: 'call-lead',
    shortTitle: '03 · Call & WhatsApp Client',
    title: 'Step 3: Call the Client & Log Your First Reply (Within 5 Mins)',
    category: 'Morning & Leads',
    whatIsThis:
      'Call or WhatsApp the new client within 5 minutes and write a short note of what they need. This marks the 5-minute SLA timer as Passed.',
    howToFollow: [
      'Choose the client from the dropdown list.',
      'Type a simple 1-line summary of your call or WhatsApp message.',
      'Click "Log Call & Pass 5-Min Timer".',
    ],
    fullModuleHref: '/os/crm',
    fullModuleLabel: 'Open Full Leads & CRM Board',
  },
  {
    stepNumber: 4,
    slug: 'convert-lead',
    shortTitle: '04 · Start Mortgage File',
    title: 'Step 4: Convert Interested Client into an Active Mortgage File',
    category: 'Morning & Leads',
    whatIsThis:
      'Once the client agrees to proceed, click one button to open their official Mortgage Deal File so we can check banks and documents.',
    howToFollow: [
      'Select the client lead you spoke with.',
      'Click "Create Active Mortgage File".',
      'Click "Next Step" to check Dubai area prices or run their ID & consent check.',
    ],
    fullModuleHref: '/os/deals',
    fullModuleLabel: 'Open Deal Pipeline Board',
  },
  {
    stepNumber: 5,
    slug: 'market-guide',
    shortTitle: '05 · Check Area Prices',
    title: 'Step 5: Check Dubai Property Prices & Client Pitch (24 Areas)',
    category: 'Morning & Leads',
    whatIsThis:
      'Going on a site visit or speaking with a buyer? Pick any of the 24 Dubai areas to see current DLD prices, 15-year growth, and exact sentences to say to the client.',
    howToFollow: [
      'Click on the Dubai community your client is interested in (e.g. Palm Jumeirah, Downtown, Dubai Hills).',
      'Read the 15-Year Price Forecast (2026–2041) and nearby Metro/Schools/Hospitals.',
      'Read the ready-made Pitch Script out loud to your client.',
    ],
    fullModuleHref: '/os/market',
    fullModuleLabel: 'Open Full 24-Area Market Pulse',
  },
  {
    stepNumber: 6,
    slug: 'calculator',
    shortTitle: '06 · Payment Calculator',
    title: 'Step 6: Calculate Monthly Payment & Upfront Cash Needed',
    category: 'ID Check & Bank Approval',
    whatIsThis:
      'Show your client their exact monthly mortgage payment, how much cash they need for Down Payment + DLD 4% fees, and if they qualify for the 10-Year UAE Golden Visa.',
    howToFollow: [
      'Enter the property price, down payment %, and client monthly salary.',
      'Review the Monthly Payment, 50% Central Bank limit check, and Total Upfront Cash.',
      'Share the numbers with your client and click "Next Step".',
    ],
    fullModuleHref: '/os/toolkit',
    fullModuleLabel: 'Open Full Mortgage Calculator Toolkit',
  },
  {
    stepNumber: 7,
    slug: 'sign-kfs',
    shortTitle: '07 · Sign Client Consent (KFS)',
    title: 'Step 7: Sign Client Key Facts Statement (KFS Consent)',
    category: 'ID Check & Bank Approval',
    whatIsThis:
      'UAE Central Bank rules require every borrower (and co-borrower) to sign the Key Facts Statement (KFS) before we send their file to any bank.',
    howToFollow: [
      'Select the Mortgage File and Applicant from the list.',
      'Confirm the fee disclosure and type the client’s name.',
      'Click "Record Signed KFS Consent".',
    ],
    fullModuleHref: '/os/compliance',
    fullModuleLabel: 'Open Full Compliance & KFS Desk',
  },
  {
    stepNumber: 8,
    slug: 'id-check',
    shortTitle: '08 · Run Client ID Check',
    title: 'Step 8: Complete Client ID & Safety Check (AML / CDD)',
    category: 'ID Check & Bank Approval',
    whatIsThis:
      'Verify the client’s Emirates ID / Passport and where their down-payment money comes from (Salary Savings, Property Sale, or Company Dividends).',
    howToFollow: [
      'Pick the Mortgage File and Applicant.',
      'Select how their down payment is funded and mark Sanctions Check as "CLEAR".',
      'Click "Approve ID & Unlock Bank Submission".',
    ],
    fullModuleHref: '/os/compliance',
    fullModuleLabel: 'Open Full Compliance & KFS Desk',
  },
  {
    stepNumber: 9,
    slug: 'update-income',
    shortTitle: '09 · Enter Salary & Loan',
    title: 'Step 9: Enter Client Salary, Credit Score & Loan Terms',
    category: 'ID Check & Bank Approval',
    whatIsThis:
      'Enter the borrower’s basic salary, allowances, AECB credit score, and target loan amount so the system can calculate their exact eligibility across 24 UAE banks.',
    howToFollow: [
      'Select the Applicant and enter their monthly salary and AECB score.',
      'Click "Save Client Income & Recalculate".',
      'Click "Next Step" to see which of the 24 UAE banks approve the loan.',
    ],
    fullModuleHref: '/os/los',
    fullModuleLabel: 'Open Full 24-Bank Underwriting Desk',
  },
  {
    stepNumber: 10,
    slug: 'compare-banks',
    shortTitle: '10 · Compare 24 Banks',
    title: 'Step 10: Compare All 24 UAE Banks (Instant Pass / Fail)',
    category: 'ID Check & Bank Approval',
    whatIsThis:
      'See side-by-side which of the 24 UAE banks approve this client under Central Bank rules (50% DBR & LTV caps), ranked from lowest monthly payment to highest.',
    howToFollow: [
      'Pick the Mortgage File at the top.',
      'Review the green "ELIGIBLE" banks and their Fixed Interest Rate & Monthly EMI.',
      'Note the top 2 banks and click "Next Step" to submit the application.',
    ],
    fullModuleHref: '/os/los',
    fullModuleLabel: 'Open Full 24-Bank Underwriting Desk',
  },
  {
    stepNumber: 11,
    slug: 'submit-ipa',
    shortTitle: '11 · Send to Top 2 Banks',
    title: 'Step 11: Send Application to Primary & Backup Bank (Pre-Approval / IPA)',
    category: 'ID Check & Bank Approval',
    whatIsThis:
      'Always submit to 2 banks at the same time (a Primary Bank and a Backup Bank) so the client is protected if one bank is slow.',
    howToFollow: [
      'Pick the Mortgage File, Primary Bank, and Backup Bank.',
      'Add a short note for the bank underwriter.',
      'Click "Submit Dual-Bank Pre-Approval (IPA)".',
    ],
    fullModuleHref: '/os/los',
    fullModuleLabel: 'Open Full 24-Bank Underwriting Desk',
  },
  {
    stepNumber: 12,
    slug: 'record-fol',
    shortTitle: '12 · Record Bank Offer (FOL)',
    title: 'Step 12: Record Bank Pre-Approval (IPA) or Final Offer Letter (FOL)',
    category: 'Property Transfer & Payout',
    whatIsThis:
      'When the bank issues the Pre-Approval (IPA) or Final Offer Letter (FOL), enter the reference number here and mark the FOL checked.',
    howToFollow: [
      'Select the Bank Submission from the dropdown.',
      'Choose "IPA Approved" or "FOL Issued" and enter the Bank Reference Number.',
      'Click "Save Bank Offer Status".',
    ],
    fullModuleHref: '/os/los',
    fullModuleLabel: 'Open Full 24-Bank Underwriting Desk',
  },
  {
    stepNumber: 13,
    slug: 'valuation-noc',
    shortTitle: '13 · Valuation & Developer NOC',
    title: 'Step 13: Record Property Valuation & Developer NOC',
    category: 'Property Transfer & Payout',
    whatIsThis:
      'Enter the independent bank valuation price and confirm the Developer NOC (No Objection Certificate) so the file is ready for transfer.',
    howToFollow: [
      'Select the Mortgage File and enter the Bank Valuation Amount (AED).',
      'Set Developer NOC Status to "NOC Issued".',
      'Click "Save Valuation & NOC Status".',
    ],
    fullModuleHref: '/os/conveyancing',
    fullModuleLabel: 'Open Full Conveyancing Desk',
  },
  {
    stepNumber: 14,
    slug: 'trustee-cheques',
    shortTitle: '14 · DLD Transfer Cheques',
    title: 'Step 14: Prepare Manager’s Cheques for DLD Trustee Transfer Day',
    category: 'Property Transfer & Payout',
    whatIsThis:
      'Before going to the Dubai Land Department (DLD) Registration Trustee office, review the exact Manager’s Cheques needed for the Seller, DLD 4%, Trustee, and Broker.',
    howToFollow: [
      'Pick the Mortgage File to view its automatic Cheque Split table.',
      'Verify each Payee and Amount (in AED) + RERA Form F protective clauses.',
      'Click "Next Step" once the transfer is completed at the Trustee office.',
    ],
    fullModuleHref: '/os/conveyancing',
    fullModuleLabel: 'Open Full Conveyancing Desk',
  },
  {
    stepNumber: 15,
    slug: 'disburse-loan',
    shortTitle: '15 · Mark Loan Disbursed',
    title: 'Step 15: Mark Loan Disbursed & Book Expected Bank Commission',
    category: 'Property Transfer & Payout',
    whatIsThis:
      'Once the loan is disbursed at the DLD Trustee, record the final loan amount here so the accounting system books our expected bank commission (subvention).',
    howToFollow: [
      'Select the Mortgage File and confirm the Disbursed Loan Amount (AED).',
      'Pick the Disbursal Date and Fixed-Rate Expiry Date (for future refinance alerts).',
      'Click "Record Loan Disbursal".',
    ],
    fullModuleHref: '/os/erp',
    fullModuleLabel: 'Open Full Accounting & ERP Desk',
  },
  {
    stepNumber: 16,
    slug: 'split-commission',
    shortTitle: '16 · 50/50 Commission Split',
    title: 'Step 16: Receive Bank Commission & Calculate 50/50 Advisor Split',
    category: 'Property Transfer & Payout',
    whatIsThis:
      'When the bank wires the commission into Betterway’s Corporate Account, record the receipt here. After any external B2B partner share, the remaining net pool splits 50% Betterway / 50% Advisor.',
    howToFollow: [
      'Select the Disbursed Deal and enter the Bank Cash Received (AED).',
      'Enter the Bank Wire / Bordereau Reference Number.',
      'Click "Record Bank Payment & Release 50/50 Split".',
    ],
    fullModuleHref: '/os/erp',
    fullModuleLabel: 'Open Full Accounting & ERP Desk',
  },
  {
    stepNumber: 17,
    slug: 'withdraw-deal',
    shortTitle: '17 · Cancel Deal / Refund',
    title: 'Step 17: Cancel a Deal or Request a Client Refund Safely',
    category: 'Daily Report & Owner Control',
    whatIsThis:
      'If a deal falls through (for example, property down-valuation), log the withdrawal and any client refund using only legal UAE corporate payment channels for Owner Shabib Siraj’s approval.',
    howToFollow: [
      'Pick the Mortgage File, enter the collected fee and any incurred valuation/admin cost.',
      'Select one of the 7 Legal UAE Payment Channels (Personal accounts are strictly blocked).',
      'Click "Submit Refund for Owner Approval".',
    ],
    fullModuleHref: '/os/withdrawals',
    fullModuleLabel: 'Open Full Withdrawals & Refunds Page',
  },
  {
    stepNumber: 18,
    slug: 'daily-report',
    shortTitle: '18 · Daily Work Report',
    title: 'Step 18: Submit Your End-of-Day Staff Work Report (Before 7:00 PM)',
    category: 'Daily Report & Owner Control',
    whatIsThis:
      'Before leaving at 7:00 PM, every advisor and manager submits a 30-second summary of today’s calls, site visits, and bank submissions.',
    howToFollow: [
      'Enter how many calls, qualified leads, site visits, and bank IPAs you completed today.',
      'Write a short summary of today’s progress and tomorrow’s priority.',
      'Click "Submit Daily Work Report".',
    ],
    fullModuleHref: '/os/operations?tab=reports',
    fullModuleLabel: 'Open Company Operations Centre',
  },
  {
    stepNumber: 19,
    slug: 'delete-bin',
    shortTitle: '19 · Pending Delete Bin',
    title: 'Step 19: Request Record Deletion / Owner Delete Bin (Zero Direct Delete)',
    category: 'Daily Report & Owner Control',
    whatIsThis:
      'Staff can never permanently delete any record. If a lead or deal was created by mistake, send it to the Pending Delete Bin with a reason for Owner Shabib Siraj to review.',
    howToFollow: [
      'Choose the record type, ID, and title, and write why it should be removed.',
      'Click "Send to Pending Delete Bin".',
      'If you are Supreme Owner Shabib Siraj, click "Reject & Restore" or "Approve Permanent Delete".',
    ],
    fullModuleHref: '/os/recycle-bin',
    fullModuleLabel: 'Open Full Pending Delete Bin',
  },
  {
    stepNumber: 20,
    slug: 'owner-approvals',
    shortTitle: '20 · Owner & Admin Control',
    title: 'Step 20: Supreme Owner Approvals, Briefings & Admin Account Control',
    category: 'Daily Report & Owner Control',
    whatIsThis:
      'Dedicated control room for Supreme Owner Shabib Siraj to approve Manager Decisions, trigger the 09:30 AM & 10:30 AM WhatsApp briefings, and supervise the Admin account.',
    howToFollow: [
      'Trigger the 09:30 AM Morning Briefing or 10:30 AM Attendance & Contemptor Report in 1 click.',
      'Approve or Reject pending Manager Admin Decisions.',
      'Use the Owner Control card to Activate, Suspend, Force Sign-Out, or Reset Password on admin@betterwaymortgages.com.',
    ],
    fullModuleHref: '/os/recycle-bin?tab=admin_control',
    fullModuleLabel: 'Open Owner Governance Console',
  },
];

export function getStepBySlug(slug: string): WorkflowStepDef {
  return STEP_WORKFLOWS.find((s) => s.slug === slug) ?? STEP_WORKFLOWS[0]!;
}
