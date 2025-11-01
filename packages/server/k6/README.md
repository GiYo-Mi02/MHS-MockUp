# K6 Load Testing for MakatiReport

Comprehensive load testing suite to ensure the MakatiReport backend can handle thousands of concurrent users across Makati City.

## Prerequisites

1. **Install K6**

   **Windows (using Chocolatey):**

   ```cmd
   choco install k6
   ```

   **Windows (using winget):**

   ```cmd
   winget install k6 --source winget
   ```

   **Alternative - Download directly:**
   - Download from: https://dl.k6.io/msi/k6-latest-amd64.msi
   - Run the installer

2. **Verify installation:**
   ```cmd
   k6 version
   ```

## Test Scenarios

### 1. 🔥 Smoke Test

**Purpose:** Verify the system works under minimal load  
**Users:** 1-5 concurrent  
**Duration:** 1 minute

```cmd
k6 run k6/smoke-test.js
```

Run this test first to ensure basic functionality before heavier tests.

---

### 2. 📊 Load Test

**Purpose:** Test under normal expected daily load  
**Users:** Up to 100 concurrent  
**Duration:** 5 minutes

```cmd
k6 run k6/load-test.js
```

Simulates typical daily usage:

- 70% citizens submitting/tracking reports
- 20% citizens tracking existing reports
- 10% public browsing

**Expected Performance:**

- 95% of requests < 800ms
- 99% of requests < 1500ms
- Error rate < 2%

---

### 3. ⚠️ Stress Test

**Purpose:** Push system beyond normal capacity to find breaking points  
**Users:** Up to 500 concurrent  
**Duration:** 10 minutes

```cmd
k6 run k6/stress-test.js
```

Simulates major city-wide incidents:

- Natural disasters (typhoon, earthquake)
- Power outages affecting large areas
- Major traffic incidents

**Acceptable Performance:**

- 95% of requests < 1500ms
- 99% of requests < 3000ms
- Error rate < 5%

---

### 4. ⚡ Spike Test

**Purpose:** Test sudden traffic surges  
**Pattern:** Rapid spike from 0 → 300 → 500 users

```cmd
k6 run k6/spike-test.js
```

Simulates:

- Viral social media posts
- Breaking news coverage
- Major disaster announcements

**Acceptable Performance:**

- 95% of requests < 2000ms
- Error rate < 10%
- System recovers after spike

---

### 5. ⏱️ Soak Test (Endurance)

**Purpose:** Test stability over extended periods  
**Users:** 50 concurrent (sustained)  
**Duration:** 30 minutes (configurable)

```cmd
k6 run k6/soak-test.js
```

**Extended duration:**

```cmd
k6 run -e DURATION=60m k6/soak-test.js
```

Detects:

- Memory leaks
- Database connection pool issues
- Performance degradation over time
- Resource exhaustion

---

### 6. 🧪 API Comprehensive Test

**Purpose:** Test all major endpoints with realistic user journeys

```cmd
k6 run k6/api-test.js
```

Tests complete flows:

- Citizen signup → verification → report submission → tracking
- Department staff operations
- Public information access

---

## Running Tests Against Different Environments

### Local Development

```cmd
k6 run k6/load-test.js
```

### Staging Server

```cmd
k6 run -e BASE_URL=https://staging.makatireport.gov.ph k6/load-test.js
```

### Production (Use with caution!)

```cmd
k6 run -e BASE_URL=https://makatireport.gov.ph k6/smoke-test.js
```

---

## Understanding Results

### Key Metrics

**http_req_duration:** Time from request start to completion

- `p(95)<800ms` means 95% of requests finish under 800ms
- `p(99)<1500ms` means 99% of requests finish under 1.5 seconds

**http_req_failed:** Percentage of failed requests

- Should be < 2% for normal operations

**Custom Metrics:**

- `report_creation_duration` - Time to create reports
- `report_tracking_duration` - Time to track reports
- `errors` - Total error rate

### Sample Output

```
✓ report submitted successfully
✓ tracking ID received
✓ report tracked successfully

checks.........................: 98.50% ✓ 1970    ✗ 30
data_received..................: 2.1 MB 350 kB/s
data_sent......................: 850 kB 142 kB/s
http_req_duration..............: avg=450ms min=120ms med=380ms max=2.1s p(95)=750ms p(99)=1.2s
http_reqs......................: 2000   333.33/s
iterations.....................: 500    83.33/s
vus............................: 100    min=0    max=100
```

---

## Performance Targets for Makati City

### Population Context

- Makati City population: ~600,000
- Active internet users: ~400,000
- Expected daily active users: ~10,000-20,000
- Peak concurrent users: ~1,000-2,000

### Target Performance

| Scenario | Concurrent Users | Response Time (p95) | Error Rate |
| -------- | ---------------- | ------------------- | ---------- |
| Normal   | 100-200          | < 800ms             | < 2%       |
| Peak     | 500-1000         | < 1500ms            | < 5%       |
| Incident | 1000-2000        | < 2500ms            | < 10%      |

---

## Performance Optimization Tips

### If Tests Fail:

1. **Database Issues:**
   - Check connection pool size in `db.ts`
   - Add database indexes for frequently queried fields
   - Consider read replicas for heavy read operations

2. **Memory Issues:**
   - Monitor Node.js memory usage
   - Check for memory leaks in long-running processes
   - Increase server memory allocation

3. **Response Time Issues:**
   - Add caching (Redis) for frequently accessed data
   - Optimize database queries (use EXPLAIN)
   - Consider CDN for static assets
   - Implement pagination for large datasets

4. **Error Rate High:**
   - Check server logs for specific errors
   - Verify database connection stability
   - Check rate limiting configuration
   - Monitor third-party service limits (Cloudinary, email)

---

## Cloud Load Testing

For testing from multiple geographic locations:

```cmd
k6 cloud k6/load-test.js
```

Requires K6 Cloud account: https://k6.io/cloud

---

## Continuous Integration

Add to your CI/CD pipeline:

```yaml
# GitHub Actions example
- name: Run K6 Load Test
  run: |
    choco install k6 -y
    k6 run k6/smoke-test.js --out json=results.json
```

---

## Monitoring During Tests

### Watch server logs:

```cmd
cd packages/server
npm run dev
```

### Monitor system resources:

- Open Task Manager (Windows)
- Watch CPU, Memory, Network usage
- Monitor database connections

### Check database:

```sql
-- Active connections
SHOW PROCESSLIST;

-- Slow queries
SELECT * FROM mysql.slow_log ORDER BY start_time DESC LIMIT 10;
```

---

## Best Practices

1. **Start Small:** Always run smoke test first
2. **Incremental:** Progress from load → stress → spike
3. **Monitor:** Watch logs and metrics during tests
4. **Production:** Never run stress tests on production without approval
5. **Off-Peak:** Schedule tests during low-traffic hours
6. **Baseline:** Record results for future comparison

---

## Troubleshooting

### K6 not found

```cmd
# Verify PATH includes K6
where k6

# Reinstall if needed
choco install k6 --force
```

### Connection refused

- Ensure server is running: `npm run dev`
- Check BASE_URL in tests matches your server port
- Verify firewall settings

### High error rates

- Check server logs for specific errors
- Verify database is running and accessible
- Check network connectivity
- Ensure sufficient resources (CPU, memory)

---

## Next Steps

1. ✅ Install K6
2. ✅ Start your server: `npm run dev`
3. ✅ Run smoke test: `k6 run k6/smoke-test.js`
4. ✅ Run load test: `k6 run k6/load-test.js`
5. 📊 Analyze results and optimize
6. 🔄 Re-test after optimizations

---

## Support

For K6 documentation: https://k6.io/docs/
For issues: Create a ticket in your project repository
