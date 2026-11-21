import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { alerts } from '@/db/schema';
import AlertRow from '@/components/AlertRow';
import { scanAction } from '@/app/actions';

export const dynamic = 'force-dynamic';
export default async function Alerts({ searchParams }: { searchParams: Promise<{ l?: string }> }) {
  const l = (await searchParams).l || 'all';
  const rows = await db.select().from(alerts).where(l === 'all' ? undefined : eq(alerts.level, l)).orderBy(desc(alerts.createdAt)).limit(300);
  return (<>
    <div className="top"><div><h1>Alerts & Messages</h1><div className="sub">Sent automatically — app, SMS / WhatsApp, email · escalation owner → PM → HOD → management</div></div>
      <form action={scanAction}><button className="btn sm">Run alert check now</button></form></div>
    <div className="chips">{[['all', 'All'], ['red', 'Red'], ['amber', 'Amber'], ['info', 'Info'], ['green', 'Done']].map(([k, t]) => <Link key={k} href={`/alerts?l=${k}`} className={'chip' + (l === k ? ' on' : '')} style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>{t}</Link>)}
      <span className="small muted" style={{ alignSelf: 'center' }}>{rows.length} messages</span></div>
    <div className="card">{rows.length ? rows.map((a) => <AlertRow key={a.id} a={a} />) : <div className="muted">None</div>}</div>
  </>);
}
