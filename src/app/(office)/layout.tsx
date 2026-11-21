import { and, count, eq, lt, ne } from 'drizzle-orm';
import { db } from '@/db';
import { approvals, tasks } from '@/db/schema';
import { requireUser } from '@/lib/auth';
import { logoutAction } from '@/app/actions';
import { todayIST } from '@/lib/dates';
import Nav from '@/components/Nav';

export default async function OfficeLayout({ children }: { children: React.ReactNode }) {
  const u = await requireUser();
  const [[od], [ap]] = await Promise.all([
    db.select({ n: count() }).from(tasks).where(and(ne(tasks.status, 'COMPLETED'), lt(tasks.plannedEnd, todayIST()))),
    db.select({ n: count() }).from(approvals).where(eq(approvals.status, 'PENDING')),
  ]);
  return (
    <div className="app">
      <nav className="side" aria-label="Main menu">
        <div className="brand"><div className="logo">IDC</div><div><b>IDC One-Stop</b><small>CRM · ERP · Field App</small></div></div>
        <Nav badges={{ '/tasks': od.n, '/approvals': ap.n }} />
        <div style={{ flex: 1 }} />
        <div className="small" style={{ color: '#A9B4CC', padding: '10px 8px', borderTop: '1px solid var(--navy2)', marginTop: 12 }}>
          <b style={{ color: '#fff' }}>{u.name}</b><br />{u.designation} · {u.employeeId}
          <form action={logoutAction}><button className="btn sm" style={{ marginTop: 8 }}>Log out</button></form>
        </div>
      </nav>
      <main>{children}</main>
    </div>
  );
}
