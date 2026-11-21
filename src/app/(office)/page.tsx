import Link from 'next/link';
import { and, eq, ne, sql } from 'drizzle-orm';
import { db } from '@/db';
import { approvals, invoices, tasks } from '@/db/schema';
import { poSummaries, latestAlerts } from '@/lib/queries';
import { diffDays, fmtShort, todayIST } from '@/lib/dates';
import { inr } from '@/lib/money';
import { clockColor, poStage } from '@/lib/view';
import { PROJECT_TYPES } from '@/lib/services';
import AlertRow from '@/components/AlertRow';
import { scanAction } from '@/app/actions';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  const today = todayIST();
  const [pos, al, [t], [ap], inv] = await Promise.all([
    poSummaries(), latestAlerts(8),
    db.select({
      due: sql<number>`count(*) filter (where ${tasks.status} <> 'COMPLETED' and ${tasks.plannedEnd} = ${today})::int`,
      od: sql<number>`count(*) filter (where ${tasks.status} <> 'COMPLETED' and ${tasks.plannedEnd} < ${today})::int`,
      ip: sql<number>`count(*) filter (where ${tasks.status} = 'IN_PROGRESS')::int`,
    }).from(tasks),
    db.select({ n: sql<number>`count(*)::int` }).from(approvals).where(eq(approvals.status, 'PENDING')),
    db.select().from(invoices),
  ]);
  const open = pos.filter((p) => !p.invoice);
  const wcc = pos.filter((p) => p.po.auditOfferedAt && !p.po.wccNo).length;
  const month = today.slice(0, 7);
  const billed = inv.filter((i) => i.date.slice(0, 7) === month).reduce((a, i) => a + Number(i.total), 0);
  const ar = inv.filter((i) => !i.paid).reduce((a, i) => a + Number(i.total), 0);
  const K = ({ l, v, s, err }: { l: string; v: React.ReactNode; s: string; err?: boolean }) => (
    <div className="card kpi"><div className="l">{l}</div><div className="v">{v}</div><div className={'s' + (err ? ' err' : '')}>{s}</div></div>);
  return (<>
    <div className="top"><div><h1>IDC Command Centre</h1><div className="sub">Live from the field app and ERP · {fmtShort(today)}</div></div>
      <form action={scanAction}><button className="btn sm">Run alert check now</button></form></div>
    <div className="grid kpis">
      <K l="Open POs" v={open.length} s={inr(open.reduce((a, p) => a + Number(p.po.value), 0)) + ' PO value'} />
      <K l="Tasks due today" v={t.due} s={`${t.od} overdue`} err={t.od > 0} />
      <K l="Tasks in progress" v={t.ip} s="from the field app" />
      <K l="Waiting for WCC" v={wcc} s="audit offered, WCC pending" />
      <K l="Billed this month" v={inr(billed)} s={`${inv.filter((i) => i.date.slice(0, 7) === month).length} invoices`} />
      <K l="Receivable (AR)" v={inr(ar)} s={`${ap.n} approvals pending`} />
    </div>
    <div className="grid two">
      <div className="card"><h2>POs — progress and 90-day clock</h2><div className="tbl-wrap"><table>
        <thead><tr><th>PO</th><th>Tasks</th><th>90-day clock</th><th>Stage</th></tr></thead>
        <tbody>{pos.map(({ po, site, pct, invoice, overdue }) => { const d = Math.max(0, diffDays(today, po.poDate)); const [st, c] = poStage(po, !!invoice, pct); return (
          <tr key={po.id}><td><Link href={`/pos/${po.id}`}><b>{po.poNumber}</b></Link><div className="small muted">{PROJECT_TYPES[po.projectType]} · {site?.siteId}</div></td>
            <td style={{ minWidth: 140 }}><div className="bar"><i style={{ width: pct + '%', background: '#1E3A8A' }} /></div><div className="small muted">{pct}% done{overdue ? <span className="err"> · {overdue} overdue</span> : null}</div></td>
            <td style={{ minWidth: 120 }}><div className="bar"><i style={{ width: Math.min(100, (d / 90) * 100) + '%', background: clockColor(d, 75, 85) }} /></div><div className="small muted">Day {d} of 90</div></td>
            <td><span className={'pill ' + c}>{st}</span></td></tr>); })}</tbody></table></div></div>
      <div className="card"><h2>Latest alerts & messages <Link href="/alerts" className="small" style={{ float: 'right' }}>View all</Link></h2>
        {al.length ? al.map((a) => <AlertRow key={a.id} a={a} />) : <div className="muted">No alerts</div>}</div>
    </div>
  </>);
}
