import Link from 'next/link';
import { poSummaries } from '@/lib/queries';
import { diffDays, fmt, todayIST } from '@/lib/dates';
import { inr } from '@/lib/money';
import { poStage } from '@/lib/view';
import { PROJECT_TYPES } from '@/lib/services';

export const dynamic = 'force-dynamic';
export default async function POs() {
  const pos = await poSummaries(); const today = todayIST();
  return (<>
    <div className="top"><div><h1>Purchase Orders</h1><div className="sub">Indus POs · every PO starts the 90-day billing clock</div></div>
      <Link href="/pos/import" className="btn pri" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>+ Import Indus PO (Excel)</Link></div>
    <div className="card"><div className="tbl-wrap"><table>
      <thead><tr><th>PO no.</th><th>PO date</th><th>Project type</th><th>Site</th><th>Value</th><th>Tasks done</th><th>Age</th><th>Stage</th></tr></thead>
      <tbody>{pos.map(({ po, site, pct, invoice }) => { const [st, c] = poStage(po, !!invoice, pct); return (
        <tr key={po.id}><td><Link href={`/pos/${po.id}`}><b>{po.poNumber}</b></Link></td><td>{fmt(po.poDate)}</td><td>{PROJECT_TYPES[po.projectType]}</td>
          <td>{site?.siteId}<div className="small muted">{site?.district}</div></td><td>{inr(po.value)}</td><td>{pct}%</td><td>Day {diffDays(today, po.poDate)}</td>
          <td><span className={'pill ' + c}>{st}</span></td></tr>); })}
        {!pos.length && <tr><td colSpan={8} className="muted">No POs yet — import the first Indus PO.</td></tr>}</tbody></table></div></div>
  </>);
}
