/** Dates are handled as 'YYYY-MM-DD' strings in IST (calendar days, PRD D-01). */
const pad = (n: number) => String(n).padStart(2, '0');
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function todayIST(now = new Date()): string {
  const ist = new Date(now.getTime() + 330 * 60000);
  return ist.toISOString().slice(0, 10);
}
const toUTC = (s: string) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
export function addDays(s: string, n: number): string {
  const d = new Date(toUTC(s) + Math.round(n) * 86400000);
  return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
}
/** a − b in whole days */
export const diffDays = (a: string, b: string) => Math.round((toUTC(a) - toUTC(b)) / 86400000);
export function fmt(s?: string | Date | null): string {
  if (!s) return '—';
  const str = s instanceof Date ? s.toISOString().slice(0, 10) : s;
  const [y, m, d] = str.split('-').map(Number);
  return `${pad(d)} ${MON[m - 1]} ${y}`;
}
export function fmtShort(s?: string | null): string {
  if (!s) return '—';
  const [, m, d] = s.split('-').map(Number);
  return `${pad(d)} ${MON[m - 1]}`;
}
/** Monday–Saturday working days between a (exclusive) and b (inclusive) — decided 21 Nov 2026. */
export function workingDaysBetween(a: string, b: string, holidays: string[] = []): number {
  let n = 0; let d = a;
  while (d < b) { d = addDays(d, 1); const wd = new Date(toUTC(d)).getUTCDay(); if (wd !== 0 && !holidays.includes(d)) n++; }
  return n;
}
