import ExcelJS from 'exceljs';

export type Cell = string | number | boolean | Date | null | undefined;

const cellText = (v: unknown): Cell => {
  if (v && typeof v === 'object' && !(v instanceof Date)) {
    const o = v as { result?: unknown; text?: string; richText?: { text: string }[]; hyperlink?: string };
    if (o.richText) return o.richText.map((r) => r.text).join('');
    if (o.result !== undefined) return o.result as Cell;
    if (o.text !== undefined) return o.text;
    return String(v);
  }
  return v as Cell;
};

export async function readXlsx(buf: Buffer): Promise<Cell[][]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const rows: Cell[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const vals = (row.values as unknown[]).slice(1).map(cellText);
    rows.push(vals);
  });
  return rows;
}

export function parseCsv(text: string, delim = ','): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cur = '', q = false;
  const t = text.replace(/^﻿/, '');
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) {
      if (c === '"' && t[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === delim) { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      row.push(cur); cur = '';
      if (row.some((x) => x !== '')) rows.push(row);
      row = [];
    } else cur += c;
  }
  row.push(cur);
  if (row.some((x) => x !== '')) rows.push(row);
  return rows;
}

export async function writeXlsx(sheetName: string, columns: string[], rows: Cell[][], guide?: string[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName.slice(0, 31));
  ws.addRow(columns).font = { bold: true };
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  rows.forEach((r) => ws.addRow(r));
  columns.forEach((c, i) => { ws.getColumn(i + 1).width = Math.max(14, c.length + 2); });
  if (guide) { const g = wb.addWorksheet('Guide'); guide.forEach((r) => g.addRow(r)); g.getColumn(1).width = 28; g.getColumn(2).width = 90; }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

const csvCell = (v: Cell): string => {
  const t = v instanceof Date ? v.toISOString().slice(0, 10) : v == null ? '' : String(v);
  return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};
/** Canonical CSV (RFC 4180, LF line ends) - the form every imported file is stored in. */
export const tableToCsv = (table: Cell[][]): string => table.map((r) => r.map(csvCell).join(',')).join('\n') + '\n';
