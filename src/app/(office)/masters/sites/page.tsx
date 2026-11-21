import { asc } from 'drizzle-orm';
import { db } from '@/db';
import { sites } from '@/db/schema';
import { addSiteAction } from '@/app/actions';
import MasterForm from '@/components/MasterForm';
export const dynamic = 'force-dynamic';
export default async function Sites() {
  const rows = await db.select().from(sites).orderBy(asc(sites.siteId));
  return (<>
    <div className="tbl-wrap"><table><thead><tr><th>Indus site ID</th><th>Name</th><th>District</th><th>Zone</th><th>GPS</th><th>Geo-fence</th></tr></thead>
      <tbody>{rows.map((s) => <tr key={s.id}><td><b>{s.siteId}</b></td><td>{s.name}</td><td>{s.district}</td><td>{s.zone}</td><td className="small">{s.lat != null ? `${s.lat.toFixed(4)}, ${s.lng?.toFixed(4)}` : <span className="err">missing — start not geo-checked</span>}</td><td>{s.fenceM} m</td></tr>)}</tbody></table></div>
    <h2 style={{ marginTop: 16 }}>Add site</h2>
    <MasterForm action={addSiteAction} submit="Save site">
      <label className="f">Indus site ID *<input name="siteId" /></label><label className="f">Name *<input name="name" /></label><label className="f">District *<input name="district" /></label>
      <label className="f">Zone *<select name="zone"><option>UP East</option><option>UP West</option></select></label>
      <label className="f">Latitude<input name="lat" inputMode="decimal" /></label><label className="f">Longitude<input name="lng" inputMode="decimal" /></label><label className="f">Geo-fence (m)<input name="fenceM" defaultValue="200" /></label>
    </MasterForm></>);
}
