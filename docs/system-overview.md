# Makati Report System Documentation

_Last updated: 2025-10-05_

## Purpose

Makati Report is a monorepo that powers a citizen incident reporting platform for Makati City. Residents submit concerns with location pins and photos, staff departments triage and resolve cases, and administrators monitor city-wide analytics. This document explains the full system end-to-end so new contributors can understand the moving parts quickly.

---

## Quick links

- [`README.md`](../README.md) — abbreviated setup instructions
- [`packages/server`](../packages/server) — Express + TypeScript API
- [`packages/web`](../packages/web) — Vite + React + Tailwind web client
- [`packages/server/scripts`](../packages/server/scripts) — database migration + seed utilities

---

## Architecture at a glance

| Layer                        | Technology                                 | Responsibilities                                                                               |
| ---------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Client                       | React 18, Vite, TailwindCSS, Leaflet       | Citizen-facing submission portal, report tracking, staff/admin dashboards, toast notifications |
| API                          | Express 4, TypeScript, mysql2, JWT, Multer | Authentication, report lifecycle, notifications, analytics, email dispatch                     |
| Database                     | MySQL 8                                    | Departments, users, reports, SLA policies, evidence, status logs, notifications                |
| External services (optional) | SMTP, Cloudinary                           | Email receipts/updates, evidence storage offloading                                            |

High-level workflow:

1. Citizens sign up/sign in (optional) and create reports with optional evidence + map pin. New accounts receive a one-time verification code; unverified citizens can file their first report but must verify before submitting additional cases.
2. API assigns the report to the matching department, writes status logs, stores evidence (local or Cloudinary), and notifies staff + citizen.
3. Department staff work the queue via `/dashboard/department`, updating statuses or responses; notifications and emails keep citizens informed.
4. City administrators access `/dashboard/admin` for analytics, heatmaps, and comparative metrics.

The monorepo uses npm workspaces so shared scripts like `npm run dev` cascade into both packages.

---

## Prerequisites

Install the following before contributing:

- **Node.js** ≥ 18 (LTS recommended) and npm ≥ 9
- **MySQL** ≥ 8.0 with a user that can create databases/tables
- **SMTP credentials** (any provider) for transactional emails
- _(Optional)_ **Cloudinary** account for hosted evidence storage (otherwise files live under `/uploads`)
- _(Optional)_ Mapbox/Leaflet basemap access (Leaflet uses open tiles by default; no API key required)

---

## Environment configuration

Clone `.env.example` files before running the system.

### Server (`packages/server/.env`)

| Variable                                                          | Description                                                                |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `PORT`                                                            | Express listening port (default `4000`)                                    |
| `CORS_ORIGIN`                                                     | Allowed web origin (default `http://localhost:5173`)                       |
| `PUBLIC_BASE_URL`                                                 | Public base URL for file links in emails (`http://localhost:4000` locally) |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`         | MySQL connection info                                                      |
| `JWT_SECRET`                                                      | Secret for signing auth cookies                                            |
| `CLOUDINARY_*`                                                    | Optional Cloudinary credentials + folder for evidence uploads              |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` | Mail transport configuration                                               |
| `EMAIL_FROM`                                                      | Friendly sender, e.g. `"Makati Cares" <noreply@makaticares.gov>`           |

Use `http://localhost:4000/api/health/email` after boot to verify the mailer.

### Web (`packages/web/.env`)

| Variable       | Description                                                                    |
| -------------- | ------------------------------------------------------------------------------ |
| `VITE_API_URL` | Root API URL used by the front-end fetch wrapper (`http://localhost:4000/api`) |

Restart Vite if you change Vite environment variables—they are injected at build time.

---

## Install, seed, and run

```cmd
npm install
copy packages\server\.env.example packages\server\.env
copy packages\web\.env.example packages\web\.env
```

Edit the copied `.env` files with real credentials, then initialize the database:

```cmd
cd packages\server
npm run db:init    & rem Creates schema from scripts/schema.sql
npm run db:seed    & rem Loads sample departments, users, and July 2025 reports
cd ..\..
```

Start both dev servers in watch mode from the repo root:

```cmd
npm run dev
```

Helpful scripts:

| Command                                    | Description                                                          |
| ------------------------------------------ | -------------------------------------------------------------------- |
| `npm run build`                            | Builds both workspaces (`tsc -b` for web + server, then Vite bundle) |
| `npm run start`                            | Runs workspace start scripts (server production bundle)              |
| `npm run lint` / `npm run format`          | Delegates to each workspace for ESLint/Prettier                      |
| `npm run -w @makati-report/server db:init` | Run script in a single workspace                                     |
| `npm run -w @makati-report/server dev`     | Start API only (uses `ts-node-dev`)                                  |
| `npm run -w @makati-report/web dev`        | Start Vite UI only                                                   |

---

## Database schema overview

The schema (defined in `scripts/schema.sql`) covers the end-to-end lifecycle of a report.

| Table                | Purpose                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------- |
| `departments`        | Master list of city departments with contact details + category codes                             |
| `citizens`           | Registered portal users (optional for submitting reports)                                         |
| `admins`             | City-level admins with analytics access                                                           |
| `department_staff`   | Department users, mapped to a `department_id`                                                     |
| `sla_policies`       | Expected resolution hours keyed by report category + urgency                                      |
| `reports`            | Primary incident records with status, urgency, locations, assignments, and an `is_anonymous` flag |
| `report_evidence`    | Stored photos/videos linked to a report (Cloudinary URL or `/uploads`)                            |
| `report_status_logs` | Immutable timeline of submissions, status changes, and responses                                  |
| `notifications`      | In-app notifications for citizens/staff/admins                                                    |

Seed data (`scripts/seed.sql`) bootstraps:

- Departments (`GARBAGE`, `TRAFFIC`, `SAFETY`, `ROADS`)
- Departments (`GARBAGE`, `TRAFFIC`, `SAFETY`, `ROADS`, `OTHERS`)
- Admin + department staff logins
- SLA policies covering regular/urgent cases
- July 2025 incident set spanning pending/in-progress/resolved/cancelled
- Notifications and status logs that showcase the dashboard UI immediately

> Tip: rerun `npm run db:init` + `npm run db:seed` whenever you want to reset the environment.

---

## Backend (`packages/server`)

### Directory map

```
src/
 ├─ index.ts               # App entry, health endpoints, router mounting
 ├─ auth.ts                # JWT cookie middleware + helpers
 ├─ db.ts                  # MySQL pool wrapper
 ├─ routes/
 │   ├─ auth.ts            # Signup, signin, signout, /me
 │   ├─ reports.ts         # Report CRUD + evidence upload + status actions
 │   ├─ dashboards.ts      # Department queue + stats, admin overview
 │   ├─ analytics.ts       # KPI, timeseries, heatmap endpoints
 │   ├─ departments.ts     # Department directory lookup
 │   └─ notifications.ts   # Notification inbox + read toggles
 └─ services/
     ├─ analytics.ts       # Query builders for KPI endpoints
     ├─ email.ts           # Nodemailer transport + diagnostics
     ├─ notifications.ts   # DB notification helpers
     ├─ report-email.ts    # Templated citizen emails
   ├─ trust.ts           # Trust scoring rules, transitions, submission gating
     └─ storage.ts         # Cloudinary/local evidence storage abstraction
```

### Authentication + authorization

- JWT cookies (7-day expiry) issued on `/api/auth/signin`, stored as `mr_token`.
- Citizens, staff, and admins share the same cookie format; staff carry `departmentId` for authorization.
- Middleware in `auth.ts` exports `requireAuth` (ensures valid token) and `requireRole(...roles)` for role-based guards.
- Citizens verify their email via OTP: `/api/auth/verification/request` issues a six-digit code (dev environments echo the code in responses) and `/api/auth/verification/confirm` validates it. Unverified citizens are redirected to the `/verify` page and limited to a single report until they confirm.

### Evidence and storage

- `multer` handles uploads (5 files, 5 MB each). Files are buffered in memory.
- `services/storage.ts` routes files to Cloudinary when `CLOUDINARY_*` is set; otherwise saved under `uploads/` (served at `/uploads`).

### Email + notifications

- `services/report-email.ts` sends receipts on creation and updates via Nodemailer (anonymous submissions skip email delivery).
- `services/notifications.ts` writes notification rows and resolves recipients per department.
- Routes gate notification helpers so anonymous citizens are not pinged while staff still receive alerts.
- API verifies transport on boot (`verifyEmailTransport`), exposing diagnostics via `/api/health/email`.

### Key REST endpoints

| Method  | Path                               | Auth                      | Summary                                               |
| ------- | ---------------------------------- | ------------------------- | ----------------------------------------------------- |
| `POST`  | `/api/auth/signup`                 | Public                    | Register a new citizen account                        |
| `POST`  | `/api/auth/signin`                 | Public                    | Issue JWT cookie for citizen/staff/admin              |
| `POST`  | `/api/auth/verification/request`   | Authenticated citizen     | Send/echo a one-time verification code                |
| `POST`  | `/api/auth/verification/confirm`   | Authenticated citizen     | Confirm code and unlock multi-report privileges       |
| `GET`   | `/api/auth/me`                     | Authenticated             | Return current session payload                        |
| `POST`  | `/api/reports`                     | Public (citizen optional) | Create a report + upload evidence                     |
| `GET`   | `/api/reports/history`             | Citizen                   | List personal reports by tracking ID and status       |
| `GET`   | `/api/reports/track/:trackingId`   | Public                    | Fetch report details, timeline, evidence              |
| `POST`  | `/api/reports/:id/actions`         | Staff/Admin               | One-shot status update and/or response                |
| `PATCH` | `/api/reports/:id/status`          | Staff/Admin               | Update status only                                    |
| `POST`  | `/api/reports/:id/respond`         | Staff/Admin               | Add response without status change                    |
| `GET`   | `/api/dashboards/department`       | Staff/Admin               | Department queue (paging, search)                     |
| `GET`   | `/api/dashboards/department/stats` | Staff/Admin               | SLA snapshot, trend counts                            |
| `GET`   | `/api/dashboards/admin/overview`   | Admin                     | Department + status aggregation, latest map markers   |
| `GET`   | `/api/analytics/*`                 | Admin                     | Summary, timeseries, heatmap, departments, categories |
| `GET`   | `/api/notifications`               | Authenticated             | Latest notifications for current user                 |
| `PATCH` | `/api/notifications/:id/read`      | Authenticated             | Mark single notification read                         |
| `PATCH` | `/api/notifications/read-all`      | Authenticated             | Mark all notifications read                           |
| `GET`   | `/api/notifications/unread-count`  | Authenticated             | Unread badge count                                    |
| `GET`   | `/api/departments`                 | Public                    | Lookup department list for report categories          |

### Error handling

- Unified Express error handler logs stack traces and returns `500` JSON payloads.
- Individual routes catch known MySQL errors (e.g., duplicate email) and return friendly messages.

---

## Frontend (`packages/web`)

### Stack

- React 18 with hooks and function components
- React Router 6 for routing and nested dashboard routes
- TailwindCSS utility classes with custom `card`, `stat-label`, etc.
- Leaflet maps for location picker (`MapPicker`) and analytics map (`ReportsMap`)
- Custom context providers: `ThemeProvider`, `AuthProvider`, `ToastProvider`

### Routing + pages

| Route                   | Audience        | Description                                                           |
| ----------------------- | --------------- | --------------------------------------------------------------------- |
| `/`                     | All             | Landing page with feature highlights and CTA                          |
| `/report`               | Citizens        | Form with drag-and-drop evidence, map pinning, auto reverse-geocoding |
| `/my-reports`           | Citizens        | History with personal tracking IDs, trust score gauge, and usage tips |
| `/track/:trackingId?`   | Citizens/guests | Track report status, timeline, evidence                               |
| `/signin`, `/signup`    | All             | Auth forms (staff/admin seeded via SQL)                               |
| `/verify`               | Citizens        | OTP entry + resend flow for confirming new accounts                   |
| `/dashboard/department` | Staff           | Queue table, stats, map pins, respond modal                           |
| `/dashboard/admin`      | Admin           | KPI cards, trend chart, heatmap, department/category tables           |

### State + data flow

- `lib/api.ts` wraps Axios with base URL + credentials.
- `AuthProvider` reads `/api/auth/me`, stores user in context, and injects auth headers. The context now exposes trust metadata (score, level, daily limits) and keeps unverified citizens on the `/verify` flow until they confirm.
- Dashboard components fetch queue/stats/analytics via `useEffect` and keep derived state via `useMemo`.
- Toasts provide feedback for report submissions, auth errors, etc.

### Mapping utilities

- `MapPicker` emits coordinates and performs reverse geocoding (OpenStreetMap + Nominatim via `lib/geocode.ts`).
- `ReportsMap` renders department pins and analytics heatmap; clicking a pin selects the report.

### Styling

- `styles.css` sets Tailwind layers plus global layout classes (`container`, `card`, `surface-subtle`, etc.).
- Dark mode toggles via `ThemeProvider` and CSS variables.

---

## Background jobs & scripts

- `npm run db:init` — executes `scripts/schema.sql` to drop/recreate tables.
- `npm run db:seed` — runs `scripts/db-seed.ts`, which executes `seed.sql` and attaches Cloudinary placeholders when configured.
- No additional cron/background workers; all notifications/emails are synchronous after the triggering request.

---

## Report lifecycle walkthrough

1. **Submission**
   - Citizen completes `/report`, optionally attaching images and a map pin.
   - API assigns the department based on category code, creates status log, calculates SLA, and notifies staff.
   - If the citizen is unverified and has already filed a report, the API returns `VERIFICATION_REQUIRED`, prompting the UI to redirect them to `/verify` before proceeding.
   - If the citizen is logged in with email, they receive a receipt email summarizing the report.

2. **Department triage**
   - Staff view `/dashboard/department`; queue fetches `/dashboards/department` and `/dashboards/department/stats`.
   - Selecting a row fetches `/reports/track/:trackingId` for timeline + evidence.
   - Staff respond via the combined action form (`/reports/:id/actions`), optionally altering status.

3. **Citizen updates**
   - Citizens get email + in-app notifications whenever staff respond or change the status, unless the report was submitted anonymously (those suppress outbound notifications).
   - Signed-in citizens can browse their submissions via `/my-reports`, which now surfaces trust score gauges, daily usage summaries, and guidance on maintaining higher tiers; each entry links directly to the tracking page.
   - `/track/:trackingId` stays publicly accessible for quick lookups.

4. **Analytics**
   - Admins select date presets (30/60/90/180 days) hitting `/analytics/*` endpoints to populate charts and heat maps.

---

## Deployment notes

1. Build the web bundle:

   ```cmd
   cd packages\web
   npm run build
   ```

   Deploy the contents of `packages/web/dist` to your static host (or serve via Express static middleware).

2. Compile the server:

   ```cmd
   cd packages\server
   npm run build
   npm run start   & rem Runs dist/index.js
   ```

   Ensure environment variables match production services (database, SMTP, Cloudinary, allowed origins).

3. Expose `/uploads` if you skip Cloudinary so staff can view attachments.

4. Configure HTTPS and secure cookies (`secure=true`) behind a reverse proxy for production.

---

## Linting, formatting, and coding standards

- Use `npm run lint` and `npm run format` at the repo root to run ESLint/Prettier across packages.
- TypeScript strictness is moderate (`tsconfig.json` in each workspace). Favor explicit typing for API contracts and React props.
- Commit conventional style suggestions: `feat:`, `fix:`, `docs:` etc. (not enforced yet but recommended).

---

## Troubleshooting

| Symptom                       | Likely cause                           | Fix                                                                  |
| ----------------------------- | -------------------------------------- | -------------------------------------------------------------------- |
| `ECONNREFUSED 127.0.0.1:3306` | MySQL not running or wrong credentials | Start MySQL, verify `.env` DB settings                               |
| `ER_DUP_ENTRY` during seed    | Previous seed left data                | Run `npm run db:init` then `npm run db:seed`                         |
| No emails sent                | SMTP credentials missing/invalid       | Update `.env`, check `/api/health/email` response                    |
| Evidence uploads fail         | Cloudinary variables missing           | Either add credentials or remove them to fall back to local storage  |
| `CORS` errors in browser      | `CORS_ORIGIN` mismatch                 | Set server `.env` to the exact web host origin                       |
| Dashboard blank with 401      | Missing auth cookie                    | Sign in via `/signin`; check browser dev tools for `mr_token` cookie |

---

## Future enhancements (ideas)

- Integrate SMS notifications for urgent updates.
- Add automated SLA breach reminders for staff via scheduled workers.
- Expand analytics slices with response time percentiles and citizen satisfaction scores.
- Introduce automated tests (unit + e2e) covering critical flows.

---

For questions or onboarding help, leave notes in the project discussion channel or open a documentation PR with clarifications.
