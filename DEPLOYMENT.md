# Deployment Guide: Makati Report

This guide walks you through deploying the Makati Report application to **Render** (backend) and **Vercel** (frontend).

## Architecture

- **Backend (Render)**: Express.js API server hosted on Render's free tier
- **Frontend (Vercel)**: React + Vite static site hosted on Vercel's free tier
- **Database**: Supabase PostgreSQL (shared across both)

---

## Prerequisites

1. **GitHub account** with your repo pushed
2. **Supabase account** and database set up
3. **Render account** (render.com)
4. **Vercel account** (vercel.com)

---

## Step 1: Prepare Supabase Database

### Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click "New project"
3. Fill in project name (e.g., "makati-report-prod")
4. Set region (choose closest to your users or Makati, Philippines)
5. Create a strong database password
6. Wait for project to initialize

### Get Connection Credentials

1. In Supabase, go to **Settings → Database**
2. Copy these values (you'll need them for Render):
   - **SUPABASE_URL**: Connection string → find `https://` URL in project settings
   - **SUPABASE_ANON_KEY**: Settings → API → `anon` key
   - **SUPABASE_SERVICE_ROLE_KEY**: Settings → API → `service_role` key

### Initialize Database Schema

1. In Supabase, go to **SQL Editor**
2. Copy the schema from `packages/server/scripts/schema.sql`
3. Paste and run it
4. Repeat with `packages/server/scripts/seed.sql` to add initial data

---

## Step 2: Deploy Backend to Render

### Connect Render to GitHub

1. Go to [render.com](https://render.com) and sign in
2. Click **Dashboard → Connect repository**
3. Authorize GitHub and select your makati-report repo

### Create Backend Service

1. Click **New → Web Service**
2. Select your makati-report repo
3. Fill in deployment settings:
   - **Name**: `makati-report-api`
   - **Runtime**: Node
   - **Build command**: (Leave as default, we have `render.yaml`)
   - **Start command**: (Leave as default, we have `render.yaml`)
4. Click **Create Web Service**

### Add Environment Variables

In Render dashboard for the service, go to **Environment**:

Add these variables:

- `NODE_ENV`: `production`
- `PORT`: `4000`
- `CORS_ORIGIN`: `https://your-vercel-domain.vercel.app` (update after Vercel deployment)
- `JWT_SECRET`: Generate a random string (or let Render generate it)
- `TOKEN_COOKIE`: `mr_token`
- `VERIFICATION_TTL_MINUTES`: `15`
- `SUPABASE_URL`: (from Step 1)
- `SUPABASE_ANON_KEY`: (from Step 1)
- `SUPABASE_SERVICE_ROLE_KEY`: (from Step 1)
- `SMTP_HOST`: (your email provider, or leave empty for dev)
- `SMTP_PORT`: `587`
- `SMTP_USER`: (your email, or leave empty)
- `SMTP_PASS`: (your email password, or leave empty)
- `EMAIL_FROM`: (sender email, or leave empty)

### Wait for Deployment

Render will automatically:

1. Install dependencies
2. Build TypeScript
3. Start the server

Once complete, you'll get a URL like `https://makati-report-api.onrender.com`

---

## Step 3: Deploy Frontend to Vercel

### Connect Vercel to GitHub

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **Add New → Project**
3. Import your makati-report repo from GitHub

### Configure Project Settings

1. **Project name**: `makati-report` (or any name)
2. **Framework**: Select `Vite`
3. **Root directory**: `./`
4. Under **Build and Output Settings**:
   - Build command: `npm run build --workspace=@makati-report/web`
   - Output directory: `packages/web/dist`

### Add Environment Variables

1. Go to **Settings → Environment Variables**
2. Add this variable (replace with your Render URL):
   - **VITE_API_URL**: `https://makati-report-api.onrender.com`
   - Select environments: `Production`, `Preview`, `Development`

### Deploy

Click **Deploy** and wait for Vercel to build and deploy your site.

You'll get a URL like `https://makati-report.vercel.app`

---

## Step 4: Update Backend CORS

Now that you have your Vercel frontend URL:

1. Go back to Render dashboard
2. Edit the `makati-report-api` service
3. Update `CORS_ORIGIN` to your Vercel URL: `https://makati-report.vercel.app`
4. Save and let Render redeploy

---

## Step 5: Test Your Deployment

### Frontend

1. Visit `https://makati-report.vercel.app`
2. Try signing up, signing in, and creating a report
3. Check browser console (F12) for any errors

### Backend API

1. Open terminal and test the API:

   ```bash
   curl https://makati-report-api.onrender.com/health
   ```

   (If you have a health endpoint; adjust as needed)

2. Check Render logs for errors:
   - Go to Render dashboard → Select service → **Logs**

### Database Connection

1. In Supabase, go to **Table Editor**
2. Check that your data appears when you submit reports

---

## Troubleshooting

### "Cannot find module" errors on Render

- Check that `render.yaml` is in the root of your repo
- Ensure `npm run build` succeeds locally

### 403 CORS errors in frontend console

- Update `CORS_ORIGIN` in Render environment variables to match your Vercel URL
- Make sure Render is redeployed after changing the variable

### API calls return 401

- Check that `SUPABASE_SERVICE_ROLE_KEY` is set on Render
- Verify JWT_SECRET is not empty
- Check Render logs for auth errors

### Emails not sending

- If `SMTP_*` variables are not set, emails will be skipped in dev mode
- To enable emails, configure SMTP credentials on Render

### "Connection refused" to database

- Verify `SUPABASE_URL` is correct (starts with `https://`)
- Check that your Supabase project is active (not paused)
- Ensure `SUPABASE_SERVICE_ROLE_KEY` is the correct key (not anon)

---

## Environment Variables Reference

### Backend (Render)

| Variable                    | Example                            | Notes                               |
| --------------------------- | ---------------------------------- | ----------------------------------- |
| `NODE_ENV`                  | `production`                       | Set to production for deployed env  |
| `PORT`                      | `4000`                             | Port the Express server runs on     |
| `CORS_ORIGIN`               | `https://makati-report.vercel.app` | Frontend URL (critical for CORS)    |
| `JWT_SECRET`                | `(random string)`                  | Secret key for JWT signing          |
| `TOKEN_COOKIE`              | `mr_token`                         | Cookie name for auth token          |
| `VERIFICATION_TTL_MINUTES`  | `15`                               | OTP expiration window               |
| `SUPABASE_URL`              | `https://xxxxx.supabase.co`        | Your Supabase project URL           |
| `SUPABASE_ANON_KEY`         | `(anon key)`                       | Public API key                      |
| `SUPABASE_SERVICE_ROLE_KEY` | `(service role key)`               | Admin API key                       |
| `SMTP_HOST`                 | `smtp.gmail.com`                   | Email provider SMTP host (optional) |
| `SMTP_PORT`                 | `587`                              | SMTP port (optional)                |
| `SMTP_USER`                 | `your-email@gmail.com`             | Email sender (optional)             |
| `SMTP_PASS`                 | `(app password)`                   | Email password (optional)           |
| `EMAIL_FROM`                | `noreply@makati.gov.ph`            | From address (optional)             |

### Frontend (Vercel)

| Variable       | Example                                  | Notes                |
| -------------- | ---------------------------------------- | -------------------- |
| `VITE_API_URL` | `https://makati-report-api.onrender.com` | Backend API base URL |

---

## Next Steps

### Custom Domain

1. **Vercel**: Go to Settings → Domains → Add your custom domain
2. **Render**: Go to Settings → Custom Domain → Add your custom domain
3. Update DNS records as instructed by each platform

### Enable HTTPS

Both Render and Vercel provide free HTTPS certificates automatically.

### Monitor & Scale

- **Render**: Free tier may sleep after inactivity. Upgrade to Starter ($7/mo) for always-on
- **Vercel**: Free tier has generous limits; upgrade if needed
- **Supabase**: Free tier has ample database limits; monitor usage in dashboard

---

## Security Notes

1. **Never commit `.env`** — use platform env variables only
2. **JWT_SECRET** should be strong and unique (Render can generate)
3. **Keep SUPABASE_SERVICE_ROLE_KEY** secret — only on backend
4. **CORS_ORIGIN** must match your frontend URL exactly
5. Regularly update dependencies to patch security issues

---

## Additional Resources

- [Render Docs](https://render.com/docs)
- [Vercel Docs](https://vercel.com/docs)
- [Supabase Docs](https://supabase.com/docs)
- [Express Deployment](https://expressjs.com/en/advanced/best-practice-performance.html)
- [Vite Deployment](https://vitejs.dev/guide/build.html)

---

## Support

If you encounter issues:

1. Check the **Logs** tab in Render/Vercel dashboards
2. Review this guide's **Troubleshooting** section
3. Open an issue on your GitHub repo for team discussion
