import {
  pgTable, text, integer, boolean, timestamp, date, numeric, doublePrecision, jsonb, pgEnum, uniqueIndex, index,
} from 'drizzle-orm/pg-core';
import { createId } from './id';

export const roleEnum = pgEnum('role', ['ADMIN', 'HO', 'PM', 'HOD', 'FIELD', 'FINANCE', 'WAREHOUSE']);
export const taskStatusEnum = pgEnum('task_status', ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD']);
export const approvalStatusEnum = pgEnum('approval_status', ['PENDING', 'APPROVED', 'REJECTED']);

const id = () => text('id').primaryKey().$defaultFn(createId);

/** User master — Employee ID, Name, Department, Designation are compulsory (PRD v3.0 §3). */
export const users = pgTable('users', {
  id: id(),
  employeeId: text('employee_id').notNull().unique(),
  name: text('name').notNull(),
  department: text('department').notNull(),
  designation: text('designation').notNull(),
  role: roleEnum('role').notNull(),
  mobile: text('mobile'),
  email: text('email'),
  zone: text('zone'),
  pinHash: text('pin_hash').notNull(),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const sites = pgTable('sites', {
  id: id(),
  siteId: text('site_id').notNull().unique(), // Indus site ID
  name: text('name').notNull(),
  district: text('district').notNull(),
  zone: text('zone').notNull(),
  address: text('address'),
  lat: doublePrecision('lat'),
  lng: doublePrecision('lng'),
  fenceM: integer('fence_m').notNull().default(200),
});

export const vendors = pgTable('vendors', {
  id: id(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  type: text('type').notNull(), // Supplier / Sublet / Transporter / Service
  gstin: text('gstin'),
  creditDays: integer('credit_days').notNull().default(30),
  subletMarginPct: doublePrecision('sublet_margin_pct'),
  active: boolean('active').notNull().default(true),
});

export const taskTemplates = pgTable('task_templates', {
  id: id(),
  projectType: text('project_type').notNull().unique(), // EB, MOUNT, DG, TRX, TCU, SOLAR
  name: text('name').notNull(),
});

export const templateSteps = pgTable('template_steps', {
  id: id(),
  templateId: text('template_id').notNull().references(() => taskTemplates.id, { onDelete: 'cascade' }),
  code: text('code').notNull(),
  seq: integer('seq').notNull(),
  step: text('step').notNull(),
  ownerText: text('owner_text').notNull(),
  afterCode: text('after_code'),
  tatDays: integer('tat_days').notNull(),
  field: boolean('field').notNull().default(false),
  informIndus: boolean('inform_indus').notNull().default(false),
  evidence: text('evidence'),
  costMin: doublePrecision('cost_min'),
  costMax: doublePrecision('cost_max'),
}, (t) => [uniqueIndex('template_step_code').on(t.templateId, t.code)]);

export const purchaseOrders = pgTable('purchase_orders', {
  id: id(),
  poNumber: text('po_number').notNull().unique(),
  projectType: text('project_type').notNull(),
  poDate: date('po_date').notNull(),
  circle: text('circle'),
  description: text('description'),
  siteRef: text('site_ref').references(() => sites.id),
  rl: text('rl'),
  value: numeric('value', { precision: 14, scale: 2 }).notNull(),
  approvedValue: numeric('approved_value', { precision: 14, scale: 2 }),
  auditOfferedAt: date('audit_offered_at'),
  wccNo: text('wcc_no'),
  wccDate: date('wcc_date'),
  createdById: text('created_by_id').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const poLines = pgTable('po_lines', {
  id: id(),
  poId: text('po_id').notNull().references(() => purchaseOrders.id, { onDelete: 'cascade' }),
  lineNo: integer('line_no').notNull(),
  itemCode: text('item_code'),
  description: text('description').notNull(),
  uom: text('uom'),
  qty: numeric('qty', { precision: 14, scale: 3 }).notNull(),
  rate: numeric('rate', { precision: 14, scale: 2 }).notNull(),
  amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
  siteCode: text('site_code'),
  projectName: text('project_name'),
  taskName: text('task_name'),
});

export const tasks = pgTable('tasks', {
  id: id(),
  poId: text('po_id').notNull().references(() => purchaseOrders.id, { onDelete: 'cascade' }),
  code: text('code').notNull(),
  seq: integer('seq').notNull(),
  step: text('step').notNull(),
  ownerText: text('owner_text').notNull(),
  afterCode: text('after_code'),
  tatDays: integer('tat_days').notNull(),
  field: boolean('field').notNull().default(false),
  informIndus: boolean('inform_indus').notNull().default(false),
  evidence: text('evidence'),
  assigneeId: text('assignee_id').references(() => users.id),
  plannedStart: date('planned_start').notNull(),
  plannedEnd: date('planned_end').notNull(),
  actualStart: timestamp('actual_start'),
  actualEnd: timestamp('actual_end'),
  status: taskStatusEnum('status').notNull().default('NOT_STARTED'),
  startLat: doublePrecision('start_lat'),
  startLng: doublePrecision('start_lng'),
  startDistanceM: integer('start_distance_m'),
  checklist: jsonb('checklist').$type<number[]>(),
  remarks: text('remarks'),
}, (t) => [uniqueIndex('task_po_code').on(t.poId, t.code), index('task_assignee_status').on(t.assigneeId, t.status)]);

export const taskPhotos = pgTable('task_photos', {
  id: id(),
  taskId: text('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  path: text('path').notNull(),
  lat: doublePrecision('lat'),
  lng: doublePrecision('lng'),
  takenAt: timestamp('taken_at').notNull().defaultNow(),
  uploadedById: text('uploaded_by_id').notNull().references(() => users.id),
});

export const approvals = pgTable('approvals', {
  id: id(),
  type: text('type').notNull(),
  poId: text('po_id').references(() => purchaseOrders.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  detail: text('detail'),
  amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
  approverRole: roleEnum('approver_role').notNull(),
  status: approvalStatusEnum('status').notNull().default('PENDING'),
  raisedById: text('raised_by_id').notNull().references(() => users.id),
  decidedById: text('decided_by_id').references(() => users.id),
  decidedAt: timestamp('decided_at'),
  comment: text('comment'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const alerts = pgTable('alerts', {
  id: id(),
  code: text('code').notNull(), // trigger id from the workbook, e.g. T04
  level: text('level').notNull(), // info / amber / red / green
  recipients: text('recipients').notNull(),
  channels: text('channels').notNull(),
  message: text('message').notNull(),
  dedupeKey: text('dedupe_key').unique(),
  poId: text('po_id').references(() => purchaseOrders.id, { onDelete: 'cascade' }),
  taskId: text('task_id').references(() => tasks.id, { onDelete: 'cascade' }),
  sentAt: timestamp('sent_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [index('alert_created').on(t.createdAt)]);

export const invoices = pgTable('invoices', {
  id: id(),
  number: text('number').notNull().unique(),
  poId: text('po_id').notNull().unique().references(() => purchaseOrders.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  taxable: numeric('taxable', { precision: 14, scale: 2 }).notNull(),
  cgst: numeric('cgst', { precision: 14, scale: 2 }).notNull(),
  sgst: numeric('sgst', { precision: 14, scale: 2 }).notNull(),
  total: numeric('total', { precision: 14, scale: 2 }).notNull(),
  amountWords: text('amount_words').notNull(),
  paid: boolean('paid').notNull().default(false),
  paidAt: timestamp('paid_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const counters = pgTable('counters', {
  key: text('key').primaryKey(),
  value: integer('value').notNull(),
});

export type User = typeof users.$inferSelect;
export type Site = typeof sites.$inferSelect;
export type PO = typeof purchaseOrders.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type Alert = typeof alerts.$inferSelect;
