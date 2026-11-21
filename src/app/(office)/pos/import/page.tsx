import { db } from '@/db';
import { sites } from '@/db/schema';
import { requireUser } from '@/lib/auth';
import ImportForm from './ImportForm';
import { PROJECT_TYPES } from '@/lib/services';

export default async function ImportPage() {
  await requireUser(['HO', 'PM', 'HOD']);
  const s = await db.select({ siteId: sites.siteId, name: sites.name }).from(sites).orderBy(sites.siteId);
  return (<>
    <div className="top"><div><h1>Import Indus PO</h1><div className="sub">Upload the Excel export from Indus ERP · check what was read · create the PO and its task plan</div></div></div>
    <ImportForm sites={s} types={PROJECT_TYPES} />
  </>);
}
