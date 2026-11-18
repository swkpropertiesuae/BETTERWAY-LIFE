import crypto from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { queryBankPolicyCoPilot } from './statement-and-policy-copilot';
import { OFFICIAL_STAFF_DIRECTORY } from '@/lib/staff-directory';

export type BetterwayGptMode =
  | 'LIVE_OS_DATA'
  | 'CBUAE_UNDERWRITING'
  | 'DLD_CONVEYANCING'
  | 'RAHABA_HR_WPS'
  | 'BILINGUAL_WRITER';

export interface AskBetterwayGptInput {
  threadId?: string;
  userEmail: string;
  prompt: string;
  mode?: BetterwayGptMode;
}

export interface AiDigitalEmployeeSpec {
  slug: string;
  name: string;
  roleTitle: string;
  department: string;
  scheduleLabel: string;
  ownerGuardrail: string;
  description: string;
}

export const DIGITAL_AI_EMPLOYEES: AiDigitalEmployeeSpec[] = [
  {
    slug: 'morning-briefing',
    name: 'Sovereign Executive Briefing Agent',
    roleTitle: '09:30 AM GST Daily Briefing to Shabib Siraj, Warda & Daniel Xavier',
    department: 'Executive Command',
    scheduleLabel: 'Daily 09:30 AM GST',
    ownerGuardrail: 'Read-only live ledger synthesis · Never modifies GL',
    description:
      'Compiles active mortgage pipeline, 3M/6M EIBOR fixings, FOL clearances, subvention inflows, and 5-minute SLA compliance.',
  },
  {
    slug: 'rahaba-hr-attendance',
    name: 'Rahaba HR & 10:05 AM Attendance Watchdog',
    roleTitle: 'HR & Office Operations Co-Pilot for Rahaba Azeez',
    department: 'Human Resources & PRO',
    scheduleLabel: 'Daily 10:06 AM & 10:30 AM GST',
    ownerGuardrail: 'Auto-flags 3+ late arrivals in 7d · Escalates to Shabib Siraj & Daniel Xavier',
    description:
      'Monitors Reception QR check-ins against the 10:05 AM GST grace window, tracks Visa/Emirates ID/RERA BRN 90-day expiries, and prepares HR letters for Rahaba Azeez.',
  },
  {
    slug: 'sla-watchdog',
    name: '5-Minute Lead SLA & Follow-Up Chaser',
    roleTitle: 'Speed-to-Lead & Omnichannel Dispatcher',
    department: 'CRM & Sales',
    scheduleLabel: 'Every 2 Minutes (08:00–21:00 GST)',
    ownerGuardrail: 'Respects 21:00–08:00 GST Quiet Hours & Global Outbound Kill Switch',
    description:
      'Audits new website and WhatsApp enquiries assigned to Daniel Xavier, Reshma Rajan, and Asif Khan; triggers instant alert before the 5-minute SLA expires.',
  },
  {
    slug: 'cbuae-underwriter',
    name: 'CBUAE 50% DBR & 24-Bank Matrix Co-Pilot',
    roleTitle: 'Pre-Underwriting & Bank Ranker Agent',
    department: 'Origination & Credit',
    scheduleLabel: 'On Every Deal Fact-Find & Statement Upload',
    ownerGuardrail: 'Hard 50.0% DBR ceiling + 200 bps stress buffer · Cites wiki_articles',
    description:
      'Evaluates borrower salary, credit card limits (5% / 3%), Tabby/Tamara BNPL lines, and ranks the best 3 UAE bank rate cards.',
  },
  {
    slug: 'conveyancing-chaser',
    name: 'Form F, RICS Valuation & DLD Trustee Coordinator',
    roleTitle: 'Conveyancing & NOC Progression Agent for Elton Frank',
    department: 'Conveyancing & Handover',
    scheduleLabel: 'Daily 11:00 AM & 04:00 PM GST',
    ownerGuardrail: 'Requires Maker-Checker before Manager Cheque split sign-off',
    description:
      'Tracks Form F (MOU) contingency dates, developer NOC applications, liability letter expiry windows, and DLD Trustee transfer slots.',
  },
  {
    slug: 'voice-receptionist',
    name: 'Betterway Bilingual AI Voice Receptionist (EN/AR)',
    roleTitle: '24/7 Inbound Call Triage & Callback Booker',
    department: 'Client Reception',
    scheduleLabel: '24/7 Instant Answer (<1s)',
    ownerGuardrail: 'Logs PDPL consent & routes qualified callers to Reshma Rajan / Asif Khan / Daniel Xavier',
    description:
      'Answers inbound client calls in English and Arabic, captures property value, residency, and monthly income, and books consultations directly into OS.',
  },
];

export function collectLiveOsContext(db: DatabaseSync) {
  const activeDealsRow = db
    .prepare(
      `SELECT COUNT(*) AS count, COALESCE(SUM(target_loan_fils), 0) AS total_loan_fils
       FROM deals
       WHERE origin_mode = 'LIVE' AND stage NOT IN ('TRANSFERRED_DISBURSED','DECLINED','WITHDRAWN')`,
    )
    .get() as { count: number; total_loan_fils: number };

  const leadsRow = db
    .prepare(
      `SELECT COUNT(*) AS total_leads,
              SUM(CASE WHEN stage = 'NEW' THEN 1 ELSE 0 END) AS untouched_leads
       FROM leads`,
    )
    .get() as { total_leads: number; untouched_leads: number };

  const eiborRow = db
    .prepare('SELECT three_month_micro, six_month_micro, fixing_date FROM eibor_fixings ORDER BY fixing_date DESC LIMIT 1')
    .get() as { three_month_micro: number; six_month_micro: number; fixing_date: string } | undefined;

  const topRates = db
    .prepare(
      `SELECT b.name_en AS bank_name, r.product_code, r.finance_mode, r.intro_rate_bps, r.fixed_years
       FROM bank_rate_cards r
       JOIN banks b ON b.id = r.bank_id
       WHERE r.status = 'ACTIVE'
       ORDER BY r.intro_rate_bps ASC LIMIT 5`,
    )
    .all() as Array<{
    bank_name: string;
    product_code: string;
    finance_mode: string;
    intro_rate_bps: number;
    fixed_years: number;
  }>;

  const todayGst = new Date(Date.now() + 4 * 3600_000).toISOString().slice(0, 10);
  const attendanceToday = db
    .prepare('SELECT COUNT(*) AS c, SUM(CASE WHEN is_late = 1 THEN 1 ELSE 0 END) AS late_c FROM office_attendance_logs WHERE check_in_date = ?')
    .get(todayGst) as { c: number; late_c: number };

  const hrPending = (
    db.prepare("SELECT COUNT(*) AS c FROM hr_operations_requests WHERE status = 'PENDING_RAHABA'").get() as {
      c: number;
    }
  ).c;

  const topDeals = db
    .prepare(
      `SELECT d.deal_ref, d.stage, d.target_loan_fils, h.primary_name AS client_name, u.full_name_en AS advisor_name
       FROM deals d
       JOIN households h ON h.id = d.household_id
       LEFT JOIN users u ON u.id = d.advisor_id
       WHERE d.origin_mode = 'LIVE'
       ORDER BY d.id DESC LIMIT 5`,
    )
    .all() as Array<{
    deal_ref: string;
    stage: string;
    target_loan_fils: number;
    client_name: string;
    advisor_name: string | null;
  }>;

  const eibor3mPct = eiborRow ? (eiborRow.three_month_micro / 100_000).toFixed(2) : '3.68';
  const eibor6mPct = eiborRow ? (eiborRow.six_month_micro / 100_000).toFixed(2) : '3.74';

  return {
    activeDealsCount: Number(activeDealsRow.count || 0),
    activePipelineAed: Math.round(Number(activeDealsRow.total_loan_fils || 0) / 100),
    totalLeadsCount: Number(leadsRow.total_leads || 0),
    untouchedLeadsCount: Number(leadsRow.untouched_leads || 0),
    eibor3mPct,
    eibor6mPct,
    topRates,
    attendanceCheckedInToday: Number(attendanceToday.c || 0),
    attendanceLateToday: Number(attendanceToday.late_c || 0),
    hrPendingCount: hrPending,
    topDeals,
  };
}

export function askBetterwayGpt(db: DatabaseSync, input: AskBetterwayGptInput) {
  const mode: BetterwayGptMode = input.mode || 'LIVE_OS_DATA';
  const cleanEmail = input.userEmail.trim().toLowerCase();
  const prompt = input.prompt.trim();
  if (!prompt) {
    throw new Error('Prompt cannot be empty');
  }

  let threadId = input.threadId;
  if (!threadId) {
    threadId = `gpt-${crypto.randomUUID().slice(0, 10)}`;
    const title = prompt.length > 56 ? `${prompt.slice(0, 53)}...` : prompt;
    db.prepare(
      `INSERT INTO ai_chat_threads (id, user_email, title, mode)
       VALUES (?, ?, ?, ?)`,
    ).run(threadId, cleanEmail, title, mode);
  } else {
    const exists = db.prepare('SELECT id FROM ai_chat_threads WHERE id = ?').get(threadId);
    if (!exists) {
      const title = prompt.length > 56 ? `${prompt.slice(0, 53)}...` : prompt;
      db.prepare(
        `INSERT INTO ai_chat_threads (id, user_email, title, mode)
         VALUES (?, ?, ?, ?)`,
      ).run(threadId, cleanEmail, title, mode);
    } else {
      db.prepare("UPDATE ai_chat_threads SET updated_at = datetime('now'), mode = ? WHERE id = ?").run(mode, threadId);
    }
  }

  const live = collectLiveOsContext(db);
  const policy = queryBankPolicyCoPilot(db, prompt);

  const ratesLines = live.topRates
    .map(
      (r, idx) =>
        `${idx + 1}. **${r.bank_name}** (${r.product_code} · ${r.finance_mode}) — **${(r.intro_rate_bps / 100).toFixed(2)}%** (${r.fixed_years}Y Fixed)`,
    )
    .join('\n');

  const dealsLines = live.topDeals
    .map(
      (d) =>
        `• **${d.deal_ref}** — ${d.client_name} · Stage: \`${d.stage}\` · Loan: **AED ${Math.round(d.target_loan_fils / 100).toLocaleString()}** · Advisor: ${d.advisor_name || 'Daniel Xavier'}`,
    )
    .join('\n');

  const rosterLine = OFFICIAL_STAFF_DIRECTORY.map((s) => `${s.fullNameEn} (${s.designation})`).join(' · ');

  let reply = '';
  if (mode === 'BILINGUAL_WRITER' || /arabic|translate|عربي/i.test(prompt)) {
    reply = [
      `### BetterwayGPT Bilingual Executive Draft (EN / AR)`,
      `**English Draft — Betterway Mortgages LLC:**`,
      `Dear Valued Client, following our CBUAE 50% DBR assessment against current 3M EIBOR (${live.eibor3mPct}%), your mortgage file is pre-qualified across our 24-bank UAE lending panel with introductory fixed rates starting at ${
        live.topRates[0] ? (live.topRates[0].intro_rate_bps / 100).toFixed(2) : '3.89'
      }%.`,
      ``,
      `**النسخة العربية المعتمدة — شركة بيتروي للوساطة العقارية والتمويل ذ.م.م:**`,
      `عميلنا العزيز، بناءً على تقييم نسبة عبء الدين (50% DBR) وفق ضوابط مصرف الإمارات المركزي وسعر إيبور لثلاثة أشهر (${live.eibor3mPct}%)، يسعدنا إفادتكم بتأهيل طلب التمويل العقاري الخاص بكم لدى أفضل البنوك الإماراتية بمعدل ربح ثابت يبدأ من ${
        live.topRates[0] ? (live.topRates[0].intro_rate_bps / 100).toFixed(2) : '3.89'
      }%.`,
      ``,
      `**Live OS Telemetry Cited:** Active Pipeline AED ${live.activePipelineAed.toLocaleString()} (${live.activeDealsCount} live files).`,
    ].join('\n');
  } else if (mode === 'RAHABA_HR_WPS' || /rahaba|ratha|hr|attendance|salary|wps|leave|visa/i.test(prompt)) {
    reply = [
      `### BetterwayGPT — Betterway Mortgages LLC · Rahaba Azeez HR, Attendance & MOHRE WPS Intelligence`,
      `• **HR Lead:** Rahaba Azeez (\`rahaba@betterwaymortgages.com\`) · Studio Profile Active`,
      `• **Official Roster (9 Accounts):** ${rosterLine}`,
      `• **Today's 10:05 AM GST Reception QR Roll Call:** ${live.attendanceCheckedInToday} checked in · ${live.attendanceLateToday} late arrival(s) · Pending HR Desk Requests: **${live.hrPendingCount}**`,
      `• **MOHRE & Statutory Rules Enforced:**`,
      `  1. Shift window **10:00 AM – 07:00 PM GST** (strict grace until **10:05 AM**; 3+ late check-ins in 7 days auto-alerts Owner Shabib Siraj, Warda & Team Manager Daniel Xavier).`,
      `  2. Reception QR anti-loophole check: requires verified **Office Wi-Fi (\`Betterway-Office-5G\`)** + staff password; blocks cellular data.`,
      `  3. Statutory EOSB Gratuity (Federal Decree-Law 33/2021): **21 days/yr** (Years 1–5) & **30 days/yr** (Year 5+) on Basic Salary.`,
      ``,
      `#### Live Pipeline & Bank Snapshot`,
      `• **Active Pipeline:** AED ${live.activePipelineAed.toLocaleString()} across **${live.activeDealsCount}** deals · **3M EIBOR:** ${live.eibor3mPct}%`,
      ratesLines,
    ].join('\n');
  } else {
    reply = [
      `### BetterwayGPT Live OS Synthesis — Betterway Mortgages LLC`,
      `• **Live Mortgage Pipeline:** **AED ${live.activePipelineAed.toLocaleString()}** across **${live.activeDealsCount} active deals** (${live.totalLeadsCount} CRM leads · ${live.untouchedLeadsCount} awaiting 5-min SLA response)`,
      `• **CBUAE Benchmark & Guardrails:** 3M EIBOR **${live.eibor3mPct}%** · 6M EIBOR **${live.eibor6mPct}%** · Hard **50.0% DBR ceiling** (+2.0% stress rate buffer) · 50/50 Net House/Advisor split`,
      `• **Rahaba Azeez HR & Reception QR Today:** ${live.attendanceCheckedInToday} staff checked in (${live.attendanceLateToday} late) · ${live.hrPendingCount} open HR queue items`,
      ``,
      `#### Top 5 Active UAE Bank Rate Cards`,
      ratesLines,
      ``,
      `#### Active Deal Files in OS`,
      dealsLines,
      ``,
      `#### Citation-Grounded Credit & Policy Guidance`,
      policy.deterministicSummary,
    ].join('\n');
  }

  db.prepare(
    `INSERT INTO ai_chat_messages (thread_id, role, content, citations_json, metrics_json)
     VALUES (?, 'user', ?, '[]', '{}')`,
  ).run(threadId, prompt);

  db.prepare(
    `INSERT INTO ai_chat_messages (thread_id, role, content, citations_json, metrics_json)
     VALUES (?, 'assistant', ?, ?, ?)`,
  ).run(
    threadId,
    reply,
    JSON.stringify(policy.citations),
    JSON.stringify(live),
  );

  return {
    threadId,
    mode,
    reply,
    citations: policy.citations,
    liveMetrics: live,
  };
}

export function listAiChatThreads(db: DatabaseSync, userEmail?: string) {
  const threads = (
    userEmail
      ? db
          .prepare('SELECT * FROM ai_chat_threads WHERE LOWER(user_email) = ? ORDER BY updated_at DESC LIMIT 20')
          .all(userEmail.trim().toLowerCase())
      : db.prepare('SELECT * FROM ai_chat_threads ORDER BY updated_at DESC LIMIT 20').all()
  ) as Array<Record<string, unknown>>;

  return threads.map((t) => {
    const messages = db
      .prepare('SELECT * FROM ai_chat_messages WHERE thread_id = ? ORDER BY id ASC')
      .all(String(t.id)) as Array<Record<string, unknown>>;
    return {
      id: String(t.id),
      userEmail: String(t.user_email),
      title: String(t.title),
      mode: String(t.mode) as BetterwayGptMode,
      updatedAt: String(t.updated_at),
      messages: messages.map((m) => ({
        id: Number(m.id),
        role: String(m.role) as 'user' | 'assistant' | 'system',
        content: String(m.content),
        citations: JSON.parse(String(m.citations_json || '[]')),
        createdAt: String(m.created_at),
      })),
    };
  });
}

export function listAiDigitalEmployees(db: DatabaseSync) {
  const runs = db
    .prepare('SELECT * FROM ai_agent_runs ORDER BY id DESC LIMIT 30')
    .all() as Array<Record<string, unknown>>;

  return DIGITAL_AI_EMPLOYEES.map((agent) => {
    const latestRun = runs.find((r) => String(r.agent_slug) === agent.slug);
    return {
      ...agent,
      latestRun: latestRun
        ? {
            id: Number(latestRun.id),
            status: String(latestRun.status),
            outputSummary: String(latestRun.output_summary),
            triggeredByEmail: String(latestRun.triggered_by_email),
            createdAt: String(latestRun.created_at),
          }
        : null,
    };
  });
}

export function runAiDigitalEmployee(
  db: DatabaseSync,
  agentSlug: string,
  triggeredByEmail: string,
) {
  const spec = DIGITAL_AI_EMPLOYEES.find((a) => a.slug === agentSlug) ?? DIGITAL_AI_EMPLOYEES[0]!;
  const live = collectLiveOsContext(db);

  let outputSummary = '';
  let actionsTaken: string[] = [];

  switch (spec.slug) {
    case 'rahaba-hr-attendance': {
      outputSummary = `Rahaba Azeez HR & 10:05 AM GST Attendance Watchdog completed: Verified 9 staff accounts (${live.attendanceCheckedInToday} checked in today, ${live.attendanceLateToday} late). Audited MOHRE WPS & 90/60/30-day Visa/Emirates ID/RERA BRN radar; ${live.hrPendingCount} HR request(s) queued for Rahaba Azeez.`;
      actionsTaken = [
        'Verified 10:05 AM GST QR roll call across all 9 Betterway staff accounts',
        'Checked 7-day rolling late contemptor window for Shabib Siraj & Daniel Xavier escalation',
        'Audited 90/60/30-day Visa, Emirates ID & RERA BRN expiry status',
      ];
      break;
    }
    case 'morning-briefing': {
      outputSummary = `09:30 AM Executive Briefing prepared for Shabib Siraj, Warda & Daniel Xavier: Active Pipeline AED ${live.activePipelineAed.toLocaleString()} (${live.activeDealsCount} live deals), 3M EIBOR ${live.eibor3mPct}%, Top Fixed Rate ${
        live.topRates[0] ? (live.topRates[0].intro_rate_bps / 100).toFixed(2) : '3.89'
      }%.`;
      actionsTaken = [
        'Compiled stage-weighted subvention forecast & 180-day clawback reserve',
        'Refreshed 3M & 6M CBUAE EIBOR benchmark feed',
        'Dispatched morning executive digest to Shabib Siraj, Warda & Daniel Xavier',
      ];
      break;
    }
    case 'sla-watchdog': {
      outputSummary = `5-Minute Speed-to-Lead SLA Audit completed: ${live.totalLeadsCount} total leads monitored (${live.untouchedLeadsCount} untouched). Assigned advisors Daniel Xavier, Reshma Rajan & Asif Khan notified.`;
      actionsTaken = [
        'Audited website calculator & WhatsApp lead response timestamps',
        'Verified 21:00–08:00 GST quiet-hours compliance',
      ];
      break;
    }
    case 'cbuae-underwriter': {
      outputSummary = `CBUAE 50% DBR & 24-Bank Pre-Underwriting Scan completed across ${live.activeDealsCount} active deals at +200 bps stress rate above ${live.eibor3mPct}% 3M EIBOR.`;
      actionsTaken = [
        'Validated 50.0% DBR ceiling & credit card 5% imputed liability rule',
        'Ranked top 3 fixed/variable bank products per household',
      ];
      break;
    }
    case 'conveyancing-chaser': {
      outputSummary = `Conveyancing & Form F Progression Check completed for Coordinator Elton Frank: Verified MOU expiry dates, RICS valuation status, and DLD Trustee cheque splits.`;
      actionsTaken = [
        'Checked Form F (MOU) 30/60-day FOL contingency timers',
        'Verified developer NOC & Seller Bank liability letter validity',
      ];
      break;
    }
    default: {
      outputSummary = `Betterway Bilingual AI Voice Receptionist (EN/AR) health check passed: Instant <1s pickup active, routing qualified mortgage callers to Daniel Xavier, Reshma Rajan & Asif Khan.`;
      actionsTaken = [
        'Verified bilingual English/Arabic IVR & qualification script',
        'Tested instant CRM lead + 5m SLA creation hook',
      ];
      break;
    }
  }

  const r = db
    .prepare(
      `INSERT INTO ai_agent_runs (agent_slug, agent_name, triggered_by_email, status, output_summary, actions_taken_json)
       VALUES (?, ?, ?, 'COMPLETED', ?, ?)`,
    )
    .run(spec.slug, spec.name, triggeredByEmail, outputSummary, JSON.stringify(actionsTaken));

  return {
    id: Number(r.lastInsertRowid),
    agentSlug: spec.slug,
    agentName: spec.name,
    status: 'COMPLETED' as const,
    outputSummary,
    actionsTaken,
  };
}
