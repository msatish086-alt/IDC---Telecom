import { diffDays, todayIST } from './dates';
import type { Task } from '@/db/schema';

export function taskChip(t: Pick<Task, 'status' | 'plannedEnd'>, today = todayIST()): [string, string] {
  if (t.status === 'COMPLETED') return ['Completed', 'p-grn'];
  const l = diffDays(t.plannedEnd, today);
  if (l < 0) return [`Overdue ${-l}d`, 'p-red'];
  if (l <= 2) return [`Due in ${l}d${t.status === 'NOT_STARTED' ? ' · not started' : ''}`, 'p-amb'];
  return t.status === 'IN_PROGRESS' ? ['In progress', 'p-blu'] : t.status === 'ON_HOLD' ? ['On hold', 'p-amb'] : ['Not started', 'p-gry'];
}
export function poStage(po: { auditOfferedAt: string | null; wccNo: string | null }, invoiced: boolean, pct: number): [string, string] {
  if (invoiced) return ['Billed', 'p-grn'];
  if (po.wccNo) return ['WCC received', 'p-blu'];
  if (po.auditOfferedAt) return ['Audit offered', 'p-blu'];
  if (pct === 100) return ['Ready for audit', 'p-amb'];
  return ['In execution', 'p-gry'];
}
export const clockColor = (d: number, amber: number, red: number) => (d >= red ? '#DC2626' : d >= amber ? '#F59E0B' : '#60A5FA');
