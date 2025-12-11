# API Architecture - Unified Router Pattern

## Problem

Vercel's Hobby plan limits deployments to **12 serverless functions**. Our application had 14+ individual API endpoints, exceeding this limit.

## Solution

**Unified API Router** - A single serverless function ([index.ts](./index.ts)) that acts as a router, delegating requests to appropriate handlers while keeping business logic organized and maintainable.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Client Request: /api/reports/123/status                    │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Vercel Routes ALL /api/* requests                          │
│  to single serverless function: /api/index                  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  api/index.ts (Unified Router)                              │
│  • Parses path: "reports/123/status"                        │
│  • Matches pattern: reports/[id]/[action]                   │
│  • Extracts params: { id: "123", action: "status" }         │
│  • Imports handler: ./reports/[id]/[action].ts              │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Handler: ./reports/[id]/[action].ts                        │
│  • Receives request with injected params                    │
│  • Executes business logic                                  │
│  • Returns response                                          │
└─────────────────────────────────────────────────────────────┘
```

## Benefits

### ✅ Stays Within Limits

- **1 serverless function** instead of 14+
- Works on Vercel Hobby plan (free tier)
- No need to upgrade to Pro plan

### ✅ Maintainable

- Business logic stays in separate files
- Each handler is independent and testable
- Easy to add new routes without creating new functions

### ✅ Production-Ready

- Centralized error handling
- Type-safe with TypeScript
- Matches Express routing patterns
- Easy debugging with clear path matching

### ✅ Reusable

- Pattern can scale to 100+ routes
- Add new routes by just importing handlers
- No Vercel configuration changes needed

## File Structure

```
api/
├── index.ts              # 🎯 UNIFIED ROUTER (ONLY .ts file in /api - single serverless function)
└── README.md             # This file

src/server/handlers/      # ⚠️ All handlers OUTSIDE /api (Vercel deploys ANY .ts in /api as separate functions)
├── health.ts             # Handler: Health check
├── departments.ts        # Handler: Departments list
├── auth/
│   ├── [action].ts       # Handler: login, logout, register, verify
│   └── verification/
│       ├── request.ts    # Handler: Request verification code
│       └── confirm.ts    # Handler: Confirm verification code
├── reports/
│   ├── index.ts          # Handler: List/create reports
│   ├── [id]/
│   │   └── [action].ts   # Handler: Update report status, comment, assign
│   └── track/
│       └── [trackingId].ts  # Handler: Track report by ID
├── notifications/
│   ├── index.ts          # Handler: List notifications
│   ├── read-all.ts       # Handler: Mark all as read
│   ├── unread-count.ts   # Handler: Get unread count
│   └── [id]/
│       └── read.ts       # Handler: Mark one as read
├── dashboards/
│   └── [type].ts         # Handler: Get dashboard data
└── analytics/
    └── [type].ts         # Handler: Get analytics data
```

**CRITICAL:** Handlers are stored in `src/server/handlers/` instead of `api/` directory. This is essential because Vercel deploys every `.ts` file in `/api` as a separate serverless function. By keeping only `index.ts` in `/api`, we ensure only 1 function is deployed.

## Route Mapping

| Request Path                     | Handler File                      | Extracted Params                  |
| -------------------------------- | --------------------------------- | --------------------------------- |
| `/api/health`                    | `./health.ts`                     | `{}`                              |
| `/api/departments`               | `./departments.ts`                | `{}`                              |
| `/api/auth/login`                | `./auth/[action].ts`              | `{ action: "login" }`             |
| `/api/auth/verification/request` | `./auth/verification/request.ts`  | `{}`                              |
| `/api/reports`                   | `./reports/index.ts`              | `{}`                              |
| `/api/reports/123/status`        | `./reports/[id]/[action].ts`      | `{ id: "123", action: "status" }` |
| `/api/reports/track/MR-ABC123`   | `./reports/track/[trackingId].ts` | `{ trackingId: "MR-ABC123" }`     |
| `/api/notifications/456/read`    | `./notifications/[id]/read.ts`    | `{ id: "456" }`                   |
| `/api/dashboards/citizen`        | `./dashboards/[type].ts`          | `{ type: "citizen" }`             |
| `/api/analytics/reports-trend`   | `./analytics/[type].ts`           | `{ type: "reports-trend" }`       |

## Adding New Routes

### Example: Add a new `/api/users/:id` endpoint

1. **Create the handler file (OUTSIDE /api directory):**

   ```typescript
   // src/server/handlers/users/[id].ts
   import type { VercelRequest, VercelResponse } from "@vercel/node";

   export default async function handler(
     req: VercelRequest,
     res: VercelResponse
   ) {
     const userId = req.query.id as string;
     // Your business logic here
     return res.json({ userId, data: "..." });
   }
   ```

2. **Register the route in api/index.ts:**

   ```typescript
   // In api/index.ts
   import usersHandler from "../src/server/handlers/users/[id]";

   // Add to matchRoute function:
   if (segments[0] === "users" && segments[1]) {
     return { handler: usersHandler, params: { id: segments[1] } };
   }
   ```

3. **Done!** No need to create a new serverless function.

⚠️ **CRITICAL:** Always create handler files in `src/server/handlers/` directory, NOT in `/api` directory. Vercel will deploy any `.ts` file in `/api` as a separate function.

## Local Development

The dev server ([dev-server.ts](../dev-server.ts)) uses the same unified router:

```typescript
// All API routes handled by single router
app.all("/api/*", async (req, res) => {
  const handler = await import("./api/index.ts");
  await handler.default(req, res);
});
```

This ensures **dev environment matches production exactly**.

## Testing

Test individual handlers directly:

```typescript
import handler from "./api/reports/index";

const mockReq = {
  method: "GET",
  query: {},
  cookies: {},
  headers: {},
};

const mockRes = {
  json: jest.fn(),
  status: jest.fn().mockReturnThis(),
};

await handler(mockReq, mockRes);
```

## Performance Considerations

- **Cold starts:** Only 1 function to warm up instead of 14+
- **Bundle size:** Shared dependencies across all routes
- **Response time:** No noticeable latency from routing logic
- **Scalability:** Can handle 100+ routes without hitting limits

## Migration from Multiple Functions

If you need to migrate back to individual functions (e.g., for Pro plan):

1. Each handler file is already self-contained
2. Simply deploy them as separate functions
3. Update `vercel.json` to remove unified routing
4. No code changes needed in handlers

## Troubleshooting

### Route not matching?

- Check path pattern in `matchRoute()` function
- Verify handler import path is correct
- Check console logs for 404 errors

### Handler not receiving params?

- Params are injected via `req.query`
- Access like: `const id = req.query.id as string`

### Dev server not working?

- Restart dev server after adding new routes
- Check file paths match (Windows vs Unix paths)
- Verify TypeScript compiles without errors

## References

- [Vercel Serverless Functions Limits](https://vercel.com/docs/concepts/limits/overview#serverless-function-limits)
- [Vercel Routing Configuration](https://vercel.com/docs/concepts/projects/project-configuration#routes)
- [Express.js Routing Patterns](https://expressjs.com/en/guide/routing.html)
