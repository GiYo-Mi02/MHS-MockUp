# 🚀 Quick Start Guide - K6 Load Testing

## Step 1: Install K6

Choose one method:

### Method 1: Chocolatey (Recommended for Windows)

```cmd
choco install k6
```

### Method 2: Winget

```cmd
winget install k6
```

### Method 3: Direct Download

Download and install: https://dl.k6.io/msi/k6-latest-amd64.msi

### Verify Installation

```cmd
k6 version
```

---

## Step 2: Start Your Server

Open a terminal in the server directory:

```cmd
cd packages\server
npm run dev
```

Keep this terminal open - your server should be running on `http://localhost:4000`

---

## Step 3: Run Your First Test

Open a **NEW** terminal and run:

```cmd
cd packages\server
npm run test:smoke
```

This runs a quick 1-minute test with minimal load to verify everything works.

---

## Step 4: Interpret Results

You'll see output like:

```
✓ health check status is 200
✓ departments status is 200

checks.........................: 100.00% ✓ 120    ✗ 0
http_req_duration..............: avg=245ms min=89ms med=210ms max=890ms p(95)=420ms p(99)=650ms
http_reqs......................: 120     2/s
```

### What to look for:

- ✅ **checks: 100%** - All health checks passed
- ✅ **p(95) < 500ms** - 95% of requests completed in under 500ms
- ✅ **http_req_failed: 0%** - No failed requests

---

## Step 5: Run More Tests

### Normal Load Test (60 seconds)

```cmd
npm run test:load
```

Simulates 100 concurrent users - typical daily usage

### Stress Test (60 seconds)

```cmd
npm run test:stress
```

Tests with 500 users - finding your limits

### Database Performance (60 seconds)

```cmd
npm run test:db
```

Focuses on database operations

### API Test (60 seconds)

```cmd
npm run test:api
```

Tests all major endpoints

### All Tests

```cmd
npm run test:all
```

Runs smoke, API, and load tests sequentially

---

## Step 6: Using the Interactive Menu

For an easier experience:

```cmd
cd packages\server\k6
run-tests.bat
```

This gives you a menu to choose which test to run!

---

## Understanding Key Metrics

### Response Times

- **avg** - Average response time
- **min** - Fastest response
- **max** - Slowest response
- **p(95)** - 95th percentile (95% of requests were faster)
- **p(99)** - 99th percentile (99% of requests were faster)

### Request Stats

- **http_reqs** - Total requests made
- **http_req_failed** - Percentage of failed requests
- **checks** - Percentage of validation checks that passed

### Target Performance

For a city-wide system:

- ✅ p(95) < 800ms for normal load
- ✅ p(95) < 1500ms for stress load
- ✅ Error rate < 2% for normal load
- ✅ Error rate < 5% for stress load

---

## Common Issues

### "k6 is not recognized"

- K6 not installed or not in PATH
- Solution: Restart terminal after installation

### "Connection refused"

- Server not running
- Solution: Run `npm run dev` in another terminal

### High error rates

- Server overloaded or database issues
- Check server logs for specific errors
- May need to optimize database queries or increase resources

---

## What to Test

1. **Start Small**: Run smoke test first
2. **Normal Load**: Run load test to see typical performance
3. **Find Limits**: Run stress test to see where it breaks
4. **Database**: Run DB test to check database performance
5. **Endurance**: Run soak test for long-term stability

---

## Performance Targets for Makati

| Scenario       | Users | Response Time | Pass Rate |
| -------------- | ----- | ------------- | --------- |
| Normal Daily   | 100   | < 800ms       | > 98%     |
| Peak Hours     | 200   | < 1000ms      | > 95%     |
| Major Incident | 500   | < 1500ms      | > 90%     |

---

## Next Steps After Testing

If tests show issues:

1. **Database Optimization**
   - Add indexes to frequently queried columns
   - Optimize slow queries
   - Consider connection pooling

2. **Caching**
   - Add Redis for frequently accessed data
   - Cache department lists
   - Cache user sessions

3. **Scaling**
   - Add more server instances
   - Use load balancer
   - Consider serverless functions for spike handling

4. **Monitoring**
   - Set up application monitoring (e.g., New Relic, DataDog)
   - Database query monitoring
   - Error tracking (e.g., Sentry)

---

## Questions?

Check `k6/README.md` for detailed documentation!
