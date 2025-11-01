/**
 * K6 LOAD TEST
 * Purpose: Test system under normal expected load
 * VUs: Up to 100 concurrent users
 * Duration: 60 seconds
 *
 * Simulates a typical day with citizens submitting reports,
 * departments updating statuses, and admins viewing analytics
 *
 * Run: k6 run k6/load-test.js
 */

import http from "k6/http";
import { check, sleep, group } from "k6";
import { Rate, Trend, Counter } from "k6/metrics";
import {
  BASE_URL,
  TEST_USERS,
  THRESHOLDS,
  generateReport,
  CATEGORIES,
} from "./config.js";

// Custom metrics
const errorRate = new Rate("errors");
const reportCreationTime = new Trend("report_creation_duration");
const reportTrackingTime = new Trend("report_tracking_duration");
const reportsCreated = new Counter("reports_created");
const reportsTracked = new Counter("reports_tracked");

export const options = {
  stages: [
    { duration: "15s", target: 20 }, // Ramp up to 20 users
    { duration: "15s", target: 50 }, // Ramp up to 50 users
    { duration: "15s", target: 100 }, // Peak load at 100 users
    { duration: "10s", target: 50 }, // Ramp down to 50
    { duration: "5s", target: 0 }, // Ramp down to 0
  ],
  thresholds: {
    ...THRESHOLDS.load,
    report_creation_duration: ["p(95)<1000", "p(99)<2000"],
    report_tracking_duration: ["p(95)<500", "p(99)<1000"],
  },
};

export function setup() {
  console.log("🏗️ Setting up load test for city-wide usage...");
  console.log("📊 Simulating normal daily traffic patterns");
  return {};
}

export default function () {
  // Simulate different user behaviors
  const userType = Math.random();

  if (userType < 0.7) {
    // 70% - Citizens submitting and tracking reports
    citizenWorkflow();
  } else if (userType < 0.9) {
    // 20% - Citizens just tracking existing reports
    trackExistingReport();
  } else {
    // 10% - Public browsing (viewing departments, health checks)
    publicBrowsing();
  }
}

function citizenWorkflow() {
  group("Citizen Report Submission Flow", function () {
    // 1. Create a new report
    const report = generateReport();
    const startTime = Date.now();

    const reportRes = http.post(
      `${BASE_URL}/api/reports`,
      JSON.stringify(report),
      {
        headers: { "Content-Type": "application/json" },
      }
    );

    const duration = Date.now() - startTime;
    reportCreationTime.add(duration);

    const success = check(reportRes, {
      "report submitted successfully": (r) => r.status === 201,
      "tracking ID received": (r) => r.json("trackingId") !== undefined,
    });

    if (!success) {
      errorRate.add(1);
    } else {
      reportsCreated.add(1);
      const trackingId = reportRes.json("trackingId");

      sleep(2);

      // 2. Immediately check the tracking
      const trackStart = Date.now();
      const trackRes = http.get(`${BASE_URL}/api/reports/track/${trackingId}`);
      const trackDuration = Date.now() - trackStart;
      reportTrackingTime.add(trackDuration);

      check(trackRes, {
        "report tracked successfully": (r) => r.status === 200,
        "report details retrieved": (r) => r.json("trackingId") === trackingId,
      }) || errorRate.add(1);

      if (trackRes.status === 200) {
        reportsTracked.add(1);
      }
    }
  });

  sleep(3);
}

function trackExistingReport() {
  group("Track Existing Report", function () {
    // Simulate tracking with a random tracking ID format
    const randomTrackingId =
      "MR-" + Math.random().toString(36).slice(2, 8).toUpperCase();

    const trackRes = http.get(
      `${BASE_URL}/api/reports/track/${randomTrackingId}`
    );

    check(trackRes, {
      "tracking endpoint responds": (r) => [200, 404].includes(r.status),
    }) || errorRate.add(1);
  });

  sleep(2);
}

function publicBrowsing() {
  group("Public Information Access", function () {
    // 1. Health check
    const health = http.get(`${BASE_URL}/api/health`);
    check(health, {
      "health check OK": (r) => r.status === 200,
    }) || errorRate.add(1);

    sleep(1);

    // 2. Get departments
    const depts = http.get(`${BASE_URL}/api/departments`);
    check(depts, {
      "departments loaded": (r) => r.status === 200 && Array.isArray(r.json()),
    }) || errorRate.add(1);
  });

  sleep(2);
}

export function teardown(data) {
  console.log("✅ Load test completed");
  console.log(`📈 Reports created: ${reportsCreated.value || 0}`);
  console.log(`🔍 Reports tracked: ${reportsTracked.value || 0}`);
}
