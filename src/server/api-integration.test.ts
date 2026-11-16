import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { createTestDb } from '@/server/db';
import type { UserRecord } from '@/server/auth';
import {
  registerPartnerAgent,
  submitPartnerLead,
  convertLeadToDeal,
  uploadDealVaultDocument,
  downloadDealVaultDocument,
  submitDealToBanks,
  verifyAndSignPartnerAgency,
} from './services/os-service';
import { recordKfsAcknowledgement, runApplicantAmlScreening } from './engines/compliance-aml-engine';
import { recordBankBordereauReceipt, recordDealDisbursal } from './engines/commission-clawback-engine';

test('end-to-end Betterway OS workflow: unverified RERA agent instant lead-drop -> Deal -> Vault expiry pre-flight -> KFS/CDD gate -> Disbursal -> ONBOARDING_HOLD -> ORN verification release', () => {
  const db = createTestDb();
  const tmpVaultDir = mkdtempSync(path.join(os.tmpdir(), 'bw-vault-test-'));

  try {
    // 1. Self-register a brand-new RERA agent from an unverified agency
    const reg = registerPartnerAgent(db, {
      companyName: 'Palm Marina Luxury Homes LLC',
      tradeLicenceNo: 'DED-776655',
      reraOrn: 'ORN-77665',
      vatTrn15: '100776655400003',
      fullNameEn: 'Sami Al Gergawi',
      email: 'sami@palmmarina.ae',
      phone: '+971507776655',
      password: 'Password#123',
      reraBrn: 'BRN-77112',
      brnExpiryDate: '2027-12-31',
      isAgencyAdmin: true,
    });
    assert.equal(reg.verificationStatus, 'PENDING_ORN_CHECK');

    // 2. Agent immediately drops a buyer lead BEFORE internal staff verify ORN
    const leadId = submitPartnerLead(db, reg.user, {
      contactName: 'Rashed Al Falasi',
      contactPhone: '+971508889900',
      contactEmail: 'rashed@example.ae',
      transactionType: 'READY_PURCHASE',
      targetPropertyFils: 400_000_000, // AED 4,000,000
      clientConsentConfirmed: true,
    });
    assert.ok(leadId > 0);

    // 3. Advisor converts lead to deal
    const advisor = db.prepare("SELECT * FROM users WHERE email = 'tariq.advisor@betterwaymortgages.com'").get() as UserRecord;
    const { dealId, primaryApplicantId } = convertLeadToDeal(db, advisor, {
      leadId,
      residencyType: 'UAE_NATIONAL',
      basicSalaryFils: 4_500_000,
      allowancesFils: 1_500_000,
      purchasePriceFils: 400_000_000,
      targetLoanFils: 300_000_000, // 75% LTV
      tenureMonths: 300,
      emirate: 'dubai',
      communityName: 'Palm Jumeirah',
      selectedBankId: 2, // Emirates NBD
    });

    // 4. Attempting bank submission before KFS & CDD must be blocked
    assert.throws(() => submitDealToBanks(db, advisor, { dealId, primaryBankId: 2 }), /KFS|CDD/i);

    // 5. Upload Salary Certificate older than 30 days -> flags WARNING_STALE_30D, and round-trips AES-256-GCM decryption
    const docId = uploadDealVaultDocument(
      db,
      advisor,
      {
        dealId,
        applicantId: primaryApplicantId,
        docCategory: 'SALARY_CERT',
        fileName: 'salary-certificate.pdf',
        mimeType: 'application/pdf',
        plainBytes: Buffer.from('%PDF-1.4 SAMPLE SALARY CERTIFICATE'),
        documentIssueDate: '2026-08-01', // > 30 days stale
      },
      tmpVaultDir,
    );
    const uploadedMeta = db.prepare('SELECT ocr_validation_status FROM vault_documents WHERE id = ?').get(docId) as {
      ocr_validation_status: string;
    };
    assert.equal(uploadedMeta.ocr_validation_status, 'WARNING_STALE_30D');

    const downloaded = downloadDealVaultDocument(db, advisor, docId, tmpVaultDir);
    assert.equal(downloaded.plainBytes.toString('utf8'), '%PDF-1.4 SAMPLE SALARY CERTIFICATE');

    // 6. Sign KFS + Clear AML/CDD -> Bank submission succeeds!
    const mlro = db.prepare("SELECT * FROM users WHERE email = 'farid.mlro@betterwaymortgages.com'").get() as UserRecord;
    recordKfsAcknowledgement(db, {
      dealId,
      applicantId: primaryApplicantId,
      disclosedBrokerFeeFils: 0,
      disclosedLfiCommissionRange: '0.45% - 0.95% paid by bank',
      signedByName: 'Rashed Al Falasi',
    });
    runApplicantAmlScreening(db, mlro, {
      dealId,
      applicantId: primaryApplicantId,
      sourceOfFundsType: 'UAE_SALARY_SAVINGS',
      verified: true,
    });

    const subResult = submitDealToBanks(db, advisor, { dealId, primaryBankId: 2, backupBankId: 4 });
    assert.equal(subResult.stage, 'IPA_SUBMITTED');
    assert.equal(subResult.submissionsCount, 2);

    // 7. Disburse & receive bank bordereau cash -> Partner payout held in ONBOARDING_HOLD because ORN not verified yet!
    const finance = db.prepare("SELECT * FROM users WHERE email = 'sana.finance@betterwaymortgages.com'").get() as UserRecord;
    const disb = recordDealDisbursal(db, finance, {
      dealId,
      disbursedLoanFils: 300_000_000,
      disbursedDate: '2026-11-16',
      fixedExpiryDate: '2028-11-16',
    });
    const settledHold = recordBankBordereauReceipt(db, finance, {
      dealId,
      receivedSubventionExVatFils: Number(disb.expected_subvention_ex_vat_fils),
      receivedDate: '2026-11-22',
      batchRef: 'ENBD-NOV-HOLDTEST',
    });
    assert.equal(settledHold.partner_payout_status, 'ONBOARDING_HOLD');

    // 8. Admin verifies ORN & marks agreement SIGNED -> releases ONBOARDING_HOLD to PAYABLE_READY + emits Self-Billed Partner Tax Invoice!
    const admin = db.prepare("SELECT * FROM users WHERE email = 'md@betterwaymortgages.com'").get() as UserRecord;
    const released = verifyAndSignPartnerAgency(db, admin, {
      agencyId: reg.agencyId,
      bankName: 'Emirates NBD',
      iban: 'AE440260001055566677701',
    });
    assert.equal(released.releasedSettlementsCount, 1);

    const afterVerify = db.prepare('SELECT partner_payout_status FROM commission_settlements WHERE deal_id = ?').get(dealId) as {
      partner_payout_status: string;
    };
    assert.equal(afterVerify.partner_payout_status, 'PAYABLE_READY');
  } finally {
    rmSync(tmpVaultDir, { recursive: true, force: true });
  }
});
