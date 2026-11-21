import { addDays } from './dates';

export interface StepIn { code: string; afterCode: string | null; tatDays: number }
export interface Planned { code: string; startDay: number; endDay: number }

/**
 * Plan every step from its "Starts after" link and TAT (calendar days).
 * A step with no link starts on day 0; steps sharing a predecessor run in parallel.
 */
export function planDays(steps: StepIn[]): Planned[] {
  const end = new Map<string, number>();
  const out: Planned[] = [];
  const pending = [...steps];
  let guard = 0;
  while (pending.length && guard++ < 10000) {
    const s = pending.shift()!;
    if (s.afterCode && !end.has(s.afterCode) && steps.some((x) => x.code === s.afterCode)) { pending.push(s); continue; }
    const start = s.afterCode ? end.get(s.afterCode) ?? 0 : 0;
    const e = start + Math.max(0, s.tatDays || 0);
    end.set(s.code, e);
    out.push({ code: s.code, startDay: start, endDay: e });
  }
  return out;
}

export function planDates<T extends StepIn>(steps: T[], poDate: string) {
  const days = new Map(planDays(steps).map((p) => [p.code, p]));
  return steps.map((s) => {
    const p = days.get(s.code)!;
    return { ...s, plannedStart: addDays(poDate, p.startDay), plannedEnd: addDays(poDate, p.endDay), startDay: p.startDay, endDay: p.endDay };
  });
}

/** Which steps are done by the field team in the app (others are office tasks). */
export function isFieldStep(step: string): boolean {
  if (/request|application|approval|billing|wcc|estimate|indent|report \(je\)|cost capture|invoice|po amendment|allocation|po received|purchase/i.test(step)) return false;
  return /survey|line work|execut|install|inspection|civil|dismantl|erection|commission|tapping|punch|delivered at site|dispatch|earthing|cabling|work at site/i.test(step);
}
export const informsIndus = (step: string) => /audit|inspection|completion|install|commission|dismantl|line work|execution/i.test(step);
