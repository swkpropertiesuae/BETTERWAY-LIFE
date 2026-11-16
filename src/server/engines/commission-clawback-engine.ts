import type { DatabaseSync } from 'node:sqlite';
import { writeAuditLog, type UserRecord } from '@/server/auth';
import { createPintAeTaxInvoice, postJournalEntry } from './ledger-tax-engine';
import { checkBankSubmissionGate } from './compliance-aml-engine';

function computeAdvisorProgressiveCommissionFils(
  db: DatabaseSync,
  advisorUserId: number | null,
  houseNetPoolFils: number,
  leadSourceCategory: string,
): { advisorCommissionFils: number; progressionBonusFils: number } {
  if (!advisorUserId || houseNetPoolFils <= 0) {
    return { advisorCommissionFils: 0, progressionBonusFils: 0 };
  }
  const emp = db
    .prepare('SELECT comp_plan_id FROM employees WHERE user_id = ?')
    .get(advisorUserId) as { comp_plan_id: number | null } | undefined;
  const planId = emp?.comp_plan_id ?? 1;

  const plan = db.prepare('SELECT * FROM advisor_comp_plans WHERE id = ?').get(planId) as
    | { self_gen_multiplier_bps: number; company_lead_multiplier_bps: number; progression_bonus_fils: number }
    | undefined;
  if (!plan) return { advisorCommissionFils: Math.round(houseNetPoolFils * 0.2), progressionBonusFils: 150_000 };

  const slabs = db
    .prepare('SELECT * FROM advisor_comp_slabs WHERE plan_id = ? ORDER BY monthly_house_net_min_fils ASC')
    .all(planId) as {
    monthly_house_net_min_fils: number;
    monthly_house_net_max_fils: number | null;
    payout_bps: number;
  }[];

  let baseComm = 0;
  for (const s of slabs) {
    if (houseNetPoolFils <= s.monthly_house_net_min_fils) break;
    const upper = s.monthly_house_net_max_fils ?? houseNetPoolFils;
    const slice = Math.max(0, Math.min(houseNetPoolFils, upper) - s.monthly_house_net_min_fils);
    baseComm += Math.round((slice * s.payout_bps) / 10_000);
  }

  const multBps = leadSourceCategory === 'SELF_GEN' ? plan.self_gen_multiplier_bps : plan.company_lead_multiplier_bps;
  const advisorCommissionFils = Math.round((baseComm * multBps) / 10_000);

  return { advisorCommissionFils, progressionBonusFils: plan.progression_bonus_fils };
}

export function recordDealDisbursal(
  db: DatabaseSync,
  actor: UserRecord,
  input: {
    dealId: number;
    disbursedLoanFils: number;
    disbursedDate: string;
    fixedExpiryDate: string;
  },
) {
  const deal = db.prepare('SELECT * FROM deals WHERE id = ?').get(input.dealId) as Record<string, unknown> | undefined;
  if (!deal) throw new Error(`Deal ${input.dealId} not found`);

  const gate = checkBankSubmissionGate(db, input.dealId);
  if (!gate.allowed) {
    const reasons = [
      ...(gate.missingKfsApplicants.length > 0 ? [`Missing KFS: ${gate.missingKfsApplicants.join(', ')}`] : []),
      ...(gate.cddBlocker ? [gate.cddBlocker] : []),
    ];
    throw new Error(`Disbursal blocked — KFS & CDD compliance gate not satisfied (${reasons.join(' | ')})`);
  }

  const existingSettlement = db.prepare('SELECT id FROM commission_settlements WHERE deal_id = ?').get(input.dealId);
  if (existingSettlement) {
    throw new Error(`Deal ${input.dealId} has already been disbursed`);
  }

  const bankId = Number(deal.selected_bank_id || 1);
  const bank = db.prepare('SELECT * FROM banks WHERE id = ?').get(bankId) as Record<string, unknown>;
  const company = db.prepare('SELECT house_clawback_provision_bps FROM company_settings WHERE id = 1').get() as {
    house_clawback_provision_bps: number;
  };

  const monthPrefix = input.disbursedDate.slice(0, 7);
  const priorMonthVol = (
    db
      .prepare(
        `SELECT COALESCE(SUM(disbursed_loan_fils), 0) as vol
         FROM deals WHERE selected_bank_id = ? AND disbursed_at LIKE ? AND id != ?`,
      )
      .get(bankId, `${monthPrefix}%`, input.dealId) as { vol: number }
  ).vol;
  const cumulativeBankVol = priorMonthVol + input.disbursedLoanFils;

  const grid = db
    .prepare(
      `SELECT * FROM bank_subvention_grids
       WHERE bank_id = ? AND monthly_volume_min_fils <= ?
         AND (monthly_volume_max_fils IS NULL OR monthly_volume_max_fils > ?)
       ORDER BY monthly_volume_min_fils DESC LIMIT 1`,
    )
    .get(bankId, cumulativeBankVol, cumulativeBankVol) as
    | { commission_bps: number; max_payout_cap_fils: number | null; vat_mode: string }
    | undefined;

  const commBps = grid?.commission_bps ?? 75;
  const vatMode = grid?.vat_mode ?? 'EXCLUSIVE_5PCT';
  let rawSubventionFils = Math.round((input.disbursedLoanFils * commBps) / 10_000);
  if (grid?.max_payout_cap_fils && rawSubventionFils > grid.max_payout_cap_fils) {
    rawSubventionFils = grid.max_payout_cap_fils;
  }

  const expectedSubventionExVatFils =
    vatMode === 'INCLUSIVE_5PCT' ? Math.round((rawSubventionFils * 100) / 105) : rawSubventionFils;
  const expectedOutputVatFils =
    vatMode === 'EXCLUSIVE_5PCT'
      ? Math.round(expectedSubventionExVatFils * 0.05)
      : vatMode === 'INCLUSIVE_5PCT'
        ? rawSubventionFils - expectedSubventionExVatFils
        : 0;

  const directClientFeeExVatFils = Number(deal.direct_client_fee_fils || 0);
  const directClientOutputVatFils = Math.round(directClientFeeExVatFils * 0.05);

  const houseClawbackProvisionFils = Math.round(
    (expectedSubventionExVatFils * company.house_clawback_provision_bps) / 10_000,
  );
  const recognizedImmediateSubventionRevFils = expectedSubventionExVatFils - houseClawbackProvisionFils;

  // Partner Agency Split — STRICTLY on Bank Subvention (NEVER on Direct Client Fee!)
  let partnerAgencyId: number | null = null;
  let partnerSplitBps = 0;
  let partnerEntitledExVatFils = 0;
  let partnerPayoutStatus = 'NOT_APPLICABLE';

  if (deal.partner_agent_id) {
    const partnerRow = db
      .prepare(
        `SELECT pa.split_override_bps, ag.id as agency_id, ag.default_split_bps
         FROM partner_agents pa JOIN partner_agencies ag ON ag.id = pa.agency_id
         WHERE pa.id = ?`,
      )
      .get(Number(deal.partner_agent_id)) as
      | { split_override_bps: number | null; agency_id: number; default_split_bps: number }
      | undefined;
    if (partnerRow) {
      partnerAgencyId = partnerRow.agency_id;
      partnerSplitBps = partnerRow.split_override_bps ?? partnerRow.default_split_bps;
      partnerEntitledExVatFils = Math.round((expectedSubventionExVatFils * partnerSplitBps) / 10_000);
      partnerPayoutStatus = 'AWAITING_BANK_CASH';
    }
  }

  const houseNetPoolFils = expectedSubventionExVatFils - partnerEntitledExVatFils + directClientFeeExVatFils;
  const advisorId = deal.advisor_id ? Number(deal.advisor_id) : null;
  const { advisorCommissionFils, progressionBonusFils } = computeAdvisorProgressiveCommissionFils(
    db,
    advisorId,
    houseNetPoolFils,
    String(deal.lead_source_category || 'COMPANY_OR_PARTNER'),
  );

  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(
      `UPDATE deals SET stage = 'TRANSFERRED_DISBURSED', disbursed_loan_fils = ?, disbursed_at = ? WHERE id = ?`,
    ).run(input.disbursedLoanFils, input.disbursedDate, input.dealId);

    const setRes = db
      .prepare(
        `INSERT INTO commission_settlements (
          deal_id, bank_id, disbursed_loan_fils, vat_mode,
          expected_subvention_ex_vat_fils, expected_output_vat_fils,
          direct_client_fee_ex_vat_fils, direct_client_output_vat_fils,
          reconciliation_status, partner_agency_id, partner_split_bps,
          partner_entitled_ex_vat_fils, partner_payout_status,
          house_clawback_provision_fils, advisor_id, advisor_entitled_fils, progression_bonus_fils
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'AWAITING_BANK_CASH', ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.dealId,
        bankId,
        input.disbursedLoanFils,
        vatMode,
        expectedSubventionExVatFils,
        expectedOutputVatFils,
        directClientFeeExVatFils,
        directClientOutputVatFils,
        partnerAgencyId,
        partnerSplitBps,
        partnerEntitledExVatFils,
        partnerPayoutStatus,
        houseClawbackProvisionFils,
        advisorId,
        advisorCommissionFils,
        progressionBonusFils,
      );
    const settlementId = Number(setRes.lastInsertRowid);

    const clawbackMonths = Number(bank.clawback_window_months || 24);
    const dt = new Date(input.disbursedDate + 'T00:00:00Z');
    dt.setUTCMonth(dt.getUTCMonth() + clawbackMonths);
    const protectedUntil = dt.toISOString().slice(0, 10);

    db.prepare(
      `INSERT INTO clawback_ledger (settlement_id, deal_id, bank_id, protected_until_date, house_provision_fils)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(settlementId, input.dealId, bankId, protectedUntil, houseClawbackProvisionFils);

    const rc = deal.selected_rate_card_id
      ? (db.prepare('SELECT * FROM bank_rate_cards WHERE id = ?').get(Number(deal.selected_rate_card_id)) as Record<string, number>)
      : null;
    db.prepare(
      `INSERT OR REPLACE INTO homeowner_radar_monitors (
        deal_id, household_id, lender_bank_id, disbursed_loan_fils,
        current_rate_bps, fixed_expiry_date, revert_margin_bps, floor_rate_bps
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      input.dealId,
      Number(deal.household_id),
      bankId,
      input.disbursedLoanFils,
      rc?.intro_rate_bps ?? 399,
      input.fixedExpiryDate,
      rc?.revert_margin_bps ?? 150,
      rc?.floor_rate_bps ?? 299,
    );

    const totalSubvRec = expectedSubventionExVatFils + expectedOutputVatFils;
    const totalClientRec = directClientFeeExVatFils + directClientOutputVatFils;
    const totalOutputVat = expectedOutputVatFils + directClientOutputVatFils;

    postJournalEntry(db, actor, {
      entryDate: input.disbursedDate,
      memo: `Disbursal revenue & IFRS-15 clawback provision (${deal.deal_ref})`,
      sourceModule: 'COMMISSION_DISBURSAL',
      sourceId: String(settlementId),
      lines: [
        { accountCode: '1200', debitFils: totalSubvRec, creditFils: 0, lineMemo: 'Bank Subvention Receivable' },
        ...(totalClientRec > 0
          ? [{ accountCode: '1210', debitFils: totalClientRec, creditFils: 0, lineMemo: 'Direct Client Advisory Receivable' }]
          : []),
        { accountCode: '4100', debitFils: 0, creditFils: recognizedImmediateSubventionRevFils, lineMemo: 'Net Immediate Subvention Revenue' },
        ...(houseClawbackProvisionFils > 0
          ? [{ accountCode: '2200', debitFils: 0, creditFils: houseClawbackProvisionFils, lineMemo: 'House IFRS-15 Clawback Reserve' }]
          : []),
        ...(directClientFeeExVatFils > 0
          ? [{ accountCode: '4200', debitFils: 0, creditFils: directClientFeeExVatFils, lineMemo: 'Direct Client Advisory Fee' }]
          : []),
        ...(totalOutputVat > 0
          ? [{ accountCode: '2300', debitFils: 0, creditFils: totalOutputVat, lineMemo: 'FTA Output VAT (5%)' }]
          : []),
      ],
    });

    db.exec('COMMIT');
    return db.prepare('SELECT * FROM commission_settlements WHERE id = ?').get(settlementId) as Record<string, number | string>;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export function recordBankBordereauReceipt(
  db: DatabaseSync,
  actor: UserRecord,
  input: {
    dealId: number;
    receivedSubventionExVatFils: number;
    receivedClientFeeExVatFils?: number;
    receivedDate: string;
    batchRef: string;
  },
) {
  const cs = db.prepare('SELECT * FROM commission_settlements WHERE deal_id = ?').get(input.dealId) as Record<string, unknown> | undefined;
  if (!cs) throw new Error(`No commission settlement found for deal ${input.dealId}`);

  if (cs.reconciliation_status === 'RECONCILED' || cs.reconciliation_status === 'CLAWED_BACK') {
    throw new Error(`Deal #${input.dealId} settlement is already ${cs.reconciliation_status}`);
  }

  const expSubv = Number(cs.expected_subvention_ex_vat_fils);
  const prevSubv = Number(cs.received_subvention_ex_vat_fils);
  const openSubv = expSubv - prevSubv;
  if (input.receivedSubventionExVatFils < 0 || input.receivedSubventionExVatFils > openSubv) {
    throw new Error(
      `Bordereau receipt (${input.receivedSubventionExVatFils} fils) exceeds open subvention receivable (${openSubv} fils)`,
    );
  }

  const expClient = Number(cs.direct_client_fee_ex_vat_fils);
  const prevClient = Number(cs.received_client_fee_ex_vat_fils);
  const clientFeeIn = input.receivedClientFeeExVatFils ?? 0;
  if (clientFeeIn < 0 || clientFeeIn > expClient - prevClient) {
    throw new Error('Client fee receipt exceeds open client advisory receivable');
  }

  const newSubvRec = prevSubv + input.receivedSubventionExVatFils;
  const newClientRec = prevClient + clientFeeIn;

  // Exact proportional VAT clearance so GL 1200 & GL 1210 clear to exact 0 fils across INCLUSIVE_5PCT, EXCLUSIVE_5PCT, and odd tranches
  const expOutVat = Number(cs.expected_output_vat_fils);
  const priorSubvVatCleared = expSubv > 0 ? Math.round((prevSubv / expSubv) * expOutVat) : 0;
  const newSubvVatCleared = newSubvRec >= expSubv ? expOutVat : expSubv > 0 ? Math.round((newSubvRec / expSubv) * expOutVat) : 0;
  const subvVatCash = newSubvVatCleared - priorSubvVatCleared;

  const expClientVat = Number(cs.direct_client_output_vat_fils);
  const priorClientVatCleared = expClient > 0 ? Math.round((prevClient / expClient) * expClientVat) : 0;
  const newClientVatCleared =
    newClientRec >= expClient ? expClientVat : expClient > 0 ? Math.round((newClientRec / expClient) * expClientVat) : 0;
  const clientVatCash = newClientVatCleared - priorClientVatCleared;

  const subvRatio = expSubv > 0 ? newSubvRec / expSubv : 1;
  const totalExpectedPool = expSubv + expClient;
  const totalReceivedPool = newSubvRec + newClientRec;
  const advisorPoolRatio = totalExpectedPool > 0 ? totalReceivedPool / totalExpectedPool : 1;

  const targetPartnerReleased = Math.round(Number(cs.partner_entitled_ex_vat_fils) * subvRatio);
  const incrementalPartnerRelease = Math.max(0, targetPartnerReleased - Number(cs.partner_released_ex_vat_fils));

  const targetAdvisorReleased = Math.round(Number(cs.advisor_entitled_fils) * advisorPoolRatio);
  const incrementalAdvisorRelease = Math.max(0, targetAdvisorReleased - Number(cs.advisor_released_fils));

  const isFullyReconciled = newSubvRec >= expSubv && newClientRec >= expClient;
  const recStatus = isFullyReconciled ? 'RECONCILED' : 'PARTIAL_RECEIVED';

  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(
      `INSERT OR IGNORE INTO bank_bordereau_batches (batch_ref, bank_id, received_date, total_cash_received_fils, created_by)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(input.batchRef, Number(cs.bank_id), input.receivedDate, input.receivedSubventionExVatFils, actor.id);

    const totalCashIn = input.receivedSubventionExVatFils + subvVatCash + clientFeeIn + clientVatCash;
    if (totalCashIn > 0) {
      postJournalEntry(db, actor, {
        entryDate: input.receivedDate,
        memo: `Bordereau cash receipt ${input.batchRef} (Deal #${input.dealId})`,
        sourceModule: 'BORDEREAU_CASH',
        sourceId: `${input.batchRef}:${input.dealId}`,
        lines: [
          { accountCode: '1100', debitFils: totalCashIn, creditFils: 0, lineMemo: 'Cash received at UAE Bank' },
          ...(input.receivedSubventionExVatFils + subvVatCash > 0
            ? [{ accountCode: '1200', debitFils: 0, creditFils: input.receivedSubventionExVatFils + subvVatCash, lineMemo: 'Clear Subvention Receivable' }]
            : []),
          ...(clientFeeIn + clientVatCash > 0
            ? [{ accountCode: '1210', debitFils: 0, creditFils: clientFeeIn + clientVatCash, lineMemo: 'Clear Client Fee Receivable' }]
            : []),
        ],
      });
    }

    let partnerPayoutStatus = String(cs.partner_payout_status);
    let partnerOffsetThisTranche = 0;
    let partnerVatThisTranche = 0;
    let heldExVatDelta = 0;
    let heldVatDelta = 0;

    if (cs.partner_agency_id && incrementalPartnerRelease > 0) {
      const agency = db.prepare('SELECT * FROM partner_agencies WHERE id = ?').get(Number(cs.partner_agency_id)) as Record<string, unknown>;
      const hasTrn = String(agency.vat_trn_15 || '').length === 15;
      const isExemptDeal = cs.vat_mode === 'EXEMPT';

      const existingDebit = Number(agency.clawback_debit_balance_fils || 0);
      partnerOffsetThisTranche = Math.min(existingDebit, incrementalPartnerRelease);
      const netPartnerPayableExVat = incrementalPartnerRelease - partnerOffsetThisTranche;

      // Compute 5% Input VAT strictly on netPartnerPayableExVat so GL 2100/2310 and SELF_BILLED_PARTNER invoice always match to the fil!
      partnerVatThisTranche = hasTrn && netPartnerPayableExVat > 0 ? Math.round(netPartnerPayableExVat * 0.05) : 0;

      if (partnerOffsetThisTranche > 0) {
        db.prepare('UPDATE partner_agencies SET clawback_debit_balance_fils = clawback_debit_balance_fils - ? WHERE id = ?').run(
          partnerOffsetThisTranche,
          Number(cs.partner_agency_id),
        );
      }

      const isVerifiedAndSigned =
        agency.verification_status === 'VERIFIED' && agency.agreement_status === 'SIGNED';
      partnerPayoutStatus = isVerifiedAndSigned ? 'PAYABLE_READY' : 'ONBOARDING_HOLD';
      const liabilityAcc = isVerifiedAndSigned ? '2100' : '2110';

      if (!isVerifiedAndSigned) {
        heldExVatDelta = netPartnerPayableExVat;
        heldVatDelta = partnerVatThisTranche;
      }

      postJournalEntry(db, actor, {
        entryDate: input.receivedDate,
        memo: `Pay-when-paid B2B Partner Split release (Deal #${input.dealId})`,
        sourceModule: 'PARTNER_WATERFALL',
        sourceId: `${input.batchRef}:${input.dealId}`,
        lines: [
          {
            accountCode: '5100',
            debitFils: incrementalPartnerRelease + (isExemptDeal ? partnerVatThisTranche : 0),
            creditFils: 0,
            lineMemo: String(agency.company_name),
          },
          ...(!isExemptDeal && partnerVatThisTranche > 0
            ? [{ accountCode: '2310', debitFils: partnerVatThisTranche, creditFils: 0, lineMemo: 'Recoverable Partner Input VAT' }]
            : []),
          ...(partnerOffsetThisTranche > 0
            ? [{ accountCode: '1300', debitFils: 0, creditFils: partnerOffsetThisTranche, lineMemo: 'Partner Clawback Debit Offset' }]
            : []),
          ...(netPartnerPayableExVat + partnerVatThisTranche > 0
            ? [{ accountCode: liabilityAcc, debitFils: 0, creditFils: netPartnerPayableExVat + partnerVatThisTranche, lineMemo: 'Net Partner Payable' }]
            : []),
        ],
      });

      if (isVerifiedAndSigned && netPartnerPayableExVat > 0) {
        createPintAeTaxInvoice(db, actor, {
          invoiceType: 'SELF_BILLED_PARTNER',
          dealId: input.dealId,
          counterpartyName: String(agency.company_name),
          counterpartyTrn15: String(agency.vat_trn_15 || ''),
          issueDate: input.receivedDate,
          supplyDate: input.receivedDate,
          subtotalFils: netPartnerPayableExVat,
          vatRateBps: hasTrn ? 500 : 0,
          skipGlPosting: true,
          description: `Self-billed RERA Introducer Split (Deal #${input.dealId})`,
        });
      }
    }

    let advisorOffsetThisTranche = 0;
    if (cs.advisor_id && incrementalAdvisorRelease > 0) {
      const emp = db
        .prepare('SELECT id, clawback_debit_balance_fils FROM employees WHERE user_id = ?')
        .get(Number(cs.advisor_id)) as { id: number; clawback_debit_balance_fils: number } | undefined;

      if (emp && emp.clawback_debit_balance_fils > 0) {
        advisorOffsetThisTranche = Math.min(emp.clawback_debit_balance_fils, incrementalAdvisorRelease);
        db.prepare('UPDATE employees SET clawback_debit_balance_fils = clawback_debit_balance_fils - ? WHERE id = ?').run(
          advisorOffsetThisTranche,
          emp.id,
        );
      }

      const netAdvisorPayable = incrementalAdvisorRelease - advisorOffsetThisTranche;
      postJournalEntry(db, actor, {
        entryDate: input.receivedDate,
        memo: `Pay-when-paid Advisor Commission release (Deal #${input.dealId})`,
        sourceModule: 'ADVISOR_WATERFALL',
        sourceId: `${input.batchRef}:${input.dealId}`,
        lines: [
          { accountCode: '5200', debitFils: incrementalAdvisorRelease, creditFils: 0, lineMemo: 'Advisor Commission Expense' },
          ...(advisorOffsetThisTranche > 0
            ? [{ accountCode: '1310', debitFils: 0, creditFils: advisorOffsetThisTranche, lineMemo: 'Advisor Clawback Debit Offset' }]
            : []),
          ...(netAdvisorPayable > 0
            ? [{ accountCode: '2150', debitFils: 0, creditFils: netAdvisorPayable, lineMemo: 'Queued for WPS Payroll' }]
            : []),
        ],
      });
    }

    db.prepare(
      `UPDATE commission_settlements
       SET received_subvention_ex_vat_fils = ?,
           received_client_fee_ex_vat_fils = ?,
           reconciliation_status = ?,
           partner_released_ex_vat_fils = ?,
           partner_input_vat_fils = partner_input_vat_fils + ?,
           partner_held_ex_vat_fils = partner_held_ex_vat_fils + ?,
           partner_held_vat_fils = partner_held_vat_fils + ?,
           partner_clawback_offset_applied_fils = partner_clawback_offset_applied_fils + ?,
           partner_payout_status = ?,
           advisor_released_fils = ?,
           advisor_clawback_offset_applied_fils = advisor_clawback_offset_applied_fils + ?
       WHERE deal_id = ?`,
    ).run(
      newSubvRec,
      newClientRec,
      recStatus,
      targetPartnerReleased,
      partnerVatThisTranche,
      heldExVatDelta,
      heldVatDelta,
      partnerOffsetThisTranche,
      partnerPayoutStatus,
      targetAdvisorReleased,
      advisorOffsetThisTranche,
      input.dealId,
    );

    db.exec('COMMIT');
    return db.prepare('SELECT * FROM commission_settlements WHERE deal_id = ?').get(input.dealId) as Record<string, number | string>;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export function triggerBankClawback(
  db: DatabaseSync,
  actor: UserRecord,
  input: {
    dealId: number;
    clawbackClaimExVatFils: number;
    triggeredDate: string;
  },
) {
  const cs = db.prepare('SELECT * FROM commission_settlements WHERE deal_id = ?').get(input.dealId) as Record<string, unknown> | undefined;
  const cbRow = db.prepare('SELECT * FROM clawback_ledger WHERE deal_id = ?').get(input.dealId) as Record<string, unknown> | undefined;
  if (!cs || !cbRow) throw new Error(`No clawback record found for deal ${input.dealId}`);
  if (cbRow.status !== 'ACTIVE_HOLD') {
    throw new Error(`Clawback record for deal ${input.dealId} is not in ACTIVE_HOLD status (current: ${cbRow.status})`);
  }
  if (input.clawbackClaimExVatFils <= 0) {
    throw new Error('Clawback claim must be positive');
  }

  const claimRatio =
    Number(cs.expected_subvention_ex_vat_fils) > 0
      ? Math.min(1, input.clawbackClaimExVatFils / Number(cs.expected_subvention_ex_vat_fils))
      : 1;

  const partnerRecovery = Math.round(Number(cs.partner_released_ex_vat_fils) * claimRatio);
  const advisorRecovery = Math.round(Number(cs.advisor_released_fils) * claimRatio);
  const provisionAbsorbed = Math.min(Number(cbRow.house_provision_fils), input.clawbackClaimExVatFils);
  const residualRevenueHit = Math.max(0, input.clawbackClaimExVatFils - provisionAbsorbed);

  // Split bank credit between cash refund (GL 1100) for already-received cash and open receivable write-down (GL 1200)
  const receivedCashCap = Number(cs.received_subvention_ex_vat_fils);
  const cashRefundFils =
    Number(cs.expected_subvention_ex_vat_fils) === 0
      ? input.clawbackClaimExVatFils
      : Math.min(receivedCashCap, input.clawbackClaimExVatFils);
  const receivableWriteDownFils = input.clawbackClaimExVatFils - cashRefundFils;

  db.exec('BEGIN IMMEDIATE');
  try {
    if (cs.partner_agency_id && partnerRecovery > 0) {
      db.prepare('UPDATE partner_agencies SET clawback_debit_balance_fils = clawback_debit_balance_fils + ? WHERE id = ?').run(
        partnerRecovery,
        Number(cs.partner_agency_id),
      );
    }
    if (cs.advisor_id && advisorRecovery > 0) {
      db.prepare('UPDATE employees SET clawback_debit_balance_fils = clawback_debit_balance_fils + ? WHERE user_id = ?').run(
        advisorRecovery,
        Number(cs.advisor_id),
      );
    }

    postJournalEntry(db, actor, {
      entryDate: input.triggeredDate,
      memo: `Early bank clawback triggered & next-deal recovery booked (Deal #${input.dealId})`,
      sourceModule: 'CLAWBACK',
      sourceId: String(cbRow.id),
      lines: [
        ...(provisionAbsorbed > 0 ? [{ accountCode: '2200', debitFils: provisionAbsorbed, creditFils: 0, lineMemo: 'Utilize House Clawback Provision' }] : []),
        ...(residualRevenueHit > 0 ? [{ accountCode: '4100', debitFils: residualRevenueHit, creditFils: 0, lineMemo: 'Clawback Revenue Reversal' }] : []),
        ...(cashRefundFils > 0 ? [{ accountCode: '1100', debitFils: 0, creditFils: cashRefundFils, lineMemo: 'Bank Clawback Deduction' }] : []),
        ...(receivableWriteDownFils > 0 ? [{ accountCode: '1200', debitFils: 0, creditFils: receivableWriteDownFils, lineMemo: 'Cancel Unpaid Subvention Receivable' }] : []),
        ...(partnerRecovery > 0
          ? [
              { accountCode: '1300', debitFils: partnerRecovery, creditFils: 0, lineMemo: 'Partner Clawback Debit Receivable' },
              { accountCode: '5100', debitFils: 0, creditFils: partnerRecovery, lineMemo: 'Reverse Partner Commission Expense' },
            ]
          : []),
        ...(advisorRecovery > 0
          ? [
              { accountCode: '1310', debitFils: advisorRecovery, creditFils: 0, lineMemo: 'Advisor Clawback Debit Receivable' },
              { accountCode: '5200', debitFils: 0, creditFils: advisorRecovery, lineMemo: 'Reverse Advisor Commission Expense' },
            ]
          : []),
      ],
    });

    db.prepare(`UPDATE commission_settlements SET reconciliation_status = 'CLAWED_BACK' WHERE deal_id = ?`).run(input.dealId);
    db.prepare(
      `UPDATE clawback_ledger
       SET status = 'CLAWBACK_TRIGGERED', clawback_claim_ex_vat_fils = ?,
           partner_debit_booked_fils = ?, advisor_debit_booked_fils = ?, triggered_at = ?
       WHERE id = ?`,
    ).run(input.clawbackClaimExVatFils, partnerRecovery, advisorRecovery, input.triggeredDate, Number(cbRow.id));

    writeAuditLog(db, actor, 'clawback_ledger', Number(cbRow.id), 'TRIGGER_CLAWBACK', cbRow, {
      partnerRecovery,
      advisorRecovery,
    });

    db.exec('COMMIT');
    return db.prepare('SELECT * FROM clawback_ledger WHERE id = ?').get(Number(cbRow.id)) as {
      id: number;
      partner_debit_booked_fils: number;
      advisor_debit_booked_fils: number;
      status: string;
    };
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export function releaseExpiredClawbacks(db: DatabaseSync, actor: UserRecord, asOfDate: string) {
  const matured = db
    .prepare(`SELECT * FROM clawback_ledger WHERE status = 'ACTIVE_HOLD' AND protected_until_date <= ?`)
    .all(asOfDate) as Record<string, unknown>[];

  db.exec('BEGIN IMMEDIATE');
  try {
    for (const row of matured) {
      const prov = Number(row.house_provision_fils);
      if (prov > 0) {
        postJournalEntry(db, actor, {
          entryDate: asOfDate,
          memo: `Release matured IFRS-15 House Clawback Reserve (Deal #${row.deal_id})`,
          sourceModule: 'CLAWBACK_RELEASE',
          sourceId: String(row.id),
          lines: [
            { accountCode: '2200', debitFils: prov, creditFils: 0, lineMemo: 'Release Matured Clawback Reserve' },
            { accountCode: '4100', debitFils: 0, creditFils: prov, lineMemo: 'Recognize Deferred Subvention Income' },
          ],
        });
      }
      db.prepare(`UPDATE clawback_ledger SET status = 'RELEASED_TO_INCOME' WHERE id = ?`).run(Number(row.id));
    }
    db.exec('COMMIT');
    return { releasedCount: matured.length };
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
