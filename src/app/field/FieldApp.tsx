'use client';
import { useCallback, useEffect, useState } from 'react';
import { CHECKLIST } from '@/lib/checklist';
import { logoutAction } from '@/app/actions';

type FTask = {
  id: string; code: string; step: string; status: string; tatDays: number; plannedStart: string; plannedEnd: string; evidence: string | null;
  checklist: number[]; remarks: string; photos: number; po: { number: string; type: string }; site: { id: string; name: string; fenceM: number; hasGps: boolean } | null;
};
type QItem = { qid: string; taskId: string; kind: 'start' | 'close'; lat?: number; lng?: number; checklist?: number[]; remarks?: string; photos?: Blob[]; at: number };

// ---------- tiny IndexedDB queue for offline work
const DB = 'idc-field', STORE = 'queue';
function idb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'qid' }); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
}
async function qAll(): Promise<QItem[]> { const d = await idb(); return new Promise((res) => { const r = d.transaction(STORE).objectStore(STORE).getAll(); r.onsuccess = () => res((r.result as QItem[]).sort((a, b) => a.at - b.at)); r.onerror = () => res([]); }); }
async function qPut(i: QItem) { const d = await idb(); return new Promise<void>((res) => { const t = d.transaction(STORE, 'readwrite'); t.objectStore(STORE).put(i); t.oncomplete = () => res(); }); }
async function qDel(qid: string) { const d = await idb(); return new Promise<void>((res) => { const t = d.transaction(STORE, 'readwrite'); t.objectStore(STORE).delete(qid); t.oncomplete = () => res(); }); }

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fd = (s: string) => { const [, m, d] = s.split('-').map(Number); return `${String(d).padStart(2, '0')} ${MON[m - 1]}`; };
const days = (a: string, b: string) => Math.round((Date.parse(a) - Date.parse(b)) / 86400000);

function getGPS(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((res) => {
    if (!('geolocation' in navigator)) return res(null);
    navigator.geolocation.getCurrentPosition((p) => res({ lat: p.coords.latitude, lng: p.coords.longitude }), () => res(null), { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  });
}

async function send(i: QItem): Promise<{ ok: boolean; error?: string; offline?: boolean }> {
  try {
    if (i.kind === 'start') {
      const r = await fetch(`/api/field/tasks/${i.taskId}/start`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lat: i.lat, lng: i.lng }) });
      const j = await r.json().catch(() => ({})); return r.ok ? { ok: true } : { ok: false, error: j.error || 'Could not start' };
    }
    const f = new FormData();
    (i.photos || []).forEach((b, n) => f.append('photos', b, `photo-${n + 1}.jpg`));
    f.set('checklist', JSON.stringify(i.checklist || [])); f.set('remarks', i.remarks || '');
    if (i.lat != null) { f.set('lat', String(i.lat)); f.set('lng', String(i.lng)); }
    const r = await fetch(`/api/field/tasks/${i.taskId}/close`, { method: 'POST', body: f });
    const j = await r.json().catch(() => ({})); return r.ok ? { ok: true } : { ok: false, error: j.error || 'Could not close' };
  } catch { return { ok: false, offline: true }; }
}

export default function FieldApp({ name, isField }: { name: string; isField: boolean }) {
  const [list, setList] = useState<FTask[]>([]);
  const [today, setToday] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [queue, setQueue] = useState<QItem[]>([]);
  const [online, setOnline] = useState(true);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [ck, setCk] = useState<Record<string, number[]>>({});
  const [rem, setRem] = useState<Record<string, string>>({});
  const [pics, setPics] = useState<Record<string, File[]>>({});

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/field/tasks', { cache: 'no-store' });
      if (r.status === 401) { location.href = '/login'; return; }
      const j = await r.json(); setList(j.tasks); setToday(j.today);
      localStorage.setItem('idc-field-cache', JSON.stringify(j));
    } catch {
      const c = localStorage.getItem('idc-field-cache'); if (c) { const j = JSON.parse(c); setList(j.tasks); setToday(j.today); }
    }
    setQueue(await qAll().catch(() => []));
  }, []);

  const sync = useCallback(async () => {
    const items = await qAll().catch(() => []); let done = 0;
    for (const i of items) { const r = await send(i); if (r.ok || !r.offline) { await qDel(i.qid); if (r.ok) done++; else setMsg(`Sync: ${r.error}`); } else break; }
    if (done) setMsg(`${done} update(s) synced to ERP.`);
    await load();
  }, [load]);

  useEffect(() => {
    setOnline(navigator.onLine); load(); sync();
    const on = () => { setOnline(true); sync(); }, off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, [load, sync]);

  const queued = (id: string) => queue.filter((q) => q.taskId === id);
  const statusOf = (t: FTask) => queued(t.id).some((q) => q.kind === 'close') ? 'COMPLETED' : queued(t.id).some((q) => q.kind === 'start') ? 'IN_PROGRESS' : t.status;

  async function start(t: FTask) {
    setBusy(true); setMsg('Getting your location…');
    const g = await getGPS();
    if (!g && t.site?.hasGps) { setBusy(false); setMsg('Turn on location (GPS) to start — start works only at the site.'); return; }
    const item: QItem = { qid: crypto.randomUUID(), taskId: t.id, kind: 'start', lat: g?.lat, lng: g?.lng, at: Date.now() };
    const r = await send(item);
    if (r.offline) { await qPut(item); setMsg('No network — start saved on phone, will sync.'); }
    else setMsg(r.ok ? 'Task started.' : r.error || 'Could not start');
    setBusy(false); await load();
  }
  async function close(t: FTask) {
    setBusy(true); setMsg('Closing…');
    const g = await getGPS();
    const item: QItem = { qid: crypto.randomUUID(), taskId: t.id, kind: 'close', lat: g?.lat, lng: g?.lng, checklist: ck[t.id] ?? t.checklist, remarks: rem[t.id] ?? t.remarks, photos: pics[t.id] ?? [], at: Date.now() };
    const r = await send(item);
    if (r.offline) { await qPut(item); setMsg('No network — closed on phone, will sync when network returns.'); setOpen(null); }
    else if (r.ok) { setMsg('Task closed — ERP updated, next owner and Indus informed.'); setOpen(null); setPics((p) => ({ ...p, [t.id]: [] })); }
    else setMsg(r.error || 'Could not close');
    setBusy(false); await load();
  }

  const t = list.find((x) => x.id === open);
  const groups: [string, FTask[]][] = today ? [
    ['Overdue', list.filter((x) => statusOf(x) !== 'COMPLETED' && x.plannedEnd < today)],
    ['Today', list.filter((x) => statusOf(x) !== 'COMPLETED' && x.plannedEnd >= today && x.plannedStart <= today)],
    ['Coming up', list.filter((x) => statusOf(x) !== 'COMPLETED' && x.plannedStart > today)],
    ['Done today', list.filter((x) => statusOf(x) === 'COMPLETED')],
  ] : [];
  const chip = (x: FTask): [string, string] => {
    const s = statusOf(x); if (s === 'COMPLETED') return ['Completed', 'p-grn'];
    const l = days(x.plannedEnd, today); if (l < 0) return [`Overdue ${-l}d`, 'p-red']; if (l <= 2) return [`Due in ${l}d`, 'p-amb'];
    return s === 'IN_PROGRESS' ? ['In progress', 'p-blu'] : ['Not started', 'p-gry'];
  };

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <div className="ph-top" style={{ position: 'sticky', top: 0, zIndex: 5 }}>
        <b>IDC Field</b><span className="small">{online ? 'Online' : 'Offline'}{queue.length ? ` · ${queue.length} to sync` : ''}</span>
      </div>
      <div className="ph-body" style={{ maxHeight: 'none' }}>
        {!isField && <div className="pill p-blu" style={{ whiteSpace: 'normal' }}>You are viewing the field app as an office user — only tasks assigned to you appear. <a href="/">Back to office</a></div>}
        {msg && <div className="pill p-amb" style={{ whiteSpace: 'normal' }} role="status">{msg}</div>}
        {queue.length > 0 && online && <button className="btn pri" onClick={sync}>Sync {queue.length} update(s) now</button>}
        {!t && <>
          <div className="small">Namaste, <b>{name}</b></div>
          {groups.map(([g, arr]) => arr.length ? <div key={g} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="small b" style={{ color: 'var(--mute)' }}>{g}</div>
            {arr.map((x) => { const [s, c] = chip(x); return (
              <button key={x.id} className="tcard" onClick={() => setOpen(x.id)}><span className={'pill ' + c} style={{ alignSelf: 'flex-start' }}>{s}</span>
                <b>{x.step}</b><span className="small muted">{x.site?.id} · PO {x.po.number}</span><span className="small">Due {fd(x.plannedEnd)}</span></button>); })}
          </div> : null)}
          {today && !list.length && <div className="muted small">No tasks right now.</div>}
          <form action={logoutAction}><button className="btn sm">Log out</button></form>
        </>}
        {t && (() => { const s = statusOf(t); const sel = ck[t.id] ?? t.checklist; const np = (pics[t.id] ?? []).length; const ok = new Set(sel).size === CHECKLIST.length && t.photos + np > 0; const [cs, cc] = chip(t);
          return (<>
            <button className="btn sm" onClick={() => setOpen(null)} style={{ alignSelf: 'flex-start' }}>← My tasks</button>
            <div className="tcard"><span className={'pill ' + cc} style={{ alignSelf: 'flex-start' }}>{cs}</span><b style={{ fontSize: 16 }}>{t.step}</b>
              <span className="small muted">PO {t.po.number} · {t.po.type}</span><span className="small">{t.site?.id} — {t.site?.name}</span>
              <span className="small">Planned {fd(t.plannedStart)} → {fd(t.plannedEnd)} · TAT {t.tatDays} d</span>{t.evidence && <span className="small muted">Evidence: {t.evidence}</span>}</div>
            {s === 'NOT_STARTED' && <><button className="btn pri big" disabled={busy} onClick={() => start(t)}>▶ Start task</button>
              <div className="small muted">{t.site?.hasGps ? `Start works only within ${t.site.fenceM} m of the site.` : 'Site GPS not set in master — start is not geo-checked.'}</div></>}
            {s === 'IN_PROGRESS' && <>
              <div className="small b">Checklist</div>
              {CHECKLIST.map((label, i) => <label key={i} className="ck"><input type="checkbox" checked={sel.includes(i)} onChange={(e) => setCk({ ...ck, [t.id]: e.target.checked ? [...new Set([...sel, i])] : sel.filter((x) => x !== i) })} /> {label}</label>)}
              <label className="f"><span className="b" style={{ color: 'var(--ink)' }}>Site photos (camera)</span>
                <input type="file" accept="image/*" capture="environment" multiple onChange={(e) => setPics({ ...pics, [t.id]: [...(pics[t.id] ?? []), ...Array.from(e.target.files ?? [])] })} /></label>
              <div className="thumbs">{(pics[t.id] ?? []).map((f, i) => <img key={i} src={URL.createObjectURL(f)} alt={`Site photo ${i + 1}`} />)}</div>
              <div className="small muted">{t.photos} uploaded · {np} new</div>
              <label className="f">Remarks<textarea rows={2} value={rem[t.id] ?? t.remarks} onChange={(e) => setRem({ ...rem, [t.id]: e.target.value })} /></label>
              <button className="btn pri big" disabled={!ok || busy} onClick={() => close(t)}>✓ Close task</button>
              {!ok && <div className="small muted">Tick every checklist item and add at least one photo to close.</div>}
            </>}
            {s === 'COMPLETED' && <div className="pill p-grn">Completed{queued(t.id).length ? ' — waiting to sync' : ''}</div>}
          </>); })()}
      </div>
    </div>
  );
}
