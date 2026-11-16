import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDb } from '@/server/db';
import type { UserRecord } from '@/server/auth';
import {
  recordKfsAcknowledgement,
  checkBankSubmissionGate,
  runApplicantAmlScreening,
  listGoAmlReports,
  createGoAmlReport,
} from './compliance-aml-engine';
import {
  postJournalEntry,
  recordVendorBill,
  computeVat201Summary,
  computeCorporateTaxSummary,
  createPintAeTaxInvoice,
} from './ledger-tax-engine';
import {
  recordDealDisbursal,
  recordBankBordereauReceipt,
  triggerBankClawback,
} from './commission-clawback-engine';
import { importLegacyBackbookCsv } from './backbook-importer';

test('CBUAE joint KFS hard-gate blocks bank submission until EVERY obligated applicant signs KFS and clears CDD', () => {
  const db = createTestDb();
  // Reset Deal 1 CDD to PENDING, clear pre-seeded KFS, and set stage to DOC_COLLECTION
  db.prepare(`DELETE FROM kfs_acknowledgements WHERE deal_id = 1`).run();
  db.prepare(`UPDATE deals SET stage = 'DOC_COLLECTION', cdd_status = 'PENDING' WHERE id = 1`).run();
  const apps = db.prepare('SELECT id, full_name_en FROM applicants WHERE household_id = 1 ORDER BY id ASC').all() as {
    id: number;
    full_name_en: string;
  }[];
  assert.equal(apps.length, 2);

  // Only PRIMARY signs KFS
  recordKfsAcknowledgement(db, {
    dealId: 1,
    applicantId: apps[0].id,
    disclosedBrokerFeeFils: 0,
    disclosedLfiCommissionRange: '0.45% - 0.95% paid by bank',
    signedByName: apps[0].full_name_en,
    signedIp: '127.0.0.1',
  });

  const gate1 = checkBankSubmissionGate(db, 1);
  assert.equal(gate1.allowed, false);
  assert.deepEqual(gate1.missingKfsApplicants, ['Sara Al Nuaimi']);

  // CO_BORROWER signs KFS, but CDD still PENDING
  recordKfsAcknowledgement(db, {
    dealId: 1,
    applicantId: apps[1].id,
    disclosedBrokerFeeFils: 0,
    disclosedLfiCommissionRange: '0.45% - 0.95% paid by bank',
    signedByName: apps[1].full_name_en,
    signedIp: '127.0.0.1',
  });
  const gate2 = checkBankSubmissionGate(db, 1);
  assert.equal(gate2.allowed, false);
  assert.match(gate2.cddBlocker ?? '', /CDD/i);

  // Screen both applicants -> clears CDD
  const mlro = db.prepare("SELECT * FROM users WHERE email = 'farid.mlro@betterwaymortgages.com'").get() as UserRecord;
  runApplicantAmlScreening(db, mlro, { dealId: 1, applicantId: apps[0].id, sourceOfFundsType: 'UAE_SALARY_SAVINGS', verified: true });
  runApplicantAmlScreening(db, mlro, { dealId: 1, applicantId: apps[1].id, sourceOfFundsType: 'UAE_SALARY_SAVINGS', verified: true });

  const gate3 = checkBankSubmissionGate(db, 1);
  assert.equal(gate3.allowed, true);
});

test('goAML STR/SAR vault rejects non-MLRO admins and exports valid UAE FIU goAML XML for MLRO', () => {
  const db = createTestDb();
  const nonMlroAdmin = db.prepare("SELECT * FROM users WHERE email = 'ops.director@betterwaymortgages.com'").get() as UserRecord;
  const mlro = db.prepare("SELECT * FROM users WHERE email = 'farid.mlro@betterwaymortgages.com'").get() as UserRecord;

  assert.throws(() => listGoAmlReports(db, nonMlroAdmin), /MLRO/i);

  const report = createGoAmlReport(db, mlro, {
    reportType: 'STR',
    dealId: 2,
    subjectSummary: 'Third-party layered remittance from unverified exchange house',
    redFlags: ['THIRD_PARTY_REMITTANCE', 'UNEXPLAINED_SOURCE_OF_WEALTH'],
  });
  assert.match(report.goaml_xml_payload, /<report_code>STR<\/report_code>/);
  assert.equal(listGoAmlReports(db, mlro).length, 2);
});

test('Double-entry GL rejects unbalanced entries, computes FTA VAT 201 & 9% Corporate Tax (> AED 375k), and emits Peppol PINT-AE UBL 2.1 XML', () => {
  const db = createTestDb();
  const finance = db.prepare("SELECT * FROM users WHERE email = 'sana.finance@betterwaymortgages.com'").get() as UserRecord;

  assert.throws(() => {
    postJournalEntry(db, finance, {
      entryDate: '2026-11-16',
      memo: 'Unbalanced broken entry',
      sourceModule: 'TEST',
      sourceId: 'ERR-1',
      lines: [
        { accountCode: '1100', debitFils: 100_000, creditFils: 0 },
        { accountCode: '4200', debitFils: 0, creditFils: 99_999 },
      ],
    });
  }, /unbalanced/i);

  // Create AED 600,000 taxable revenue invoice (+5% VAT = AED 30,000) with PINT-AE UBL 2.1 XML
  const inv = createPintAeTaxInvoice(db, finance, {
    invoiceType: 'TAX_INVOICE_380',
    counterpartyName: 'Emirates NBD Bank PJSC',
    counterpartyTrn15: '100223344500003',
    counterpartyPeppolId: '0235:100223344500003',
    issueDate: '2026-11-16',
    supplyDate: '2026-11-16',
    subtotalFils: 60_000_000, // AED 600,000
    vatRateBps: 500,
    revenueAccountCode: '4100',
    receivableAccountCode: '1200',
    description: 'Mortgage brokerage subvention batch Nov 2026',
  });
  assert.match(inv.pint_ae_xml, /urn:peppol:pint:billing-1@ae-1/);
  assert.match(inv.pint_ae_xml, /100482910400003/);
  assert.equal(inv.vat_fils, 3_000_000); // AED 30,000

  // Record AED 40,000 entertainment bill (50% CT deductible) and AED 10,000 fine (0% CT deductible)
  recordVendorBill(db, finance, {
    vendorName: 'DIFC Hospitality Venue',
    vendorTrn15: '100556677800003',
    billDate: '2026-11-16',
    expenseAccountCode: '6400',
    subtotalFils: 4_000_000, // AED 40,000
    inputVatFils: 200_000, // AED 2,000
    inputVatCategory: 'DIRECT_TAXABLE',
    ctDeductibility: 'ENTERTAINMENT_50',
  });
  recordVendorBill(db, finance, {
    vendorName: 'Administrative Penalty Authority',
    vendorTrn15: '',
    billDate: '2026-11-16',
    expenseAccountCode: '6500',
    subtotalFils: 1_000_000, // AED 10,000
    inputVatFils: 0,
    inputVatCategory: 'DIRECT_TAXABLE',
    ctDeductibility: 'NON_DEDUCTIBLE_0',
  });

  const vat201 = computeVat201Summary(db);
  assert.equal(vat201.standardRatedSuppliesFils, 60_000_000);
  assert.equal(vat201.outputVatFils, 3_000_000);
  assert.equal(vat201.recoverableInputVatFils, 200_000);
  assert.equal(vat201.netVatPayableFils, 2_800_000);

  // Accounting profit = 600,000 - 40,000 - 10,000 = AED 550,000
  // CT add-backs = 50% of 40,000 (AED 20,000) + 100% of 10,000 (AED 10,000) = AED 30,000 -> Taxable Income = AED 580,000
  // 9% CT on (580,000 - 375,000 = 205,000) = AED 18,450 (1,845,000 fils)
  const ct = computeCorporateTaxSummary(db);
  assert.equal(ct.accountingNetProfitFils, 55_000_000);
  assert.equal(ct.taxableIncomeFils, 58_000_000);
  assert.equal(ct.corporateTaxPayableFils, 1_845_000);
});

test('Pay-when-paid waterfall pays strictly on received Bank Subvention (never Client Fee), handles partial tranches without double-pay, and offsets clawbacks on next deal', () => {
  const db = createTestDb();
  const finance = db.prepare("SELECT * FROM users WHERE email = 'sana.finance@betterwaymortgages.com'").get() as UserRecord;

  // Set AED 10,000 direct client fee on Deal 1 alongside AED 2,800,000 HSBC loan (75 bps = AED 21,000 bank subvention ex-VAT)
  db.prepare('UPDATE deals SET direct_client_fee_fils = 1_000_000 WHERE id = 1').run();

  const settlement = recordDealDisbursal(db, finance, {
    dealId: 1,
    disbursedLoanFils: 280_000_000,
    disbursedDate: '2026-11-16',
    fixedExpiryDate: '2028-11-16',
  });

  // Expected HSBC subvention = 0.75% of AED 2,800,000 = AED 21,000 (2,100,000 fils)
  assert.equal(settlement.expected_subvention_ex_vat_fils, 2_100_000);
  // House IFRS-15 Clawback Provision = 10% of AED 21,000 = AED 2,100 (210,000 fils)
  assert.equal(settlement.house_clawback_provision_fils, 210_000);
  // Partner Agency (Harbour Crest GOLD 30%) entitled to 30% of AED 21,000 = AED 6,300 (630,000 fils) — ZERO share of AED 10,000 client fee!
  assert.equal(settlement.partner_entitled_ex_vat_fils, 630_000);
  // Pay-when-paid: released = 0 until bank cash arrives!
  assert.equal(settlement.partner_released_ex_vat_fils, 0);
  assert.equal(settlement.advisor_released_fils, 0);

  // 1) Bank pays 50% partial tranche (AED 10,500 ex-VAT) + client pays 100% of AED 10,000 fee
  const afterHalf = recordBankBordereauReceipt(db, finance, {
    dealId: 1,
    receivedSubventionExVatFils: 1_050_000,
    receivedClientFeeExVatFils: 1_000_000,
    receivedDate: '2026-11-20',
    batchRef: 'HSBC-NOV-PART1',
  });
  assert.equal(afterHalf.reconciliation_status, 'PARTIAL_RECEIVED');
  assert.equal(afterHalf.partner_released_ex_vat_fils, 315_000); // Exact 50% of AED 6,300

  // 2) Bank pays remaining 50% tranche (AED 10,500 ex-VAT)
  const afterFull = recordBankBordereauReceipt(db, finance, {
    dealId: 1,
    receivedSubventionExVatFils: 1_050_000,
    receivedClientFeeExVatFils: 0,
    receivedDate: '2026-11-25',
    batchRef: 'HSBC-NOV-PART2',
  });
  assert.equal(afterFull.reconciliation_status, 'RECONCILED');
  assert.equal(afterFull.partner_released_ex_vat_fils, 630_000); // Exact 100%, zero double-pay!
  assert.equal(afterFull.partner_payout_status, 'PAYABLE_READY');

  // 3) Early bank clawback of 100% on Deal 1 books debit balances on Partner Agency & Advisor
  const cb = triggerBankClawback(db, finance, {
    dealId: 1,
    clawbackClaimExVatFils: 2_100_000,
    triggeredDate: '2027-04-10',
  });
  assert.equal(cb.partner_debit_booked_fils, 630_000);
  const agencyAfterCb = db.prepare('SELECT clawback_debit_balance_fils FROM partner_agencies WHERE id = 1').get() as {
    clawback_debit_balance_fils: number;
  };
  assert.equal(agencyAfterCb.clawback_debit_balance_fils, 630_000);

  // 4) Deal 2 clears KFS + CDD, then disburses & reconciles under same agency (AED 2,000,000 ENBD loan @ 80 bps = AED 16,000 subvention -> 30% partner split = AED 4,800)
  // The AED 4,800 (480,000 fils) must be 100% offset against the AED 6,300 clawback debit, leaving AED 1,500 remaining debit!
  const deal2App = db.prepare('SELECT id, full_name_en FROM applicants WHERE household_id = 2').get() as { id: number; full_name_en: string };
  recordKfsAcknowledgement(db, {
    dealId: 2,
    applicantId: deal2App.id,
    disclosedBrokerFeeFils: 1_000_000,
    disclosedLfiCommissionRange: '0.45% - 1.00% paid by LFI',
    signedByName: deal2App.full_name_en,
  });
  db.prepare("UPDATE deals SET cdd_status = 'CLEARED' WHERE id = 2").run();
  recordDealDisbursal(db, finance, {
    dealId: 2,
    disbursedLoanFils: 200_000_000,
    disbursedDate: '2027-05-01',
    fixedExpiryDate: '2029-05-01',
  });
  const deal2Settled = recordBankBordereauReceipt(db, finance, {
    dealId: 2,
    receivedSubventionExVatFils: 1_600_000,
    receivedClientFeeExVatFils: 0,
    receivedDate: '2027-05-15',
    batchRef: 'ENBD-MAY-01',
  });
  assert.equal(deal2Settled.partner_clawback_offset_applied_fils, 480_000);
  const agencyAfterOffset = db.prepare('SELECT clawback_debit_balance_fils FROM partner_agencies WHERE id = 1').get() as {
    clawback_debit_balance_fils: number;
  };
  assert.equal(agencyAfterOffset.clawback_debit_balance_fils, 150_000);
});

test('importLegacyBackbookCsv loads historical closed loans into 90-Day Radar & Clawback Watchlist without polluting current-period Revenue or VAT', () => {
  const db = createTestDb();
  const finance = db.prepare("SELECT * FROM users WHERE email = 'sana.finance@betterwaymortgages.com'").get() as UserRecord;

  const revBefore = computeVat201Summary(db).standardRatedSuppliesFils;
  const csv = [
    'deal_ref,client_name,phone,community,bank_key,loan_aed,rate_pct,disbursed_date,fixed_expiry_date,revert_margin_pct,floor_pct',
    'BW-LEGACY-2024-09,Nabil Al Zarooni,+971509988771,Palm Jumeirah,dib,4200000,3.99,2025-01-20,2027-01-20,1.15,2.99',
  ].join('\n');

  const imported = importLegacyBackbookCsv(db, finance, csv);
  assert.equal(imported.importedCount, 1);

  const radarRow = db
    .prepare("SELECT m.* FROM homeowner_radar_monitors m JOIN deals d ON d.id = m.deal_id WHERE d.deal_ref = 'BW-LEGACY-2024-09'")
    .get() as { disbursed_loan_fils: number; fixed_expiry_date: string } | undefined;
  assert.ok(radarRow);
  assert.equal(radarRow.disbursed_loan_fils, 420_000_000);

  const revAfter = computeVat201Summary(db).standardRatedSuppliesFils;
  assert.equal(revAfter, revBefore, 'Legacy back-book import must never create current-period VATable revenue');
});
