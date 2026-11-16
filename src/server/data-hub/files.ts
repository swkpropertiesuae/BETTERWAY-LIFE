// Any supported file -> one table of cells. The importer stores every upload as CSV, whatever it arrived as.
import { parseCsv, readXlsx, type Cell } from './xlsx';

export const SUPPORTED = ['.xlsx', '.xlsm', '.csv', '.tsv', '.txt', '.json'];

const sniff = (line: string) => [',', ';', '\t', '|'].map((d) => [d, line.split(d).length] as const).sort((a, b) => b[1] - a[1])[0][0];

export async function fileToTable(fileName: string, bytes: Buffer): Promise<Cell[][]> {
  const ext = (fileName.match(/\.[^.]+$/)?.[0] ?? '').toLowerCase();
  if (ext === '.xlsx' || ext === '.xlsm') return readXlsx(bytes);
  if (['.csv', '.tsv', '.txt'].includes(ext)) {
    // shortcut: UTF-8 only, legacy Windows-1252 exports need re-saving as UTF-8 CSV
    const text = bytes.toString('utf8');
    return parseCsv(text, ext === '.tsv' ? '\t' : sniff(text.split(/\r?\n/, 1)[0] ?? ''));
  }
  if (ext === '.json') {
    let data: unknown;
    try { data = JSON.parse(bytes.toString('utf8')); } catch { throw new Error('File is not valid JSON'); }
    const arr = Array.isArray(data) ? data : ((data as Record<string, unknown>)?.data ?? (data as Record<string, unknown>)?.rows ?? (data as Record<string, unknown>)?.items);
    if (!Array.isArray(arr) || !arr.every((r) => r && typeof r === 'object')) throw new Error('JSON must be an array of row objects');
    const keys = [...new Set(arr.flatMap((r) => Object.keys(r as object)))];
    return [keys, ...arr.map((r) => keys.map((k) => { const v = (r as Record<string, unknown>)[k]; return typeof v === 'object' && v ? JSON.stringify(v) : (v as Cell); }))];
  }
  throw new Error(`${ext || 'This file type'} cannot be read as a table. Supported: ${SUPPORTED.join(' ')}. Save the sheet as .xlsx or .csv (scans and PDFs need OCR, which is not built).`);
}
