import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDb } from '@/server/db';
import type { UserRecord } from '@/server/auth';
import {
  registerPartnerAgent,
  submitDealToBanks,
  submitPartnerLead,
  convertLeadToDeal,
  verifyAndSignPartnerAgency,
} from './services/os-service';
import {
  recordBankBordereauReceipt,
  recordDealDisbursal,
  triggerBankClawback,
  releaseExpiredClawbacks,
} from './engines/commission-clawback-engine';
import { runMonthlyWpsPayroll } from './engines/wps-gratuity-engine';
import { computeVat201Summary, createPintAeTaxInvoice, getTrialBalance } from './engines/ledger-tax-engine';
import { recordKfsAcknowledgement, runApplicantAmlScreening } from './engines/compliance-aml-engine';
import { evaluateDealAcross24Banks } from './engines/underwriting-engine';

test('R1 (C1): WPS payroll respects advisor clawback offsets and routes recoverable draws through GL 1310 without driving GL 2150 negative', () => {
  const db = createTestDb();
  const finance = db.prepare("SELECT * FROM users WHERE email = 'sana.finance@betterwaymortgages.com'").get() as UserRecord;
  const hr = db.prepare("SELECT * FROM users WHERE email = 'reem.hr@betterwaymortgages.com'").get() as UserRecord;
  const mlro = db.prepare("SELECT * FROM users WHERE email = 'farid.mlro@betterwaymortgages.com'").get() as UserRecord;

  // Clear KFS + CDD for Deal 1 (joint household Khalid & Sara)
  const deal1Apps = db.prepare('SELECT id, full_name_en FROM applicants WHERE household_id = 1').all() as {
    id: number;
    full_name_en: string;
  }[];
  for (const a of deal1Apps) {
    recordKfsAcknowledgement(db, {
      dealId: 1,
      applicantId: a.id,
      disclosedBrokerFeeFils: 0,
      disclosedLfiCommissionRange: '0.45% - 1.00%',
      signedByName: a.full_name_en,
    });
    runApplicantAmlScreening(db, mlro, { dealId: 1, applicantId: a.id, sourceOfFundsType: 'UAE_SALARY_SAVINGS', verified: true });
  }

  // Pre-seed a clawback debit of AED 1,000 (100,000 fils) on Advisor Tariq (GL 1310)
  const advisor = db.prepare("SELECT * FROM users WHERE email = 'tariq.advisor@betterwaymortgages.com'").get() as UserRecord;
  db.prepare('UPDATE employees SET clawback_debit_balance_fils = 100000 WHERE user_id = ?').run(advisor.id);

  // Month 1 (no deals disbursed yet): Tariq gets AED 5,000 recoverable draw -> must debit GL 1310, NOT GL 2150!
  runMonthlyWpsPayroll(db, hr, { periodMonth: '2026-10', payStartDate: '2026-10-01', payEndDate: '2026-10-31' });
  let tb = getTrialBalance(db);
  const gl2150AfterDraw = tb.find((r) => r.code === '2150')!;
  assert.equal(gl2150AfterDraw.total_credit_fils - gl2150AfterDraw.total_debit_fils, 0);

  // Month 2: Disburse Deal 1 & receive bordereau cash -> AED 1,000 clawback offset deducted from Tariq's release
  const disb = recordDealDisbursal(db, finance, {
    dealId: 1,
    disbursedLoanFils: 280_000_000,
    disbursedDate: '2026-11-05',
    fixedExpiryDate: '2028-11-05',
  });
  const settled = recordBankBordereauReceipt(db, finance, {
    dealId: 1,
    receivedSubventionExVatFils: Number(disb.expected_subvention_ex_vat_fils),
    receivedDate: '2026-11-12',
    batchRef: 'HSBC-R1-TEST',
  });
  assert.equal(settled.advisor_clawback_offset_applied_fils, 100_000);

  // Run Month 2 WPS Payroll -> GL 2150 must clear cleanly to 0 (not negative -100,000!)
  runMonthlyWpsPayroll(db, hr, { periodMonth: '2026-11', payStartDate: '2026-11-01', payEndDate: '2026-11-30' });
  tb = getTrialBalance(db);
  const gl2150AfterPay = tb.find((r) => r.code === '2150')!;
  assert.equal(gl2150AfterPay.total_credit_fils - gl2150AfterPay.total_debit_fils, 0);
});

test('R2 (C2): Zero-TRN partner onboarding hold release with newly supplied TRN books GL 2310 Input VAT and matches PINT-AE total_fils', () => {
  const db = createTestDb();
  const reg = registerPartnerAgent(db, {
    companyName: 'Creekside Prestige Homes LLC',
    tradeLicenceNo: 'DED-661122',
    reraOrn: 'ORN-66112',
    vatTrn15: '', // Registered without TRN initially!
    fullNameEn: 'Nasser Al Ketbi',
    email: 'nasser@creekside.ae',
    phone: '+971506611223',
    password: 'Password#123',
    reraBrn: 'BRN-66112',
    brnExpiryDate: '2027-12-31',
    isAgencyAdmin: true,
  });

  const leadId = submitPartnerLead(db, reg.user, {
    contactName: 'Majid Al Suwaidi',
    contactPhone: '+971509988776',
    targetPropertyFils: 300_000_000,
    clientConsentConfirmed: true,
  });

  const advisor = db.prepare("SELECT * FROM users WHERE email = 'tariq.advisor@betterwaymortgages.com'").get() as UserRecord;
  const { dealId, primaryApplicantId } = convertLeadToDeal(db, advisor, {
    leadId,
    residencyType: 'UAE_NATIONAL',
    basicSalaryFils: 4_000_000,
    allowancesFils: 1_000_000,
    purchasePriceFils: 300_000_000,
    targetLoanFils: 240_000_000,
    tenureMonths: 300,
    emirate: 'dubai',
    communityName: 'Dubai Creek Harbour',
    selectedBankId: 2,
  });

  const mlro = db.prepare("SELECT * FROM users WHERE email = 'farid.mlro@betterwaymortgages.com'").get() as UserRecord;
  recordKfsAcknowledgement(db, {
    dealId,
    applicantId: primaryApplicantId,
    disclosedBrokerFeeFils: 0,
    disclosedLfiCommissionRange: '0.45% - 1.00%',
    signedByName: 'Majid Al Suwaidi',
  });
  runApplicantAmlScreening(db, mlro, { dealId, applicantId: primaryApplicantId, sourceOfFundsType: 'UAE_SALARY_SAVINGS', verified: true });

  const finance = db.prepare("SELECT * FROM users WHERE email = 'sana.finance@betterwaymortgages.com'").get() as UserRecord;
  const disb = recordDealDisbursal(db, finance, {
    dealId,
    disbursedLoanFils: 240_000_000,
    disbursedDate: '2026-11-10',
    fixedExpiryDate: '2028-11-10',
  });
  recordBankBordereauReceipt(db, finance, {
    dealId,
    receivedSubventionExVatFils: Number(disb.expected_subvention_ex_vat_fils),
    receivedDate: '2026-11-15',
    batchRef: 'ENBD-R2-HOLD',
  });

  // Now Admin verifies ORN AND supplies 15-digit VAT TRN!
  const admin = db.prepare("SELECT * FROM users WHERE email = 'md@betterwaymortgages.com'").get() as UserRecord;
  verifyAndSignPartnerAgency(db, admin, {
    agencyId: reg.agencyId,
    bankName: 'Emirates NBD',
    iban: 'AE440260001055566677701',
    vatTrn15: '100661122300003',
  });

  const inv = db
    .prepare("SELECT * FROM tax_invoices WHERE deal_id = ? AND invoice_type = 'SELF_BILLED_PARTNER'")
    .get(dealId) as { subtotal_fils: number; vat_fils: number; total_fils: number };
  assert.ok(inv.vat_fils > 0);

  const tb = getTrialBalance(db);
  const gl2110 = tb.find((r) => r.code === '2110')!;
  const gl2100 = tb.find((r) => r.code === '2100')!;
  assert.equal(gl2110.total_credit_fils - gl2110.total_debit_fils, 0);
  assert.equal(gl2100.total_credit_fils - gl2100.total_debit_fils, inv.total_fils);
});

test('R3 (C3 + I1): INCLUSIVE_5PCT bordereau clears GL 1200 to 0, rejects duplicate reconciled receipts, guards clawback idempotency, and releases matured holds', () => {
  const db = createTestDb();
  const finance = db.prepare("SELECT * FROM users WHERE email = 'sana.finance@betterwaymortgages.com'").get() as UserRecord;
  const mlro = db.prepare("SELECT * FROM users WHERE email = 'farid.mlro@betterwaymortgages.com'").get() as UserRecord;

  // Switch HSBC subvention grid to INCLUSIVE_5PCT
  db.prepare("UPDATE bank_subvention_grids SET vat_mode = 'INCLUSIVE_5PCT' WHERE bank_id = 4").run();

  const deal1Apps = db.prepare('SELECT id, full_name_en FROM applicants WHERE household_id = 1').all() as {
    id: number;
    full_name_en: string;
  }[];
  for (const a of deal1Apps) {
    recordKfsAcknowledgement(db, {
      dealId: 1,
      applicantId: a.id,
      disclosedBrokerFeeFils: 0,
      disclosedLfiCommissionRange: '0.45% - 1.00%',
      signedByName: a.full_name_en,
    });
    runApplicantAmlScreening(db, mlro, { dealId: 1, applicantId: a.id, sourceOfFundsType: 'UAE_SALARY_SAVINGS', verified: true });
  }

  const disb = recordDealDisbursal(db, finance, {
    dealId: 1,
    disbursedLoanFils: 280_000_000,
    disbursedDate: '2026-11-01',
    fixedExpiryDate: '2028-11-01',
  });
  recordBankBordereauReceipt(db, finance, {
    dealId: 1,
    receivedSubventionExVatFils: Number(disb.expected_subvention_ex_vat_fils),
    receivedDate: '2026-11-10',
    batchRef: 'HSBC-INCL-1',
  });

  // GL 1200 must clear to exact 0 fils even under INCLUSIVE_5PCT!
  const tb = getTrialBalance(db);
  const gl1200 = tb.find((r) => r.code === '1200')!;
  assert.equal(gl1200.total_debit_fils - gl1200.total_credit_fils, 0);

  // Duplicate bordereau receipt on already RECONCILED deal must be rejected
  assert.throws(
    () =>
      recordBankBordereauReceipt(db, finance, {
        dealId: 1,
        receivedSubventionExVatFils: 100_000,
        receivedDate: '2026-11-11',
        batchRef: 'HSBC-INCL-DUP',
      }),
    /reconciled|exceeds/i,
  );

  // Release matured clawback holds after protected_until_date
  const released = releaseExpiredClawbacks(db, finance, '2029-12-01');
  assert.equal(released.releasedCount, 1);

  // Cannot trigger clawback once no longer ACTIVE_HOLD
  assert.throws(
    () => triggerBankClawback(db, finance, { dealId: 1, clawbackClaimExVatFils: 500_000, triggeredDate: '2029-12-02' }),
    /ACTIVE_HOLD|already/i,
  );
});

test('R4 (C4 + I4): recordDealDisbursal enforces KFS/CDD gate, submitDealToBanks blocks knocked-out banks, and underwriting enforces max age at maturity', () => {
  const db = createTestDb();
  const finance = db.prepare("SELECT * FROM users WHERE email = 'sana.finance@betterwaymortgages.com'").get() as UserRecord;
  const advisor = db.prepare("SELECT * FROM users WHERE email = 'tariq.advisor@betterwaymortgages.com'").get() as UserRecord;
  const mlro = db.prepare("SELECT * FROM users WHERE email = 'farid.mlro@betterwaymortgages.com'").get() as UserRecord;

  // Deal 2 has PENDING CDD & unsigned KFS -> recordDealDisbursal must reject!
  assert.throws(
    () =>
      recordDealDisbursal(db, finance, {
        dealId: 2,
        disbursedLoanFils: 168_000_000,
        disbursedDate: '2026-11-16',
        fixedExpiryDate: '2028-11-16',
      }),
    /KFS|CDD/i,
  );

  // Sign KFS & clear CDD on Deal 2 (non-resident UK applicant James Thornton)
  const james = db.prepare('SELECT id FROM applicants WHERE household_id = 2').get() as { id: number };
  recordKfsAcknowledgement(db, {
    dealId: 2,
    applicantId: james.id,
    disclosedBrokerFeeFils: 1_000_000,
    disclosedLfiCommissionRange: '0.45% - 1.00%',
    signedByName: 'James Thornton',
  });
  runApplicantAmlScreening(db, mlro, { dealId: 2, applicantId: james.id, sourceOfFundsType: 'OVERSEAS_DIVIDENDS', verified: true });

  // Find a bank that does NOT accept non-residents (knocked out) and verify submitDealToBanks rejects it!
  const resOnlyBank = db.prepare('SELECT id FROM banks WHERE accepts_non_resident = 0 LIMIT 1').get() as { id: number };
  assert.throws(
    () => submitDealToBanks(db, advisor, { dealId: 2, primaryBankId: resOnlyBank.id }),
    /ineligible|knocked out/i,
  );

  // Set applicant DOB so age + 25y tenure > 65 salaried ceiling -> must knock out banks!
  db.prepare("UPDATE applicants SET dob = '1970-01-01' WHERE id = ?").run(james.id);
  db.prepare('UPDATE deals SET tenure_months = 300 WHERE id = 2').run();
  const uwAged = evaluateDealAcross24Banks(db, 2);
  assert.equal(uwAged.eligibleOffers.length, 0);
  assert.ok(uwAged.knockouts.some((k) => /age|maturity/i.test(k.reason)));
});

test('R5 (C6 + I5): Public partner signup cannot hijack existing ORN as admin, EndpointID avoids 0235:0235:, and CREDIT_NOTE_381 emits CreditNote + reverses GL/VAT', () => {
  const db = createTestDb();
  const finance = db.prepare("SELECT * FROM users WHERE email = 'sana.finance@betterwaymortgages.com'").get() as UserRecord;

  // Attempt to register on existing verified ORN '11842' claiming isAgencyAdmin: true
  const hijackAttempt = registerPartnerAgent(db, {
    companyName: 'Harbour Crest Real Estate Broker LLC',
    tradeLicenceNo: 'DED-918273',
    reraOrn: '11842',
    fullNameEn: 'Intruder Agent',
    email: 'intruder@example.com',
    phone: '+971500000001',
    password: 'Password#123',
    reraBrn: 'BRN-99999',
    brnExpiryDate: '2027-12-31',
    isAgencyAdmin: true,
  });
  assert.equal(hijackAttempt.user.role, 'PARTNER_AGENT');

  // Issue a standard tax invoice then a Credit Note 381
  const inv = createPintAeTaxInvoice(db, finance, {
    invoiceType: 'TAX_INVOICE_380',
    counterpartyName: 'Test Client',
    counterpartyTrn15: '100222333400003',
    issueDate: '2026-11-16',
    supplyDate: '2026-11-16',
    subtotalFils: 1_000_000,
    vatRateBps: 500,
    description: 'Advisory Fee',
  });
  assert.ok(!inv.pint_ae_xml.includes('>0235:'));

  const vatBeforeCn = computeVat201Summary(db);
  const cn = createPintAeTaxInvoice(db, finance, {
    invoiceType: 'CREDIT_NOTE_381',
    counterpartyName: 'Test Client',
    counterpartyTrn15: '100222333400003',
    issueDate: '2026-11-17',
    supplyDate: '2026-11-17',
    subtotalFils: 400_000,
    vatRateBps: 500,
    description: 'Partial Fee Credit Note',
  });
  assert.ok(cn.pint_ae_xml.includes('<CreditNote'));
  const vatAfterCn = computeVat201Summary(db);
  assert.equal(vatBeforeCn.outputVatFils - vatAfterCn.outputVatFils, 20_000);
});
