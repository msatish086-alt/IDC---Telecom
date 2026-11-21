import { asc } from 'drizzle-orm';
import { db } from '@/db';
import { vendors } from '@/db/schema';
import { addVendorAction } from '@/app/actions';
import MasterForm from '@/components/MasterForm';
export const dynamic = 'force-dynamic';
export default async function Vendors() {
  const rows = await db.select().from(vendors).orderBy(asc(vendors.code));
  return (<>
    <div className="tbl-wrap"><table><thead><tr><th>Code</th><th>Name</th><th>Type</th><th>GSTIN</th><th>Credit days</th><th>Sublet margin</th></tr></thead>
      <tbody>{rows.map((v) => <tr key={v.id}><td><b>{v.code}</b></td><td>{v.name}</td><td>{v.type}</td><td>{v.gstin ?? '—'}</td><td>{v.creditDays}</td><td>{v.subletMarginPct != null ? v.subletMarginPct + '%' : '—'}</td></tr>)}</tbody></table></div>
    <h2 style={{ marginTop: 16 }}>Add vendor</h2>
    <MasterForm action={addVendorAction} submit="Save vendor">
      <label className="f">Code *<input name="code" /></label><label className="f">Name *<input name="name" /></label>
      <label className="f">Type *<select name="type"><option>Supplier</option><option>Sublet</option><option>Transporter</option><option>Service</option></select></label>
      <label className="f">GSTIN<input name="gstin" /></label><label className="f">Credit days<input name="creditDays" defaultValue="30" /></label><label className="f">Sublet margin %<input name="margin" /></label>
    </MasterForm></>);
}
