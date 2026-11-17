import type { DatabaseSync } from 'node:sqlite';
import { assertMlroAccess, writeAuditLog, type UserRecord } from '@/server/auth';

const SANCTIONS_WATCHLIST = ['DESIGNATED ENTITY ALPHA', 'SANCTIONED SYNDICATE', 'TERRORIST LIST SAMPLE'];
const HIGH_RISK_COUNTRIES = new Set(['IR', 'KP', 'MM', 'SY']);

const xmlEscape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

export function recordKfsAcknowledgement(
  db: DatabaseSync,
  input: {
    dealId: number;
    applicantId: number;
    disclosedBrokerFeeFils: number;
    disclosedLfiCommissionRange: string;
    signedByName: string;
    signedIp?: string;
  },
) {
  const deal = db.prepare('SELECT id, deal_ref, target_loan_fils, tenure_months FROM deals WHERE id = ?').get(input.dealId);
  if (!deal) throw new Error(`Deal ${input.dealId} not found`);

  const snapshot = JSON.stringify({
    deal,
    statutoryNotice:
      'CBUAE Consumer Protection Key Facts Statement: Early settlement capped at 1% of balance or AED 10,000 (+5% VAT), whichever is lower. Variable rate resets against published CBUAE EIBOR plus bank margin subject to contractual floor.',
    disclosedBrokerFeeFils: input.disclosedBrokerFeeFils,
    disclosedLfiCommissionRange: input.disclosedLfiCommissionRange,
  });

  db.prepare(
    `INSERT INTO kfs_acknowledgements (
      deal_id, applicant_id, disclosed_broker_fee_fils, disclosed_lfi_commission_range,
      kfs_snapshot_json, signed_by_name, signed_ip
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(deal_id, applicant_id) DO UPDATE SET
      disclosed_broker_fee_fils = excluded.disclosed_broker_fee_fils,
      disclosed_lfi_commission_range = excluded.disclosed_lfi_commission_range,
      kfs_snapshot_json = excluded.kfs_snapshot_json,
      signed_by_name = excluded.signed_by_name,
      signed_ip = excluded.signed_ip,
      signed_at = datetime('now')`,
  ).run(
    input.dealId,
    input.applicantId,
    input.disclosedBrokerFeeFils,
    input.disclosedLfiCommissionRange,
    snapshot,
    input.signedByName,
    input.signedIp ?? '127.0.0.1',
  );

  writeAuditLog(db, null, 'kfs_acknowledgements', `${input.dealId}:${input.applicantId}`, 'KFS_SIGNED', null, input);
}

export function checkBankSubmissionGate(db: DatabaseSync, dealId: number) {
  const deal = db.prepare('SELECT id, household_id, cdd_status, origin_mode FROM deals WHERE id = ?').get(dealId) as
    | { id: number; household_id: number; cdd_status: string; origin_mode: string }
    | undefined;
  if (!deal) throw new Error(`Deal ${dealId} not found`);

  if (deal.origin_mode === 'LEGACY_BACKBOOK') {
    return { allowed: true, missingKfsApplicants: [] as string[], cddBlocker: null };
  }

  const obligated = db
    .prepare(
      `SELECT id, full_name_en FROM applicants
       WHERE household_id = ? AND applicant_role IN ('PRIMARY','CO_BORROWER','GUARANTOR')
       ORDER BY id ASC`,
    )
    .all(deal.household_id) as { id: number; full_name_en: string }[];

  const signedRows = db
    .prepare('SELECT applicant_id FROM kfs_acknowledgements WHERE deal_id = ?')
    .all(dealId) as { applicant_id: number }[];
  const signedIds = new Set(signedRows.map((r) => r.applicant_id));

  const missingKfsApplicants = obligated.filter((a) => !signedIds.has(a.id)).map((a) => a.full_name_en);

  let cddBlocker: string | null = null;
  if (!['CLEARED', 'EDD_APPROVED'].includes(deal.cdd_status)) {
    cddBlocker = `AML/CDD clearance required before bank submission (current CDD status: ${deal.cdd_status})`;
  }

  return {
    allowed: missingKfsApplicants.length === 0 && cddBlocker === null,
    missingKfsApplicants,
    cddBlocker,
  };
}

export function runApplicantAmlScreening(
  db: DatabaseSync,
  reviewer: UserRecord,
  input: {
    dealId: number;
    applicantId: number;
    sourceOfFundsType: string;
    verified: boolean;
    notes?: string;
  },
) {
  const applicant = db.prepare('SELECT * FROM applicants WHERE id = ?').get(input.applicantId) as Record<string, unknown> | undefined;
  if (!applicant) throw new Error('Applicant not found');

  const upperName = String(applicant.full_name_en).toUpperCase();
  const imported = db.prepare('SELECT name_upper FROM sanctions_list_entries').all() as { name_upper: string }[];
  const isSanctionsHit = SANCTIONS_WATCHLIST.some((w) => upperName.includes(w)) || imported.some((w) => upperName.replace(/\s+/g, ' ').includes(w.name_upper));
  const isHighRiskCountry =
    HIGH_RISK_COUNTRIES.has(String(applicant.nationality_code)) || HIGH_RISK_COUNTRIES.has(String(applicant.residence_country));
  const isPep = Number(applicant.is_pep) === 1;

  let riskScore = 15;
  if (applicant.residency_type === 'NON_RESIDENT') riskScore += 20;
  if (isPep) riskScore += 45;
  if (isHighRiskCountry) riskScore += 50;
  if (input.sourceOfFundsType.includes('GIFT') || input.sourceOfFundsType.includes('CRYPTO')) riskScore += 30;
  if (isSanctionsHit) riskScore = 100;

  const riskBand: 'LOW' | 'MEDIUM' | 'HIGH' = riskScore >= 60 ? 'HIGH' : riskScore >= 35 ? 'MEDIUM' : 'LOW';
  const sanctionsStatus = isSanctionsHit ? 'CONFIRMED_BLOCK' : 'CLEAR';

  db.prepare(
    `INSERT INTO aml_screenings (
      deal_id, applicant_id, risk_score, risk_band, source_of_funds_type,
      source_of_funds_verified, sanctions_match_status, pep_status, mlro_reviewer_id, reviewed_at, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)`,
  ).run(
    input.dealId,
    input.applicantId,
    riskScore,
    riskBand,
    input.sourceOfFundsType,
    input.verified ? 1 : 0,
    sanctionsStatus,
    isPep ? 1 : 0,
    reviewer.id,
    input.notes ?? '',
  );

  // Evaluate overall deal CDD status across all obligated applicants
  const deal = db.prepare('SELECT household_id FROM deals WHERE id = ?').get(input.dealId) as { household_id: number };
  const obligated = db
    .prepare("SELECT id FROM applicants WHERE household_id = ? AND applicant_role IN ('PRIMARY','CO_BORROWER','GUARANTOR')")
    .all(deal.household_id) as { id: number }[];

  const screenings = db
    .prepare(
      `SELECT applicant_id, risk_band, source_of_funds_verified, sanctions_match_status
       FROM aml_screenings WHERE deal_id = ? ORDER BY id DESC`,
    )
    .all(input.dealId) as {
    applicant_id: number;
    risk_band: string;
    source_of_funds_verified: number;
    sanctions_match_status: string;
  }[];

  const latestByApplicant = new Map<number, (typeof screenings)[0]>();
  for (const s of screenings) {
    if (!latestByApplicant.has(s.applicant_id)) latestByApplicant.set(s.applicant_id, s);
  }

  let newCddStatus = 'PENDING';
  const anyBlocked = [...latestByApplicant.values()].some((s) => s.sanctions_match_status === 'CONFIRMED_BLOCK');
  const allScreenedAndVerified = obligated.every((o) => latestByApplicant.get(o.id)?.source_of_funds_verified === 1);
  const anyHighRisk = [...latestByApplicant.values()].some((s) => s.risk_band === 'HIGH');

  if (anyBlocked) {
    newCddStatus = 'BLOCKED';
  } else if (allScreenedAndVerified) {
    newCddStatus = anyHighRisk ? (reviewer.is_mlro === 1 ? 'EDD_APPROVED' : 'EDD_REQUIRED') : 'CLEARED';
  }

  db.prepare('UPDATE deals SET cdd_status = ? WHERE id = ?').run(newCddStatus, input.dealId);
  writeAuditLog(db, reviewer, 'aml_screenings', `${input.dealId}:${input.applicantId}`, 'AML_SCREENED', null, {
    riskScore,
    riskBand,
    newCddStatus,
  });

  return { riskScore, riskBand, sanctionsStatus, dealCddStatus: newCddStatus };
}

export function listGoAmlReports(db: DatabaseSync, actor: UserRecord | null) {
  assertMlroAccess(actor);
  return db.prepare('SELECT * FROM goaml_reports ORDER BY id DESC').all() as {
    id: number;
    report_ref: string;
    report_type: string;
    deal_id: number | null;
    subject_summary: string;
    red_flag_indicators_json: string;
    goaml_xml_payload: string;
    status: string;
    created_at: string;
  }[];
}

export function createGoAmlReport(
  db: DatabaseSync,
  actor: UserRecord | null,
  input: {
    reportType: 'STR' | 'SAR';
    dealId?: number | null;
    subjectSummary: string;
    redFlags: string[];
  },
) {
  const mlro = assertMlroAccess(actor);
  const company = db.prepare('SELECT legal_name, cbuae_broker_reg FROM company_settings WHERE id = 1').get() as {
    legal_name: string;
    cbuae_broker_reg: string;
  };
  const count = (db.prepare('SELECT COUNT(*) as c FROM goaml_reports').get() as { c: number }).c + 1;
  const reportRef = `GOAML-${input.reportType}-2026-${String(count).padStart(3, '0')}`;

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<report xmlns="http://www.unodc.org/goaml/uae-fiu/4.0">',
    `  <rentity_id>${xmlEscape(company.cbuae_broker_reg)}</rentity_id>`,
    `  <rentity_branch>${xmlEscape(company.legal_name)}</rentity_branch>`,
    '  <submission_code>E</submission_code>',
    `  <report_code>${input.reportType}</report_code>`,
    `  <entity_reference>${xmlEscape(reportRef)}</entity_reference>`,
    `  <submission_date>${new Date().toISOString()}</submission_date>`,
    '  <currency_code_local>AED</currency_code_local>',
    `  <reason>${xmlEscape(input.subjectSummary)}</reason>`,
    '  <report_indicators>',
    ...input.redFlags.map((rf) => `    <indicator>${xmlEscape(rf)}</indicator>`),
    '  </report_indicators>',
    '</report>',
  ].join('\n');

  const res = db
    .prepare(
      `INSERT INTO goaml_reports (
        report_ref, report_type, deal_id, subject_summary, red_flag_indicators_json,
        goaml_xml_payload, status, created_by_mlro
      ) VALUES (?, ?, ?, ?, ?, ?, 'XML_READY', ?)`,
    )
    .run(reportRef, input.reportType, input.dealId ?? null, input.subjectSummary, JSON.stringify(input.redFlags), xml, mlro.id);

  // Audit log intentionally omits subject summary to prevent tipping off non-MLRO audit readers
  writeAuditLog(db, mlro, 'goaml_reports', Number(res.lastInsertRowid), 'CREATE_SEALED_FIU_REPORT', null, { reportRef });

  return db.prepare('SELECT * FROM goaml_reports WHERE id = ?').get(Number(res.lastInsertRowid)) as {
    id: number;
    report_ref: string;
    report_type: string;
    goaml_xml_payload: string;
    status: string;
  };
}

export function logSanadakComplaint(
  db: DatabaseSync,
  actor: UserRecord,
  input: { dealId?: number | null; complainantName: string; category: string; description: string },
) {
  const count = (db.prepare('SELECT COUNT(*) as c FROM sanadak_complaints').get() as { c: number }).c + 1;
  const ref = `CMP-2026-${String(count).padStart(3, '0')}`;
  const ackDue = new Date(Date.now() + 2 * 86_400_000).toISOString(); // 2 business days acknowledgement SLA
  const resDue = new Date(Date.now() + 15 * 86_400_000).toISOString(); // 15 days resolution SLA before Sanadak right
  const res = db
    .prepare(
      `INSERT INTO sanadak_complaints (complaint_ref, deal_id, complainant_name, category, description, ack_due_at, resolution_due_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(ref, input.dealId ?? null, input.complainantName, input.category, input.description, ackDue, resDue);
  writeAuditLog(db, actor, 'sanadak_complaints', Number(res.lastInsertRowid), 'LOG_COMPLAINT', null, { ref });
  return ref;
}
