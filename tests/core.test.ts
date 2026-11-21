import { describe, expect, it } from 'vitest';
import { planDays } from '../src/lib/planning';
import { amountInWords, gstSplit } from '../src/lib/money';
import { addDays, diffDays, workingDaysBetween } from '../src/lib/dates';
import { distanceM } from '../src/lib/geo';
import templates from '../src/db/templates.json';

type Row = [string, string, string, string, number];
const steps = (k: string) => (templates as unknown as Record<string, Row[]>)[k].map((r) => ({ code: r[0], afterCode: r[3] || null, tatDays: Math.round(r[4] || 0) }));

describe('planning', () => {
  it('EB parallel plan: audit offered on day 19, invoice on day 40 (workbook v1.6)', () => {
    const p = new Map(planDays(steps('EB')).map((x) => [x.code, x]));
    expect(p.get('EB-17')!.startDay).toBe(19);
    expect(p.get('EB-23')!.endDay).toBe(40);
  });
  it('invoice day per project type matches workbook v1.6', () => {
    const want: Record<string, number> = { EB: 40, MOUNT: 15, DG: 16, TRX: 18, TCU: 40, SOLAR: 16 };
    for (const [k, d] of Object.entries(want)) expect(Math.max(...planDays(steps(k)).map((x) => x.endDay))).toBe(d);
  });
  it('every template finishes inside the 45-day Upgrade limit', () => {
    for (const k of ['MOUNT', 'DG', 'TRX', 'TCU', 'SOLAR']) expect(Math.max(...planDays(steps(k)).map((x) => x.endDay))).toBeLessThanOrEqual(45);
  });
  it('steps sharing a predecessor run in parallel', () => {
    const p = planDays([{ code: 'A', afterCode: null, tatDays: 2 }, { code: 'B', afterCode: 'A', tatDays: 3 }, { code: 'C', afterCode: 'A', tatDays: 1 }]);
    expect(p.find((x) => x.code === 'B')!.startDay).toBe(2);
    expect(p.find((x) => x.code === 'C')!.startDay).toBe(2);
  });
});
describe('money', () => {
  it('Indian amount in words', () => {
    expect(amountInWords(5664)).toBe('Rupees Five Thousand Six Hundred Sixty Four Only');
    expect(amountInWords(2250160.5)).toBe('Rupees Twenty Two Lakh Fifty Thousand One Hundred Sixty and Fifty Paise Only');
    expect(amountInWords(12345678)).toBe('Rupees One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight Only');
  });
  it('GST 9% + 9%', () => { expect(gstSplit(4800)).toEqual({ cgst: 432, sgst: 432, total: 5664 }); });
});
describe('dates and geo', () => {
  it('calendar arithmetic', () => { expect(addDays('2026-11-21', 40)).toBe('2026-12-31'); expect(diffDays('2026-12-31', '2026-11-21')).toBe(40); });
  it('working days Mon–Sat', () => { expect(workingDaysBetween('2026-11-14', '2026-11-21')).toBe(6); });
  it('geo-fence distance', () => { const d = distanceM(26.85, 81.008, 26.8505, 81.0085); expect(d).toBeGreaterThan(50); expect(d).toBeLessThan(90); });
});
