/**
 * K6 STRESS TEST
 * Purpose: Test system beyond normal capacity to find breaking points
 * VUs: Up to 500 concurrent users
 * Duration: 10 minutes
 *
 * Simulates peak hours or major incidents (e.g., flooding, power outage)
 * where many citizens report simultaneously
 *
 * Run: k6 run k6/stress-test.js
 */

import http from "k6/http";
import { check, sleep, group } from "k6";
import { Rate, Trend, Counter } from "k6/metrics";
import { BASE_URL, THRESHOLDS, generateReport } from "./config.js";

// Custom metrics
const errorRate = new Rate("errors");
const serverErrors = new Counter("server_errors");
const timeouts = new Counter("timeouts");
const successfulReports = new Counter("successful_reports");

export const options = {
  stages: [
    { duration: "2m", target: 100 }, // Warm up
    { duration: "2m", target: 200 }, // Approaching stress
    { duration: "2m", target: 300 }, // Stress level
    { duration: "2m", target: 400 }, // High stress
    { duration: "1m", target: 500 }, // Breaking point
    { duration: "1m", target: 0 }, // Recovery
  ],
  thresholds: THRESHOLDS.stress,
};

export function setup() {
  console.log("⚠️  Starting STRESS TEST - Finding system limits...");
  console.log("🔥 Simulating major city-wide incident with surge of reports");
  return {};
}

export default function () {
  group("High-Stress Report Submission", function () {
    const report = generateReport();

    // Most users will create reports during stress scenarios
    const reportRes = http.post(
      `${BASE_URL}/api/reports`,
      JSON.stringify(report),
      {
        headers: { "Content-Type": "application/json" },
        timeout: "30s", // Allow longer timeout under stress
      }
    );

    const success = check(reportRes, {
      "status is not 5xx": (r) => r.status < 500,
      "response time OK": (r) => r.timings.duration < 5000,
    });

    if (reportRes.status >= 500) {
      serverErrors.add(1);
      errorRate.add(1);
    } else if (reportRes.status === 201) {
      successfulReports.add(1);
    } else if (reportRes.error) {
      timeouts.add(1);
      errorRate.add(1);
    }
  });

  // Minimal sleep under stress
  sleep(1);
}

export function teardown(data) {
  console.log("✅ Stress test completed");
  console.log(`✔️  Successful reports: ${successfulReports.value || 0}`);
  console.log(`❌ Server errors (5xx): ${serverErrors.value || 0}`);
  console.log(`⏱️  Timeouts: ${timeouts.value || 0}`);
}
