import Link from 'next/link';
import { poSummaries } from '@/lib/queries';
import { diffDays, fmtShort, todayIST } from '@/lib/dates';
import { inr } from '@/lib/money';
import { poStage } from '@/lib/view';
import { PROJECT_TYPES } from '@/lib/services';
import { auditAction, invoiceAction, markPaidAction, wccAction } from '@/app/actions';

export const dynamic = 'force-dynamic';
export default async function Billing() {
  const pos = await poSummaries(); const today = todayIST();
  const inv = pos.filter((p) => p.invoice).map((p) => ({ ...p.invoice!, poNumber: p.po.poNumber }));
  return (<>
    <div className="top"><div><h1>WCC & Billing</h1><div className="sub">Audit offered → WCC within 7 days → IDC tax invoice next working day</div></div></div>
    <div className="card"><h2>WCC tracker</h2><div className="tbl-wrap"><table><thead><tr><th>PO</th><th>Tasks</th><th>Audit offered</th><th>WCC</th><th>Stage</th><th>Next action</th></tr></thead>
      <tbody>{pos.map(({ po, site, pct, invoice }) => { const [st, c] = poStage(po, !!invoice, pct); return (
        <tr key={po.id}><td><Link href={`/pos/${po.id}`}><b>{po.poNumber}</b></Link><div className="small muted">{PROJECT_TYPES[po.projectType]} · {site?.siteId}</div></td><td>{pct}%</td>
          <td>{fmtShort(po.auditOfferedAt)}{po.auditOfferedAt && !po.wccNo && <div className={'small ' + (diffDays(today, po.auditOfferedAt) > 7 ? 'err' : 'muted')}>{diffDays(today, po.auditOfferedAt)} d since audit</div>}</td>
          <td>{po.wccNo ?? '—'}<div className="small muted">{fmtShort(po.wccDate)}</div></td><td><span className={'pill ' + c}>{st}</span></td>
          <td>{invoice ? <Link href={`/invoice/${invoice.id}`}>{invoice.number}</Link>
            : po.wccNo ? <form action={invoiceAction}><input type="hidden" name="poId" value={po.id} /><button className="btn sm pri">Raise invoice</button></form>
            : po.auditOfferedAt ? <form action={wccAction} className="row"><input type="hidden" name="poId" value={po.id} /><input name="wccNo" placeholder="WCC no." required style={{ width: 110 }} /><input type="hidden" name="wccDate" value={today} /><button className="btn sm pri">Record WCC</button></form>
            : <form action={auditAction}><input type="hidden" name="poId" value={po.id} /><button className="btn sm" disabled={pct < 60}>Offer audit</button></form>}</td></tr>); })}</tbody></table></div></div>
    <div className="card"><h2>Invoices (AR)</h2><div className="tbl-wrap"><table><thead><tr><th>Invoice</th><th>Date</th><th>PO</th><th>Taxable</th><th>GST</th><th>Total</th><th>Status</th></tr></thead>
      <tbody>{inv.map((i) => (
        <tr key={i.id}><td><Link href={`/invoice/${i.id}`}><b>{i.number}</b></Link></td><td>{fmtShort(i.date)}</td><td>{i.poNumber}</td><td>{inr(i.taxable)}</td><td>{inr(Number(i.cgst) + Number(i.sgst))}</td><td><b>{inr(i.total)}</b></td>
          <td>{i.paid ? <span className="pill p-grn">Paid</span> : <form action={markPaidAction} className="row"><input type="hidden" name="invoiceId" value={i.id} /><span className="pill p-amb">Outstanding · {diffDays(today, i.date)} d</span><button className="btn sm">Mark paid</button></form>}</td></tr>))}
        {!inv.length && <tr><td colSpan={7} className="muted">No invoices yet</td></tr>}</tbody></table></div></div>
  </>);
}
