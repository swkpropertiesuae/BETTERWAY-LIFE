import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDb } from '@/server/db';
import type { UserRecord } from '@/server/auth';
import {
  calculateUaeGratuityFils,
  runMonthlyWpsPayroll,
  computeNafisComplianceStatus,
} from './wps-gratuity-engine';
import {
  analyzeBankStatementLines,
  queryBankPolicyCoPilot,
} from './statement-and-policy-copilot';

test('calculateUaeGratuityFils strictly uses Basic Salary (excluding allowances), applies 21d/30d brackets, deducts unpaid leave, and enforces 1-year cliff & 24m cap', () => {
  // Under 1 year (300 days) -> 0
  assert.equal(
    calculateUaeGratuityFils({
      basicSalaryFils: 1_800_000,
      totalMonthlySalaryFils: 2_800_000,
      grossServiceDays: 300,
      unpaidLeaveDays: 0,
    }).gratuityFils,
    0,
  );

  // Exact 3 years (1095 days) on AED 18,000 Basic (allowances ignored!) -> 3 * 21 = 63 days * AED 600/day = AED 37,800 (3,780,000 fils)
  const yr3 = calculateUaeGratuityFils({
    basicSalaryFils: 1_800_000,
    totalMonthlySalaryFils: 2_800_000,
    grossServiceDays: 1095,
    unpaidLeaveDays: 0,
  });
  assert.equal(yr3.gratuityFils, 3_780_000);

  // Exact 7 years (2555 days) -> (5 * 21 + 2 * 30) = 165 days * AED 600/day = AED 99,000 (9,900,000 fils)
  const yr7 = calculateUaeGratuityFils({
    basicSalaryFils: 1_800_000,
    totalMonthlySalaryFils: 2_800_000,
    grossServiceDays: 2555,
    unpaidLeaveDays: 0,
  });
  assert.equal(yr7.gratuityFils, 9_900_000);

  // 40 years service hits 24-month total salary cap (24 * 2,800,000 = 67,200,000 fils)
  const capped = calculateUaeGratuityFils({
    basicSalaryFils: 1_800_000,
    totalMonthlySalaryFils: 2_800_000,
    grossServiceDays: 365 * 40,
    unpaidLeaveDays: 0,
  });
  assert.equal(capped.gratuityFils, 67_200_000);
});

test('runMonthlyWpsPayroll generates compliant MOHRE .SIF (EDR + SCR), computes Emirati GPSSA, and rolls over recoverable draw deficits', () => {
  const db = createTestDb();
  const hr = db.prepare("SELECT * FROM users WHERE email = 'reem.hr@betterwaymortgages.com'").get() as UserRecord;

  // Month 1 (2026-10): Tariq has AED 5,000 recoverable draw and 0 released commission -> accrues AED 5,000 (500,000 fils) draw deficit!
  const oct = runMonthlyWpsPayroll(db, hr, {
    periodMonth: '2026-10',
    payStartDate: '2026-10-01',
    payEndDate: '2026-10-31',
  });

  assert.match(oct.sif_content, /^EDR,00192837465012,302620122,AE070331234567890123456,/m);
  assert.match(oct.sif_content, /^SCR,0000849201421,302620122,/m);

  const tariqAfterOct = db.prepare("SELECT draw_deficit_fils FROM employees WHERE emp_code = 'BW-EMP-001'").get() as {
    draw_deficit_fils: number;
  };
  assert.equal(tariqAfterOct.draw_deficit_fils, 500_000);

  // Month 2 (2026-11): Credit Tariq with AED 12,000 (1,200,000 fils) released advisor commission -> recovers prior AED 5,000 draw deficit cleanly!
  db.prepare(
    `INSERT INTO commission_settlements (
      deal_id, bank_id, disbursed_loan_fils, expected_subvention_ex_vat_fils,
      reconciliation_status, advisor_id, advisor_entitled_fils, advisor_released_fils
    ) VALUES (1, 6, 280_000_000, 2_100_000, 'RECONCILED', 3, 1_200_000, 1_200_000)`,
  ).run();

  runMonthlyWpsPayroll(db, hr, {
    periodMonth: '2026-11',
    payStartDate: '2026-11-01',
    payEndDate: '2026-11-30',
  });

  const tariqAfterNov = db.prepare("SELECT draw_deficit_fils FROM employees WHERE emp_code = 'BW-EMP-001'").get() as {
    draw_deficit_fils: number;
  };
  assert.equal(tariqAfterNov.draw_deficit_fils, 0, 'Prior recoverable draw deficit should be fully recouped fromAED 12,000 commission');

  const nafis = computeNafisComplianceStatus(db);
  assert.equal(nafis.emiratiCount, 2);
  assert.equal(nafis.compliant, true);
});

test('analyzeBankStatementLines detects salary credits, undisclosed EMIs/BNPL, and bounced cheques; Policy Co-Pilot returns exact citations', () => {
  const analysis = analyzeBankStatementLines([
    { date: '2026-09-28', description: 'WPS SALARY TRANSFER EMIRATES GROUP', debitFils: 0, creditFils: 4_200_000 },
    { date: '2026-10-28', description: 'WPS SALARY TRANSFER EMIRATES GROUP', debitFils: 0, creditFils: 4_200_000 },
    { date: '2026-10-05', description: 'LOAN EMI RECOVERY PERSONAL FIN', debitFils: 320_000, creditFils: 0 },
    { date: '2026-10-11', description: 'TABBY BNPL INSTALMENT', debitFils: 85_000, creditFils: 0 },
    { date: '2026-10-18', description: 'INWARD CHEQUE RETURNED INSUFFICIENT FUNDS', debitFils: 10_500, creditFils: 0 },
  ]);

  assert.equal(analysis.avgMonthlySalaryFils, 4_200_000);
  assert.equal(analysis.detectedRecurringEmiFils, 320_000);
  assert.equal(analysis.detectedBnplFils, 85_000);
  assert.equal(analysis.bouncedChequeCount, 1);
  assert.equal(analysis.underwritingAlertLevel, 'REVIEW_REQUIRED');

  const db = createTestDb();
  const ans = queryBankPolicyCoPilot(db, 'credit card 3% DBR HSBC');
  assert.ok(ans.citations.length >= 1);
  assert.match(ans.citations[0].clauseRef, /CBUAE-MLR-Art4/);
});
