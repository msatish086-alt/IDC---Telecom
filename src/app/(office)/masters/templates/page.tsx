import Link from 'next/link';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { taskTemplates, templateSteps } from '@/db/schema';
import { planDays } from '@/lib/planning';
import { updateTatAction } from '@/app/actions';
import { inr } from '@/lib/money';
export const dynamic = 'force-dynamic';
export default async function Templates({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const sel = (await searchParams).t || 'EB';
  const tpls = await db.select().from(taskTemplates).orderBy(asc(taskTemplates.projectType));
  const tpl = tpls.find((x) => x.projectType === sel) ?? tpls[0];
  const steps = tpl ? await db.select().from(templateSteps).where(eq(templateSteps.templateId, tpl.id)).orderBy(asc(templateSteps.seq)) : [];
  const plan = new Map(planDays(steps).map((p) => [p.code, p]));
  const last = Math.max(0, ...[...plan.values()].map((p) => p.endDay));
  const audit = steps.find((s) => /indus audit/i.test(s.step));
  return (<>
    <div className="chips">{tpls.map((t) => <Link key={t.id} href={`/masters/templates?t=${t.projectType}`} className={'chip' + (t.id === tpl?.id ? ' on' : '')} style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>{t.name}</Link>)}</div>
    <p className="small muted">{steps.length} steps · invoice by day {last}{audit ? ` · audit offered day ${plan.get(audit.code)?.startDay}` : ''} · TATs in calendar days; change a TAT and new POs use it (existing POs keep their plan).</p>
    <div className="tbl-wrap"><table><thead><tr><th>ID</th><th>Step</th><th>Owner</th><th>Starts after</th><th>TAT (days)</th><th>Start</th><th>End</th><th>Field?</th><th>Cost (₹)</th></tr></thead>
      <tbody>{steps.map((s) => (<tr key={s.id}><td>{s.code}</td><td>{s.step}</td><td className="small">{s.ownerText}</td><td>{s.afterCode ?? '—'}</td>
        <td><form action={updateTatAction} className="row"><input type="hidden" name="stepId" value={s.id} /><input name="tatDays" type="number" min="0" defaultValue={s.tatDays} style={{ width: 64 }} aria-label={`TAT for ${s.code}`} /><button className="btn sm">Save</button></form></td>
        <td>{plan.get(s.code)?.startDay}</td><td><b>{plan.get(s.code)?.endDay}</b></td><td>{s.field ? 'Yes' : ''}</td><td className="small">{s.costMin || s.costMax ? `${inr(s.costMin)}–${inr(s.costMax)}` : '—'}</td></tr>))}</tbody></table></div>
  </>);
}
