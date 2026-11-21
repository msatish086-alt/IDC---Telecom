import Link from 'next/link';
import { notFound } from 'next/navigation';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { invoices, poLines, purchaseOrders, sites, taskPhotos, tasks, users } from '@/db/schema';
import { diffDays, fmt, fmtShort, todayIST } from '@/lib/dates';
import { inr } from '@/lib/money';
import { clockColor, poStage, taskChip } from '@/lib/view';
import { PROJECT_TYPES } from '@/lib/services';
import { auditAction, invoiceAction, officeDoneAction, reassignAction, requestApprovalAction, wccAction } from '@/app/actions';
import AutoSubmitSelect from '@/components/AutoSubmitSelect';

export const dynamic = 'force-dynamic';
export default async function PODetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [row] = await db.select({ po: purchaseOrders, site: sites }).from(purchaseOrders).leftJoin(sites, eq(purchaseOrders.siteRef, sites.id)).where(eq(purchaseOrders.id, id));
  if (!row) notFound();
  const { po, site } = row; const today = todayIST();
  const [ts, lines, people, [inv], photos] = await Promise.all([
    db.select().from(tasks).where(eq(tasks.poId, id)).orderBy(asc(tasks.seq)),
    db.select().from(poLines).where(eq(poLines.poId, id)).orderBy(asc(poLines.lineNo)),
    db.select({ id: users.id, name: users.name, role: users.role }).from(users).where(eq(users.active, true)).orderBy(asc(users.name)),
    db.select().from(invoices).where(eq(invoices.poId, id)),
    db.select({ taskId: taskPhotos.taskId, path: taskPhotos.path }).from(taskPhotos).innerJoin(tasks, eq(taskPhotos.taskId, tasks.id)).where(eq(tasks.poId, id)),
  ]);
  const d = Math.max(0, diffDays(today, po.poDate)); const done = ts.filter((t) => t.status === 'COMPLETED').length; const pct = ts.length ? Math.round((done / ts.length) * 100) : 0;
  const span = Math.max(...ts.map((t) => diffDays(t.plannedEnd, po.poDate)), d) + 2; const L = (v: number) => ((v / span) * 100).toFixed(1) + '%';
  const [st, c] = poStage(po, !!inv, pct);
  const limit = po.projectType === 'EB' ? { label: 'EB audit-offer target (20 days)', of: 20, a: 17, r: 20 } : { label: 'Upgrade execution limit (45 days)', of: 45, a: 40, r: 45 };
  const ph = (tid: string) => photos.filter((p) => p.taskId === tid);
  return (<>
    <div className="top"><div><h1>PO {po.poNumber}</h1><div className="sub">{PROJECT_TYPES[po.projectType]} · {site?.siteId} {site?.name} · {po.rl ? po.rl + ' · ' : ''}PO date {fmt(po.poDate)} · {inr(po.value)}</div></div></div>
    <div><Link href="/pos" className="small">← All POs</Link></div>
    <div className="grid kpis">
      <div className="card"><div className="small muted">PO-to-billing clock (90 days)</div><div className="bar"><i style={{ width: Math.min(100, (d / 90) * 100) + '%', background: clockColor(d, 75, 85) }} /></div><div className="small">Day {d} of 90 · {Math.max(0, 90 - d)} days left</div></div>
      <div className="card"><div className="small muted">{limit.label}</div><div className="bar"><i style={{ width: Math.min(100, (d / limit.of) * 100) + '%', background: clockColor(d, limit.a, limit.r) }} /></div><div className="small">Day {d} of {limit.of}</div></div>
      <div className="card"><div className="small muted">Tasks</div><div style={{ fontSize: 22, fontWeight: 700 }}>{done} / {ts.length}</div><div className="small">{ts.filter((t) => t.status !== 'COMPLETED' && t.plannedEnd < today).length} overdue</div></div>
      <div className="card"><div className="small muted">Stage</div><div style={{ margin: '6px 0' }}><span className={'pill ' + c}>{st}</span></div>
        {inv ? <Link className="btn sm" href={`/invoice/${inv.id}`} style={{ display: 'inline-flex', alignItems: 'center' }}>Invoice {inv.number}</Link>
          : po.wccNo ? <form action={invoiceAction}><input type="hidden" name="poId" value={po.id} /><div className="small">WCC {po.wccNo} · {fmtShort(po.wccDate)}</div><button className="btn sm pri">Raise invoice</button></form>
          : po.auditOfferedAt ? <form action={wccAction} className="row"><input type="hidden" name="poId" value={po.id} /><input name="wccNo" placeholder="WCC no." required style={{ width: 120 }} /><input type="date" name="wccDate" defaultValue={today} /><button className="btn sm pri">Record WCC</button></form>
          : <form action={auditAction}><input type="hidden" name="poId" value={po.id} /><button className="btn sm" disabled={pct < 60} title={pct < 60 ? 'Complete execution tasks first' : ''}>Offer audit to Indus</button></form>}
      </div>
    </div>
    <div className="card"><h2>Task plan — planned (light) vs actual (dark), red line = today</h2><div className="tbl-wrap"><table>
      <thead><tr><th>ID</th><th>Step</th><th>Assigned to</th><th>Planned</th><th>Timeline</th><th>Status</th><th></th></tr></thead>
      <tbody>{ts.map((t) => { const [s2, c2] = taskChip(t, today); const s0 = diffDays(t.plannedStart, po.poDate), e0 = diffDays(t.plannedEnd, po.poDate);
        const as = t.actualStart ? diffDays(t.actualStart.toISOString().slice(0, 10), po.poDate) : null; const ae = t.actualEnd ? diffDays(t.actualEnd.toISOString().slice(0, 10), po.poDate) : d;
        return (<tr key={t.id}><td className="small muted">{t.code}</td>
          <td><b>{t.step}</b><div className="small muted">{t.afterCode ? 'after ' + t.afterCode : 'start'} · TAT {t.tatDays} d{t.field ? ' · field task' : ''}</div></td>
          <td><form action={reassignAction}><input type="hidden" name="taskId" value={t.id} /><input type="hidden" name="poId" value={po.id} />
            <AutoSubmitSelect name="assigneeId" defaultValue={t.assigneeId ?? ''} aria-label="Assignee"><option value="">Unassigned</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</AutoSubmitSelect></form></td>
          <td className="small">{fmtShort(t.plannedStart)} → <b>{fmtShort(t.plannedEnd)}</b>{t.actualEnd && <div className="muted">done {fmtShort(t.actualEnd.toISOString().slice(0, 10))}</div>}</td>
          <td style={{ minWidth: 180 }}><div className="gantt"><span className="pl" style={{ left: L(s0), width: L(Math.max(e0 - s0, 0.4)) }} />
            {as != null && <span className="ac" style={{ left: L(as), width: L(Math.max(ae - as, 0.4)) }} />}<span className="today" style={{ left: L(d) }} /></div></td>
          <td><span className={'pill ' + c2}>{s2}</span>{ph(t.id).length > 0 && <div className="small">{ph(t.id).map((p, i) => <a key={p.path} href={`/api/files/${p.path}`} target="_blank" style={{ marginRight: 6 }}>photo {i + 1}</a>)}</div>}</td>
          <td>{t.status !== 'COMPLETED' && (t.field ? <span className="small muted">via field app</span> : <form action={officeDoneAction}><input type="hidden" name="taskId" value={t.id} /><input type="hidden" name="poId" value={po.id} /><button className="btn sm">Mark done</button></form>)}</td></tr>); })}</tbody></table></div></div>
    <div className="grid two">
      <div className="card"><h2>PO lines</h2><table><thead><tr><th>#</th><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead>
        <tbody>{lines.map((l) => <tr key={l.id}><td>{l.lineNo}</td><td>{l.description}<div className="small muted">{l.itemCode}</div></td><td>{Number(l.qty)}</td><td>{inr(l.rate)}</td><td>{inr(l.amount)}</td></tr>)}</tbody></table></div>
      <div className="card"><h2>Request approval</h2><form action={requestApprovalAction} className="form"><input type="hidden" name="poId" value={po.id} />
        <label className="f">Type<select name="type"><option>Material request</option><option>Sublet work order</option><option>PO amendment</option><option>Expense</option></select></label>
        <label className="f">What for *<input name="title" required /></label><label className="f">Amount (₹) *<input name="amount" type="number" min="1" required /></label>
        <label className="f">Details<input name="detail" /></label><button className="btn pri">Send for approval</button></form>
        <div className="small muted" style={{ marginTop: 6 }}>Up to the approval limit is auto-approved; above it goes to the HOD.</div></div>
    </div>
  </>);
}
