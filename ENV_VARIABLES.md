# Makati Report - Production Environment Variables

Copy this to your Render and Vercel dashboards.

## Render Backend Environment Variables

```
NODE_ENV=production
PORT=4000
CORS_ORIGIN=https://makati-report.vercel.app
JWT_SECRET=<generate_random_string_or_let_render_generate>
TOKEN_COOKIE=mr_token
VERIFICATION_TTL_MINUTES=15

# Supabase - Get from Settings → API
SUPABASE_URL=<your_supabase_url>
SUPABASE_ANON_KEY=<your_anon_key>
SUPABASE_SERVICE_ROLE_KEY=<your_service_role_key>

# Email (optional - leave empty to disable)
SMTP_HOST=<your_smtp_host>
SMTP_PORT=587
SMTP_USER=<your_email>
SMTP_PASS=<your_email_password>
EMAIL_FROM=noreply@makati.gov.ph
```

## Vercel Frontend Environment Variables

```
VITE_API_URL=https://makati-report-api.onrender.com
```

## Steps to Add to Render

1. Go to Render Dashboard → Select `makati-report-api` service
2. Go to **Environment** tab
3. Add each variable from the Backend list above
4. For `JWT_SECRET`, either:
   - Generate a random string: `openssl rand -base64 32`
   - Click the link in Render to auto-generate
5. Save and wait for automatic redeploy

## Steps to Add to Vercel

1. Go to Vercel Dashboard → Select your project
2. Go to **Settings → Environment Variables**
3. Add `VITE_API_URL` with your Render backend URL
4. Select environments: `Production`, `Preview`, `Development`
5. Redeploy

## Supabase Setup

1. Create a project at supabase.com
2. In **Settings → Database → Connection string**, copy:
   - `SUPABASE_URL`: Project URL (e.g., https://xxxxx.supabase.co)
3. In **Settings → API**, copy:
   - `SUPABASE_ANON_KEY`: Public anonymous key
   - `SUPABASE_SERVICE_ROLE_KEY`: Service role key (keep secret!)
4. Run schema and seed SQL in Supabase SQL Editor:
   - `packages/server/scripts/schema.sql`
   - `packages/server/scripts/seed.sql`

## Email Configuration (Optional)

To enable email verification:

- **Gmail**: Use App Passwords (not regular password)
- **SendGrid**: Use SendGrid API key as `SMTP_PASS`
- **Other providers**: Consult their SMTP documentation

If not configured, OTP codes will appear on the frontend (dev mode).
