# Load Testing Guide for MakatiReport

## ✅ All Fixes Applied

### 1. **Rate Limiting Bypass for Testing**

- Set `DISABLE_RATE_LIMIT=true` to disable rate limiting during load tests
- Automatically bypasses verification checks and daily limits
- **IMPORTANT**: Only use in dev/test environments!

### 2. **Category Validation Fixed**

- Updated all K6 tests to use valid department codes:
  - `GARBAGE` (Sanitation)
  - `TRAFFIC` (Traffic Management)
  - `SAFETY` (Public Safety)
  - `ROADS` (Infrastructure)
  - `OTHERS` (General Services)

### 3. **Authentication Flow Corrected**

- K6 tests now properly signup → signin → get token
- Uses correct cookie name: `mr_token`
- Extracts correct field: `id` (not `citizenId`)

### 4. **Performance Optimizations**

- ✅ Async email sending (fire-and-forget)
- ✅ Compression middleware (60-80% smaller payloads)
- ✅ Response caching (ETag support)
- ✅ Helmet security headers
- ✅ Connection keep-alive optimization

---

## 🚀 How to Run Load Tests

### Step 1: Start Server in Test Mode

```bash
cd packages\server
set DISABLE_RATE_LIMIT=true
npm run dev
```

**You should see:**

```
⚡ Performance optimizations enabled:
  - Compression middleware
  - Rate limiting: DISABLED (Load Test Mode)  ← IMPORTANT!
  - Helmet security headers
```

### Step 2: Run Load Tests

```bash
cd k6
.\run-tests.bat
```

**Choose a test:**

1. **Smoke Test** - Quick validation (1 min, 5 users)
2. **Load Test** - Normal load (5 min, up to 100 users)
3. **Stress Test** - Extreme load (10 min, up to 500 users)
4. **Gradual Stress** - Find breaking point (20 min, 10→200 gradually) ⭐ **RECOMMENDED**
5. **Spike Test** - Sudden surge (4 min)
6. **Soak Test** - Endurance (30 min)

---

## 📊 Recommended Testing Strategy

### Phase 1: Validate Fixes (START HERE)

```bash
# 1. Run smoke test to verify system works
Choice: 1 (Smoke Test)
Expected: >95% success rate

# 2. Run gradual stress to find capacity
Choice: 4 (Gradual Stress Test)
Expected: System handles 50-100 users smoothly
```

### Phase 2: Measure Improvements

```bash
# Compare against baseline (was 63% failure rate)
Choice: 3 (Stress Test)
Expected: <10% failure rate (90%+ success)
```

### Phase 3: Production Readiness

```bash
# Endurance test
Choice: 6 (Soak Test)
Expected: Stable performance over 30 minutes
```

---

## 🎯 Expected Results (After All Fixes)

### Before Optimizations:

```
Success Rate: 37% (63% failures)
p95 Response: 1510ms
Throughput: ~155 req/s
Errors: Rate limits, timeouts, validation failures
```

### After Optimizations (Target):

```
Success Rate: 90-95% (<10% failures)
p95 Response: <500ms
Throughput: 250-350 req/s
Errors: Minimal, only under extreme load
```

---

## 🔍 Interpreting Results

### Success Metrics ✅

- `http_req_failed < 10%` - Most requests succeed
- `http_req_duration p95 < 1000ms` - Fast response times
- `successful_reports` - Reports created successfully
- `server_errors (5xx) = 0` - No crashes

### Warning Signs ⚠️

- `http_req_failed > 20%` - System overloaded
- `timeouts > 100` - Server can't keep up
- `p95 > 3000ms` - Unacceptable latency

### Critical Issues 🚨

- `server_errors > 0` - Application crashes
- `http_req_failed > 50%` - System failure
- `p95 > 10s` - Complete breakdown

---

## 🐛 Troubleshooting

### Still seeing 403 "VERIFICATION_REQUIRED"?

**Solution**: Make sure `DISABLE_RATE_LIMIT=true` is set when starting server

### Still seeing "Invalid category/department"?

**Solution**: Check `config.js` - should only contain valid codes:

- GARBAGE, TRAFFIC, SAFETY, ROADS, OTHERS

### Server crashing under load?

**Solution**:

1. Start with Gradual Stress Test (option 4) to find breaking point
2. Check server logs for errors
3. Monitor database connection pool usage
4. Consider horizontal scaling if needed

### Request timeouts?

**Solution**:

1. Reduce concurrent users (try 50 → 100 instead of 500)
2. Check Supabase dashboard for rate limiting
3. Increase server resources (RAM, CPU)
4. Optimize database queries

---

## 🔧 Configuration Files Modified

### 1. `packages/server/src/index.ts`

- Added `DISABLE_RATE_LIMIT` environment variable check
- Rate limiter skips when flag is set
- Auth limiter bypassed during tests

### 2. `packages/server/src/routes/reports.ts`

- Verification check bypassed in test mode
- Daily limit check bypassed in test mode
- All business logic preserved for production

### 3. `packages/server/k6/config.js`

- Categories updated to valid codes
- Sample reports use correct departments

### 4. `packages/server/k6/stress-test.js`

- Authentication flow fixed (signup + signin)
- Correct cookie name (`mr_token`)
- Proper error handling

### 5. `packages/server/k6/gradual-stress-test.js` (NEW)

- Safer alternative to extreme stress test
- Gradually increases load: 10 → 25 → 50 → 100 → 150 → 200 users
- Better for finding actual system capacity

---

## 🔒 Security Reminder

**NEVER use `DISABLE_RATE_LIMIT=true` in production!**

This flag is ONLY for load testing in dev/test environments. In production:

- Rate limiting protects against abuse
- Verification ensures account validity
- Daily limits prevent spam

---

## 📈 Next Steps After Testing

### If results are good (90%+ success):

1. ✅ Re-enable rate limiting (remove environment variable)
2. ✅ Test with rate limiting enabled at realistic levels
3. ✅ Monitor production deployment
4. ✅ Set up alerts for key metrics

### If results need improvement:

1. 🔍 Identify specific bottlenecks from logs
2. 🔧 Optimize database queries (add indexes)
3. 📦 Consider caching more endpoints
4. 🚀 Scale horizontally (multiple server instances)
5. 💾 Upgrade Supabase plan if hitting limits

---

## 📊 Monitoring in Production

### Key Metrics to Track:

- Response times (p50, p95, p99)
- Error rates (4xx, 5xx)
- Request throughput (req/s)
- Database connection pool usage
- Memory/CPU usage

### Recommended Tools:

- Application Insights / New Relic
- Supabase Dashboard (built-in monitoring)
- Uptime monitoring (Pingdom, UptimeRobot)
- Log aggregation (Loggly, Papertrail)

---

## 🎉 Summary

All critical issues have been fixed:

- ✅ Rate limiting can be disabled for testing
- ✅ Authentication works correctly in K6 tests
- ✅ Category validation uses valid department codes
- ✅ Email sending is async (non-blocking)
- ✅ Gradual stress test for safer capacity testing

**Your system is now ready for comprehensive load testing!**

Start with the **Gradual Stress Test (option 4)** to safely find your system's capacity.
