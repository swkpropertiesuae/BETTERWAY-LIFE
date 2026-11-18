import { NextResponse } from 'next/server';
import { getDb } from '@/server/db';
import {
  buildBetterwayMobileBundle,
  enqueueMobileOfflineAction,
  replayMobileOfflineQueue,
} from '@/server/engines/mobile-app-engine';
import {
  createHrOperationRequest,
  getRahabaOperationsDashboard,
  reviewHrOperationRequestByRahaba,
  type HrRequestType,
} from '@/server/engines/rahaba-hr-operations-engine';
import {
  askBetterwayGpt,
  collectLiveOsContext,
  runAiDigitalEmployee,
} from '@/server/engines/betterway-gpt-engine';
import {
  createAndAutoFillStudioDocument,
  listStudioTemplates,
} from '@/server/engines/pdf-studio-engine';
import { recordReceptionQrCheckIn } from '@/server/engines/swk-enterprise-engine';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Betterway-Device',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(req: Request) {
  try {
    const db = getDb();
    const url = new URL(req.url);
    const staffEmail = (url.searchParams.get('staff') || 'daniel@betterwaymortgages.com')
      .trim()
      .toLowerCase();
    const deviceId = url.searchParams.get('deviceId') || 'BW-ANDROID-APK-01';

    const bundle = buildBetterwayMobileBundle(db, staffEmail, deviceId);
    const hrDash = getRahabaOperationsDashboard(db);
    const studioTemplates = listStudioTemplates();
    const liveMetrics = collectLiveOsContext(db);

    return NextResponse.json(
      {
        ok: true,
        apkVersion: '2.1.0',
        apkDownloadUrl: '/downloads/Betterway-ONE.apk',
        serverTimeGst: new Date(Date.now() + 4 * 3600_000).toISOString(),
        bundle,
        hrDash,
        studioTemplates,
        liveMetrics,
      },
      { headers: CORS_HEADERS },
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Failed to load live mobile state' },
      { status: 400, headers: CORS_HEADERS },
    );
  }
}

export async function POST(req: Request) {
  try {
    const db = getDb();
    const body = (await req.json()) as Record<string, unknown>;
    const action = String(body.action || '');
    const staffEmail = String(body.userEmail || 'daniel@betterwaymortgages.com')
      .trim()
      .toLowerCase();
    const deviceId = String(body.deviceId || 'BW-ANDROID-APK-01');

    const userRow = db
      .prepare('SELECT * FROM users WHERE LOWER(email) = ? LIMIT 1')
      .get(staffEmail) as
      | {
          id: number;
          email: string;
          phone: string;
          full_name_en: string;
          full_name_ar: string;
          role: 'SUPER_ADMIN' | 'SALES_ADVISOR' | 'CREDIT_UNDERWRITER' | 'PROGRESSION_MANAGER' | 'COMPLIANCE_MLRO' | 'FINANCE_ADMIN' | 'HR_MANAGER';
          is_mlro: number;
          can_approve_rates: number;
          preferred_lang: 'en' | 'ar';
          status: 'ACTIVE' | 'SUSPENDED';
        }
      | undefined;

    if (!userRow) {
      throw new Error(`Unknown Betterway staff account: ${staffEmail}`);
    }

    let notice = 'Synced with Betterway OS Live Database';
    let extra: Record<string, unknown> = {};

    switch (action) {
      case 'qr_checkin': {
        const res = recordReceptionQrCheckIn(db, userRow, {
          networkSsid: String(body.networkSsid || 'Betterway-Office-5G'),
          qrStandCode: String(body.qrStandCode || 'BW-RECEPTION-STAND-DXB-1'),
        });
        notice = `Office QR Check-In Recorded in Live DB (${res.checkInTimeGst} GST · ${res.status})`;
        extra = { checkIn: res };
        break;
      }

      case 'gps_checkin':
      case 'deal_note': {
        const q = enqueueMobileOfflineAction(db, {
          idempotencyKey: String(body.idempotencyKey || `apk-${Date.now()}`),
          userEmail: staffEmail,
          deviceId,
          actionType: action === 'gps_checkin' ? 'SITE_VISIT_CHECKIN' : 'UPDATE_DEAL_NOTE',
          targetTable: 'deals',
          targetId: String(body.dealId || '1'),
          baseRecordVersion: Number(body.baseRecordVersion ?? 1),
          payload: {
            note: String(body.note || 'Logged from Betterway ONE Android APK'),
            gpsCoords: String(body.gpsCoords || '25.1972,55.2744'),
          },
        });
        const rep = replayMobileOfflineQueue(db, staffEmail, deviceId);
        notice = `Saved to Live Deal Timeline (${q.id} · ${rep.syncedCount} synced)`;
        extra = { queueItem: q, replay: rep };
        break;
      }

      case 'create_hr_request': {
        const hrReq = createHrOperationRequest(db, {
          requesterEmail: staffEmail,
          requestType: (body.requestType as HrRequestType) || 'SALARY_CERTIFICATE',
          subject: String(body.subject || 'Official Salary Certificate Request'),
          details: String(body.details || 'Submitted from Betterway ONE Android APK'),
          priority: 'HIGH',
        });
        notice = `HR Request ${hrReq.requestRef} saved to Rahaba Azeez Live Queue`;
        extra = { hrRequest: hrReq };
        break;
      }

      case 'review_hr_request': {
        const rev = reviewHrOperationRequestByRahaba(db, {
          requestId: Number(body.requestId),
          actorEmail: staffEmail,
          decision:
            (body.decision as 'APPROVED_ISSUED' | 'ESCALATED_MANAGER_OWNER' | 'REJECTED') ||
            'APPROVED_ISSUED',
          rahabaNotes: String(body.rahabaNotes || 'Approved & issued via Betterway ONE APK'),
        });
        notice = `HR Request ${rev.requestRef} marked ${rev.status} in Live DB`;
        extra = { reviewed: rev };
        break;
      }

      case 'submit_daily_report': {
        const reportDate = new Date(Date.now() + 4 * 3600_000).toISOString().slice(0, 10);
        db.prepare(
          `INSERT INTO daily_work_reports (
            user_id, employee_name, report_date, calls_count, leads_qualified,
            site_visits_count, ipas_submitted, summary_notes, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'SUBMITTED')`,
        ).run(
          userRow.id,
          userRow.full_name_en,
          reportDate,
          Number(body.callsCount || 18),
          Number(body.leadsQualified || 5),
          Number(body.siteVisitsCount || 2),
          Number(body.ipasSubmitted || 2),
          String(body.summaryNotes || 'Submitted via Betterway ONE Android APK'),
        );
        notice = `Daily Work Report saved to Live Company Operations DB for ${userRow.full_name_en}`;
        break;
      }

      case 'stamp_pdf': {
        const doc = createAndAutoFillStudioDocument(db, {
          templateId: String(body.templateId || 'hr-salary-certificate'),
          employeeEmail: staffEmail,
          dealId: Number(body.dealId || 1),
          createdByEmail: staffEmail,
        });
        notice = `Official Document ${doc.docRef} stamped & saved in Live Studio Vault`;
        extra = { document: doc };
        break;
      }

      case 'ask_gpt': {
        const gpt = askBetterwayGpt(db, {
          userEmail: staffEmail,
          prompt: String(body.prompt || 'Show live mortgage pipeline and Rahaba HR status'),
          mode: 'LIVE_OS_DATA',
        });
        notice = 'BetterwayGPT Live Response Ready';
        extra = { gpt };
        break;
      }

      case 'run_agent': {
        const run = runAiDigitalEmployee(
          db,
          String(body.agentSlug || 'rahaba-hr-attendance'),
          staffEmail,
        );
        notice = run.outputSummary;
        extra = { agentRun: run };
        break;
      }

      default:
        notice = 'Connected to Betterway OS Live Database';
    }

    const bundle = buildBetterwayMobileBundle(db, staffEmail, deviceId);
    const hrDash = getRahabaOperationsDashboard(db);

    return NextResponse.json(
      {
        ok: true,
        notice,
        ...extra,
        bundle,
        hrDash,
      },
      { headers: CORS_HEADERS },
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Live sync action failed' },
      { status: 400, headers: CORS_HEADERS },
    );
  }
}
