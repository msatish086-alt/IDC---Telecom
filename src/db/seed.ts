/* Seed masters, task templates (from workbook v1.6) and sample POs. Run: npm run db:seed */
import { sql, eq, and, ne } from 'drizzle-orm';
import { db } from './index';
import { users, sites, vendors, taskTemplates, templateSteps, tasks, approvals } from './schema';
import { hashPin } from '../lib/pin';
import { createPO, scanAlerts, recordWCC, offerAudit, requestApproval, PROJECT_TYPES } from '../lib/services';
import { isFieldStep, informsIndus } from '../lib/planning';
import { addDays, diffDays, todayIST } from '../lib/dates';
import templates from './templates.json';

type Row = [string, string, string, string, number, number, number, string, number, number];

async function main() {
  const today = todayIST();
  console.log('Seeding for', today);
  await db.execute(sql`TRUNCATE alerts, approvals, invoices, task_photos, tasks, po_lines, purchase_orders, template_steps, task_templates, vendors, sites, users, counters CASCADE`);

  const pin = hashPin('1234');
  const U = [
    ['ADMIN-001', 'System Admin', 'IT', 'Administrator', 'ADMIN', null],
    ['HO-001', 'Neha Sharma', 'Front Desk', 'HO Coordinator', 'HO', null],
    ['PM-014', 'Ravi Kumar', 'Projects', 'Project Manager', 'PM', null],
    ['HOD-01', 'Arun', 'Projects — EB', 'HOD', 'HOD', null],
    ['HOD-02', 'Bhola', 'Projects — Upgrade & Solar', 'HOD', 'HOD', null],
    ['FT-101', 'Suresh Yadav', 'Field', 'Site Supervisor', 'FIELD', null],
    ['FT-102', 'Amit Verma', 'Field', 'Technician', 'FIELD', null],
    ['FIN-01', 'Pooja Gupta', 'Finance', 'Accounts Manager', 'FINANCE', null],
    ['WH-01', 'Store Keeper', 'Warehouse', 'Warehouse Manager', 'WAREHOUSE', null],
  ] as const;
  await db.insert(users).values(U.map(([employeeId, name, department, designation, role, zone]) => ({ employeeId, name, department, designation, role, zone, pinHash: pin })));

  await db.insert(sites).values([
    { siteId: 'UP-MRT-2207', name: 'Meerut Sector 12', district: 'Meerut', zone: 'UP West', lat: 28.9845, lng: 77.7064 },
    { siteId: 'UP-LKO-1043', name: 'Lucknow Gomti Nagar', district: 'Lucknow', zone: 'UP East', lat: 26.8500, lng: 81.0080 },
    { siteId: 'UP-GZB-0412', name: 'Ghaziabad Raj Nagar', district: 'Ghaziabad', zone: 'UP West', lat: 28.6830, lng: 77.4370 },
    { siteId: 'UP-KNP-0611', name: 'Kanpur Kidwai Nagar', district: 'Kanpur', zone: 'UP East', lat: 26.4290, lng: 80.3210 },
    { siteId: 'UP-LKO-1050', name: 'Lucknow Aliganj', district: 'Lucknow', zone: 'UP East', lat: 26.8920, lng: 80.9440 },
    { siteId: 'UP-MRT-2190', name: 'Meerut Shastri Nagar', district: 'Meerut', zone: 'UP West', lat: 28.9600, lng: 77.6900 },
  ]);
  await db.insert(vendors).values([
    { code: 'V-021', name: 'Sublet vendor V-021', type: 'Sublet', subletMarginPct: 82, creditDays: 30 },
    { code: 'S-014', name: 'Supplier S-014 (cables)', type: 'Supplier', creditDays: 30 },
    { code: 'T-07', name: 'Transporter T-07', type: 'Transporter', creditDays: 15 },
  ]);

  for (const [type, rows] of Object.entries(templates as unknown as Record<string, Row[]>)) {
    const [tpl] = await db.insert(taskTemplates).values({ projectType: type, name: PROJECT_TYPES[type] }).returning();
    await db.insert(templateSteps).values(rows.map((r, i) => ({
      templateId: tpl.id, code: r[0], seq: i + 1, step: r[1], ownerText: r[2] || '—', afterCode: r[3] || null, tatDays: Math.round(r[4] || 0),
      field: isFieldStep(r[1]), informIndus: informsIndus(r[1]), evidence: r[7] || null, costMin: r[8] || null, costMax: r[9] || null,
    })));
  }

  const [ho] = await db.select().from(users).where(eq(users.employeeId, 'HO-001'));
  const mk = async (poNumber: string, projectType: string, siteId: string, rl: string, ago: number, lines: [string, number, number][], lag: number) => {
    const poDate = addDays(today, -ago);
    const r = await createPO({ poNumber, projectType, poDate, siteId, rl, lines: lines.map(([description, qty, rate]) => ({ description, qty, rate })) }, ho.id, { silent: true });
    if (!r.ok) throw new Error(r.errors.join('; '));
    for (const t of await db.select().from(tasks).where(eq(tasks.poId, r.po.id))) {
      const de = diffDays(t.plannedEnd, poDate), ds = diffDays(t.plannedStart, poDate);
      if (de <= ago - lag) await db.update(tasks).set({ status: 'COMPLETED', actualStart: new Date(t.plannedStart), actualEnd: new Date(addDays(t.plannedEnd, lag > 0 ? 1 : 0)) }).where(eq(tasks.id, t.id));
      else if (ds < ago) await db.update(tasks).set({ status: 'IN_PROGRESS', actualStart: new Date(t.plannedStart) }).where(eq(tasks.id, t.id));
    }
    return r.po;
  };
  await mk('3100458721', 'EB', 'UP-MRT-2207', 'RL 2716', 18, [['EB new connection — 10 kW, LT line 300 m', 1, 285000]], 2);
  await mk('3100459102', 'TCU', 'UP-LKO-1043', '', 32, [['TCU supply & installation', 1, 48502.67], ['Old SMPS dismantle', 2, 3771.67]], 4);
  await mk('3100459344', 'DG', 'UP-GZB-0412', '', 9, [['DG removal and return to Indus WH', 1, 20150]], 0);
  const sol = await mk('3100459810', 'SOLAR', 'UP-KNP-0611', '', 13, [['Solar 5 kWp supply, installation, commissioning', 1, 163443]], 1);
  const mount = await mk('3100457760', 'MOUNT', 'UP-LKO-1050', '', 24, [['Antenna / MW mount installation', 2, 2400]], 0);
  await db.update(tasks).set({ status: 'COMPLETED', actualEnd: new Date() }).where(and(eq(tasks.poId, mount.id), ne(tasks.status, 'COMPLETED')));
  await offerAudit(mount.id); await recordWCC(mount.id, 'WCC-IND-77310', addDays(today, -1));
  await mk('3100458600', 'TRX', 'UP-MRT-2190', '', 4, [['TRX installation', 1, 22000]], 0);

  const [pm] = await db.select().from(users).where(eq(users.employeeId, 'PM-014'));
  await requestApproval({ type: 'Material request', poId: sol.id, title: 'Solar mounting structure + DC cable', detail: 'PO 3100459810 · above ₹10,000 limit', amount: 38500, userId: pm.id });
  await requestApproval({ type: 'Sublet bill', title: 'Vendor V-021 — TCU installation', detail: 'Vendor margin 82% of PO value', amount: 42000, userId: pm.id });
  await requestApproval({ type: 'Petty expense', title: 'Site cleaning labour', detail: 'Within limit', amount: 1800, userId: pm.id });
  const n = await scanAlerts(today);
  console.log('Seed done. Alerts raised:', n, '· Login with any Employee ID (e.g. HO-001, FT-101) and PIN 1234');
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
