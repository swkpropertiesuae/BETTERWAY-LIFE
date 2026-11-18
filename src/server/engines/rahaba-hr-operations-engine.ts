import type { DatabaseSync } from 'node:sqlite';
import { OFFICIAL_STAFF_DIRECTORY, getStaffProfileByNameOrEmail } from '@/lib/staff-directory';
import { createAndAutoFillStudioDocument } from './pdf-studio-engine';

export type HrRequestType =
  | 'SALARY_CERTIFICATE'
  | 'EMPLOYMENT_NOC'
  | 'OFFER_LETTER'
  | 'LEAVE_REQUEST'
  | 'LATE_ATTENDANCE_EXCUSE'
  | 'VISA_RERA_RENEWAL'
  | 'EXPENSE_REIMBURSEMENT'
  | 'DISCIPLINARY_WARNING';

export interface CreateHrOperationRequestInput {
  requesterEmail: string;
  requestType: HrRequestType;
  subject: string;
  details: string;
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
}

export function ensureSeededRahabaOperations(db: DatabaseSync) {
  const count = (db.prepare('SELECT COUNT(*) AS c FROM hr_operations_requests').get() as { c: number }).c;
  if (count > 0) return;

  const seedRows: Array<{
    ref: string;
    email: string;
    name: string;
    avatar: string | null;
    type: HrRequestType;
    subject: string;
    details: string;
    priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
    status: 'PENDING_RAHABA' | 'APPROVED_ISSUED' | 'ESCALATED_MANAGER_OWNER';
    notes: string;
  }> = [
    {
      ref: 'BW-HR-1001',
      email: 'asif@betterwaymortgages.com',
      name: 'Asif Khan',
      avatar: '/staff/asif-khan.jpg',
      type: 'SALARY_CERTIFICATE',
      subject: 'Official MOHRE Salary Certificate for Emirates NBD Auto Finance',
      details: 'Addressed to Emirates NBD Retail Credit Desk confirming AED 12,000 monthly fixed package + 50/50 commission split.',
      priority: 'HIGH',
      status: 'APPROVED_ISSUED',
      notes: 'Verified MOHRE WPS ledger by Rahaba Azeez. Official PDF generated in Document Studio.',
    },
    {
      ref: 'BW-HR-1002',
      email: 'reshma@betterwaymortgages.com',
      name: 'Reshma Rajan',
      avatar: '/staff/reshma-rajan.jpg',
      type: 'EMPLOYMENT_NOC',
      subject: 'Employer NOC for RTA Dubai Driving Licence File Opening',
      details: 'Standard Arabic/English employer NOC addressed to Roads & Transport Authority (RTA) Dubai.',
      priority: 'NORMAL',
      status: 'PENDING_RAHABA',
      notes: 'Queued in Rahaba Azeez HR Desk for review and digital stamp.',
    },
    {
      ref: 'BW-HR-1003',
      email: 'elton@betterwaymortgages.com',
      name: 'Elton Frank',
      avatar: '/staff/elton-frank.jpg',
      type: 'LATE_ATTENDANCE_EXCUSE',
      subject: 'Morning DLD Al Manara Trustee Early Handover Attendance Exemption',
      details: 'Attending 09:30 AM manager cheque handover at Al Manara Trustee before arriving at office.',
      priority: 'HIGH',
      status: 'APPROVED_ISSUED',
      notes: 'Approved by Rahaba Azeez & Team Manager Daniel Xavier as HOLIDAY_CLIENT_VISIT.',
    },
    {
      ref: 'BW-HR-1004',
      email: 'nusrik@betterwaymortgages.com',
      name: 'Mohammad Nusrik',
      avatar: '/staff/mohammad-nusrik.jpg',
      type: 'EXPENSE_REIMBURSEMENT',
      subject: 'Google Ads & Meta Lead-Gen Campaign Invoice Verification',
      details: 'Monthly digital performance campaign spend receipt for BetterwayMortgages.com.',
      priority: 'HIGH',
      status: 'ESCALATED_MANAGER_OWNER',
      notes: 'Verified by Rahaba Azeez; escalated to Shabib Siraj & Warda for treasury release.',
    },
  ];

  const ins = db.prepare(
    `INSERT OR IGNORE INTO hr_operations_requests (
      request_ref, requester_email, requester_name, requester_avatar,
      request_type, subject, details, priority,
      assigned_hr_email, assigned_hr_name, assigned_hr_avatar,
      status, rahaba_notes, reviewed_by_email, reviewed_by_name, reviewed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'rahaba@betterwaymortgages.com', 'Rahaba Azeez', '/staff/rahaba-azeez.jpg', ?, ?, ?, ?, datetime('now'))`,
  );

  for (const r of seedRows) {
    ins.run(
      r.ref,
      r.email,
      r.name,
      r.avatar,
      r.type,
      r.subject,
      r.details,
      r.priority,
      r.status,
      r.notes,
      r.status === 'PENDING_RAHABA' ? null : 'rahaba@betterwaymortgages.com',
      r.status === 'PENDING_RAHABA' ? null : 'Rahaba Azeez',
    );
  }
}

export function createHrOperationRequest(
  db: DatabaseSync,
  input: CreateHrOperationRequestInput,
) {
  ensureSeededRahabaOperations(db);
  const cleanEmail = input.requesterEmail.trim().toLowerCase();
  const profile = getStaffProfileByNameOrEmail(cleanEmail);
  const userRow = db
    .prepare('SELECT full_name_en, avatar_url FROM users WHERE LOWER(email) = ?')
    .get(cleanEmail) as { full_name_en: string; avatar_url: string | null } | undefined;

  const requesterName = userRow?.full_name_en || profile?.fullNameEn || cleanEmail;
  const requesterAvatar = userRow?.avatar_url ?? profile?.avatarUrl ?? null;
  const requestRef = `BW-HR-${Date.now().toString(36).toUpperCase().slice(-5)}`;
  const priority = input.priority || 'NORMAL';

  const r = db
    .prepare(
      `INSERT INTO hr_operations_requests (
        request_ref, requester_email, requester_name, requester_avatar,
        request_type, subject, details, priority,
        assigned_hr_email, assigned_hr_name, assigned_hr_avatar, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'rahaba@betterwaymortgages.com', 'Rahaba Azeez', '/staff/rahaba-azeez.jpg', 'PENDING_RAHABA')`,
    )
    .run(
      requestRef,
      cleanEmail,
      requesterName,
      requesterAvatar,
      input.requestType,
      input.subject.trim(),
      input.details.trim(),
      priority,
    );

  return {
    id: Number(r.lastInsertRowid),
    requestRef,
    requesterEmail: cleanEmail,
    requesterName,
    requesterAvatar,
    requestType: input.requestType,
    subject: input.subject.trim(),
    priority,
    assignedHrEmail: 'rahaba@betterwaymortgages.com',
    assignedHrName: 'Rahaba Azeez',
    assignedHrAvatar: '/staff/rahaba-azeez.jpg',
    status: 'PENDING_RAHABA' as const,
  };
}

export function reviewHrOperationRequestByRahaba(
  db: DatabaseSync,
  input: {
    requestId: number;
    actorEmail: string;
    decision: 'APPROVED_ISSUED' | 'ESCALATED_MANAGER_OWNER' | 'REJECTED';
    rahabaNotes?: string;
  },
) {
  const existing = db
    .prepare('SELECT * FROM hr_operations_requests WHERE id = ?')
    .get(input.requestId) as Record<string, unknown> | undefined;
  if (!existing) {
    throw new Error(`HR request #${input.requestId} not found`);
  }

  const actorProfile = getStaffProfileByNameOrEmail(input.actorEmail);
  const actorName = actorProfile?.fullNameEn || 'Rahaba Azeez';

  let studioDocId: number | null = null;
  if (input.decision === 'APPROVED_ISSUED') {
    const reqType = String(existing.request_type);
    const tplMap: Record<string, string> = {
      SALARY_CERTIFICATE: 'hr-salary-certificate',
      EMPLOYMENT_NOC: 'hr-employment-noc',
      OFFER_LETTER: 'hr-offer-letter',
      DISCIPLINARY_WARNING: 'hr-attendance-notice',
    };
    const tplId = tplMap[reqType];
    if (tplId) {
      const generated = createAndAutoFillStudioDocument(db, {
        templateId: tplId,
        employeeEmail: String(existing.requester_email),
        createdByEmail: input.actorEmail,
      });
      studioDocId = generated.id;
    }
  }

  db.prepare(
    `UPDATE hr_operations_requests
     SET status = ?,
         rahaba_notes = ?,
         reviewed_by_email = ?,
         reviewed_by_name = ?,
         studio_doc_id = COALESCE(?, studio_doc_id),
         reviewed_at = datetime('now')
     WHERE id = ?`,
  ).run(
    input.decision,
    input.rahabaNotes || 'Reviewed by Rahaba Azeez (HR & Company Operations)',
    input.actorEmail.trim().toLowerCase(),
    actorName,
    studioDocId,
    input.requestId,
  );

  const updated = db
    .prepare('SELECT * FROM hr_operations_requests WHERE id = ?')
    .get(input.requestId) as Record<string, unknown>;

  return {
    id: Number(updated.id),
    requestRef: String(updated.request_ref),
    status: String(updated.status) as 'APPROVED_ISSUED' | 'ESCALATED_MANAGER_OWNER' | 'REJECTED',
    reviewedByName: String(updated.reviewed_by_name),
    rahabaNotes: String(updated.rahaba_notes),
    studioDocId: updated.studio_doc_id ? Number(updated.studio_doc_id) : null,
  };
}

export function getRahabaOperationsDashboard(db: DatabaseSync, dateGst?: string) {
  ensureSeededRahabaOperations(db);
  const targetDate = dateGst || new Date(Date.now() + 4 * 3600_000).toISOString().slice(0, 10);

  const attendanceLogs = db
    .prepare('SELECT * FROM office_attendance_logs WHERE check_in_date = ? ORDER BY id DESC')
    .all(targetDate) as Array<Record<string, unknown>>;

  const dailyReports = db
    .prepare('SELECT * FROM daily_work_reports ORDER BY id DESC LIMIT 20')
    .all() as Array<Record<string, unknown>>;

  const employees = db
    .prepare(
      `SELECT e.*, u.email
       FROM employees e
       LEFT JOIN users u ON u.id = e.user_id
       ORDER BY e.id ASC`,
    )
    .all() as Array<Record<string, unknown>>;

  const requests = db
    .prepare('SELECT * FROM hr_operations_requests ORDER BY id DESC LIMIT 30')
    .all() as Array<Record<string, unknown>>;

  const contemptorAlerts = db
    .prepare("SELECT * FROM late_contemptor_alerts WHERE alert_status = 'OPEN' ORDER BY id DESC")
    .all() as Array<Record<string, unknown>>;

  const staffRollCall = OFFICIAL_STAFF_DIRECTORY.map((staff) => {
    const checkIn = attendanceLogs.find(
      (l) => String(l.email).toLowerCase() === staff.email.toLowerCase(),
    );
    const emp = employees.find(
      (e) =>
        String(e.email || '').toLowerCase() === staff.email.toLowerCase() ||
        String(e.full_name || '').toLowerCase() === staff.fullNameEn.toLowerCase(),
    );
    const latestReport = dailyReports.find(
      (r) => String(r.employee_name).toLowerCase() === staff.fullNameEn.toLowerCase(),
    );

    return {
      ...staff,
      empCode: emp ? String(emp.emp_code) : 'BW-EMP',
      basicSalaryAed: emp ? Math.round(Number(emp.basic_salary_fils) / 100) : 0,
      visaExpiryDate: emp ? String(emp.visa_expiry_date) : '2028-06-30',
      reraExpiryDate: emp && emp.rera_card_expiry_date ? String(emp.rera_card_expiry_date) : null,
      checkedInToday: Boolean(checkIn),
      checkInTimeGst: checkIn ? String(checkIn.check_in_time_gst) : null,
      attendanceStatus: checkIn ? String(checkIn.status) : 'AWAITING_SCAN',
      lateMinutes: checkIn ? Number(checkIn.late_minutes || 0) : 0,
      networkSsid: checkIn ? String(checkIn.network_ssid) : null,
      submittedDailyReport: Boolean(latestReport),
      latestReportNotes: latestReport ? String(latestReport.summary_notes) : null,
    };
  });

  const rahabaProfile = getStaffProfileByNameOrEmail('rahaba@betterwaymortgages.com')!;

  return {
    dateGst: targetDate,
    hrLead: rahabaProfile,
    staffRollCall,
    requests: requests.map((r) => ({
      id: Number(r.id),
      requestRef: String(r.request_ref),
      requesterEmail: String(r.requester_email),
      requesterName: String(r.requester_name),
      requesterAvatar: r.requester_avatar ? String(r.requester_avatar) : null,
      requestType: String(r.request_type) as HrRequestType,
      subject: String(r.subject),
      details: String(r.details),
      priority: String(r.priority),
      status: String(r.status),
      rahabaNotes: String(r.rahaba_notes || ''),
      reviewedByName: r.reviewed_by_name ? String(r.reviewed_by_name) : null,
      studioDocId: r.studio_doc_id ? Number(r.studio_doc_id) : null,
      createdAt: String(r.created_at),
    })),
    contemptorAlerts,
    kpis: {
      totalStaff: staffRollCall.length,
      checkedInCount: staffRollCall.filter((s) => s.checkedInToday).length,
      lateCount: staffRollCall.filter((s) => s.attendanceStatus === 'LATE').length,
      pendingHrRequests: requests.filter((r) => String(r.status) === 'PENDING_RAHABA').length,
      issuedHrCertificates: requests.filter((r) => String(r.status) === 'APPROVED_ISSUED').length,
      reportsSubmittedCount: staffRollCall.filter((s) => s.submittedDailyReport).length,
    },
  };
}
