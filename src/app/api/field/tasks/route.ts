import { NextResponse } from 'next/server';
import { and, asc, eq, inArray, lte, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import { purchaseOrders, sites, taskPhotos, tasks } from '@/db/schema';
import { currentUser } from '@/lib/auth';
import { addDays, todayIST } from '@/lib/dates';
import { PROJECT_TYPES } from '@/lib/services';

/** My field tasks: open ones starting within 2 days, plus anything finished today. */
export async function GET() {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const today = todayIST();
  const rows = await db.select({ t: tasks, po: purchaseOrders, site: sites }).from(tasks)
    .innerJoin(purchaseOrders, eq(tasks.poId, purchaseOrders.id)).leftJoin(sites, eq(purchaseOrders.siteRef, sites.id))
    .where(and(eq(tasks.assigneeId, u.id), or(
      and(inArray(tasks.status, ['NOT_STARTED', 'IN_PROGRESS', 'ON_HOLD']), lte(tasks.plannedStart, addDays(today, 2))),
      sql`${tasks.status} = 'COMPLETED' and (${tasks.actualEnd} at time zone 'UTC' at time zone 'Asia/Kolkata')::date = ${today}`,
    ))).orderBy(asc(tasks.plannedEnd));
  const ids = rows.map((r) => r.t.id);
  const counts = ids.length ? await db.select({ taskId: taskPhotos.taskId, n: sql<number>`count(*)::int` }).from(taskPhotos).where(inArray(taskPhotos.taskId, ids)).groupBy(taskPhotos.taskId) : [];
  const pc = new Map(counts.map((c) => [c.taskId, c.n]));
  return NextResponse.json({
    today, user: { name: u.name, designation: u.designation },
    tasks: rows.map(({ t, po, site }) => ({
      id: t.id, code: t.code, step: t.step, status: t.status, tatDays: t.tatDays, plannedStart: t.plannedStart, plannedEnd: t.plannedEnd, evidence: t.evidence,
      checklist: t.checklist ?? [], remarks: t.remarks ?? '', photos: pc.get(t.id) ?? 0,
      po: { number: po.poNumber, type: PROJECT_TYPES[po.projectType] }, site: site ? { id: site.siteId, name: site.name, fenceM: site.fenceM, hasGps: site.lat != null } : null,
    })),
  });
}
