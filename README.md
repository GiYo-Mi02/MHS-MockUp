# MakatiReport Monorepo (React + Vite, Express + MySQL)

Department-centric concern reporting system for Makati City.

Frontend: React + Vite + TailwindCSS
Backend: Express + TypeScript + MySQL (mysql2) + JWT

📚 **Need the full tour?** Read the complete [system overview documentation](docs/system-overview.md) for architecture, API contracts, workflows, and deployment guidance.

## Setup (Windows cmd)

1. Install dependencies

```cmd
npm install
```

2. Configure env files

```cmd
copy packages\server\.env.example packages\server\.env
copy packages\web\.env.example packages\web\.env
```

Fill out the server `.env` with your SMTP provider so citizens receive receipts and department updates automatically:

- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE` – mail server connection
- `SMTP_USER`, `SMTP_PASS` – credentials (if required)
- `EMAIL_FROM` – sender address shown in emails (use the same domain as your SMTP user)
- `PUBLIC_BASE_URL` – the public URL for the API (used for local file fallback links)
- Optional: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_FOLDER` for hosted evidence storage

You can verify that the mail transport is wired correctly at [http://localhost:4000/api/health/email](http://localhost:4000/api/health/email).

3. Initialize database (ensure MySQL running and credentials in server .env)

```cmd
cd packages\server
npm run db:init
npm run db:seed
cd ..\..
```

4. Run dev servers (web at 5173, API at 4000)

```cmd
npm run dev
```

If needed, run separately:

```cmd
cd packages\server && npm run dev
cd packages\web && npm run dev
```

## Folders

- packages/web: Vite React app
- packages/server: Express API

## Highlights

- Optional photo evidence uploads with drag & drop UI. Files are sent via multipart form data and stored on Cloudinary when configured, otherwise saved under `/uploads`.
- Department queue includes keyword search and five-item pagination for faster triage.
- Email transport verification endpoint (`/api/health/email`) to spot environment issues quickly.
- Citizens with registered accounts receive an immediate submission receipt summarizing the title, status, description, and location, plus ongoing status-update emails with the same details.
- Logged-in citizens can submit anonymously; the API flags reports via `is_anonymous` and skips citizen notifications while still routing to departments.
- Signed-in citizens can revisit `/my-reports` to see their submission history (backed by `/api/reports/history`) and jump to individual tracking pages.
- Account verification workflow issues time-bound email codes; unverified citizens can file one report until they confirm their inbox (dev builds surface the code inline when SMTP is disabled).
- Trust scoring adjusts daily submission limits and auto-routes low-trust reports to the new Manual Review queue, with status badges surfaced across citizen, staff, and admin views.
- City-level analytics endpoints (`/api/analytics`) now expose cross-department KPIs, day-by-day trends, comparative department metrics, geospatial heatmap buckets, and category performance breakdowns for the admin dashboards.
- Seed data includes a July 2025 incident set with resolved, in-progress, pending, and cancelled examples so analytics and heatmap views have immediate signal.
