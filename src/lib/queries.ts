import 'server-only';
import { desc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { alerts, invoices, purchaseOrders, sites, tasks } from '@/db/schema';

/** Every PO with site, task counts and invoice — for lists and the dashboard. */
export async function poSummaries() {
  const rows = await db.select({
    po: purchaseOrders, site: sites,
    total: sql<number>`count(${tasks.id})::int`,
    done: sql<number>`count(${tasks.id}) filter (where ${tasks.status} = 'COMPLETED')::int`,
    overdue: sql<number>`count(${tasks.id}) filter (where ${tasks.status} <> 'COMPLETED' and ${tasks.plannedEnd} < (now() at time zone 'Asia/Kolkata')::date)::int`,
  }).from(purchaseOrders).leftJoin(sites, eq(purchaseOrders.siteRef, sites.id)).leftJoin(tasks, eq(tasks.poId, purchaseOrders.id))
    .groupBy(purchaseOrders.id, sites.id).orderBy(desc(purchaseOrders.poDate));
  const inv = await db.select().from(invoices);
  const byPo = new Map(inv.map((i) => [i.poId, i]));
  return rows.map((r) => ({ ...r, pct: r.total ? Math.round((r.done / r.total) * 100) : 0, invoice: byPo.get(r.po.id) ?? null }));
}
export const latestAlerts = (n = 50) => db.select().from(alerts).orderBy(desc(alerts.createdAt)).limit(n);
