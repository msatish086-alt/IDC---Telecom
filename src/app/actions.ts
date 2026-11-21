'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { invoices, sites, templateSteps, users, vendors } from '@/db/schema';
import { checkPin, createSession, destroySession, hashPin, requireUser } from '@/lib/auth';
import {
  completeTask, createPO, decideApproval, offerAudit, raiseInvoice, reassignTask, recordWCC, requestApproval, scanAlerts, type POInput,
} from '@/lib/services';
import { parseIndusPO, type PODraft } from '@/lib/poImport';
import { todayIST } from '@/lib/dates';

const s = (f: FormData, k: string) => String(f.get(k) ?? '').trim();

// ---------- auth
export async function loginAction(_: unknown, f: FormData) {
  const [u] = await db.select().from(users).where(eq(users.employeeId, s(f, 'employeeId').toUpperCase()));
  if (!u || !u.active || !checkPin(s(f, 'pin'), u.pinHash)) return { error: 'Employee ID or PIN is wrong.' };
  await createSession(u.id);
  redirect(u.role === 'FIELD' ? '/field' : '/');
}
export async function logoutAction() { await destroySession(); redirect('/login'); }

// ---------- PO import
export async function parsePOAction(_: unknown, f: FormData): Promise<{ draft?: PODraft; error?: string }> {
  await requireUser(['HO', 'PM', 'HOD']);
  const file = f.get('file');
  if (!(file instanceof File) || !file.size) return { error: 'Choose the Indus PO Excel file first.' };
  try { return { draft: await parseIndusPO(await file.arrayBuffer()) }; }
  catch { return { error: 'This file could not be read. Upload the .xlsx export from Indus ERP.' }; }
}
export async function createPOAction(_: unknown, f: FormData): Promise<{ errors?: string[] }> {
  const u = await requireUser(['HO', 'PM', 'HOD']);
  const n = Number(s(f, 'lineCount') || 0);
  const lines: POInput['lines'] = [];
  for (let i = 0; i < n; i++) {
    const description = s(f, `l${i}_description`); if (!description) continue;
    lines.push({ lineNo: i + 1, itemCode: s(f, `l${i}_itemCode`), description, uom: s(f, `l${i}_uom`), qty: Number(s(f, `l${i}_qty`) || 1), rate: Number(s(f, `l${i}_rate`) || 0), siteCode: s(f, `l${i}_siteCode`) });
  }
  const r = await createPO({ poNumber: s(f, 'poNumber'), projectType: s(f, 'projectType'), poDate: s(f, 'poDate'), circle: s(f, 'circle'), description: s(f, 'description'), siteId: s(f, 'siteId'), rl: s(f, 'rl'), lines }, u.id);
  if (!r.ok) return { errors: r.errors };
  revalidatePath('/');
  redirect(`/pos/${r.po.id}`);
}

// ---------- tasks
export async function reassignAction(f: FormData) {
  await requireUser(['HO', 'PM', 'HOD']);
  await reassignTask(s(f, 'taskId'), s(f, 'assigneeId'));
  revalidatePath(`/pos/${s(f, 'poId')}`);
}
export async function officeDoneAction(f: FormData) {
  const u = await requireUser(['HO', 'PM', 'HOD', 'FINANCE']);
  await completeTask(s(f, 'taskId'), u.id);
  revalidatePath(`/pos/${s(f, 'poId')}`);
}

// ---------- WCC & billing
export async function auditAction(f: FormData) { await requireUser(['HO', 'PM', 'HOD']); await offerAudit(s(f, 'poId')); revalidatePath('/', 'layout'); }
export async function wccAction(f: FormData) {
  await requireUser(['HO', 'PM', 'HOD', 'FINANCE']);
  if (!s(f, 'wccNo')) return;
  await recordWCC(s(f, 'poId'), s(f, 'wccNo'), s(f, 'wccDate') || todayIST());
  revalidatePath('/', 'layout');
}
export async function invoiceAction(f: FormData) {
  await requireUser(['FINANCE', 'HO']);
  const r = await raiseInvoice(s(f, 'poId'));
  revalidatePath('/', 'layout');
  if (r.ok && r.invoice) redirect(`/invoice/${r.invoice.id}`);
}
export async function markPaidAction(f: FormData) {
  await requireUser(['FINANCE']);
  await db.update(invoices).set({ paid: true, paidAt: new Date() }).where(eq(invoices.id, s(f, 'invoiceId')));
  revalidatePath('/billing');
}

// ---------- approvals
export async function decideAction(f: FormData) {
  const u = await requireUser(['HOD']);
  await decideApproval(s(f, 'id'), u.id, s(f, 'decision') === 'approve', s(f, 'comment') || undefined);
  revalidatePath('/approvals');
}
export async function requestApprovalAction(f: FormData) {
  const u = await requireUser();
  const amount = Number(s(f, 'amount'));
  if (!s(f, 'title') || !(amount > 0)) return;
  await requestApproval({ type: s(f, 'type') || 'Material request', poId: s(f, 'poId') || undefined, title: s(f, 'title'), detail: s(f, 'detail'), amount, userId: u.id });
  revalidatePath('/approvals'); if (s(f, 'poId')) revalidatePath(`/pos/${s(f, 'poId')}`);
}

// ---------- alerts
export async function scanAction() { await requireUser(); await scanAlerts(); revalidatePath('/', 'layout'); }

// ---------- masters
export async function addUserAction(_: unknown, f: FormData): Promise<{ error?: string; ok?: string }> {
  await requireUser(['ADMIN', 'HO']);
  const v = { employeeId: s(f, 'employeeId').toUpperCase(), name: s(f, 'name'), department: s(f, 'department'), designation: s(f, 'designation'), role: s(f, 'role'), mobile: s(f, 'mobile'), zone: s(f, 'zone'), pin: s(f, 'pin') };
  const miss = (['employeeId', 'name', 'department', 'designation'] as const).filter((k) => !v[k]);
  if (miss.length) return { error: 'Compulsory: ' + miss.map((k) => ({ employeeId: 'Employee ID', name: 'Name', department: 'Department', designation: 'Designation' }[k])).join(', ') };
  if (!['ADMIN', 'HO', 'PM', 'HOD', 'FIELD', 'FINANCE', 'WAREHOUSE'].includes(v.role)) return { error: 'Choose a role' };
  if (!/^\d{4,6}$/.test(v.pin)) return { error: 'PIN must be 4–6 digits' };
  const [dup] = await db.select({ id: users.id }).from(users).where(eq(users.employeeId, v.employeeId));
  if (dup) return { error: `Employee ID ${v.employeeId} already exists` };
  await db.insert(users).values({ employeeId: v.employeeId, name: v.name, department: v.department, designation: v.designation, role: v.role as never, mobile: v.mobile || null, zone: v.zone || null, pinHash: hashPin(v.pin) });
  revalidatePath('/masters/users');
  return { ok: `${v.name} added` };
}
export async function addSiteAction(_: unknown, f: FormData): Promise<{ error?: string; ok?: string }> {
  await requireUser(['ADMIN', 'HO']);
  const siteId = s(f, 'siteId').toUpperCase();
  if (!siteId || !s(f, 'name') || !s(f, 'district') || !s(f, 'zone')) return { error: 'Site ID, name, district and zone are compulsory' };
  const lat = s(f, 'lat') ? Number(s(f, 'lat')) : null, lng = s(f, 'lng') ? Number(s(f, 'lng')) : null;
  const [dup] = await db.select({ id: sites.id }).from(sites).where(eq(sites.siteId, siteId));
  if (dup) return { error: `Site ${siteId} already exists` };
  await db.insert(sites).values({ siteId, name: s(f, 'name'), district: s(f, 'district'), zone: s(f, 'zone'), lat, lng, fenceM: Number(s(f, 'fenceM') || 200) });
  revalidatePath('/masters/sites');
  return { ok: `Site ${siteId} added` };
}
export async function addVendorAction(_: unknown, f: FormData): Promise<{ error?: string; ok?: string }> {
  await requireUser(['ADMIN', 'HO', 'FINANCE']);
  if (!s(f, 'code') || !s(f, 'name') || !s(f, 'type')) return { error: 'Code, name and type are compulsory' };
  await db.insert(vendors).values({ code: s(f, 'code').toUpperCase(), name: s(f, 'name'), type: s(f, 'type'), gstin: s(f, 'gstin') || null, creditDays: Number(s(f, 'creditDays') || 30), subletMarginPct: s(f, 'margin') ? Number(s(f, 'margin')) : null }).onConflictDoNothing();
  revalidatePath('/masters/vendors');
  return { ok: 'Vendor saved' };
}
export async function updateTatAction(f: FormData) {
  await requireUser(['ADMIN', 'HOD']);
  const tat = Math.max(0, Math.round(Number(s(f, 'tatDays'))));
  await db.update(templateSteps).set({ tatDays: tat }).where(eq(templateSteps.id, s(f, 'stepId')));
  revalidatePath('/masters/templates');
}
