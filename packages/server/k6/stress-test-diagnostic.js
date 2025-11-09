/**
 * K6 DIAGNOSTIC STRESS TEST
 * Purpose: Find out WHY requests are failing under load
 *
 * Run: k6 run k6/stress-test-diagnostic.js
 */

import http from "k6/http";
import { check, sleep, group } from "k6";
import { Counter, Trend } from "k6/metrics";
import { BASE_URL, generateReport } from "./config.js";

// Track specific error types
const errors4xx = new Counter("errors_4xx");
const errors5xx = new Counter("errors_5xx");
const errorsTimeout = new Counter("errors_timeout");
const errorsConnection = new Counter("errors_connection");
const success2xx = new Counter("success_2xx");

export const options = {
  stages: [
    { duration: "10s", target: 50 }, // Warm up
    { duration: "20s", target: 100 }, // Build up
    { duration: "20s", target: 200 }, // High load
    { duration: "10s", target: 0 }, // Cool down
  ],
  thresholds: {
    http_req_duration: ["p(95)<2000"],
  },
};

export function setup() {
  console.log("🔍 Starting DIAGNOSTIC stress test...");
  console.log("📊 This will show exactly what errors occur under load");
  return {};
}

export default function () {
  const report = generateReport();

  const res = http.post(`${BASE_URL}/api/reports`, JSON.stringify(report), {
    headers: { "Content-Type": "application/json" },
    timeout: "10s",
  });

  // Track success
  if (res.status >= 200 && res.status < 300) {
    success2xx.add(1);
  }

  // Track 4xx errors (client errors)
  if (res.status >= 400 && res.status < 500) {
    errors4xx.add(1);
    if (res.status === 429) {
      console.log(`⚠️  Rate limited (429)`);
    } else if (res.status === 400) {
      console.log(`⚠️  Bad request (400): ${res.body.substring(0, 100)}`);
    } else {
      console.log(`⚠️  Client error ${res.status}`);
    }
  }

  // Track 5xx errors (server errors)
  if (res.status >= 500) {
    errors5xx.add(1);
    console.log(`❌ Server error ${res.status}: ${res.body.substring(0, 100)}`);
  }

  // Track connection errors
  if (res.status === 0 || res.error) {
    if (res.error && res.error.includes("timeout")) {
      errorsTimeout.add(1);
      console.log(`⏱️  Timeout error`);
    } else {
      errorsConnection.add(1);
      console.log(`🔌 Connection error: ${res.error}`);
    }
  }

  sleep(1);
}

export function teardown(data) {
  console.log("\n📊 DIAGNOSTIC RESULTS:");
  console.log("═══════════════════════════════════");
  console.log(`✅ Successful (2xx): ${success2xx.value || 0}`);
  console.log(`⚠️  Client Errors (4xx): ${errors4xx.value || 0}`);
  console.log(`❌ Server Errors (5xx): ${errors5xx.value || 0}`);
  console.log(`🔌 Connection Errors: ${errorsConnection.value || 0}`);
  console.log(`⏱️  Timeout Errors: ${errorsTimeout.value || 0}`);
  console.log("═══════════════════════════════════");

  const total =
    (success2xx.value || 0) +
    (errors4xx.value || 0) +
    (errors5xx.value || 0) +
    (errorsConnection.value || 0) +
    (errorsTimeout.value || 0);

  if (total > 0) {
    const successRate = (((success2xx.value || 0) / total) * 100).toFixed(2);
    console.log(`\n✅ Success Rate: ${successRate}%`);

    if (errorsConnection.value > 0) {
      console.log("\n💡 RECOMMENDATION: Connection errors detected!");
      console.log("   Likely causes:");
      console.log("   1. Database connection pool exhausted");
      console.log("   2. Too many concurrent connections");
      console.log("   3. Network limits reached");
      console.log("\n   Solutions:");
      console.log("   - Increase database connection pool size");
      console.log("   - Add connection retry logic");
      console.log("   - Implement request queuing");
    }

    if (errors4xx.value > 0) {
      console.log("\n💡 RECOMMENDATION: Client errors detected!");
      console.log("   - Check for rate limiting (429)");
      console.log("   - Verify request data validation");
      console.log("   - Review authentication logic");
    }
  }
}
