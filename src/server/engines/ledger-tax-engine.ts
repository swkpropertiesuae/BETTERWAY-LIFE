import type { DatabaseSync } from 'node:sqlite';
import { writeAuditLog, type UserRecord } from '@/server/auth';

const xmlEsc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

const cleanPeppolId = (raw: string) => (raw ? raw.replace(/^0235:/, '') : '000000000000000');

export type JournalLineInput = {
  accountCode: string;
  debitFils: number;
  creditFils: number;
  lineMemo?: string;
};

export function postJournalEntry(
  db: DatabaseSync,
  actor: Pick<UserRecord, 'id' | 'role'> | null,
  input: {
    entryDate: string;
    memo: string;
    sourceModule: string;
    sourceId: string;
    lines: JournalLineInput[];
  },
): number {
  if (input.lines.length < 2) {
    throw new Error('Double-entry journal requires at least 2 lines');
  }
  let totalDebit = 0;
  let totalCredit = 0;
  for (const l of input.lines) {
    if (!Number.isInteger(l.debitFils) || !Number.isInteger(l.creditFils) || l.debitFils < 0 || l.creditFils < 0) {
      throw new Error('Journal amounts must be non-negative integer fils');
    }
    totalDebit += l.debitFils;
    totalCredit += l.creditFils;
  }
  if (totalDebit === 0 || totalDebit !== totalCredit) {
    throw new Error(`Unbalanced double-entry journal: debit=${totalDebit} fils vs credit=${totalCredit} fils`);
  }

  const nextNum = (db.prepare('SELECT COUNT(*) as c FROM gl_journal_entries').get() as { c: number }).c + 1;
  const entryRef = `JE-2026-${String(nextNum).padStart(4, '0')}`;

  const res = db
    .prepare(
      `INSERT INTO gl_journal_entries (entry_ref, entry_date, memo, source_module, source_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(entryRef, input.entryDate, input.memo, input.sourceModule, input.sourceId, actor?.id ?? null);

  const entryId = Number(res.lastInsertRowid);
  const insLine = db.prepare(
    `INSERT INTO gl_journal_lines (journal_entry_id, account_code, debit_fils, credit_fils, line_memo)
     VALUES (?, ?, ?, ?, ?)`,
  );
  for (const l of input.lines) {
    if (l.debitFils === 0 && l.creditFils === 0) continue;
    insLine.run(entryId, l.accountCode, l.debitFils, l.creditFils, l.lineMemo ?? '');
  }

  writeAuditLog(db, actor, 'gl_journal_entries', entryId, 'POST_JOURNAL', null, { entryRef, totalDebit });
  return entryId;
}

export function getTrialBalance(db: DatabaseSync) {
  return db
    .prepare(
      `SELECT a.code, a.name, a.account_type,
              COALESCE(SUM(l.debit_fils), 0) as total_debit_fils,
              COALESCE(SUM(l.credit_fils), 0) as total_credit_fils
       FROM gl_accounts a
       LEFT JOIN gl_journal_lines l ON l.account_code = a.code
       GROUP BY a.code, a.name, a.account_type
       ORDER BY a.code ASC`,
    )
    .all() as {
    code: string;
    name: string;
    account_type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
    total_debit_fils: number;
    total_credit_fils: number;
  }[];
}

export function generatePintAeXmlString(params: {
  invoiceNumber: string;
  invoiceTypeCode: '380' | '381';
  issueDate: string;
  supplyDate: string;
  sellerName: string;
  sellerTrn15: string;
  sellerPeppolId: string;
  sellerAddress: string;
  buyerName: string;
  buyerTrn15: string;
  buyerPeppolId: string;
  subtotalFils: number;
  vatRateBps: number;
  vatFils: number;
  totalFils: number;
  description: string;
}): string {
  const fmtAed = (fils: number) => (fils / 100).toFixed(2);
  const vatPct = (params.vatRateBps / 100).toFixed(2);
  const vatCat = params.vatRateBps > 0 ? 'S' : 'Z';
  const isCreditNote = params.invoiceTypeCode === '381';
  const rootTag = isCreditNote ? 'CreditNote' : 'Invoice';
  const rootNs = isCreditNote
    ? 'urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2'
    : 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2';
  const typeTag = isCreditNote ? 'CreditNoteTypeCode' : 'InvoiceTypeCode';
  const lineTag = isCreditNote ? 'CreditNoteLine' : 'InvoiceLine';
  const qtyTag = isCreditNote ? 'CreditedQuantity' : 'InvoicedQuantity';

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<${rootTag} xmlns="${rootNs}"`,
    '         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"',
    '         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">',
    '  <cbc:CustomizationID>urn:peppol:pint:billing-1@ae-1</cbc:CustomizationID>',
    '  <cbc:ProfileID>urn:peppol:bis:billing</cbc:ProfileID>',
    `  <cbc:ID>${xmlEsc(params.invoiceNumber)}</cbc:ID>`,
    `  <cbc:IssueDate>${xmlEsc(params.issueDate)}</cbc:IssueDate>`,
    `  <cbc:${typeTag}>${params.invoiceTypeCode}</cbc:${typeTag}>`,
    '  <cbc:DocumentCurrencyCode>AED</cbc:DocumentCurrencyCode>',
    '  <cbc:TaxCurrencyCode>AED</cbc:TaxCurrencyCode>',
    '  <cac:Delivery>',
    `    <cbc:ActualDeliveryDate>${xmlEsc(params.supplyDate)}</cbc:ActualDeliveryDate>`,
    '  </cac:Delivery>',
    '  <cac:AccountingSupplierParty>',
    '    <cac:Party>',
    `      <cbc:EndpointID schemeID="0235">${xmlEsc(cleanPeppolId(params.sellerPeppolId || params.sellerTrn15))}</cbc:EndpointID>`,
    '      <cac:PartyTaxScheme>',
    `        <cbc:CompanyID>${xmlEsc(params.sellerTrn15 || '000000000000000')}</cbc:CompanyID>`,
    '        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>',
    '      </cac:PartyTaxScheme>',
    '      <cac:PartyLegalEntity>',
    `        <cbc:RegistrationName>${xmlEsc(params.sellerName)}</cbc:RegistrationName>`,
    '      </cac:PartyLegalEntity>',
    '    </cac:Party>',
    '  </cac:AccountingSupplierParty>',
    '  <cac:AccountingCustomerParty>',
    '    <cac:Party>',
    `      <cbc:EndpointID schemeID="0235">${xmlEsc(cleanPeppolId(params.buyerPeppolId || params.buyerTrn15))}</cbc:EndpointID>`,
    '      <cac:PartyTaxScheme>',
    `        <cbc:CompanyID>${xmlEsc(params.buyerTrn15 || '000000000000000')}</cbc:CompanyID>`,
    '        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>',
    '      </cac:PartyTaxScheme>',
    '      <cac:PartyLegalEntity>',
    `        <cbc:RegistrationName>${xmlEsc(params.buyerName)}</cbc:RegistrationName>`,
    '      </cac:PartyLegalEntity>',
    '    </cac:Party>',
    '  </cac:AccountingCustomerParty>',
    '  <cac:TaxTotal>',
    `    <cbc:TaxAmount currencyID="AED">${fmtAed(params.vatFils)}</cbc:TaxAmount>`,
    '    <cac:TaxSubtotal>',
    `      <cbc:TaxableAmount currencyID="AED">${fmtAed(params.subtotalFils)}</cbc:TaxableAmount>`,
    `      <cbc:TaxAmount currencyID="AED">${fmtAed(params.vatFils)}</cbc:TaxAmount>`,
    '      <cac:TaxCategory>',
    `        <cbc:ID>${vatCat}</cbc:ID>`,
    `        <cbc:Percent>${vatPct}</cbc:Percent>`,
    '        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>',
    '      </cac:TaxCategory>',
    '    </cac:TaxSubtotal>',
    '  </cac:TaxTotal>',
    '  <cac:LegalMonetaryTotal>',
    `    <cbc:LineExtensionAmount currencyID="AED">${fmtAed(params.subtotalFils)}</cbc:LineExtensionAmount>`,
    `    <cbc:TaxExclusiveAmount currencyID="AED">${fmtAed(params.subtotalFils)}</cbc:TaxExclusiveAmount>`,
    `    <cbc:TaxInclusiveAmount currencyID="AED">${fmtAed(params.totalFils)}</cbc:TaxInclusiveAmount>`,
    `    <cbc:PayableAmount currencyID="AED">${fmtAed(params.totalFils)}</cbc:PayableAmount>`,
    '  </cac:LegalMonetaryTotal>',
    `  <cac:${lineTag}>`,
    '    <cbc:ID>1</cbc:ID>',
    `    <cbc:${qtyTag} unitCode="C62">1</cbc:${qtyTag}>`,
    `    <cbc:LineExtensionAmount currencyID="AED">${fmtAed(params.subtotalFils)}</cbc:LineExtensionAmount>`,
    '    <cac:Item>',
    `      <cbc:Name>${xmlEsc(params.description)}</cbc:Name>`,
    '      <cac:ClassifiedTaxCategory>',
    `        <cbc:ID>${vatCat}</cbc:ID>`,
    `        <cbc:Percent>${vatPct}</cbc:Percent>`,
    '        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>',
    '      </cac:ClassifiedTaxCategory>',
    '    </cac:Item>',
    '    <cac:Price>',
    `      <cbc:PriceAmount currencyID="AED">${fmtAed(params.subtotalFils)}</cbc:PriceAmount>`,
    '    </cac:Price>',
    `  </cac:${lineTag}>`,
    `</${rootTag}>`,
  ].join('\n');
}

export function createPintAeTaxInvoice(
  db: DatabaseSync,
  actor: Pick<UserRecord, 'id' | 'role'> | null,
  input: {
    invoiceType: 'TAX_INVOICE_380' | 'CREDIT_NOTE_381' | 'SELF_BILLED_PARTNER';
    dealId?: number | null;
    counterpartyName: string;
    counterpartyTrn15?: string;
    counterpartyPeppolId?: string;
    issueDate: string;
    supplyDate: string;
    subtotalFils: number;
    vatRateBps: number;
    revenueAccountCode?: string;
    receivableAccountCode?: string;
    skipGlPosting?: boolean;
    description: string;
  },
) {
  const company = db.prepare('SELECT * FROM company_settings WHERE id = 1').get() as Record<string, string>;
  const count = (db.prepare('SELECT COUNT(*) as c FROM tax_invoices').get() as { c: number }).c + 1;
  const prefix = input.invoiceType === 'CREDIT_NOTE_381' ? 'CN' : input.invoiceType === 'SELF_BILLED_PARTNER' ? 'SBP' : 'INV';
  const invoiceNumber = `BW-${prefix}-2026-${String(count).padStart(4, '0')}`;

  const vatFils = Math.round((input.subtotalFils * input.vatRateBps) / 10_000);
  const totalFils = input.subtotalFils + vatFils;

  const isSelfBilled = input.invoiceType === 'SELF_BILLED_PARTNER';
  const xml = generatePintAeXmlString({
    invoiceNumber,
    invoiceTypeCode: input.invoiceType === 'CREDIT_NOTE_381' ? '381' : '380',
    issueDate: input.issueDate,
    supplyDate: input.supplyDate,
    sellerName: isSelfBilled ? input.counterpartyName : company.legal_name,
    sellerTrn15: isSelfBilled ? input.counterpartyTrn15 || '' : company.vat_trn_15,
    sellerPeppolId: isSelfBilled ? input.counterpartyPeppolId || '' : company.peppol_endpoint_id,
    sellerAddress: company.office_address,
    buyerName: isSelfBilled ? company.legal_name : input.counterpartyName,
    buyerTrn15: isSelfBilled ? company.vat_trn_15 : input.counterpartyTrn15 || '',
    buyerPeppolId: isSelfBilled ? company.peppol_endpoint_id : input.counterpartyPeppolId || '',
    subtotalFils: input.subtotalFils,
    vatRateBps: input.vatRateBps,
    vatFils,
    totalFils,
    description: input.description,
  });

  // Avoid double-posting GL if this invoice documents an already-disbursed deal settlement
  const hasDealSettlement =
    input.dealId != null &&
    Boolean(db.prepare('SELECT id FROM commission_settlements WHERE deal_id = ?').get(input.dealId));
  const shouldPostGl = !input.skipGlPosting && !hasDealSettlement;

  let glEntryId: number | null = null;
  if (shouldPostGl && input.invoiceType === 'TAX_INVOICE_380') {
    const revAcc = input.revenueAccountCode || '4100';
    const recAcc = input.receivableAccountCode || '1200';
    glEntryId = postJournalEntry(db, actor, {
      entryDate: input.issueDate,
      memo: `${invoiceNumber} — ${input.description}`,
      sourceModule: 'TAX_INVOICE',
      sourceId: invoiceNumber,
      lines: [
        { accountCode: recAcc, debitFils: totalFils, creditFils: 0, lineMemo: input.counterpartyName },
        { accountCode: revAcc, debitFils: 0, creditFils: input.subtotalFils, lineMemo: input.description },
        ...(vatFils > 0 ? [{ accountCode: '2300', debitFils: 0, creditFils: vatFils, lineMemo: 'FTA 5% Output VAT' }] : []),
      ],
    });
  } else if (!input.skipGlPosting && input.invoiceType === 'CREDIT_NOTE_381') {
    const revAcc = input.revenueAccountCode || '4100';
    const recAcc = input.receivableAccountCode || '1200';
    glEntryId = postJournalEntry(db, actor, {
      entryDate: input.issueDate,
      memo: `${invoiceNumber} Credit Note — ${input.description}`,
      sourceModule: 'CREDIT_NOTE',
      sourceId: invoiceNumber,
      lines: [
        { accountCode: revAcc, debitFils: input.subtotalFils, creditFils: 0, lineMemo: input.description },
        ...(vatFils > 0 ? [{ accountCode: '2300', debitFils: vatFils, creditFils: 0, lineMemo: 'Reverse FTA Output VAT' }] : []),
        { accountCode: recAcc, debitFils: 0, creditFils: totalFils, lineMemo: input.counterpartyName },
      ],
    });
  }

  const res = db
    .prepare(
      `INSERT INTO tax_invoices (
        invoice_number, invoice_type, deal_id, counterparty_name, counterparty_trn_15,
        counterparty_peppol_id, issue_date, supply_date, subtotal_fils, vat_rate_bps,
        vat_fils, total_fils, pint_ae_xml, peppol_status, gl_entry_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'VALIDATED_XML', ?)`,
    )
    .run(
      invoiceNumber,
      input.invoiceType,
      input.dealId ?? null,
      input.counterpartyName,
      input.counterpartyTrn15 ?? '',
      input.counterpartyPeppolId ?? '',
      input.issueDate,
      input.supplyDate,
      input.subtotalFils,
      input.vatRateBps,
      vatFils,
      totalFils,
      xml,
      glEntryId,
    );

  return db.prepare('SELECT * FROM tax_invoices WHERE id = ?').get(Number(res.lastInsertRowid)) as {
    id: number;
    invoice_number: string;
    subtotal_fils: number;
    vat_fils: number;
    total_fils: number;
    pint_ae_xml: string;
  };
}

export function recordVendorBill(
  db: DatabaseSync,
  actor: Pick<UserRecord, 'id' | 'role'> | null,
  input: {
    vendorName: string;
    vendorTrn15?: string;
    billDate: string;
    expenseAccountCode: string;
    marketingChannel?: string;
    subtotalFils: number;
    inputVatFils: number;
    inputVatCategory: 'DIRECT_TAXABLE' | 'DIRECT_EXEMPT' | 'RESIDUAL_OVERHEAD';
    ctDeductibility: 'FULL_100' | 'ENTERTAINMENT_50' | 'NON_DEDUCTIBLE_0';
  },
) {
  const count = (db.prepare('SELECT COUNT(*) as c FROM vendor_bills').get() as { c: number }).c + 1;
  const billNumber = `BILL-2026-${String(count).padStart(4, '0')}`;
  const totalCashOutFils = input.subtotalFils + input.inputVatFils;

  const isExemptBlocked = input.inputVatCategory === 'DIRECT_EXEMPT';
  const glEntryId = postJournalEntry(db, actor, {
    entryDate: input.billDate,
    memo: `${billNumber} — ${input.vendorName}`,
    sourceModule: 'VENDOR_BILL',
    sourceId: billNumber,
    lines: [
      {
        accountCode: input.expenseAccountCode,
        debitFils: input.subtotalFils + (isExemptBlocked ? input.inputVatFils : 0),
        creditFils: 0,
        lineMemo: input.vendorName,
      },
      ...(!isExemptBlocked && input.inputVatFils > 0
        ? [{ accountCode: '2310', debitFils: input.inputVatFils, creditFils: 0, lineMemo: 'FTA Input VAT' }]
        : []),
      { accountCode: '1100', debitFils: 0, creditFils: totalCashOutFils, lineMemo: `Paid ${input.vendorName}` },
    ],
  });

  const res = db
    .prepare(
      `INSERT INTO vendor_bills (
        bill_number, vendor_name, vendor_trn_15, bill_date, expense_account_code,
        marketing_channel, subtotal_fils, input_vat_fils, input_vat_category, ct_deductibility, gl_entry_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      billNumber,
      input.vendorName,
      input.vendorTrn15 ?? '',
      input.billDate,
      input.expenseAccountCode,
      input.marketingChannel ?? null,
      input.subtotalFils,
      input.inputVatFils,
      input.inputVatCategory,
      input.ctDeductibility,
      glEntryId,
    );

  return Number(res.lastInsertRowid);
}

export function computeVat201Summary(db: DatabaseSync) {
  // Include standalone GL-posted tax invoices & credit notes (deal settlements are counted via commission_settlements below)
  const outInvoices = db
    .prepare(
      `SELECT invoice_type, subtotal_fils, vat_rate_bps, vat_fils
       FROM tax_invoices
       WHERE invoice_type IN ('TAX_INVOICE_380','CREDIT_NOTE_381') AND gl_entry_id IS NOT NULL`,
    )
    .all() as { invoice_type: string; subtotal_fils: number; vat_rate_bps: number; vat_fils: number }[];

  const settlements = db
    .prepare(
      `SELECT cs.expected_subvention_ex_vat_fils, cs.expected_output_vat_fils,
              cs.direct_client_fee_ex_vat_fils, cs.direct_client_output_vat_fils, cs.vat_mode,
              cs.partner_input_vat_fils
       FROM commission_settlements cs
       JOIN deals d ON d.id = cs.deal_id
       WHERE d.origin_mode = 'LIVE'`,
    )
    .all() as {
    expected_subvention_ex_vat_fils: number;
    expected_output_vat_fils: number;
    direct_client_fee_ex_vat_fils: number;
    direct_client_output_vat_fils: number;
    vat_mode: string;
    partner_input_vat_fils: number;
  }[];

  let standardRatedSuppliesFils = 0;
  let zeroRatedSuppliesFils = 0;
  let exemptSuppliesFils = 0;
  let outputVatFils = 0;

  for (const inv of outInvoices) {
    const sign = inv.invoice_type === 'CREDIT_NOTE_381' ? -1 : 1;
    if (inv.vat_rate_bps > 0) {
      standardRatedSuppliesFils += sign * inv.subtotal_fils;
      outputVatFils += sign * inv.vat_fils;
    } else {
      zeroRatedSuppliesFils += sign * inv.subtotal_fils;
    }
  }

  let partnerInputVatTaxableFils = 0;
  for (const s of settlements) {
    if (s.vat_mode === 'EXEMPT') {
      exemptSuppliesFils += s.expected_subvention_ex_vat_fils;
    } else if (s.vat_mode === 'ZERO_RATED') {
      zeroRatedSuppliesFils += s.expected_subvention_ex_vat_fils;
      partnerInputVatTaxableFils += s.partner_input_vat_fils;
    } else {
      standardRatedSuppliesFils += s.expected_subvention_ex_vat_fils;
      outputVatFils += s.expected_output_vat_fils;
      partnerInputVatTaxableFils += s.partner_input_vat_fils;
    }
    if (s.direct_client_fee_ex_vat_fils > 0) {
      standardRatedSuppliesFils += s.direct_client_fee_ex_vat_fils;
      outputVatFils += s.direct_client_output_vat_fils;
    }
  }

  const totalSupplies = Math.max(0, standardRatedSuppliesFils + zeroRatedSuppliesFils + exemptSuppliesFils);
  const taxableRatio =
    totalSupplies > 0 ? Math.max(0, standardRatedSuppliesFils + zeroRatedSuppliesFils) / totalSupplies : 1;

  const bills = db
    .prepare("SELECT input_vat_fils, input_vat_category FROM vendor_bills WHERE COALESCE(approval_status, 'APPROVED') = 'APPROVED'")
    .all() as {
    input_vat_fils: number;
    input_vat_category: string;
  }[];

  let directTaxableInputVat = partnerInputVatTaxableFils;
  let residualInputVat = 0;
  for (const b of bills) {
    if (b.input_vat_category === 'DIRECT_TAXABLE') directTaxableInputVat += b.input_vat_fils;
    else if (b.input_vat_category === 'RESIDUAL_OVERHEAD') residualInputVat += b.input_vat_fils;
  }

  const recoverableResidualVat = Math.round(residualInputVat * taxableRatio);
  const recoverableInputVatFils = directTaxableInputVat + recoverableResidualVat;
  const netVatPayableFils = outputVatFils - recoverableInputVatFils;

  return {
    standardRatedSuppliesFils,
    zeroRatedSuppliesFils,
    exemptSuppliesFils,
    taxableRecoveryRatioPct: +(taxableRatio * 100).toFixed(2),
    outputVatFils,
    recoverableInputVatFils,
    netVatPayableFils,
  };
}

export function computeCorporateTaxSummary(db: DatabaseSync) {
  const tb = getTrialBalance(db);
  let totalRevenueFils = 0;
  let totalExpenseFils = 0;

  for (const row of tb) {
    if (row.account_type === 'REVENUE') {
      totalRevenueFils += row.total_credit_fils - row.total_debit_fils;
    } else if (row.account_type === 'EXPENSE') {
      totalExpenseFils += row.total_debit_fils - row.total_credit_fils;
    }
  }

  const accountingNetProfitFils = totalRevenueFils - totalExpenseFils;

  const bills = db
    .prepare("SELECT subtotal_fils, ct_deductibility FROM vendor_bills WHERE COALESCE(approval_status, 'APPROVED') = 'APPROVED'")
    .all() as {
    subtotal_fils: number;
    ct_deductibility: string;
  }[];
  let nonDeductibleAddBacksFils = 0;
  for (const b of bills) {
    if (b.ct_deductibility === 'ENTERTAINMENT_50') {
      nonDeductibleAddBacksFils += Math.round(b.subtotal_fils * 0.5);
    } else if (b.ct_deductibility === 'NON_DEDUCTIBLE_0') {
      nonDeductibleAddBacksFils += b.subtotal_fils;
    }
  }

  const taxableIncomeFils = Math.max(0, accountingNetProfitFils + nonDeductibleAddBacksFils);
  const ZERO_BRACKET_FILS = 37_500_000;
  const subjectTo9PctFils = Math.max(0, taxableIncomeFils - ZERO_BRACKET_FILS);
  const corporateTaxPayableFils = Math.round(subjectTo9PctFils * 0.09);

  return {
    totalRevenueFils,
    totalExpenseFils,
    accountingNetProfitFils,
    nonDeductibleAddBacksFils,
    taxableIncomeFils,
    zeroBracketThresholdFils: ZERO_BRACKET_FILS,
    subjectTo9PctFils,
    corporateTaxPayableFils,
  };
}
