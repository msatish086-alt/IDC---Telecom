CREATE TYPE "public"."approval_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('ADMIN', 'HO', 'PM', 'HOD', 'FIELD', 'FINANCE', 'WAREHOUSE');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD');--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"level" text NOT NULL,
	"recipients" text NOT NULL,
	"channels" text NOT NULL,
	"message" text NOT NULL,
	"dedupe_key" text,
	"po_id" text,
	"task_id" text,
	"sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "alerts_dedupe_key_unique" UNIQUE("dedupe_key")
);
--> statement-breakpoint
CREATE TABLE "approvals" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"po_id" text,
	"title" text NOT NULL,
	"detail" text,
	"amount" numeric(14, 2) NOT NULL,
	"approver_role" "role" NOT NULL,
	"status" "approval_status" DEFAULT 'PENDING' NOT NULL,
	"raised_by_id" text NOT NULL,
	"decided_by_id" text,
	"decided_at" timestamp,
	"comment" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "counters" (
	"key" text PRIMARY KEY NOT NULL,
	"value" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"number" text NOT NULL,
	"po_id" text NOT NULL,
	"date" date NOT NULL,
	"taxable" numeric(14, 2) NOT NULL,
	"cgst" numeric(14, 2) NOT NULL,
	"sgst" numeric(14, 2) NOT NULL,
	"total" numeric(14, 2) NOT NULL,
	"amount_words" text NOT NULL,
	"paid" boolean DEFAULT false NOT NULL,
	"paid_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_number_unique" UNIQUE("number"),
	CONSTRAINT "invoices_po_id_unique" UNIQUE("po_id")
);
--> statement-breakpoint
CREATE TABLE "po_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"po_id" text NOT NULL,
	"line_no" integer NOT NULL,
	"item_code" text,
	"description" text NOT NULL,
	"uom" text,
	"qty" numeric(14, 3) NOT NULL,
	"rate" numeric(14, 2) NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"site_code" text,
	"project_name" text,
	"task_name" text
);
--> statement-breakpoint
CREATE TABLE "purchase_orders" (
	"id" text PRIMARY KEY NOT NULL,
	"po_number" text NOT NULL,
	"project_type" text NOT NULL,
	"po_date" date NOT NULL,
	"circle" text,
	"description" text,
	"site_ref" text,
	"rl" text,
	"value" numeric(14, 2) NOT NULL,
	"approved_value" numeric(14, 2),
	"audit_offered_at" date,
	"wcc_no" text,
	"wcc_date" date,
	"created_by_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_orders_po_number_unique" UNIQUE("po_number")
);
--> statement-breakpoint
CREATE TABLE "sites" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"name" text NOT NULL,
	"district" text NOT NULL,
	"zone" text NOT NULL,
	"address" text,
	"lat" double precision,
	"lng" double precision,
	"fence_m" integer DEFAULT 200 NOT NULL,
	CONSTRAINT "sites_site_id_unique" UNIQUE("site_id")
);
--> statement-breakpoint
CREATE TABLE "task_photos" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"path" text NOT NULL,
	"lat" double precision,
	"lng" double precision,
	"taken_at" timestamp DEFAULT now() NOT NULL,
	"uploaded_by_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"project_type" text NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "task_templates_project_type_unique" UNIQUE("project_type")
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"po_id" text NOT NULL,
	"code" text NOT NULL,
	"seq" integer NOT NULL,
	"step" text NOT NULL,
	"owner_text" text NOT NULL,
	"after_code" text,
	"tat_days" integer NOT NULL,
	"field" boolean DEFAULT false NOT NULL,
	"inform_indus" boolean DEFAULT false NOT NULL,
	"evidence" text,
	"assignee_id" text,
	"planned_start" date NOT NULL,
	"planned_end" date NOT NULL,
	"actual_start" timestamp,
	"actual_end" timestamp,
	"status" "task_status" DEFAULT 'NOT_STARTED' NOT NULL,
	"start_lat" double precision,
	"start_lng" double precision,
	"start_distance_m" integer,
	"checklist" jsonb,
	"remarks" text
);
--> statement-breakpoint
CREATE TABLE "template_steps" (
	"id" text PRIMARY KEY NOT NULL,
	"template_id" text NOT NULL,
	"code" text NOT NULL,
	"seq" integer NOT NULL,
	"step" text NOT NULL,
	"owner_text" text NOT NULL,
	"after_code" text,
	"tat_days" integer NOT NULL,
	"field" boolean DEFAULT false NOT NULL,
	"inform_indus" boolean DEFAULT false NOT NULL,
	"evidence" text,
	"cost_min" double precision,
	"cost_max" double precision
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"employee_id" text NOT NULL,
	"name" text NOT NULL,
	"department" text NOT NULL,
	"designation" text NOT NULL,
	"role" "role" NOT NULL,
	"mobile" text,
	"email" text,
	"zone" text,
	"pin_hash" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_employee_id_unique" UNIQUE("employee_id")
);
--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"gstin" text,
	"credit_days" integer DEFAULT 30 NOT NULL,
	"sublet_margin_pct" double precision,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "vendors_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_po_id_purchase_orders_id_fk" FOREIGN KEY ("po_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_po_id_purchase_orders_id_fk" FOREIGN KEY ("po_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_raised_by_id_users_id_fk" FOREIGN KEY ("raised_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_decided_by_id_users_id_fk" FOREIGN KEY ("decided_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_po_id_purchase_orders_id_fk" FOREIGN KEY ("po_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "po_lines" ADD CONSTRAINT "po_lines_po_id_purchase_orders_id_fk" FOREIGN KEY ("po_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_site_ref_sites_id_fk" FOREIGN KEY ("site_ref") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_photos" ADD CONSTRAINT "task_photos_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_photos" ADD CONSTRAINT "task_photos_uploaded_by_id_users_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_po_id_purchase_orders_id_fk" FOREIGN KEY ("po_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_steps" ADD CONSTRAINT "template_steps_template_id_task_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."task_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alert_created" ON "alerts" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "task_po_code" ON "tasks" USING btree ("po_id","code");--> statement-breakpoint
CREATE INDEX "task_assignee_status" ON "tasks" USING btree ("assignee_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "template_step_code" ON "template_steps" USING btree ("template_id","code");