# MakatiReport - Unified Vercel Deployment

Department-centric concern reporting system for Makati City.

**Tech Stack:**

- Frontend: React + Vite + TailwindCSS
- Backend: Vercel Serverless Functions
- Database: Supabase (PostgreSQL)

📚 **Need the full tour?** Read the complete [system overview documentation](docs/system-overview.md) for architecture, API contracts, workflows, and deployment guidance.

## Project Structure

```
makati-report/
├── src/
│   ├── client/          # React frontend
│   │   ├── components/  # UI components
│   │   ├── pages/       # Page components
│   │   ├── lib/         # Utilities (api, auth, etc.)
│   │   └── main.tsx     # App entry point
│   └── server/          # Server-side code
│       ├── supabase.ts  # Database client
│       ├── auth.ts      # JWT authentication
│       └── services/    # Business logic
├── api/                 # Vercel Serverless Functions
│   ├── auth/            # Authentication endpoints
│   ├── reports/         # Report management
│   ├── notifications/   # In-app notifications
│   ├── analytics/       # Analytics data
│   └── dashboards/      # Dashboard data
├── index.html           # HTML entry point
├── vite.config.ts       # Vite configuration
└── vercel.json          # Vercel deployment config
```

## Setup (Local Development)

1. Install dependencies

```bash
npm install
```

2. Configure environment

```bash
copy .env.example .env
```

Fill out the `.env` with your credentials:

- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` – Supabase connection
- `JWT_SECRET` – Secret for JWT token signing
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` – Email server (optional)
- `CLOUDINARY_URL` – For file uploads (optional)

3. Run development server

```bash
npm run dev
```

The app will be available at http://localhost:5173

## Deployment to Vercel

1. Push your code to GitHub
2. Import the project in Vercel
3. Add environment variables in Vercel Dashboard:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `JWT_SECRET`
   - (Optional) `SMTP_*` and `CLOUDINARY_*` variables
4. Deploy!

The API endpoints are automatically deployed as serverless functions under `/api/*`.

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
