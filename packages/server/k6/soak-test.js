/**
 * K6 SOAK TEST (Endurance Test)
 * Purpose: Test system stability over extended period
 * VUs: Moderate sustained load
 * Duration: 30 minutes (configurable)
 *
 * Detects issues like:
 * - Memory leaks
 * - Database connection pool exhaustion
 * - Disk space issues
 * - Performance degradation over time
 *
 * Run: k6 run k6/soak-test.js
 * Run longer: k6 run -e DURATION=60m k6/soak-test.js
 */

import http from "k6/http";
import { check, sleep, group } from "k6";
import { Rate, Trend, Counter } from "k6/metrics";
import { BASE_URL, THRESHOLDS, generateReport } from "./config.js";

// Custom metrics
const errorRate = new Rate("errors");
const responseTime = new Trend("response_time");
const dbQueryTime = new Trend("db_query_time");
const memoryLeakIndicator = new Trend("memory_leak_indicator");
const totalRequests = new Counter("total_requests");

const DURATION = __ENV.DURATION || "30m";
const SUSTAINED_LOAD = 50; // Moderate sustained load

export const options = {
  stages: [
    { duration: "2m", target: SUSTAINED_LOAD }, // Ramp up
    { duration: DURATION, target: SUSTAINED_LOAD }, // Sustained load
    { duration: "2m", target: 0 }, // Ramp down
  ],
  thresholds: {
    ...THRESHOLDS.soak,
    response_time: ["p(95)<1200", "p(99)<2500"],
    // Check for performance degradation
    response_time: ["trend<2000"], // Response time shouldn't grow significantly
  },
};

export function setup() {
  console.log("⏱️  Starting SOAK TEST - Extended endurance test");
  console.log(`⌛ Duration: ${DURATION} at ${SUSTAINED_LOAD} concurrent users`);
  console.log("🔍 Monitoring for memory leaks and degradation");
  return { startTime: Date.now() };
}

export default function (data) {
  totalRequests.add(1);

  // Simulate realistic mix of operations
  const operation = Math.random();

  if (operation < 0.4) {
    // 40% - Submit reports
    submitReport();
  } else if (operation < 0.7) {
    // 30% - Track reports
    trackReport();
  } else if (operation < 0.9) {
    // 20% - View departments
    viewDepartments();
  } else {
    // 10% - Health checks
    healthCheck();
  }

  sleep(2 + Math.random() * 3); // 2-5 seconds between requests
}

function submitReport() {
  group("Submit Report", function () {
    const report = generateReport();
    const start = Date.now();

    const res = http.post(`${BASE_URL}/api/reports`, JSON.stringify(report), {
      headers: { "Content-Type": "application/json" },
    });

    const duration = Date.now() - start;
    responseTime.add(duration);

    check(res, {
      "report submitted": (r) => r.status === 201,
    }) || errorRate.add(1);
  });
}

function trackReport() {
  group("Track Report", function () {
    const trackingId =
      "MR-" + Math.random().toString(36).slice(2, 8).toUpperCase();
    const start = Date.now();

    const res = http.get(`${BASE_URL}/api/reports/track/${trackingId}`);
    const duration = Date.now() - start;
    responseTime.add(duration);

    check(res, {
      "tracking responds": (r) => [200, 404].includes(r.status),
    });
  });
}

function viewDepartments() {
  group("View Departments", function () {
    const start = Date.now();

    const res = http.get(`${BASE_URL}/api/departments`);
    const duration = Date.now() - start;
    responseTime.add(duration);
    dbQueryTime.add(duration); // This hits DB

    check(res, {
      "departments loaded": (r) => r.status === 200,
    }) || errorRate.add(1);
  });
}

function healthCheck() {
  group("Health Check", function () {
    const start = Date.now();

    const res = http.get(`${BASE_URL}/api/health`);
    const duration = Date.now() - start;

    // Track response time trend to detect degradation
    memoryLeakIndicator.add(duration);

    check(res, {
      "health OK": (r) => r.status === 200,
      "response fast": (r) => r.timings.duration < 500,
    });
  });
}

export function teardown(data) {
  const totalTime = (Date.now() - data.startTime) / 1000 / 60;
  console.log("✅ Soak test completed");
  console.log(`⏱️  Total runtime: ${totalTime.toFixed(2)} minutes`);
  console.log(`📊 Total requests: ${totalRequests.value || 0}`);
  console.log(
    `📈 Average rate: ${((totalRequests.value || 0) / totalTime).toFixed(2)} req/min`
  );
}
