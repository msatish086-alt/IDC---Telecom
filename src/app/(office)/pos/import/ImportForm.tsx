'use client';
import { useActionState, useState, useEffect } from 'react';
import { createPOAction, parsePOAction } from '@/app/actions';
import type { PODraft } from '@/lib/poImport';

type Line = PODraft['lines'][number];
const blank = (): PODraft => ({ poNumber: '', poDate: new Date().toISOString().slice(0, 10), description: '', circle: '', siteId: '', rl: '', projectType: '', total: 0, lines: [{ lineNo: 1, itemCode: '', description: '', uom: 'Each', qty: 1, rate: 0, siteCode: '', projectName: '', taskName: '' }], warnings: [] });

export default function ImportForm({ sites, types }: { sites: { siteId: string; name: string }[]; types: Record<string, string> }) {
  const [parsed, parse, parsing] = useActionState(parsePOAction, {});
  const [created, create, creating] = useActionState(createPOAction, {});
  const [d, setD] = useState<PODraft | null>(null);
  useEffect(() => { if (parsed.draft) setD(parsed.draft); }, [parsed]);
  const set = (k: keyof PODraft, v: string) => setD((x) => (x ? { ...x, [k]: v } : x));
  const setL = (i: number, k: keyof Line, v: string) => setD((x) => x && { ...x, lines: x.lines.map((l, j) => (j === i ? { ...l, [k]: k === 'qty' || k === 'rate' ? Number(v) : v } : l)) });
  const sum = d ? d.lines.reduce((a, l) => a + l.qty * l.rate, 0) : 0;
  return (<>
    <form action={parse} className="card row">
      <label className="f" style={{ flex: 1 }}>Indus PO Excel (.xlsx)<input type="file" name="file" accept=".xlsx" required /></label>
      <button className="btn pri" disabled={parsing}>{parsing ? 'Reading…' : 'Read file'}</button>
      <button type="button" className="btn" onClick={() => setD(blank())}>Enter manually</button>
      {parsed.error && <div className="err" style={{ width: '100%' }}>{parsed.error}</div>}
    </form>
    {d && (
      <form action={create} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2>Check before creating</h2>
        {d.warnings.map((w) => <div key={w} className="pill p-amb" style={{ whiteSpace: 'normal' }}>{w}</div>)}
        <div className="form">
          <label className="f">PO number *<input name="poNumber" value={d.poNumber} onChange={(e) => set('poNumber', e.target.value)} required /></label>
          <label className="f">PO date *<input type="date" name="poDate" value={d.poDate} onChange={(e) => set('poDate', e.target.value)} required /></label>
          <label className="f">Project type *<select name="projectType" value={d.projectType} onChange={(e) => set('projectType', e.target.value)} required>
            <option value="">Choose</option>{Object.entries(types).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label className="f">Indus site ID *<input name="siteId" list="sitelist" value={d.siteId} onChange={(e) => set('siteId', e.target.value)} required /></label>
          <label className="f">RL / work package<input name="rl" value={d.rl} onChange={(e) => set('rl', e.target.value)} /></label>
          <label className="f">Circle<input name="circle" value={d.circle} onChange={(e) => set('circle', e.target.value)} /></label>
        </div>
        <datalist id="sitelist">{sites.map((s) => <option key={s.siteId} value={s.siteId}>{s.name}</option>)}</datalist>
        <label className="f">PO description<input name="description" value={d.description} onChange={(e) => set('description', e.target.value)} /></label>
        <input type="hidden" name="lineCount" value={d.lines.length} />
        <div className="tbl-wrap"><table><thead><tr><th>#</th><th>Item code</th><th>Description</th><th>UOM</th><th>Qty</th><th>Rate (₹)</th><th>Amount</th></tr></thead>
          <tbody>{d.lines.map((l, i) => (
            <tr key={i}><td>{i + 1}</td>
              <td><input name={`l${i}_itemCode`} value={l.itemCode} onChange={(e) => setL(i, 'itemCode', e.target.value)} style={{ width: 150 }} /></td>
              <td><input name={`l${i}_description`} value={l.description} onChange={(e) => setL(i, 'description', e.target.value)} style={{ minWidth: 260 }} /></td>
              <td><input name={`l${i}_uom`} value={l.uom} onChange={(e) => setL(i, 'uom', e.target.value)} style={{ width: 70 }} /></td>
              <td><input name={`l${i}_qty`} type="number" step="any" value={l.qty} onChange={(e) => setL(i, 'qty', e.target.value)} style={{ width: 80 }} /></td>
              <td><input name={`l${i}_rate`} type="number" step="any" value={l.rate} onChange={(e) => setL(i, 'rate', e.target.value)} style={{ width: 110 }} /></td>
              <td>₹{(l.qty * l.rate).toLocaleString('en-IN')}<input type="hidden" name={`l${i}_siteCode`} value={l.siteCode} /></td></tr>))}</tbody></table></div>
        <div className="row"><button type="button" className="btn sm" onClick={() => setD({ ...d, lines: [...d.lines, { ...blank().lines[0], lineNo: d.lines.length + 1 }] })}>+ Add line</button>
          <span className="b">PO value: ₹{sum.toLocaleString('en-IN')}</span></div>
        {created.errors?.map((e) => <div key={e} className="err">{e}</div>)}
        <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn pri" disabled={creating}>{creating ? 'Creating…' : 'Create PO & plan tasks'}</button></div>
      </form>)}
  </>);
}
