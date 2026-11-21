# IDC One-Stop — CRM + ERP + Field App (Phase 1 MVP)

This is the first working release of the system described in **PRD v3.0** and **workbook v1.6**. It covers Phase 1, "Run the work":

- **PO to tasks:** Indus PO in → task plan with TAT → field work with GPS and photos.
- **Alerts:** sent automatically, with escalation.
- **Approvals:** by amount, above a set limit.
- **Billing:** WCC → tax invoice (amount in words).
- **Command Centre:** the home dashboard.

## What is in this release

| Area | What works |
|---|---|
| Login | Employee ID + PIN; the role decides what you can do. FIELD users land on the field app. |
| Masters | **Users:** Employee ID, Name, Department and Designation are compulsory.<br>**Sites:** Indus site ID, GPS and geo-fence.<br>**Vendors.**<br>**Task templates:** TAT can be edited without code. |
| Indus PO import | Upload the Indus ERP **Excel** export. The system reads the PO number, order date, description, operating unit, total, lines, site ID and RL, and guesses the project type. You check the result before creating the PO. **Enter manually** is the fallback. Duplicate POs and unknown sites are blocked. |
| Task plan | Built from the template for the project type (EB, Mount, DG, TRX, TCU, Solar), using the TATs from workbook v1.6. Steps that share a predecessor run in parallel.<br>**EB:** audit offered on day 19, invoice on day 40.<br>**Others:** Mount day 15, DG day 16, TRX day 18, TCU day 40, Solar day 16.<br>Field steps go to field staff, office steps to the PM and billing steps to Finance; anyone can be reassigned. |
| PO screen | 90-day billing clock, plus the EB 20-day or Upgrade 45-day clock, and a planned-vs-actual timeline.<br>Reassign tasks, mark office tasks done and request approvals.<br>Offer audit → record WCC → raise invoice. |
| Field app (`/field`, installable PWA) | My tasks, grouped as overdue / today / coming up / done today.<br>**Start** is checked against the site geo-fence (fresh GPS reading).<br>Checklist and camera photos (geo-tagged) are needed before **Close**.<br>Works **offline**: actions are queued on the phone and synced when the network returns.<br>Installs on Android and iPhone from the browser ("Add to Home screen"). |
| Alerts | Triggers from the workbook (T01 PO imported, T02 plan ready, T04 assigned, T05 started, T06 due in 2 days, T07 overdue with escalation tiers, T08 completed, T11/T12 approvals, T21–T24 audit / WCC / invoice, T29/T30 PO day 75/85, T31 Upgrade day 40, T46 Indus informed).<br>They are de-duplicated. "Run alert check now" runs the check by hand; the hourly cron calls `/api/cron/scan?key=…`. |
| Approvals | Up to `APPROVAL_LIMIT` (₹10,000 by default) is auto-approved. Above the limit it goes to the HOD, who approves or rejects with a comment. |
| Billing | IDC tax invoice: CGST 9% + SGST 9%, amount in words (lakh / crore), numbered per financial year (`IDC/26-27/0001`). Uses the Indus approved value when there is one. Mark paid. AR list. |

**Not in Phase 1 (planned next):** warehouse, procurement, transport, P&L / ageing MIS, cash flow, Tally sync, WhatsApp provider, per-step checklists, S3 photo storage, OTP login. See PRD v3.0 §15.

## Technology

- Next.js 15 (App Router, server actions) + React 19, TypeScript.
- PostgreSQL with Drizzle ORM. It is pure JavaScript, so there are no native engine downloads, and the schema lives in `src/db/schema.ts`.
- PWA: `public/manifest.webmanifest`, `public/sw.js` and an IndexedDB offline queue.
- Photos are stored on local disk (`STORAGE_DIR`) for the MVP. For production, swap `src/lib/storage.ts` for S3 or Azure Blob.
- Alerts are sent through `src/lib/notify.ts`. If `NOTIFY_WEBHOOK_URL` is set, every alert is POSTed there, so you can plug in the WhatsApp / SMS / email gateway. Otherwise alerts are logged and shown in the app.

## Run it locally

```bash
cp .env.example .env            # set DATABASE_URL and SESSION_SECRET
docker compose up -d db         # or use any PostgreSQL 14+
npm install
npm run db:push                 # create tables (or apply drizzle/*.sql)
npm run db:seed                 # sample users, sites, templates and 6 POs
npm run dev                     # http://localhost:3000
```

Sample logins (PIN `1234`):

| Employee ID | Role |
|---|---|
| `HO-001` | Front desk |
| `PM-014` | Project Manager |
| `HOD-01` / `HOD-02` | HOD (approvals) |
| `FT-101` / `FT-102` | Field (opens the field app) |
| `FIN-01` | Finance (invoices) |
| `ADMIN-001` | Admin |

**Change every PIN before real use.**

## Deploy

1. Use any Node 20+ host (Render, Railway, AWS, Azure, a VPS) plus managed PostgreSQL.
2. Set `DATABASE_URL`, `SESSION_SECRET` (long random string), `CRON_SECRET`, `STORAGE_DIR` (a persistent disk) and `APPROVAL_LIMIT`.
3. Run `npm run build && npm start` behind HTTPS. The field app needs HTTPS for GPS and camera.
4. Schedule `GET /api/cron/scan?key=$CRON_SECRET` every hour, so T-2 and overdue alerts go out.
5. Load real masters: users, sites with GPS, vendors. The seed script is for demo data only.

## Tests

```bash
npm test     # planning (EB day 19 / 40, every template's invoice day), money in words, GST, dates, geo-fence
```

The full flow was also checked in a browser before release:
- Excel import and duplicate check.
- Compulsory user fields.
- Field start blocked 207 km away, then allowed at the site.
- Close blocked until the checklist and a photo are done.
- Offline start, then sync.
- HOD approval.
- WCC → invoice with amount in words.

## Project layout

```
src/db/schema.ts        tables      src/db/seed.ts      sample data      src/db/templates.json  task templates (workbook v1.6)
src/lib/services.ts     PO creation + planning, task start/close, alerts engine, WCC, invoice, approvals
src/lib/poImport.ts     Indus PO Excel reader         src/lib/planning.ts  TAT planning
src/app/(office)/…      office screens                src/app/field/…      field app
src/app/api/…           field API, files, cron
```
