import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDb } from '@/server/db';
import type { UserRecord } from '@/server/auth';
import {
  canPrintReceptionQr,
  isSupremeOwner,
  executeOwnerAdminControl,
  recordReceptionQrCheckIn,
  generateOwnerBriefing,
  requestRecordDeletionToBin,
  decideRecycleBinRequest,
  submitManagerAdminDecision,
  decideManagerAdminDecision,
  assertLegalUaePaymentChannel,
  computeSwk5050CommissionSplit,
  createDealWithdrawalRequest,
  decideDealWithdrawal,
  DUBAI_AREAS_24,
  syncDailyDldTransactions,
} from './engines/swk-enterprise-engine';

test('SWK-1: Hierarchy & Reception QR Print Guard — only Owner Shabib Siraj, Admin, and Manager Mohammad Haseeb can print QR; Owner controls Admin account', () => {
  const db = createTestDb();
  const shabib = db.prepare("SELECT * FROM users WHERE email = 'shabib@betterwaymortgages.com'").get() as UserRecord;
  const admin = db.prepare("SELECT * FROM users WHERE email = 'admin@betterwaymortgages.com'").get() as UserRecord;
  const haseeb = db.prepare("SELECT * FROM users WHERE email = 'haseeb@betterwaymortgages.com'").get() as UserRecord;
  const advisor = db.prepare("SELECT * FROM users WHERE email = 'tariq.advisor@betterwaymortgages.com'").get() as UserRecord;

  assert.equal(isSupremeOwner(shabib), true);
  assert.equal(isSupremeOwner(admin), false);
  assert.equal(canPrintReceptionQr(shabib), true);
  assert.equal(canPrintReceptionQr(admin), true);
  assert.equal(canPrintReceptionQr(haseeb), true);
  assert.equal(canPrintReceptionQr(advisor), false);

  // Non-owner cannot suspend admin@betterwaymortgages.com
  assert.throws(() => executeOwnerAdminControl(db, haseeb, { action: 'suspend', notes: 'Test' }), /Owner/i);

  // Supreme Owner Shabib Siraj can suspend and re-activate admin@betterwaymortgages.com
  const suspended = executeOwnerAdminControl(db, shabib, { action: 'suspend', notes: 'Audit lock test' });
  assert.equal(suspended.adminStatus, 'SUSPENDED');
  const reactivated = executeOwnerAdminControl(db, shabib, { action: 'activate', notes: 'Restored by Owner' });
  assert.equal(reactivated.adminStatus, 'ACTIVE');
});

test('SWK-2: Office Reception QR Attendance enforces 10:05 AM GST grace period and triggers Continuous Contemptor Alert at >=3 late arrivals in 7 days', () => {
  const db = createTestDb();
  const shabib = db.prepare("SELECT * FROM users WHERE email = 'shabib@betterwaymortgages.com'").get() as UserRecord;
  const advisor = db.prepare("SELECT * FROM users WHERE email = 'tariq.advisor@betterwaymortgages.com'").get() as UserRecord;

  const onTime = recordReceptionQrCheckIn(db, advisor, {
    checkInDate: '2026-11-10',
    checkInTimeGst: '10:04',
    networkSsid: 'Betterway-Office-5G',
    qrStandCode: 'BW-RECEPTION-STAND-DXB-1',
  });
  assert.equal(onTime.isLate, false);
  assert.equal(onTime.lateMinutes, 0);

  // 3 late arrivals (> 10:05 AM) within 7 days -> triggers Continuous Contemptor Alert!
  recordReceptionQrCheckIn(db, advisor, {
    checkInDate: '2026-11-11',
    checkInTimeGst: '10:15',
    networkSsid: 'Betterway-Office-5G',
    qrStandCode: 'BW-RECEPTION-STAND-DXB-1',
  });
  recordReceptionQrCheckIn(db, advisor, {
    checkInDate: '2026-11-12',
    checkInTimeGst: '10:22',
    networkSsid: 'Betterway-Office-5G',
    qrStandCode: 'BW-RECEPTION-STAND-DXB-1',
  });
  const thirdLate = recordReceptionQrCheckIn(db, advisor, {
    checkInDate: '2026-11-13',
    checkInTimeGst: '10:31',
    networkSsid: 'Betterway-Office-5G',
    qrStandCode: 'BW-RECEPTION-STAND-DXB-1',
  });
  assert.equal(thirdLate.isLate, true);
  assert.equal(thirdLate.lateMinutes, 31);
  assert.equal(thirdLate.contemptorAlertTriggered, true);

  const report = generateOwnerBriefing(db, shabib, 'attendance-1030', '2026-11-13');
  assert.ok(report.contemptorsCount >= 1);
});

test('SWK-3: Pending Delete Bin (Recycle Bin) and Manager Admin Decisions require mandatory reason and Owner Shabib Siraj final sign-off', () => {
  const db = createTestDb();
  const shabib = db.prepare("SELECT * FROM users WHERE email = 'shabib@betterwaymortgages.com'").get() as UserRecord;
  const haseeb = db.prepare("SELECT * FROM users WHERE email = 'haseeb@betterwaymortgages.com'").get() as UserRecord;

  assert.throws(
    () =>
      requestRecordDeletionToBin(db, haseeb, {
        entityType: 'leads',
        entityId: '1',
        recordTitle: 'Lead #1 — Khalid Al Nuaimi',
        deleteReason: '',
      }),
    /reason/i,
  );

  const binId = requestRecordDeletionToBin(db, haseeb, {
    entityType: 'leads',
    entityId: '1',
    recordTitle: 'Lead #1 — Khalid Al Nuaimi',
    deleteReason: 'Duplicate test inquiry requested for archival',
  });

  // Manager cannot self-approve Recycle Bin deletion
  assert.throws(() => decideRecycleBinRequest(db, haseeb, { binId, decision: 'REJECTED_RESTORED' }), /Owner/i);

  const restored = decideRecycleBinRequest(db, shabib, {
    binId,
    decision: 'REJECTED_RESTORED',
    ownerNotes: 'Keep active lead on file',
  });
  assert.equal(restored.status, 'REJECTED_RESTORED');

  const decId = submitManagerAdminDecision(db, haseeb, {
    subject: 'Q4 Bayut & Dubizzle Co-Branded Mortgage Campaign Budget',
    category: 'Marketing & Portal Allocation',
    reason: 'Target 40 qualified ready-transfer buyers in Dubai Hills & Marina',
    amountFils: 4_500_000,
  });
  const decApproved = decideManagerAdminDecision(db, shabib, {
    decisionId: decId,
    decision: 'APPROVED',
    ownerComment: 'Approved by Shabib Siraj',
  });
  assert.equal(decApproved.status, 'APPROVED');
});

test('SWK-4: Zero tolerance for personal bank accounts, 50-50% Net Commission Split after Partner share, and Deal Withdrawals with Owner sign-off', () => {
  const db = createTestDb();
  const shabib = db.prepare("SELECT * FROM users WHERE email = 'shabib@betterwaymortgages.com'").get() as UserRecord;
  const haseeb = db.prepare("SELECT * FROM users WHERE email = 'haseeb@betterwaymortgages.com'").get() as UserRecord;

  // Personal advisor account must be strictly blocked
  assert.throws(() => assertLegalUaePaymentChannel('Sales Advisor Personal Bank Account'), /personal|prohibited/i);
  assert.doesNotThrow(() => assertLegalUaePaymentChannel('Betterway Company Bank Account (AED/FX)'));

  // 50-50% Net Commission Split: AED 30,000 gross ex-VAT with 30% 3rd-party partner share (AED 9,000) -> Net Pool AED 21,000 -> AED 10,500 Company / AED 10,500 Advisor
  const split = computeSwk5050CommissionSplit({
    grossCommissionExVatFils: 3_000_000,
    partnerShareBps: 3000,
  });
  assert.equal(split.partnerShareFils, 900_000);
  assert.equal(split.companyNetPoolFils, 2_100_000);
  assert.equal(split.company50ShareFils, 1_050_000);
  assert.equal(split.advisor50ShareFils, 1_050_000);

  // Deal withdrawal & client refund request -> Owner approval
  const wId = createDealWithdrawalRequest(db, haseeb, {
    dealId: 2,
    department: 'OFFPLAN_HANDOVER',
    withdrawalReason: 'Buyer deferred handover financing to cash settlement per SPA addendum',
    collectedFeeFils: 1_000_000,
    incurredCostFils: 315_000,
    paymentChannel: 'Betterway Company Bank Account (AED/FX)',
  });
  const wDecided = decideDealWithdrawal(db, shabib, {
    withdrawalId: wId,
    decision: 'APPROVED_REFUNDED',
    ownerNotes: 'Refund AED 6,850 net of valuation cost approved by Shabib Siraj',
  });
  assert.equal(wDecided.refundable_fils, 685_000);
  assert.equal(wDecided.status, 'APPROVED_REFUNDED');
});

test('SWK-5: 24-Area Dubai Market Pulse, 15-Year Outlook (2026-2041) & Daily DLD Sync', () => {
  const db = createTestDb();
  const shabib = db.prepare("SELECT * FROM users WHERE email = 'shabib@betterwaymortgages.com'").get() as UserRecord;

  assert.equal(DUBAI_AREAS_24.length, 24);
  assert.ok(DUBAI_AREAS_24[0].forecast15Y.length >= 5);
  assert.ok(DUBAI_AREAS_24[0].closingKeywords.length >= 4);

  const synced = syncDailyDldTransactions(db, shabib);
  assert.ok(synced.insertedCount >= 5);
});
