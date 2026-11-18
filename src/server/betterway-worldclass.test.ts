import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { createInMemoryDb } from '@/server/db';
import { ensureCommercialProductionReady, OFFICIAL_BETTERWAY_STAFF } from '@/server/db/seed';
import {
  canPrintReceptionQr,
  generateReceptionStandQrSvg,
  verifyAndRecordPublicQrCheckIn,
  ingestWebsiteLeadToOs,
} from '@/server/engines/swk-enterprise-engine';
import {
  OFFICIAL_STAFF_DIRECTORY,
  getStaffAvatarUrl,
  getStaffProfileByNameOrEmail,
} from '@/lib/staff-directory';
import { computeToolkitAll } from '@/lib/uae-deal-toolkit';
import {
  buildBetterwayMobileBundle,
  enqueueMobileOfflineAction,
  replayMobileOfflineQueue,
  resolveMobileSyncConflict,
  formatMobileLockScreenNotification,
} from '@/server/engines/mobile-app-engine';
import {
  askBetterwayGpt,
  listAiDigitalEmployees,
  runAiDigitalEmployee,
} from '@/server/engines/betterway-gpt-engine';
import {
  listStudioTemplates,
  createAndAutoFillStudioDocument,
  transformStudioDocumentWithAi,
  getMasterWorkflowBookletChapters,
} from '@/server/engines/pdf-studio-engine';
import {
  createHrOperationRequest,
  reviewHrOperationRequestByRahaba,
  getRahabaOperationsDashboard,
} from '@/server/engines/rahaba-hr-operations-engine';

test('BW-1: Official Betterway Mortgages LLC roster seeds 9 exact accounts with studio avatars for the 6 staff and clean Warda profile', () => {
  const db = createInMemoryDb({ seed: true });
  ensureCommercialProductionReady(db);

  const users = db
    .prepare('SELECT email, full_name_en, role, avatar_url, status FROM users ORDER BY id ASC')
    .all() as Array<{
    email: string;
    full_name_en: string;
    role: string;
    avatar_url: string | null;
    status: string;
  }>;

  const emails = users.map((u) => u.email);
  assert.deepEqual(emails, [
    'shabib@betterwaymortgages.com',
    'warda@betterwaymortgages.com',
    'admin@betterwaymortgages.com',
    'daniel@betterwaymortgages.com',
    'rahaba@betterwaymortgages.com',
    'nusrik@betterwaymortgages.com',
    'elton@betterwaymortgages.com',
    'reshma@betterwaymortgages.com',
    'asif@betterwaymortgages.com',
  ]);

  // Verify Warda is named strictly "Warda" with zero mention of "wife" anywhere in users or employees
  const wardaUser = users.find((u) => u.email === 'warda@betterwaymortgages.com')!;
  assert.equal(wardaUser.full_name_en, 'Warda');
  const wardaEmp = db
    .prepare('SELECT full_name, designation, department FROM employees WHERE full_name = ?')
    .get('Warda') as { full_name: string; designation: string; department: string };
  assert.ok(wardaEmp);
  assert.doesNotMatch(
    `${wardaEmp.full_name} ${wardaEmp.designation} ${wardaEmp.department}`,
    /wife/i,
  );

  // Verify all 6 photographed staff have studio avatar URLs and the image files exist on disk in public/staff/
  const expectedAvatars: Record<string, string> = {
    'daniel@betterwaymortgages.com': '/staff/daniel-xavier.jpg',
    'rahaba@betterwaymortgages.com': '/staff/rahaba-azeez.jpg',
    'nusrik@betterwaymortgages.com': '/staff/mohammad-nusrik.jpg',
    'elton@betterwaymortgages.com': '/staff/elton-frank.jpg',
    'reshma@betterwaymortgages.com': '/staff/reshma-rajan.jpg',
    'asif@betterwaymortgages.com': '/staff/asif-khan.jpg',
  };

  for (const [email, avatarPath] of Object.entries(expectedAvatars)) {
    const u = users.find((x) => x.email === email)!;
    assert.equal(u.avatar_url, avatarPath);
    assert.equal(getStaffAvatarUrl(email), avatarPath);
    assert.equal(getStaffAvatarUrl(u.full_name_en), avatarPath);
    const diskPath = path.resolve(process.cwd(), 'public', avatarPath.replace(/^\//, ''));
    assert.equal(existsSync(diskPath), true, `Missing studio portrait on disk: ${diskPath}`);
  }

  // Verify exact designations requested by user
  const empByEmail = new Map(
    (
      db
        .prepare(
          `SELECT u.email, e.designation, e.department
           FROM employees e JOIN users u ON u.id = e.user_id`,
        )
        .all() as Array<{ email: string; designation: string; department: string }>
    ).map((r) => [r.email, r]),
  );

  assert.match(empByEmail.get('daniel@betterwaymortgages.com')!.designation, /Team Manager.*Mortgage Advisor/i);
  assert.match(empByEmail.get('rahaba@betterwaymortgages.com')!.designation, /HR/i);
  assert.match(empByEmail.get('nusrik@betterwaymortgages.com')!.designation, /Digital Marketing/i);
  assert.match(empByEmail.get('elton@betterwaymortgages.com')!.designation, /Coordinator/i);
  assert.match(empByEmail.get('reshma@betterwaymortgages.com')!.designation, /Telesales.*Mortgage Advisor/i);
  assert.match(empByEmail.get('asif@betterwaymortgages.com')!.designation, /Mortgage Advisor/i);
  assert.equal(OFFICIAL_BETTERWAY_STAFF.length, 9);
  assert.equal(OFFICIAL_STAFF_DIRECTORY.length, 9);
  assert.ok(getStaffProfileByNameOrEmail('Daniel Xavier'));
});

test('BW-2: Reception QR generation, Wi-Fi/Cellular anti-loophole verification, and print guard for Owner Shabib, Warda, Admin & Manager Daniel Xavier', () => {
  const db = createInMemoryDb({ seed: true });
  ensureCommercialProductionReady(db);

  const shabib = db.prepare("SELECT * FROM users WHERE email = 'shabib@betterwaymortgages.com'").get() as any;
  const warda = db.prepare("SELECT * FROM users WHERE email = 'warda@betterwaymortgages.com'").get() as any;
  const daniel = db.prepare("SELECT * FROM users WHERE email = 'daniel@betterwaymortgages.com'").get() as any;
  const asif = db.prepare("SELECT * FROM users WHERE email = 'asif@betterwaymortgages.com'").get() as any;

  assert.equal(canPrintReceptionQr(shabib), true);
  assert.equal(canPrintReceptionQr(warda), true);
  assert.equal(canPrintReceptionQr(daniel), true);
  assert.equal(canPrintReceptionQr(asif), false);

  const qrSvg = generateReceptionStandQrSvg('https://os.betterwaymortgages.com/os/reception-qr?scan=1&stand=BW-RECEPTION-STAND-DXB-1');
  assert.match(qrSvg, /<svg[\s\S]*viewBox=/);
  assert.match(qrSvg, /<rect|<path/);

  // Reject cellular data check-in (anti-loophole rule matching SWK)
  assert.throws(
    () =>
      verifyAndRecordPublicQrCheckIn(db, {
        email: 'asif@betterwaymortgages.com',
        password: 'Betterway#2026',
        connectionType: 'cellular',
        networkSsid: 'Betterway-Office-5G',
        qrStandCode: 'BW-RECEPTION-STAND-DXB-1',
        deviceId: 'BW-WEB-TEST1',
      }),
    /Office Wi-Fi/i,
  );

  // Accept valid Office Wi-Fi check-in with credentials
  const checkIn = verifyAndRecordPublicQrCheckIn(db, {
    email: 'asif@betterwaymortgages.com',
    password: 'Betterway#2026',
    connectionType: 'wifi',
    networkSsid: 'Betterway-Office-5G',
    qrStandCode: 'BW-RECEPTION-STAND-DXB-1',
    deviceId: 'BW-WEB-TEST1',
    checkInDate: '2026-11-18',
    checkInTimeGst: '09:56',
  });
  assert.equal(checkIn.status, 'ON_TIME');
  assert.equal(checkIn.employee.fullNameEn, 'Asif Khan');
  assert.equal(checkIn.employee.avatarUrl, '/staff/asif-khan.jpg');
});

test('BW-3: SWK-grade 8-tool UAE Deal & Mortgage Toolkit computes accurate figures and WhatsApp summaries', () => {
  const res = computeToolkitAll({
    priceAed: 3_000_000,
    downPaymentPct: 20,
    interestRatePct: 3.99,
    tenureYears: 25,
    monthlyIncomeAed: 50_000,
    existingDebtAed: 2_000,
    cardLimitsAed: 40_000,
    residency: 'expat',
    firstHome: true,
    offPlan: false,
    currentLoanBalanceAed: 2_000_000,
    currentRatePct: 5.49,
    newRatePct: 3.89,
    remainingYears: 20,
    annualRentAed: 210_000,
    areaSqft: 1_400,
    serviceChargePerSqft: 18,
    reraIndexAvgAed: 240_000,
    jointOwners: 1,
    grossSubventionAed: 30_000,
    partnerSharePct: 25,
    advisorSplitPct: 50,
    bookingPct: 20,
    constructionPct: 40,
    handoverPct: 40,
    postHandoverPct: 0,
  });

  assert.ok(res.costToClose.cashRequired > 600_000);
  assert.ok(res.mortgage.emi > 10_000);
  assert.equal(res.mortgage.dbrOk, true);
  assert.equal(res.buyout.earlySettlementFeeAed, 10_500); // AED 10,000 cap + 5% VAT
  assert.ok(res.buyout.netFiveYearSavingsAed > 50_000);
  assert.equal(res.visa.goldenVisaEligible, true);
  assert.equal(res.commission.partnerPayoutAed, 7_500);
  assert.equal(res.commission.netPoolAed, 22_500);
  assert.equal(res.commission.advisorPayoutAed, 11_250);
  assert.ok(res.yieldRera.netYieldPct > 4);
  assert.equal(res.offPlan.oqoodFeeAed, 120_000);
  assert.match(res.summaries.mortgage, /Betterway Mortgages/i);
});

test('BW-4: Website-to-OS interconnection ingests public enquiries, calculator scenarios, slot bookings & partner signups into CRM', () => {
  const db = createInMemoryDb({ seed: true });
  ensureCommercialProductionReady(db);

  const out = ingestWebsiteLeadToOs(db, {
    fullName: 'Omar Al Falasi',
    phone: '+971509876543',
    email: 'omar.falasi@example.ae',
    residency: 'UAE National',
    goal: 'Buy a ready home',
    propertyValueAed: 4_200_000,
    downPaymentPct: 15,
    monthlyIncomeAed: 65_000,
    topic: 'Calculator scenario: Monthly Repayment & DBR',
    preferredSlot: 'Tomorrow 11:00 AM GST',
    sourcePage: '/calculators/mortgage-repayment',
  });

  assert.match(out.referenceCode, /^BW-ENQ-/);
  assert.ok(out.leadId > 0);
  assert.ok(
    ['Daniel Xavier', 'Reshma Rajan', 'Asif Khan'].includes(out.assignedAdvisor.fullNameEn),
  );
  assert.ok(out.assignedAdvisor.avatarUrl.startsWith('/staff/'));
});

test('BW-5: Betterway ONE Mobile App & Offline Sync Engine handles scoped bundles, idempotent offline queue, version conflicts & lock-screen redaction', () => {
  const db = createInMemoryDb({ seed: true });
  ensureCommercialProductionReady(db);

  const bundle = buildBetterwayMobileBundle(db, 'asif@betterwaymortgages.com', 'BW-IOS-ASIF-01');
  assert.equal(bundle.staff.fullNameEn, 'Asif Khan');
  assert.equal(bundle.staff.avatarUrl, '/staff/asif-khan.jpg');
  assert.match(bundle.encryptedChecksum, /^AES256-GCM-/);
  assert.ok(bundle.assignedDeals.length > 0);

  // Enqueue with idempotency key (duplicate call must be idempotent)
  const firstDealId = Number(bundle.assignedDeals[0]!.id);
  const q1 = enqueueMobileOfflineAction(db, {
    idempotencyKey: 'idem-asif-visit-001',
    userEmail: 'asif@betterwaymortgages.com',
    deviceId: 'BW-IOS-ASIF-01',
    actionType: 'SITE_VISIT_CHECKIN',
    targetTable: 'deals',
    targetId: String(firstDealId),
    baseRecordVersion: 1,
    payload: { gpsCoords: '25.1972,55.2744', note: 'Met buyer at Downtown Dubai viewing' },
  });
  const q1Dup = enqueueMobileOfflineAction(db, {
    idempotencyKey: 'idem-asif-visit-001',
    userEmail: 'asif@betterwaymortgages.com',
    deviceId: 'BW-IOS-ASIF-01',
    actionType: 'SITE_VISIT_CHECKIN',
    targetTable: 'deals',
    targetId: String(firstDealId),
    baseRecordVersion: 1,
    payload: { gpsCoords: '25.1972,55.2744', note: 'Met buyer at Downtown Dubai viewing' },
  });
  assert.equal(q1.id, q1Dup.id);

  // Enqueue stale baseRecordVersion (0 < 1) to trigger version conflict review
  enqueueMobileOfflineAction(db, {
    idempotencyKey: 'idem-asif-conflict-002',
    userEmail: 'asif@betterwaymortgages.com',
    deviceId: 'BW-IOS-ASIF-01',
    actionType: 'UPDATE_DEAL_NOTE',
    targetTable: 'deals',
    targetId: String(firstDealId),
    baseRecordVersion: 0,
    payload: { note: 'Offline rate switch request to 3.89% fixed' },
  });

  const replay = replayMobileOfflineQueue(db, 'asif@betterwaymortgages.com', 'BW-IOS-ASIF-01');
  assert.equal(replay.syncedCount, 1);
  assert.equal(replay.conflictCount, 1);
  assert.equal(replay.conflictIds.length, 1);

  const resolved = resolveMobileSyncConflict(
    db,
    'daniel@betterwaymortgages.com',
    replay.conflictIds[0]!,
    'ACCEPT_CLIENT',
  );
  assert.equal(resolved.status, 'RESOLVED');

  const notif = formatMobileLockScreenNotification(
    { title: 'VIP Client Salary Certificate Uploaded', recordType: 'DEAL', recordId: 'BW-2026-001' },
    true,
  );
  assert.equal(notif.suppressedByQuietHours, true);
  assert.doesNotMatch(notif.lockScreenText, /Salary Certificate/i);
  assert.match(notif.lockScreenText, /Betterway ONE/i);
});

test('BW-6: BetterwayGPT complete own ChatGPT & Digital AI Employees engine answers from live OS data and executes autonomous routines', () => {
  const db = createInMemoryDb({ seed: true });
  ensureCommercialProductionReady(db);

  const chatRes = askBetterwayGpt(db, {
    userEmail: 'daniel@betterwaymortgages.com',
    prompt: 'Show our live pipeline summary, top UAE bank rates, and Rahaba HR attendance status today',
    mode: 'LIVE_OS_DATA',
  });
  assert.ok(chatRes.threadId);
  assert.match(chatRes.reply, /Betterway Mortgages/i);
  assert.match(chatRes.reply, /DBR|EIBOR|Pipeline/i);
  assert.ok(chatRes.citations.length > 0);
  assert.ok(chatRes.liveMetrics.activeDealsCount >= 1);

  const agents = listAiDigitalEmployees(db);
  assert.ok(agents.length >= 6);
  const runRes = runAiDigitalEmployee(db, 'rahaba-hr-attendance', 'rahaba@betterwaymortgages.com');
  assert.equal(runRes.status, 'COMPLETED');
  assert.match(runRes.outputSummary, /Rahaba Azeez|Attendance|10:05/i);
});

test('BW-7: PDF & Document Studio auto-fills placeholders from DB, translates EN/AR, and serves the 20-chapter workflow booklet', () => {
  const db = createInMemoryDb({ seed: true });
  ensureCommercialProductionReady(db);

  const templates = listStudioTemplates();
  assert.ok(templates.length >= 10);
  assert.ok(templates.some((t) => t.category === 'HR & Rahaba Operations'));

  const doc = createAndAutoFillStudioDocument(db, {
    templateId: 'hr-salary-certificate',
    employeeEmail: 'asif@betterwaymortgages.com',
    dealId: 1,
    createdByEmail: 'rahaba@betterwaymortgages.com',
  });
  assert.ok(doc.id > 0);
  assert.match(doc.renderedBody, /Asif Khan/);
  assert.doesNotMatch(doc.renderedBody, /\[Employee Name\]/);

  const arabicDraft = transformStudioDocumentWithAi(doc.renderedBody, 'translate_ar');
  assert.match(arabicDraft, /شهادة|التمويل العقاري|درهم/);

  const chapters = getMasterWorkflowBookletChapters();
  assert.equal(chapters.length, 20);
});

test('BW-8: Rahaba Azeez HR, Attendance & Company Operations Centre manages HR requests, certificates, attendance roll-call & escalations', () => {
  const db = createInMemoryDb({ seed: true });
  ensureCommercialProductionReady(db);

  const reqItem = createHrOperationRequest(db, {
    requesterEmail: 'asif@betterwaymortgages.com',
    requestType: 'SALARY_CERTIFICATE',
    subject: 'Salary Certificate addressed to Emirates NBD for personal auto loan',
    details: 'Please issue stamped salary certificate showing AED 12,000 fixed + commission structure.',
    priority: 'HIGH',
  });
  assert.match(reqItem.requestRef, /^BW-HR-/);
  assert.equal(reqItem.assignedHrName, 'Rahaba Azeez');
  assert.equal(reqItem.assignedHrAvatar, '/staff/rahaba-azeez.jpg');

  const reviewed = reviewHrOperationRequestByRahaba(db, {
    requestId: reqItem.id,
    actorEmail: 'rahaba@betterwaymortgages.com',
    decision: 'APPROVED_ISSUED',
    rahabaNotes: 'Verified MOHRE contract & WPS history. Official PDF issued in Studio.',
  });
  assert.equal(reviewed.status, 'APPROVED_ISSUED');
  assert.equal(reviewed.reviewedByName, 'Rahaba Azeez');

  const dash = getRahabaOperationsDashboard(db, '2026-11-18');
  assert.equal(dash.hrLead.fullNameEn, 'Rahaba Azeez');
  assert.equal(dash.hrLead.avatarUrl, '/staff/rahaba-azeez.jpg');
  assert.equal(dash.staffRollCall.length, 9);
  assert.ok(dash.requests.length >= 1);
});
