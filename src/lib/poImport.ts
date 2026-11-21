import 'server-only';
import ExcelJS from 'exceljs';

export interface PODraft {
  poNumber: string; poDate: string; description: string; circle: string; siteId: string; rl: string; projectType: string; total: number;
  lines: { lineNo: number; itemCode: string; description: string; uom: string; qty: number; rate: number; siteCode: string; projectName: string; taskName: string }[];
  warnings: string[];
}

const MON: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const pad = (n: number) => String(n).padStart(2, '0');

export function toISODate(v: unknown): string {
  if (v instanceof Date && !isNaN(+v)) return v.toISOString().slice(0, 10);
  const s = String(v ?? '').trim();
  let m = s.match(/^(\d{1,2})[-/ ]([A-Za-z]{3})[A-Za-z]*[-/ ](\d{2,4})/);
  if (m) { const y = Number(m[3].length === 2 ? '20' + m[3] : m[3]); return `${y}-${pad(MON[m[2].toLowerCase()] || 1)}-${pad(+m[1])}`; }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/); if (m) return `${m[3]}-${pad(+m[2])}-${pad(+m[1])}`;
  return '';
}
const num = (v: unknown) => { const n = Number(String(v ?? '').replace(/[₹,\s]/g, '')); return isFinite(n) ? n : 0; };
const text = (v: unknown): string => {
  if (v == null) return '';
  if (typeof v === 'object') {
    const o = v as { text?: string; result?: unknown; richText?: { text: string }[] };
    if (o.richText) return o.richText.map((r) => r.text).join('');
    if (o.text) return String(o.text);
    if (o.result != null) return String(o.result);
    if (v instanceof Date) return v.toISOString().slice(0, 10);
  }
  return String(v).trim();
};

/** Guess the project type from the PO / line description (Indus titles carry the activity name). */
export function guessType(s: string): string {
  const t = s.toLowerCase();
  if (/solar/.test(t)) return 'SOLAR';
  if (/\bdg\b|diesel gen|dg removal/.test(t)) return 'DG';
  if (/\btcu\b/.test(t)) return 'TCU';
  if (/\btrx\b/.test(t)) return 'TRX';
  if (/mount/.test(t)) return 'MOUNT';
  if (/\beb\b|electric|new connection|uppcl|pvvnl/.test(t)) return 'EB';
  return '';
}

/** Read an Indus PO Excel export (field map: workbook sheet "Indus PO Field Map"). */
export async function parseIndusPO(buf: ArrayBuffer): Promise<PODraft> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const ws = wb.worksheets[0];
  const grid: string[][] = [];
  const raw: unknown[][] = [];
  ws.eachRow({ includeEmpty: true }, (row, r) => {
    const vals = (row.values as unknown[]).slice(1);
    raw[r - 1] = vals; grid[r - 1] = vals.map(text);
  });
  const d: PODraft = { poNumber: '', poDate: '', description: '', circle: '', siteId: '', rl: '', projectType: '', total: 0, lines: [], warnings: [] };

  // header labels: value is in the next non-empty cell to the right, or the cell below
  const find = (rx: RegExp): unknown => {
    for (let r = 0; r < grid.length; r++) for (let c = 0; c < (grid[r] || []).length; c++) {
      if (rx.test(grid[r][c] || '')) {
        for (let k = c + 1; k < grid[r].length; k++) if (grid[r][k]) return raw[r][k];
        if (grid[r + 1]?.[c]) return raw[r + 1][c];
      }
    }
    return '';
  };
  d.poNumber = text(find(/^(po|order|purchase order)\s*(number|no\.?|num|#)?\s*:?$/i)).replace(/\.0$/, '');
  d.poDate = toISODate(find(/^order\s*date|^po\s*date/i));
  d.description = text(find(/^description\s*:?$/i));
  d.circle = text(find(/^operating\s*unit/i));
  d.total = num(find(/^total\s*:?$/i));

  // line table: a row containing Line + Description + (Amount | Price)
  const hr = grid.findIndex((row) => row && row.some((x) => /^line$/i.test(x)) && row.some((x) => /^description$/i.test(x)) && row.some((x) => /amount|price/i.test(x)));
  if (hr >= 0) {
    const H = grid[hr].map((x) => (x || '').toLowerCase());
    const col = (...names: RegExp[]) => H.findIndex((h) => names.some((n) => n.test(h)));
    const C = {
      line: col(/^line$/), item: col(/item\s*num|item\s*code/), desc: col(/^description$/), uom: col(/^uom|unit/), qty: col(/^qty|quantity|ordered/),
      price: col(/^price|rate|unit price/), amt: col(/^amount$/), site: col(/site\s*id/), proj: col(/project\s*name/), task: col(/task\s*name/),
    };
    for (let r = hr + 1; r < grid.length; r++) {
      const row = grid[r]; if (!row || !row.some(Boolean)) continue;
      const desc = C.desc >= 0 ? row[C.desc] : '';
      if (!desc) continue;
      const qty = C.qty >= 0 ? num(row[C.qty]) : 1;
      const rate = C.price >= 0 ? num(row[C.price]) : C.amt >= 0 ? num(row[C.amt]) / (qty || 1) : 0;
      d.lines.push({
        lineNo: C.line >= 0 ? num(row[C.line]) || d.lines.length + 1 : d.lines.length + 1, itemCode: C.item >= 0 ? row[C.item] : '', description: desc,
        uom: C.uom >= 0 ? row[C.uom] : '', qty: qty || 1, rate, siteCode: C.site >= 0 ? row[C.site] : '', projectName: C.proj >= 0 ? row[C.proj] : '', taskName: C.task >= 0 ? row[C.task] : '',
      });
    }
  }
  d.siteId = d.lines.find((l) => l.siteCode)?.siteCode || (d.description.match(/\b(IN-\d{5,}|UP-[A-Z]{3}-\d{3,})\b/)?.[1] ?? '');
  d.rl = d.lines.find((l) => /RL/i.test(l.projectName))?.projectName.match(/R?\/?RL-?\d+/i)?.[0] ?? '';
  d.projectType = guessType(d.description + ' ' + d.lines.map((l) => l.description).join(' '));

  if (!d.poNumber) d.warnings.push('PO number not found — please type it.');
  if (!d.poDate) d.warnings.push('Order date not found — please enter it.');
  if (!d.lines.length) d.warnings.push('No PO lines found — add them below.');
  if (!d.projectType) d.warnings.push('Project type could not be read from the description — please choose it.');
  const sum = d.lines.reduce((a, l) => a + l.qty * l.rate, 0);
  if (d.total && Math.abs(sum - d.total) > 1) d.warnings.push(`Lines add up to ₹${sum.toLocaleString('en-IN')} but PO total is ₹${d.total.toLocaleString('en-IN')} — check milestone lines.`);
  return d;
}
