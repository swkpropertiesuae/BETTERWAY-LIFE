import type { DatabaseSync } from 'node:sqlite';
import { writeAuditLog, type UserRecord } from '@/server/auth';
import { postJournalEntry } from './ledger-tax-engine';

export function calculateUaeGratuityFils(params: {
  basicSalaryFils: number;
  totalMonthlySalaryFils: number;
  grossServiceDays: number;
  unpaidLeaveDays: number;
}) {
  const netServiceDays = Math.max(0, params.grossServiceDays - params.unpaidLeaveDays);
  if (netServiceDays < 365 || params.basicSalaryFils <= 0) {
    return {
      netServiceDays,
      netServiceYears: +(netServiceDays / 365).toFixed(2),
      gratuityDaysEarned: 0,
      gratuityFils: 0,
      cappedAt24Months: false,
    };
  }

  const dailyBasicFils = params.basicSalaryFils / 30;
  const firstFiveYearDays = Math.min(netServiceDays, 5 * 365);
  const beyondFiveYearDays = Math.max(0, netServiceDays - 5 * 365);

  const gratuityDaysEarned = (firstFiveYearDays / 365) * 21 + (beyondFiveYearDays / 365) * 30;
  const uncappedFils = Math.round(dailyBasicFils * gratuityDaysEarned);
  const maxCapFils = params.totalMonthlySalaryFils * 24;
  const gratuityFils = Math.min(uncappedFils, maxCapFils);

  return {
    netServiceDays,
    netServiceYears: +(netServiceDays / 365).toFixed(2),
    gratuityDaysEarned: +gratuityDaysEarned.toFixed(2),
    gratuityFils,
    cappedAt24Months: uncappedFils > maxCapFils,
  };
}

export function runMonthlyWpsPayroll(
  db: DatabaseSync,
  actor: UserRecord,
  input: {
    periodMonth: string; // YYYY-MM
    payStartDate: string; // YYYY-MM-DD
    payEndDate: string; // YYYY-MM-DD
  },
) {
  const company = db.prepare('SELECT * FROM company_settings WHERE id = 1').get() as {
    mohre_establishment_id: string;
    wps_routing_bank_code: string;
    legal_name: string;
  };
  const employees = db
    .prepare('SELECT * FROM employees WHERE termination_date IS NULL ORDER BY id ASC')
    .all() as Record<string, unknown>[];

  const startMs = Date.parse(input.payStartDate + 'T00:00:00Z');
  const endMs = Date.parse(input.payEndDate + 'T00:00:00Z');
  const periodDays = Math.max(1, Math.round((endMs - startMs) / 86_400_000) + 1);

  const edrLines: string[] = [];
  let totalFixedFils = 0;
  let totalVariableFils = 0;
  let totalCommissionCleared2150Fils = 0;
  let totalDrawAdvances1310Fils = 0;
  let totalDrawRecovered1310Fils = 0;
  let totalNonRecoverableDraw5200Fils = 0;
  let totalNetPayableFils = 0;
  let totalGpssaEmpFils = 0;
  let totalGpssaEmployerFils = 0;
  let totalBasicEarnedFils = 0;
  let totalAllowancesEarnedFils = 0;

  db.exec('BEGIN IMMEDIATE');
  try {
    const runRes = db
      .prepare(
        `INSERT INTO payroll_runs (period_month, pay_start_date, pay_end_date, status)
         VALUES (?, ?, ?, 'SIF_GENERATED')`,
      )
      .run(input.periodMonth, input.payStartDate, input.payEndDate);
    const runId = Number(runRes.lastInsertRowid);

    for (const emp of employees) {
      const empId = Number(emp.id);

      // Overlap-aware unpaid leave days within [payStartDate, payEndDate]
      const overlappingLeaves = db
        .prepare(
          `SELECT start_date, end_date FROM leave_records
           WHERE employee_id = ? AND leave_type = 'UNPAID' AND status = 'APPROVED'
             AND start_date <= ? AND end_date >= ?`,
        )
        .all(empId, input.payEndDate, input.payStartDate) as { start_date: string; end_date: string }[];

      let rawOverlapUnpaid = 0;
      for (const lv of overlappingLeaves) {
        const sMs = Math.max(startMs, Date.parse(lv.start_date + 'T00:00:00Z'));
        const eMs = Math.min(endMs, Date.parse(lv.end_date + 'T00:00:00Z'));
        if (eMs >= sMs) {
          rawOverlapUnpaid += Math.round((eMs - sMs) / 86_400_000) + 1;
        }
      }
      const unpaidDays = Math.min(periodDays, rawOverlapUnpaid);
      const paidDays = periodDays - unpaidDays;
      const dayRatio = paidDays / periodDays;

      const basicEarned = Math.round(Number(emp.basic_salary_fils) * dayRatio);
      const allowEarned = Math.round(
        (Number(emp.housing_allowance_fils) + Number(emp.transport_allowance_fils) + Number(emp.other_allowance_fils)) *
          dayRatio,
      );
      const fixedPayFils = basicEarned + allowEarned;

      // Net cash-payable commission released since prior runs (strictly subtracting advisor_clawback_offset_applied_fils!)
      let rawReleasedCommFils = 0;
      if (emp.user_id) {
        const totalNetReleased = (
          db
            .prepare(
              `SELECT COALESCE(SUM(advisor_released_fils - advisor_clawback_offset_applied_fils), 0) as c
               FROM commission_settlements WHERE advisor_id = ?`,
            )
            .get(Number(emp.user_id)) as { c: number }
        ).c;
        const alreadyPaid = (
          db
            .prepare(
              `SELECT COALESCE(SUM(variable_commission_fils - draw_advance_fils + draw_recovered_fils), 0) as p
               FROM payroll_lines WHERE employee_id = ? AND payroll_run_id != ?`,
            )
            .get(empId, runId) as { p: number }
        ).p;
        rawReleasedCommFils = Math.max(0, totalNetReleased - alreadyPaid);
      }

      const monthlyDraw = Number(emp.monthly_draw_fils || 0);
      const isRecoverable = Number(emp.is_draw_recoverable) === 1;
      let currentDeficit = Number(emp.draw_deficit_fils || 0);
      let variableCommissionPayable = rawReleasedCommFils;
      let drawAdvanceFils = 0;
      let drawRecoveredFils = 0;
      let nonRecoverableTopUpFils = 0;

      if (monthlyDraw > 0) {
        if (isRecoverable) {
          if (rawReleasedCommFils >= monthlyDraw) {
            const surplusAboveDraw = rawReleasedCommFils - monthlyDraw;
            drawRecoveredFils = Math.min(currentDeficit, surplusAboveDraw);
            currentDeficit -= drawRecoveredFils;
            variableCommissionPayable = rawReleasedCommFils - drawRecoveredFils;
          } else {
            const shortfall = monthlyDraw - rawReleasedCommFils;
            drawAdvanceFils = shortfall;
            currentDeficit += shortfall;
            variableCommissionPayable = rawReleasedCommFils + drawAdvanceFils;
          }
          db.prepare('UPDATE employees SET draw_deficit_fils = ? WHERE id = ?').run(currentDeficit, empId);
        } else if (rawReleasedCommFils < monthlyDraw) {
          nonRecoverableTopUpFils = monthlyDraw - rawReleasedCommFils;
          drawAdvanceFils = nonRecoverableTopUpFils; // Prevents consuming future commissions in alreadyPaid query
          variableCommissionPayable = monthlyDraw;
        }
      }

      // GPSSA Pension for UAE Nationals (5% employee deduction + 12.5% employer contribution on Basic + Housing)
      const pensionableBase = basicEarned + Math.round(Number(emp.housing_allowance_fils) * dayRatio);
      const isNational = Number(emp.is_uae_national) === 1 && emp.contract_type !== 'EXEMPT';
      const gpssaEmployee = isNational ? Math.round(pensionableBase * 0.05) : 0;
      const gpssaEmployer = isNational ? Math.round(pensionableBase * 0.125) : 0;

      const netFixedForSif = Math.max(0, fixedPayFils - gpssaEmployee);
      const netPayableFils = netFixedForSif + variableCommissionPayable;

      const joinMs = Date.parse(String(emp.join_date) + 'T00:00:00Z');
      const totalServiceDays = Math.max(0, Math.round((endMs - joinMs) / 86_400_000));
      const totalUnpaidEver = (
        db
          .prepare("SELECT COALESCE(SUM(days_count), 0) as d FROM leave_records WHERE employee_id = ? AND leave_type = 'UNPAID' AND status = 'APPROVED'")
          .get(empId) as { d: number }
      ).d;
      const eosb =
        Number(emp.is_uae_national) === 1
          ? 0
          : calculateUaeGratuityFils({
              basicSalaryFils: Number(emp.basic_salary_fils),
              totalMonthlySalaryFils:
                Number(emp.basic_salary_fils) +
                Number(emp.housing_allowance_fils) +
                Number(emp.transport_allowance_fils) +
                Number(emp.other_allowance_fils),
              grossServiceDays: totalServiceDays,
              unpaidLeaveDays: totalUnpaidEver,
            }).gratuityFils;

      db.prepare(
        `INSERT INTO payroll_lines (
          payroll_run_id, employee_id, paid_days, unpaid_leave_days, fixed_pay_fils,
          variable_commission_fils, draw_advance_fils, draw_recovered_fils,
          gpssa_employee_deduction_fils, gpssa_employer_contrib_fils, net_payable_fils, eosb_accrued_to_date_fils
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        runId,
        empId,
        paidDays,
        unpaidDays,
        netFixedForSif,
        variableCommissionPayable,
        drawAdvanceFils,
        drawRecoveredFils,
        gpssaEmployee,
        gpssaEmployer,
        netPayableFils,
        eosb,
      );

      edrLines.push(
        [
          'EDR',
          String(emp.mohre_person_id_14).padStart(14, '0'),
          String(emp.routing_agent_id_9).padStart(9, '0'),
          String(emp.employee_iban_23),
          input.payStartDate,
          input.payEndDate,
          String(paidDays).padStart(4, '0'),
          (netFixedForSif / 100).toFixed(2),
          (variableCommissionPayable / 100).toFixed(2),
          String(unpaidDays).padStart(4, '0'),
        ].join(','),
      );

      totalFixedFils += netFixedForSif;
      totalVariableFils += variableCommissionPayable;
      totalCommissionCleared2150Fils += rawReleasedCommFils;
      if (isRecoverable) {
        totalDrawAdvances1310Fils += drawAdvanceFils;
        totalDrawRecovered1310Fils += drawRecoveredFils;
      } else {
        totalNonRecoverableDraw5200Fils += nonRecoverableTopUpFils;
      }
      totalNetPayableFils += netPayableFils;
      totalGpssaEmpFils += gpssaEmployee;
      totalGpssaEmployerFils += gpssaEmployer;
      totalBasicEarnedFils += basicEarned;
      totalAllowancesEarnedFils += allowEarned;
    }

    const now = new Date();
    const creationDate = now.toISOString().slice(0, 10);
    const creationTime = now.toISOString().slice(11, 16).replace(':', '');
    const salaryMonth = input.periodMonth.slice(5, 7) + input.periodMonth.slice(0, 4);

    const scrLine = [
      'SCR',
      company.mohre_establishment_id.padStart(13, '0'),
      company.wps_routing_bank_code.padStart(9, '0'),
      creationDate,
      creationTime,
      salaryMonth,
      String(edrLines.length),
      ((totalFixedFils + totalVariableFils) / 100).toFixed(2),
      'AED',
      `BW-WPS-${input.periodMonth}`,
    ].join(',');

    const sifContent = [...edrLines, scrLine].join('\n');
    const sifFilename = `${company.mohre_establishment_id}${creationDate.replace(/-/g, '')}${creationTime}.SIF`;

    const glEntryId = postJournalEntry(db, actor, {
      entryDate: input.payEndDate,
      memo: `Monthly UAE WPS Payroll & GPSSA (${input.periodMonth})`,
      sourceModule: 'HRM_WPS_PAYROLL',
      sourceId: String(runId),
      lines: [
        { accountCode: '6100', debitFils: totalBasicEarnedFils, creditFils: 0, lineMemo: 'Basic Salaries' },
        { accountCode: '6110', debitFils: totalAllowancesEarnedFils, creditFils: 0, lineMemo: 'Allowances' },
        ...(totalCommissionCleared2150Fils > 0
          ? [{ accountCode: '2150', debitFils: totalCommissionCleared2150Fils, creditFils: 0, lineMemo: 'Clear Accrued Advisor Commissions' }]
          : []),
        ...(totalDrawAdvances1310Fils > 0
          ? [{ accountCode: '1310', debitFils: totalDrawAdvances1310Fils, creditFils: 0, lineMemo: 'Recoverable Advisor Draw Advance' }]
          : []),
        ...(totalNonRecoverableDraw5200Fils > 0
          ? [{ accountCode: '5200', debitFils: totalNonRecoverableDraw5200Fils, creditFils: 0, lineMemo: 'Non-Recoverable Draw Guarantee' }]
          : []),
        ...(totalGpssaEmployerFils > 0
          ? [{ accountCode: '6120', debitFils: totalGpssaEmployerFils, creditFils: 0, lineMemo: 'GPSSA Employer 12.5%' }]
          : []),
        ...(totalDrawRecovered1310Fils > 0
          ? [{ accountCode: '1310', debitFils: 0, creditFils: totalDrawRecovered1310Fils, lineMemo: 'Recoup Prior Advisor Draw Deficit' }]
          : []),
        { accountCode: '1100', debitFils: 0, creditFils: totalNetPayableFils, lineMemo: `WPS SIF Transfer (${sifFilename})` },
        ...(totalGpssaEmpFils + totalGpssaEmployerFils > 0
          ? [
              {
                accountCode: '2420',
                debitFils: 0,
                creditFils: totalGpssaEmpFils + totalGpssaEmployerFils,
                lineMemo: 'GPSSA Pension Payable',
              },
            ]
          : []),
      ],
    });

    db.prepare(
      `UPDATE payroll_runs SET sif_filename = ?, sif_content = ?, total_net_fils = ?, gl_entry_id = ? WHERE id = ?`,
    ).run(sifFilename, sifContent, totalNetPayableFils, glEntryId, runId);

    writeAuditLog(db, actor, 'payroll_runs', runId, 'GENERATE_WPS_SIF', null, {
      periodMonth: input.periodMonth,
      sifFilename,
      totalNetPayableFils,
    });

    db.exec('COMMIT');
    return db.prepare('SELECT * FROM payroll_runs WHERE id = ?').get(runId) as {
      id: number;
      period_month: string;
      sif_filename: string;
      sif_content: string;
      total_net_fils: number;
    };
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export function computeNafisComplianceStatus(db: DatabaseSync) {
  const activeStaff = db
    .prepare('SELECT is_uae_national, nafis_registered, basic_salary_fils, housing_allowance_fils, transport_allowance_fils FROM employees WHERE termination_date IS NULL')
    .all() as {
    is_uae_national: number;
    nafis_registered: number;
    basic_salary_fils: number;
    housing_allowance_fils: number;
    transport_allowance_fils: number;
  }[];

  const totalHeadcount = activeStaff.length;
  const qualifyingEmiratis = activeStaff.filter(
    (e) =>
      e.is_uae_national === 1 &&
      e.nafis_registered === 1 &&
      e.basic_salary_fils + e.housing_allowance_fils + e.transport_allowance_fils >= 600_000,
  ).length;

  const requiredQuota =
    totalHeadcount >= 50 ? Math.ceil(totalHeadcount * 0.1) : totalHeadcount >= 20 ? 2 : 1;

  return {
    totalHeadcount,
    emiratiCount: qualifyingEmiratis,
    requiredQuota,
    compliant: qualifyingEmiratis >= requiredQuota,
    shortfallSlots: Math.max(0, requiredQuota - qualifyingEmiratis),
  };
}

export function getDocumentExpiryWatchlist(db: DatabaseSync, horizonDays = 120) {
  const cutoff = new Date(Date.now() + horizonDays * 86_400_000).toISOString().slice(0, 10);
  const emps = db
    .prepare(
      `SELECT emp_code, full_name, designation, visa_expiry_date, emirates_id_expiry_date, rera_card_expiry_date, medical_ins_expiry_date
       FROM employees WHERE termination_date IS NULL`,
    )
    .all() as Record<string, string | null>[];

  const alerts: { empCode: string; fullName: string; docType: string; expiryDate: string }[] = [];
  for (const e of emps) {
    const checks: [string, string | null][] = [
      ['UAE Residence Visa', e.visa_expiry_date],
      ['Emirates ID', e.emirates_id_expiry_date],
      ['RERA Broker Card', e.rera_card_expiry_date],
      ['Medical Insurance', e.medical_ins_expiry_date],
    ];
    for (const [docType, dt] of checks) {
      if (dt && dt <= cutoff) {
        alerts.push({ empCode: String(e.emp_code), fullName: String(e.full_name), docType, expiryDate: dt });
      }
    }
  }
  return alerts.sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
}
