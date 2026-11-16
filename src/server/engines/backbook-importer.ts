import type { DatabaseSync } from 'node:sqlite';
import { writeAuditLog, type UserRecord } from '@/server/auth';

/**
 * Imports historical closed mortgages (`origin_mode = 'LEGACY_BACKBOOK'`) straight into
 * `homeowner_radar_monitors` and `clawback_ledger` WITHOUT creating current-period GL revenue or VAT entries.
 */
export function importLegacyBackbookCsv(db: DatabaseSync, actor: UserRecord, csvContent: string) {
  const lines = csvContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return { importedCount: 0, dealRefs: [] as string[] };

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const idx = (col: string) => headers.indexOf(col);

  const importedRefs: string[] = [];
  db.exec('BEGIN IMMEDIATE');
  try {
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map((c) => c.trim());
      const dealRef = cols[idx('deal_ref')];
      const clientName = cols[idx('client_name')];
      const phone = cols[idx('phone')] || '';
      const community = cols[idx('community')] || 'Dubai';
      const bankKey = cols[idx('bank_key')] || 'emirates-nbd';
      const loanAed = Number(cols[idx('loan_aed')] || 0);
      const ratePct = Number(cols[idx('rate_pct')] || 3.99);
      const disbursedDate = cols[idx('disbursed_date')] || '2025-01-01';
      const fixedExpiryDate = cols[idx('fixed_expiry_date')] || '2027-01-01';
      const revertMarginPct = Number(cols[idx('revert_margin_pct')] || 1.5);
      const floorPct = Number(cols[idx('floor_pct')] || 2.99);

      if (!dealRef || !clientName || loanAed <= 0) continue;

      const bank = (db.prepare('SELECT id, clawback_window_months FROM banks WHERE bank_key = ?').get(bankKey) ??
        db.prepare('SELECT id, clawback_window_months FROM banks LIMIT 1').get()) as {
        id: number;
        clawback_window_months: number;
      };

      const loanFils = Math.round(loanAed * 100);
      const hhId = Number(
        db.prepare("INSERT INTO households (primary_name, segment) VALUES (?, 'RESIDENT_SALARIED')").run(clientName).lastInsertRowid,
      );
      db.prepare(
        `INSERT INTO applicants (household_id, applicant_role, full_name_en, phone)
         VALUES (?, 'PRIMARY', ?, ?)`,
      ).run(hhId, clientName, phone);

      const dealId = Number(
        db
          .prepare(
            `INSERT INTO deals (
              deal_ref, origin_mode, household_id, community_name, purchase_price_fils,
              estimated_valuation_fils, target_loan_fils, stage, cdd_status,
              selected_bank_id, disbursed_loan_fils, disbursed_at
            ) VALUES (
              ?, 'LEGACY_BACKBOOK', ?, ?, ?, ?, ?, 'TRANSFERRED_DISBURSED', 'CLEARED', ?, ?, ?
            )`,
          )
          .run(dealRef, hhId, community, Math.round(loanFils / 0.8), Math.round(loanFils / 0.8), loanFils, bank.id, loanFils, disbursedDate)
          .lastInsertRowid,
      );

      db.prepare(
        `INSERT INTO homeowner_radar_monitors (
          deal_id, household_id, lender_bank_id, disbursed_loan_fils,
          current_rate_bps, fixed_expiry_date, revert_margin_bps, floor_rate_bps
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        dealId,
        hhId,
        bank.id,
        loanFils,
        Math.round(ratePct * 100),
        fixedExpiryDate,
        Math.round(revertMarginPct * 100),
        Math.round(floorPct * 100),
      );

      const csId = Number(
        db
          .prepare(
            `INSERT INTO commission_settlements (
              deal_id, bank_id, disbursed_loan_fils, vat_mode,
              expected_subvention_ex_vat_fils, reconciliation_status
            ) VALUES (?, ?, ?, 'EXCLUSIVE_5PCT', 0, 'RECONCILED')`,
          )
          .run(dealId, bank.id, loanFils).lastInsertRowid,
      );

      const dt = new Date(disbursedDate + 'T00:00:00Z');
      dt.setUTCMonth(dt.getUTCMonth() + bank.clawback_window_months);
      db.prepare(
        `INSERT INTO clawback_ledger (settlement_id, deal_id, bank_id, protected_until_date, house_provision_fils)
         VALUES (?, ?, ?, ?, 0)`,
      ).run(csId, dealId, bank.id, dt.toISOString().slice(0, 10));

      importedRefs.push(dealRef);
    }
    writeAuditLog(db, actor, 'deals', 'LEGACY_BATCH', 'IMPORT_LEGACY_BACKBOOK', null, { importedRefs });
    db.exec('COMMIT');
    return { importedCount: importedRefs.length, dealRefs: importedRefs };
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
