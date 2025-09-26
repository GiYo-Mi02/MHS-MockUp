# MakatiReport Monorepo (React + Vite, Express + MySQL)

Department-centric concern reporting system for Makati City.

Frontend: React + Vite + TailwindCSS
Backend: Express + TypeScript + MySQL (mysql2) + JWT

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

Fill out the server `.env` with your SMTP provider so department responses email citizens automatically:

- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE` – mail server connection
- `SMTP_USER`, `SMTP_PASS` – credentials (if required)
- `EMAIL_FROM` – sender address shown in emails

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

Next steps: wire API calls, JWT auth guards, Cloudinary upload.
