import Link from 'next/link';
import { and, asc, eq, gte, lt, lte, ne, type SQL } from 'drizzle-orm';
import { db } from '@/db';
import { purchaseOrders, sites, tasks, users } from '@/db/schema';
import { addDays, fmtShort, todayIST } from '@/lib/dates';
import { taskChip } from '@/lib/view';
import { PROJECT_TYPES } from '@/lib/services';

export const dynamic = 'force-dynamic';
const F: [string, string][] = [['open', 'All open'], ['od', 'Overdue'], ['t2', 'Due in 2 days'], ['ip', 'In progress'], ['ns', 'Not started'], ['done', 'Completed']];
export default async function Tasks({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const f = (await searchParams).f || 'open'; const today = todayIST();
  const W: Record<string, SQL | undefined> = {
    open: ne(tasks.status, 'COMPLETED'), od: and(ne(tasks.status, 'COMPLETED'), lt(tasks.plannedEnd, today)),
    t2: and(ne(tasks.status, 'COMPLETED'), gte(tasks.plannedEnd, today), lte(tasks.plannedEnd, addDays(today, 2))),
    ip: eq(tasks.status, 'IN_PROGRESS'), ns: eq(tasks.status, 'NOT_STARTED'), done: eq(tasks.status, 'COMPLETED'),
  };
  const rows = await db.select({ t: tasks, po: purchaseOrders, site: sites, u: users }).from(tasks)
    .innerJoin(purchaseOrders, eq(tasks.poId, purchaseOrders.id)).leftJoin(sites, eq(purchaseOrders.siteRef, sites.id)).leftJoin(users, eq(tasks.assigneeId, users.id))
    .where(W[f] ?? W.open).orderBy(asc(tasks.plannedEnd)).limit(300);
  return (<>
    <div className="top"><div><h1>Tasks & TAT</h1><div className="sub">Every task has an owner, a TAT and planned dates from the project template</div></div></div>
    <div className="chips">{F.map(([k, l]) => <Link key={k} href={`/tasks?f=${k}`} className={'chip' + (f === k ? ' on' : '')} style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>{l}</Link>)}</div>
    <div className="card"><div className="tbl-wrap"><table><thead><tr><th>Task</th><th>PO / site</th><th>Owner</th><th>Due</th><th>Status</th></tr></thead>
      <tbody>{rows.map(({ t, po, site, u }) => { const [s, c] = taskChip(t, today); return (
        <tr key={t.id}><td><b>{t.step}</b><div className="small muted">{t.code}</div></td><td><Link href={`/pos/${po.id}`}>{po.poNumber}</Link><div className="small muted">{PROJECT_TYPES[po.projectType]} · {site?.siteId}</div></td>
          <td>{u ? `${u.name}` : <span className="muted">Unassigned</span>}</td><td>{fmtShort(t.plannedEnd)}</td><td><span className={'pill ' + c}>{s}</span></td></tr>); })}
        {!rows.length && <tr><td colSpan={5} className="muted">Nothing here</td></tr>}</tbody></table></div></div>
  </>);
}
