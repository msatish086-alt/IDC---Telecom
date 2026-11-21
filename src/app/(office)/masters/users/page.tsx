import { asc } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { addUserAction } from '@/app/actions';
import MasterForm from '@/components/MasterForm';
export const dynamic = 'force-dynamic';
export default async function Users() {
  const rows = await db.select().from(users).orderBy(asc(users.employeeId));
  return (<>
    <div className="tbl-wrap"><table><thead><tr><th>Employee ID</th><th>Name</th><th>Department</th><th>Designation</th><th>Role</th><th>Zone</th><th>Mobile</th></tr></thead>
      <tbody>{rows.map((u) => <tr key={u.id}><td><b>{u.employeeId}</b></td><td>{u.name}</td><td>{u.department}</td><td>{u.designation}</td><td>{u.role}</td><td>{u.zone ?? 'All'}</td><td>{u.mobile ?? '—'}</td></tr>)}</tbody></table></div>
    <h2 style={{ marginTop: 16 }}>Add user</h2>
    <MasterForm action={addUserAction} submit="Save user">
      <label className="f">Employee ID *<input name="employeeId" /></label><label className="f">Name *<input name="name" /></label>
      <label className="f">Department *<select name="department" defaultValue=""><option value="">Select</option><option>Front Desk</option><option>Projects</option><option>Field</option><option>Warehouse</option><option>Finance</option><option>IT</option></select></label>
      <label className="f">Designation *<input name="designation" /></label>
      <label className="f">Role *<select name="role" defaultValue="FIELD">{['FIELD', 'PM', 'HOD', 'HO', 'FINANCE', 'WAREHOUSE', 'ADMIN'].map((r) => <option key={r}>{r}</option>)}</select></label>
      <label className="f">Zone<select name="zone" defaultValue=""><option value="">All</option><option>UP East</option><option>UP West</option></select></label>
      <label className="f">Mobile<input name="mobile" /></label><label className="f">Login PIN (4–6 digits) *<input name="pin" inputMode="numeric" /></label>
    </MasterForm></>);
}
