import 'server-only';
import { and, asc, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  alerts, approvals, counters, invoices, poLines, purchaseOrders, sites, taskPhotos, tasks, taskTemplates, templateSteps, users,
} from '@/db/schema';
import { addDays, diffDays, fmtShort, todayIST } from './dates';
import { amountInWords, gstSplit, inr } from './money';
import { informsIndus, isFieldStep, planDates } from './planning';
import { distanceM } from './geo';
import { notify } from './notify';

export const PROJECT_TYPES: Record<string, string> = {
  EB: 'EB new connection', MOUNT: 'Mount (Upgrade Minor)', DG: 'DG', TRX: 'TRX', TCU: 'TCU', SOLAR: 'Solar',
};
export const APPROVAL_LIMIT = Number(process.env.APPROVAL_LIMIT || 10000);

// ---------------------------------------------------------------- alerts
type Level = 'info' | 'amber' | 'red' | 'green';
export async function raiseAlert(a: { code: string; level: Level; to: string; ch: string; msg: string; key?: string; poId?: string; taskId?: string }) {
  const rows = await db.insert(alerts).values({
    code: a.code, level: a.level, recipients: a.to, channels: a.ch, message: a.msg, dedupeKey: a.key ?? null, poId: a.poId, taskId: a.taskId,
  }).onConflictDoNothing({ target: alerts.dedupeKey }).returning();
  if (rows[0]) await notify(rows[0]);
  return rows[0];
}

const userLabel = async (id: string | null) => {
  if (!id) return 'Unassigned';
  const [u] = await db.select().from(users).where(eq(users.id, id));
  return u ? `${u.name} (${u.designation})` : 'Unassigned';
};

/** Scan all open work and raise T-2, overdue, PO-clock and WCC alerts (idempotent via dedupe keys). */
export async function scanAlerts(today = todayIST()) {
  let n = 0;
  const open = await db.select({ t: tasks, po: purchaseOrders, site: sites }).from(tasks)
    .innerJoin(purchaseOrders, eq(tasks.poId, purchaseOrders.id)).leftJoin(sites, eq(purchaseOrders.siteRef, sites.id))
    .where(ne(tasks.status, 'COMPLETED'));
  for (const { t, po, site } of open) {
    const left = diffDays(t.plannedEnd, today);
    const where = `PO ${po.poNumber}, site ${site?.siteId ?? '—'}`;
    const who = await userLabel(t.assigneeId);
    if (left < 0) {
      const late = -left, tier = late >= 7 ? 7 : late >= 3 ? 3 : 1;
      const r = await raiseAlert({ code: 'T07', level: 'red', to: who + ', PM' + (late >= 3 ? ', HOD' : '') + (late >= 7 ? ', Management' : ''), ch: 'Push, WhatsApp',
        msg: `OVERDUE ${late} day(s): ${t.step} — ${where}.`, key: `od:${t.id}:${tier}`, poId: po.id, taskId: t.id });
      if (r) n++;
    } else if (left <= 2) {
      const r = await raiseAlert({ code: 'T06', level: 'amber', to: who + ', PM', ch: 'Push', msg: `Due in ${left} day(s): ${t.step} — ${where}.`, key: `t2:${t.id}`, poId: po.id, taskId: t.id });
      if (r) n++;
    }
  }
  const pos = await db.select().from(purchaseOrders);
  const billed = new Set((await db.select({ p: invoices.poId }).from(invoices)).map((x) => x.p));
  for (const po of pos) {
    const d = diffDays(today, po.poDate);
    if (!billed.has(po.id)) {
      if (d >= 85) n += (await raiseAlert({ code: 'T30', level: 'red', to: 'Coordinator, HOD, CFO', ch: 'Push, Email', msg: `PO ${po.poNumber} at day ${d} of 90 without billing.`, key: `p85:${po.id}`, poId: po.id })) ? 1 : 0;
      else if (d >= 75) n += (await raiseAlert({ code: 'T29', level: 'amber', to: 'Coordinator, HOD', ch: 'Push, Email', msg: `PO ${po.poNumber} at day ${d} of 90 without billing.`, key: `p75:${po.id}`, poId: po.id })) ? 1 : 0;
      if (po.projectType !== 'EB' && d >= 40 && d < 45) n += (await raiseAlert({ code: 'T31', level: 'amber', to: 'HOD', ch: 'Push', msg: `Upgrade PO ${po.poNumber} at day ${d} of the 45-day execution limit.`, key: `u40:${po.id}`, poId: po.id })) ? 1 : 0;
    }
    if (po.auditOfferedAt && !po.wccNo && diffDays(today, po.auditOfferedAt) > 7)
      n += (await raiseAlert({ code: 'T22', level: 'red', to: 'Coordinator, HOD', ch: 'Push, Email', msg: `WCC not received ${diffDays(today, po.auditOfferedAt)} days after audit — PO ${po.poNumber}.`, key: `w7:${po.id}`, poId: po.id })) ? 1 : 0;
  }
  return n;
}

// ---------------------------------------------------------------- PO + plan
export interface POInput {
  poNumber: string; projectType: string; poDate: string; circle?: string; description?: string; siteId: string; rl?: string;
  lines: { lineNo?: number; itemCode?: string; description: string; uom?: string; qty: number; rate: number; siteCode?: string; projectName?: string; taskName?: string }[];
}

async function pickAssignee(role: 'FIELD' | 'PM' | 'FINANCE', zone: string | null, seq: number) {
  const list = await db.select().from(users).where(and(eq(users.role, role), eq(users.active, true))).orderBy(asc(users.employeeId));
  const inZone = list.filter((u) => !zone || !u.zone || u.zone === zone);
  const pool = inZone.length ? inZone : list;
  return pool.length ? pool[seq % pool.length].id : null;
}

export async function createPO(input: POInput, userId: string | null, opts: { silent?: boolean } = {}) {
  const errors: string[] = [];
  if (!input.poNumber?.trim()) errors.push('PO number is missing');
  if (!PROJECT_TYPES[input.projectType]) errors.push('Choose a project type');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.poDate || '')) errors.push('PO date is missing');
  if (!input.lines?.length) errors.push('At least one PO line is needed');
  const [site] = await db.select().from(sites).where(eq(sites.siteId, (input.siteId || '').trim()));
  if (!site) errors.push(`Site ${input.siteId || '(blank)'} is not in the site master — add it first`);
  const [dup] = await db.select({ id: purchaseOrders.id }).from(purchaseOrders).where(eq(purchaseOrders.poNumber, input.poNumber.trim()));
  if (dup) errors.push(`PO ${input.poNumber} already exists`);
  const [tpl] = await db.select().from(taskTemplates).where(eq(taskTemplates.projectType, input.projectType));
  if (!tpl) errors.push('No task template for this project type');
  if (errors.length) return { ok: false as const, errors };

  const value = input.lines.reduce((a, l) => a + Number(l.qty) * Number(l.rate), 0);
  const [po] = await db.insert(purchaseOrders).values({
    poNumber: input.poNumber.trim(), projectType: input.projectType, poDate: input.poDate, circle: input.circle || site!.zone,
    description: input.description, siteRef: site!.id, rl: input.rl || null, value: value.toFixed(2), createdById: userId,
  }).returning();
  await db.insert(poLines).values(input.lines.map((l, i) => ({
    poId: po.id, lineNo: l.lineNo ?? i + 1, itemCode: l.itemCode, description: l.description, uom: l.uom,
    qty: String(l.qty), rate: Number(l.rate).toFixed(2), amount: (Number(l.qty) * Number(l.rate)).toFixed(2),
    siteCode: l.siteCode, projectName: l.projectName, taskName: l.taskName,
  })));

  const steps = await db.select().from(templateSteps).where(eq(templateSteps.templateId, tpl!.id)).orderBy(asc(templateSteps.seq));
  const planned = planDates(steps, input.poDate);
  const rows = [];
  for (const [i, s] of planned.entries()) {
    const role = s.field ? 'FIELD' : /finance|billing|invoice/i.test(s.step) ? 'FINANCE' : 'PM';
    rows.push({
      poId: po.id, code: s.code, seq: s.seq, step: s.step, ownerText: s.ownerText, afterCode: s.afterCode, tatDays: s.tatDays,
      field: s.field, informIndus: s.informIndus, evidence: s.evidence, assigneeId: await pickAssignee(role, site!.zone, i),
      plannedStart: s.plannedStart, plannedEnd: s.plannedEnd,
    });
  }
  const created = await db.insert(tasks).values(rows).returning();

  if (!opts.silent) {
    await raiseAlert({ code: 'T01', level: 'info', to: 'HO coordinator, HOD', ch: 'In-app, Email', poId: po.id,
      msg: `PO ${po.poNumber} imported — ${PROJECT_TYPES[po.projectType]}, site ${site!.siteId}, ${inr(value)}. 90-day billing clock started.` });
    const invDay = Math.max(...planned.map((p) => p.endDay));
    await raiseAlert({ code: 'T02', level: 'info', to: 'Task owners, HOD, Warehouse, Finance', ch: 'In-app, Push, Email', poId: po.id,
      msg: `PO ${po.poNumber} approved for execution: ${created.length} tasks planned, invoice target ${fmtShort(addDays(po.poDate, invDay))} (day ${invDay}).` });
    for (const t of created.filter((x) => !x.afterCode))
      await raiseAlert({ code: 'T04', level: 'info', to: await userLabel(t.assigneeId), ch: 'Push, WhatsApp', poId: po.id, taskId: t.id,
        msg: `New task: ${t.step} — site ${site!.siteId}, due ${fmtShort(t.plannedEnd)}.` });
  }
  return { ok: true as const, po };
}

// ---------------------------------------------------------------- task actions
export async function startTask(taskId: string, userId: string, gps: { lat?: number; lng?: number }) {
  const [row] = await db.select({ t: tasks, po: purchaseOrders, site: sites }).from(tasks)
    .innerJoin(purchaseOrders, eq(tasks.poId, purchaseOrders.id)).leftJoin(sites, eq(purchaseOrders.siteRef, sites.id)).where(eq(tasks.id, taskId));
  if (!row) return { ok: false, error: 'Task not found' };
  if (row.t.status === 'COMPLETED') return { ok: false, error: 'Task already completed' };
  let dist: number | null = null;
  if (row.site?.lat != null && row.site?.lng != null) {
    if (gps.lat == null || gps.lng == null) return { ok: false, error: 'Location is needed to start this task. Turn on GPS and try again.' };
    dist = distanceM(gps.lat, gps.lng, row.site.lat, row.site.lng);
    if (dist > row.site.fenceM) return { ok: false, error: `You are ${dist >= 1000 ? (dist / 1000).toFixed(1) + ' km' : dist + ' m'} from site ${row.site.siteId}. Start works only within ${row.site.fenceM} m.` };
  }
  await db.update(tasks).set({ status: 'IN_PROGRESS', actualStart: new Date(), startLat: gps.lat ?? null, startLng: gps.lng ?? null, startDistanceM: dist }).where(eq(tasks.id, taskId));
  await raiseAlert({ code: 'T05', level: 'info', to: 'PM', ch: 'In-app', poId: row.po.id, taskId,
    msg: `${await userLabel(userId)} started "${row.t.step}" — PO ${row.po.poNumber}${dist != null ? ` (${dist} m from site)` : ''}.` });
  return { ok: true, distanceM: dist };
}

export async function completeTask(taskId: string, userId: string, data: { checklist?: number[]; remarks?: string } = {}) {
  const [row] = await db.select({ t: tasks, po: purchaseOrders, site: sites }).from(tasks)
    .innerJoin(purchaseOrders, eq(tasks.poId, purchaseOrders.id)).leftJoin(sites, eq(purchaseOrders.siteRef, sites.id)).where(eq(tasks.id, taskId));
  if (!row) return { ok: false, error: 'Task not found' };
  if (row.t.status === 'COMPLETED') return { ok: true };
  const now = new Date();
  await db.update(tasks).set({ status: 'COMPLETED', actualStart: row.t.actualStart ?? now, actualEnd: now, checklist: data.checklist ?? row.t.checklist, remarks: data.remarks ?? row.t.remarks }).where(eq(tasks.id, taskId));
  const late = diffDays(todayIST(), row.t.plannedEnd);
  await raiseAlert({ code: 'T08', level: 'green', to: 'PM, next task owner', ch: 'In-app, Push', poId: row.po.id, taskId,
    msg: `Completed: "${row.t.step}" — PO ${row.po.poNumber}${late > 0 ? ` (${late} d late)` : ' (on time)'}.` });
  if (row.t.informIndus)
    await raiseAlert({ code: 'T46', level: 'info', to: `Indus ${row.po.projectType === 'EB' ? 'EB' : 'Upgrade'} team — ${row.po.circle ?? 'circle'}`, ch: 'Email', poId: row.po.id, taskId,
      msg: `Indus informed: "${row.t.step}" completed at site ${row.site?.siteId ?? '—'} (PO ${row.po.poNumber}), evidence attached.` });
  const next = await db.select().from(tasks).where(and(eq(tasks.poId, row.po.id), eq(tasks.afterCode, row.t.code), eq(tasks.status, 'NOT_STARTED')));
  for (const x of next)
    await raiseAlert({ code: 'T04', level: 'info', to: await userLabel(x.assigneeId), ch: 'Push, WhatsApp', poId: row.po.id, taskId: x.id,
      msg: `New task ready: "${x.step}" — site ${row.site?.siteId ?? '—'}, due ${fmtShort(x.plannedEnd)}.` });
  return { ok: true };
}

export async function addPhoto(taskId: string, userId: string, path: string, lat?: number, lng?: number) {
  await db.insert(taskPhotos).values({ taskId, path, uploadedById: userId, lat: lat ?? null, lng: lng ?? null });
}

export async function reassignTask(taskId: string, assigneeId: string) {
  const [t] = await db.update(tasks).set({ assigneeId }).where(eq(tasks.id, taskId)).returning();
  if (t) await raiseAlert({ code: 'T04', level: 'info', to: await userLabel(assigneeId), ch: 'Push, WhatsApp', poId: t.poId, taskId,
    msg: `Task assigned to you: "${t.step}", due ${fmtShort(t.plannedEnd)}.` });
}

// ---------------------------------------------------------------- WCC + billing
export async function offerAudit(poId: string) {
  const [po] = await db.update(purchaseOrders).set({ auditOfferedAt: todayIST() }).where(eq(purchaseOrders.id, poId)).returning();
  await raiseAlert({ code: 'T21', level: 'info', to: 'Indus audit team, HOD', ch: 'Email', poId, msg: `Audit offered to Indus for PO ${po.poNumber}. WCC expected within 7 days.` });
}
export async function recordWCC(poId: string, wccNo: string, wccDate: string) {
  const [po] = await db.update(purchaseOrders).set({ wccNo, wccDate }).where(eq(purchaseOrders.id, poId)).returning();
  await db.update(tasks).set({ status: 'COMPLETED', actualEnd: new Date() })
    .where(and(eq(tasks.poId, poId), ne(tasks.status, 'COMPLETED'), sql`${tasks.step} ~* 'wcc'`));
  await raiseAlert({ code: 'T23', level: 'amber', to: 'Finance', ch: 'In-app, Email', poId, msg: `WCC ${wccNo} received for PO ${po.poNumber} — raise invoice by ${fmtShort(addDays(wccDate, 1))}.` });
}
async function nextNumber(key: string) {
  const [r] = await db.insert(counters).values({ key, value: 1 })
    .onConflictDoUpdate({ target: counters.key, set: { value: sql`${counters.value} + 1` } }).returning();
  return r.value;
}
export function fyLabel(date: string) {
  const [y, m] = date.split('-').map(Number); const s = m >= 4 ? y : y - 1;
  return `${String(s).slice(2)}-${String(s + 1).slice(2)}`;
}
export async function raiseInvoice(poId: string) {
  const [po] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, poId));
  if (!po) return { ok: false, error: 'PO not found' };
  if (!po.wccNo) return { ok: false, error: 'Record the WCC before invoicing' };
  const [exists] = await db.select().from(invoices).where(eq(invoices.poId, poId));
  if (exists) return { ok: true, invoice: exists };
  const date = todayIST(); const fy = fyLabel(date);
  const n = await nextNumber('invoice:' + fy);
  const taxable = Number(po.approvedValue ?? po.value); const g = gstSplit(taxable);
  const [inv] = await db.insert(invoices).values({
    number: `IDC/${fy}/${String(n).padStart(4, '0')}`, poId, date, taxable: taxable.toFixed(2), cgst: g.cgst.toFixed(2), sgst: g.sgst.toFixed(2),
    total: g.total.toFixed(2), amountWords: amountInWords(g.total),
  }).returning();
  await db.update(tasks).set({ status: 'COMPLETED', actualEnd: new Date() })
    .where(and(eq(tasks.poId, poId), ne(tasks.status, 'COMPLETED'), sql`${tasks.step} ~* 'billing|invoice'`));
  await raiseAlert({ code: 'T24', level: 'green', to: 'Finance, HOD', ch: 'In-app, Email', poId, msg: `Invoice ${inv.number} raised for PO ${po.poNumber}: ${inr(g.total)}. Upload on Indus portal.` });
  return { ok: true, invoice: inv };
}

// ---------------------------------------------------------------- approvals
export async function requestApproval(a: { type: string; poId?: string; title: string; detail?: string; amount: number; userId: string }) {
  const auto = a.amount <= APPROVAL_LIMIT;
  const [r] = await db.insert(approvals).values({
    type: a.type, poId: a.poId, title: a.title, detail: a.detail, amount: a.amount.toFixed(2), approverRole: 'HOD',
    status: auto ? 'APPROVED' : 'PENDING', raisedById: a.userId, decidedAt: auto ? new Date() : null, comment: auto ? `Auto-approved: within ₹${APPROVAL_LIMIT.toLocaleString('en-IN')} limit` : null,
  }).returning();
  if (!auto) await raiseAlert({ code: 'T11', level: 'amber', to: 'HOD', ch: 'Push, In-app', poId: a.poId, msg: `Approval needed: ${a.type} ${inr(a.amount)} — ${a.title}.` });
  return r;
}
export async function decideApproval(id: string, userId: string, approve: boolean, comment?: string) {
  const [r] = await db.update(approvals).set({ status: approve ? 'APPROVED' : 'REJECTED', decidedById: userId, decidedAt: new Date(), comment })
    .where(and(eq(approvals.id, id), eq(approvals.status, 'PENDING'))).returning();
  if (r) await raiseAlert({ code: 'T12', level: approve ? 'green' : 'red', to: 'Requester, PM', ch: 'Push, In-app', poId: r.poId ?? undefined,
    msg: `${r.type} ${inr(r.amount)} ${approve ? 'approved' : 'rejected'} — ${r.title}${comment ? ` (${comment})` : ''}.` });
  return r;
}

export { isNull, inArray, isFieldStep, informsIndus };
