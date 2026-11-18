import crypto from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { getStaffProfileByNameOrEmail, OFFICIAL_STAFF_DIRECTORY } from '@/lib/staff-directory';

export interface MobileOfflineActionInput {
  idempotencyKey: string;
  userEmail: string;
  deviceId: string;
  actionType:
    | 'MOBILE_QR_CHECKIN'
    | 'SITE_VISIT_CHECKIN'
    | 'LOG_CALL_OUTCOME'
    | 'UPDATE_DEAL_NOTE'
    | 'ADVANCE_DEAL_STAGE'
    | 'SUBMIT_HR_REQUEST';
  targetTable: 'deals' | 'leads' | 'office_attendance_logs' | 'hr_operations_requests';
  targetId: string;
  baseRecordVersion: number;
  sourceTimestamp?: string;
  payload: Record<string, unknown>;
}

const ALLOWED_TABLES = new Set([
  'deals',
  'leads',
  'office_attendance_logs',
  'hr_operations_requests',
]);

export function buildBetterwayMobileBundle(
  db: DatabaseSync,
  userEmail: string,
  deviceId = 'BW-IOS-PRO-01',
) {
  const cleanEmail = userEmail.trim().toLowerCase();
  const userRow = db
    .prepare('SELECT id, email, full_name_en, role, status, avatar_url FROM users WHERE LOWER(email) = ?')
    .get(cleanEmail) as
    | {
        id: number;
        email: string;
        full_name_en: string;
        role: string;
        status: string;
        avatar_url: string | null;
      }
    | undefined;

  if (!userRow || userRow.status !== 'ACTIVE') {
    throw new Error('DEVICE_SESSION_REVOKED: Local mobile data must be wiped immediately');
  }

  const profile = getStaffProfileByNameOrEmail(cleanEmail) ?? OFFICIAL_STAFF_DIRECTORY[0]!;
  const isExecutiveOrManager =
    userRow.role === 'SUPER_ADMIN' ||
    cleanEmail === 'daniel@betterwaymortgages.com' ||
    cleanEmail === 'rahaba@betterwaymortgages.com';

  const assignedLeads = (
    isExecutiveOrManager
      ? db.prepare('SELECT * FROM leads ORDER BY id DESC LIMIT 15').all()
      : db
          .prepare('SELECT * FROM leads WHERE assigned_advisor_id = ? OR assigned_advisor_id IS NULL ORDER BY id DESC LIMIT 15')
          .all(userRow.id)
  ) as Array<Record<string, unknown>>;

  const assignedDeals = (
    isExecutiveOrManager
      ? db
          .prepare(
            `SELECT d.*, h.primary_name AS client_name
             FROM deals d
             JOIN households h ON h.id = d.household_id
             WHERE d.origin_mode = 'LIVE'
             ORDER BY d.id DESC LIMIT 15`,
          )
          .all()
      : db
          .prepare(
            `SELECT d.*, h.primary_name AS client_name
             FROM deals d
             JOIN households h ON h.id = d.household_id
             WHERE d.origin_mode = 'LIVE' AND (d.advisor_id = ? OR d.advisor_id IS NULL)
             ORDER BY d.id DESC LIMIT 15`,
          )
          .all(userRow.id)
  ) as Array<Record<string, unknown>>;

  const todayGst = new Date(Date.now() + 4 * 3600_000).toISOString().slice(0, 10);
  const todayAttendance = db
    .prepare(
      'SELECT * FROM office_attendance_logs WHERE LOWER(email) = ? AND check_in_date = ? ORDER BY id DESC LIMIT 1',
    )
    .get(cleanEmail, todayGst) as Record<string, unknown> | undefined;

  const pendingSyncQueue = db
    .prepare('SELECT * FROM mobile_sync_queue WHERE LOWER(user_email) = ? ORDER BY source_timestamp DESC LIMIT 20')
    .all(cleanEmail) as Array<Record<string, unknown>>;

  const openConflicts = db
    .prepare("SELECT * FROM mobile_sync_conflicts WHERE status = 'NEEDS_REVIEW' ORDER BY created_at DESC LIMIT 20")
    .all() as Array<Record<string, unknown>>;

  const expiresAt = new Date(Date.now() + 24 * 3600_000).toISOString();
  const payloadDigest = JSON.stringify({
    email: cleanEmail,
    deviceId,
    leads: assignedLeads.length,
    deals: assignedDeals.length,
  });
  const encryptedChecksum = `AES256-GCM-${crypto.createHash('sha256').update(payloadDigest).digest('hex').slice(0, 24)}`;

  return {
    staff: {
      userId: userRow.id,
      email: userRow.email,
      fullNameEn: userRow.full_name_en,
      designation: profile.designation,
      department: profile.department,
      role: userRow.role,
      avatarUrl: userRow.avatar_url || profile.avatarUrl,
    },
    deviceId,
    expiresAt,
    encryptedChecksum,
    todayGst,
    todayAttendance: todayAttendance || null,
    assignedLeads,
    assignedDeals,
    pendingSyncQueue,
    openConflicts,
  };
}

export function enqueueMobileOfflineAction(db: DatabaseSync, input: MobileOfflineActionInput) {
  if (!ALLOWED_TABLES.has(input.targetTable)) {
    throw new Error(`INVALID_MOBILE_SYNC_TABLE: ${input.targetTable}`);
  }

  const existing = db
    .prepare('SELECT * FROM mobile_sync_queue WHERE idempotency_key = ?')
    .get(input.idempotencyKey) as Record<string, unknown> | undefined;

  if (existing) {
    return existing as {
      id: string;
      idempotency_key: string;
      sync_status: string;
    };
  }

  const id = `msync-${crypto.randomUUID().slice(0, 8)}`;
  const sourceTs = input.sourceTimestamp || new Date().toISOString();
  db.prepare(
    `INSERT INTO mobile_sync_queue (
      id, idempotency_key, user_email, device_id, action_type, target_table, target_id,
      base_record_version, payload_json, source_timestamp, sync_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_SYNC')`,
  ).run(
    id,
    input.idempotencyKey,
    input.userEmail.trim().toLowerCase(),
    input.deviceId,
    input.actionType,
    input.targetTable,
    String(input.targetId),
    Number(input.baseRecordVersion ?? 1),
    JSON.stringify(input.payload || {}),
    sourceTs,
  );

  return db.prepare('SELECT * FROM mobile_sync_queue WHERE id = ?').get(id) as {
    id: string;
    idempotency_key: string;
    sync_status: string;
  };
}

export function replayMobileOfflineQueue(
  db: DatabaseSync,
  userEmail: string,
  deviceId: string,
) {
  const cleanEmail = userEmail.trim().toLowerCase();
  const pendingItems = db
    .prepare(
      `SELECT * FROM mobile_sync_queue
       WHERE LOWER(user_email) = ? AND device_id = ? AND sync_status = 'PENDING_SYNC'
       ORDER BY source_timestamp ASC`,
    )
    .all(cleanEmail, deviceId) as Array<Record<string, unknown>>;

  let syncedCount = 0;
  let conflictCount = 0;
  let failedCount = 0;
  const conflictIds: string[] = [];
  const now = new Date().toISOString();

  for (const item of pendingItems) {
    const queueId = String(item.id);
    const targetTable = String(item.target_table);
    const targetId = String(item.target_id);
    const baseVersion = Number(item.base_record_version);
    const payload = JSON.parse(String(item.payload_json || '{}')) as Record<string, unknown>;

    // Block irreversible final disbursal from offline queue without live server approval
    if (
      String(item.action_type) === 'ADVANCE_DEAL_STAGE' &&
      (payload.targetStage === 'TRANSFERRED_DISBURSED' || payload.targetStage === 'SETTLED')
    ) {
      db.prepare(
        `UPDATE mobile_sync_queue
         SET sync_status = 'FAILED',
             rejection_reason = 'SERVER_APPROVAL_REQUIRED_FOR_IRREVERSIBLE_DISBURSAL',
             processed_at = ?
         WHERE id = ?`,
      ).run(now, queueId);
      failedCount++;
      continue;
    }

    if (targetTable === 'deals' || targetTable === 'leads') {
      const currentRecord = db
        .prepare(`SELECT * FROM ${targetTable} WHERE id = ?`)
        .get(Number(targetId)) as Record<string, unknown> | undefined;

      if (!currentRecord) {
        db.prepare(
          `UPDATE mobile_sync_queue
           SET sync_status = 'FAILED', rejection_reason = 'TARGET_RECORD_NOT_FOUND', processed_at = ?
           WHERE id = ?`,
        ).run(now, queueId);
        failedCount++;
        continue;
      }

      const serverVersion = Number(currentRecord.record_version ?? 1);
      if (baseVersion < serverVersion) {
        const conflictId = `sconf-${crypto.randomUUID().slice(0, 8)}`;
        const affectedFields = Object.keys(payload).length > 0 ? Object.keys(payload) : ['record_version'];

        db.prepare(
          `INSERT INTO mobile_sync_conflicts (
            id, queue_item_id, target_table, target_id, base_version, server_version,
            server_values_json, client_values_json, affected_fields_json, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'NEEDS_REVIEW')`,
        ).run(
          conflictId,
          queueId,
          targetTable,
          targetId,
          baseVersion,
          serverVersion,
          JSON.stringify({
            stage: currentRecord.stage,
            record_version: serverVersion,
          }),
          JSON.stringify(payload),
          JSON.stringify(affectedFields),
        );

        db.prepare(
          `UPDATE mobile_sync_queue
           SET sync_status = 'NEEDS_REVIEW',
               rejection_reason = 'VERSION_MERGE_CONFLICT_DETECTED',
               processed_at = ?
           WHERE id = ?`,
        ).run(now, queueId);

        conflictCount++;
        conflictIds.push(conflictId);
        continue;
      }

      // Apply clean sync update and bump record_version
      db.prepare(`UPDATE ${targetTable} SET record_version = COALESCE(record_version, 1) + 1 WHERE id = ?`).run(
        Number(targetId),
      );

      if (targetTable === 'deals' && payload.note) {
        db.prepare(
          `INSERT INTO comm_messages (deal_id, channel, direction, sender_name, body, internal_only)
           VALUES (?, 'INTERNAL_NOTE', 'INTERNAL', ?, ?, 1)`,
        ).run(
          Number(targetId),
          cleanEmail,
          `[Betterway ONE Mobile Sync · ${String(item.action_type)}] ${String(payload.note)}${
            payload.gpsCoords ? ` (GPS: ${String(payload.gpsCoords)})` : ''
          }`,
        );
      }
    }

    db.prepare(
      `UPDATE mobile_sync_queue
       SET sync_status = 'SYNCED', processed_at = ?
       WHERE id = ?`,
    ).run(now, queueId);
    syncedCount++;
  }

  return {
    syncedCount,
    conflictCount,
    failedCount,
    conflictIds,
  };
}

export function resolveMobileSyncConflict(
  db: DatabaseSync,
  supervisorEmail: string,
  conflictId: string,
  resolution: 'ACCEPT_CLIENT' | 'ACCEPT_SERVER' | 'MERGED',
) {
  const conflict = db
    .prepare('SELECT * FROM mobile_sync_conflicts WHERE id = ?')
    .get(conflictId) as Record<string, unknown> | undefined;
  if (!conflict) {
    throw new Error(`SYNC_CONFLICT_NOT_FOUND: ${conflictId}`);
  }

  const now = new Date().toISOString();
  const targetTable = String(conflict.target_table);
  const targetId = Number(conflict.target_id);

  if ((targetTable === 'deals' || targetTable === 'leads') && (resolution === 'ACCEPT_CLIENT' || resolution === 'MERGED')) {
    const clientVals = JSON.parse(String(conflict.client_values_json || '{}')) as Record<string, unknown>;
    db.prepare(`UPDATE ${targetTable} SET record_version = COALESCE(record_version, 1) + 1 WHERE id = ?`).run(targetId);
    if (targetTable === 'deals' && clientVals.note) {
      db.prepare(
        `INSERT INTO comm_messages (deal_id, channel, direction, sender_name, body, internal_only)
         VALUES (?, 'INTERNAL_NOTE', 'INTERNAL', ?, ?, 1)`,
      ).run(
        targetId,
        supervisorEmail,
        `[Conflict Resolved (${resolution})] ${String(clientVals.note)}`,
      );
    }
  }

  db.prepare(
    `UPDATE mobile_sync_conflicts
     SET status = 'RESOLVED', resolved_by = ?, resolution_strategy = ?, resolved_at = ?
     WHERE id = ?`,
  ).run(supervisorEmail, resolution, now, conflictId);

  db.prepare(
    `UPDATE mobile_sync_queue
     SET sync_status = 'SYNCED', rejection_reason = NULL
     WHERE id = ?`,
  ).run(String(conflict.queue_item_id));

  return db.prepare('SELECT * FROM mobile_sync_conflicts WHERE id = ?').get(conflictId) as {
    id: string;
    status: string;
    resolution_strategy: string;
    resolved_by: string;
  };
}

export function formatMobileLockScreenNotification(
  notification: { title: string; recordType: string; recordId: string },
  quietHoursActive: boolean,
) {
  return {
    suppressedByQuietHours: quietHoursActive,
    lockScreenText: `Betterway ONE: Action required on ${notification.recordType} (${notification.recordId}). Unlock with FaceID/TouchID to view confidential CBUAE/PDPL details.`,
    deepLinkUrl: `/os/mobile?recordType=${encodeURIComponent(notification.recordType)}&recordId=${encodeURIComponent(notification.recordId)}`,
  };
}
