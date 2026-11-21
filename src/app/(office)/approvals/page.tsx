import { desc, eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '@/db';
import { approvals, users } from '@/db/schema';
import { fmtShort } from '@/lib/dates';
import { inr } from '@/lib/money';
import { decideAction } from '@/app/actions';
import { APPROVAL_LIMIT } from '@/lib/services';
import { currentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export default async function Approvals() {
  const me = await currentUser(); const decider = alias(users, 'decider');
  const rows = await db.select({ a: approvals, by: users, dec: decider }).from(approvals).innerJoin(users, eq(approvals.raisedById, users.id))
    .leftJoin(decider, eq(approvals.decidedById, decider.id)).orderBy(desc(approvals.createdAt));
  const canDecide = me?.role === 'HOD' || me?.role === 'ADMIN';
  return (<>
    <div className="top"><div><h1>Approvals</h1><div className="sub">Approval limit ₹{APPROVAL_LIMIT.toLocaleString('en-IN')} — above it goes to the HOD (configurable)</div></div></div>
    <div className="card"><div className="tbl-wrap"><table><thead><tr><th>Type</th><th>What for</th><th>Amount</th><th>Raised by</th><th>Status / action</th></tr></thead>
      <tbody>{rows.map(({ a, by, dec }) => (
        <tr key={a.id}><td><b>{a.type}</b><div className="small muted">{fmtShort(a.createdAt.toISOString().slice(0, 10))}</div></td><td>{a.title}<div className="small muted">{a.detail}</div></td>
          <td>{inr(a.amount)}</td><td>{by.name}</td>
          <td>{a.status === 'PENDING' ? (canDecide ? <form action={decideAction} className="row"><input type="hidden" name="id" value={a.id} /><input name="comment" placeholder="Comment" style={{ width: 130 }} />
            <button name="decision" value="approve" className="btn sm pri">Approve</button><button name="decision" value="reject" className="btn sm red">Reject</button></form> : <span className="pill p-amb">Waiting for HOD</span>)
            : <><span className={'pill ' + (a.status === 'APPROVED' ? 'p-grn' : 'p-red')}>{a.status === 'APPROVED' ? 'Approved' : 'Rejected'}</span><div className="small muted">{dec ? dec.name : ''} {a.comment}</div></>}</td></tr>))}
        {!rows.length && <tr><td colSpan={5} className="muted">No approvals yet</td></tr>}</tbody></table></div></div>
  </>);
}
