import type { Alert } from '@/db/schema';
import { fmtShort } from '@/lib/dates';
const COL: Record<string, string> = { red: '#DC2626', amber: '#F59E0B', info: '#2563EB', green: '#0F766E' };
export default function AlertRow({ a }: { a: Alert }) {
  return (
    <div className="alert"><span className="dot" style={{ background: COL[a.level] ?? '#2563EB' }} />
      <div style={{ flex: 1, minWidth: 0 }}><div className="b" style={{ fontSize: 13 }}>{a.message}</div>
        <div className="small muted">{a.code} · To: {a.recipients} · {a.channels}{a.sentAt ? ' · sent' : ''}</div></div>
      <span className="small muted" style={{ whiteSpace: 'nowrap' }}>{fmtShort(a.createdAt.toISOString().slice(0, 10))}</span></div>
  );
}
