# Backend Structure

This directory contains the backend API logic organized for Vercel serverless deployment.

## Architecture

The backend uses **Express.js** with a **monolithic serverless function** approach to stay within Vercel's Hobby plan limit of 12 functions.

### Directory Structure

```
backend/
├── app.ts                 # Main Express app configuration
├── routes/               # Express route handlers
│   ├── health.ts         # Health check endpoint
│   ├── departments.ts    # Department management
│   ├── auth.ts           # Authentication & verification
│   ├── reports.ts        # Report CRUD operations
│   ├── notifications.ts  # User notifications
│   ├── dashboards.ts     # Dashboard analytics
│   └── analytics.ts      # Advanced analytics
└── services/             # Business logic & utilities
    ├── supabase.ts       # Supabase client
    ├── auth.ts           # JWT token management
    └── services/         # Service modules
        ├── analytics.ts
        ├── email.ts
        ├── notifications.ts
        ├── report-email.ts
        ├── storage.ts
        ├── trust.ts
        └── verification.ts
```

## How It Works

### Single Entry Point

- **api/index.ts** exports the Express app from `backend/app.ts`
- Vercel deploys this as **1 serverless function**
- All `/api/*` routes are handled by Express routing

### Route Organization

Each route file (`backend/routes/*.ts`) exports an Express Router:

```typescript
import { Router } from "express";

const router = Router();

router.get("/", async (req, res) => {
  // Handler logic
});

export default router;
```

### Benefits

- ✅ **No function limit issues** - all routes in 1 function
- ✅ **Maintainable** - organized by domain (auth, reports, etc.)
- ✅ **Reusable** - standard Express patterns
- ✅ **Type-safe** - full TypeScript support
- ✅ **Scalable** - add routes without Vercel constraints

## API Routes

### Health

- `GET /api/health` - API health check

### Departments

- `GET /api/departments` - List all departments

### Authentication

- `POST /api/auth/signup` - Create new citizen account
- `POST /api/auth/signin` - Login (citizen/staff/admin)
- `POST /api/auth/signout` - Logout
- `GET /api/auth/me` - Get current user info
- `POST /api/auth/verify` - Verify account with code
- `POST /api/auth/resend-code` - Resend verification code
- `POST /api/auth/verification/request` - Request verification
- `POST /api/auth/verification/confirm` - Confirm verification

### Reports

- `POST /api/reports` - Create new report
- `GET /api/reports` - Get user's reports
- `GET /api/reports/track/:trackingId` - Track report (public)
- `PATCH /api/reports/:id/status` - Update report status
- `POST /api/reports/:id/respond` - Add response to report
- `POST /api/reports/:id/actions` - Combined status update & response

### Notifications

- `GET /api/notifications` - Get all notifications
- `GET /api/notifications/unread-count` - Get unread count
- `PATCH /api/notifications/read-all` - Mark all as read
- `PATCH /api/notifications/:id/read` - Mark one as read

### Dashboards

- `GET /api/dashboards/:type` - Get dashboard data (department/stats)

### Analytics

- `GET /api/analytics/:type` - Get analytics (trends/categories/departments/time/geography)

## Environment Variables

Required environment variables (set in `.env` or Vercel):

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-service-role-key

# JWT
JWT_SECRET=your-secret-key

# Email (optional, for verification)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

## Deployment

### Local Development

```bash
npm run dev
```

### Deploy to Vercel

```bash
git push origin main
# Or manually: vercel --prod
```

Vercel automatically:

1. Detects `api/index.ts` as a serverless function
2. Bundles all imports from `backend/`
3. Deploys as **1 function** handling all routes

## Important Notes

### Frontend vs Backend Separation

- **Frontend (src/client/)**: React components, runs in browser
- **Backend (backend/)**: Express API, runs on Vercel serverless

### Why This Structure?

- **Vercel Limitation**: Only files in `/api/*.ts` become serverless functions
- **Solution**: Single entry point (`api/index.ts`) that imports Express app
- **Result**: Unlimited routes, 1 function deployment

### TypeScript Configuration

- Root `tsconfig.json` includes both `src/client/**/*` and `backend/**/*`
- Separate `api/tsconfig.json` extends root, includes backend files for bundling
- Frontend build ignores backend code (Vite handles `src/client/` only)

## Troubleshooting

### "Cannot find module" errors

Make sure imports use relative paths from `backend/`:

```typescript
// ✅ Correct
import { supabaseAdmin } from "../services/supabase";

// ❌ Wrong
import { supabaseAdmin } from "@/services/supabase";
```

### 404 errors on frontend routes

Verify `vercel.json` has the SPA fallback rule:

```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/index.ts" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

### CORS errors

CORS is configured globally in `backend/app.ts`. If you need specific origins:

```typescript
app.use(
  cors({
    origin: "https://your-domain.com",
    credentials: true,
  })
);
```
