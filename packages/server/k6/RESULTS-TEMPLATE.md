# K6 Performance Testing Results Template

## Test Information

- **Test Type**: [Smoke/Load/Stress/Spike/Soak]
- **Date**: [Date]
- **Duration**: [X minutes]
- **Max VUs**: [X users]
- **Server**: [Local/Staging/Production]

---

## Test Results

### Summary Statistics

```
checks.........................: X% ✓ XXX    ✗ XX
http_req_duration..............: avg=XXXms min=XXms med=XXXms max=XXXms p(95)=XXXms p(99)=XXXms
http_req_failed................: X%
http_reqs......................: XXXX  XX/s
iterations.....................: XXXX  XX/s
vus............................: min=X  max=XXX
```

### Key Metrics

- **Average Response Time**: XXXms
- **95th Percentile**: XXXms (target: <800ms for normal, <1500ms for stress)
- **99th Percentile**: XXXms
- **Success Rate**: XX%
- **Throughput**: XX requests/second

### Pass/Fail Status

- ✅/❌ Response time within threshold
- ✅/❌ Error rate acceptable
- ✅/❌ System remained stable

---

## Performance by Endpoint

### Report Submission

- Average: XXXms
- p(95): XXXms
- Success rate: XX%

### Report Tracking

- Average: XXXms
- p(95): XXXms
- Success rate: XX%

### Departments API

- Average: XXXms
- p(95): XXXms
- Success rate: XX%

---

## Observations

### Positive

- [What worked well]
- [Performance highlights]

### Issues Found

- [Any bottlenecks]
- [Error patterns]
- [Resource constraints]

---

## System Resources During Test

### Server

- CPU Usage: [Peak XX%]
- Memory Usage: [XX MB / XX GB]
- Network: [XX Mbps]

### Database

- Connections: [XX active, XX max]
- Query Time: [XX ms average]
- Slow Queries: [Yes/No, list if any]

---

## Recommendations

1. [Optimization suggestions]
2. [Infrastructure improvements]
3. [Code changes needed]

---

## Next Steps

- [ ] [Action item 1]
- [ ] [Action item 2]
- [ ] [Retest after optimizations]

---

## Raw K6 Output

```
[Paste full K6 output here for reference]
```
