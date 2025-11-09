/**
 * K6 SMOKE TEST
 * Purpose: Verify the system works under minimal load
 * VUs: 1-5 users
 * Duration: 1 minute
 *
 * Run: k6 run k6/smoke-test.js
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate } from "k6/metrics";
import { BASE_URL, TEST_USERS, THRESHOLDS, generateReport } from "./config.js";

// Custom metrics
const errorRate = new Rate("errors");

export const options = {
  stages: [
    { duration: "30s", target: 1 }, // Ramp up to 1 user
    { duration: "30s", target: 5 }, // Stay at 5 users
  ],
  thresholds: THRESHOLDS.smoke,
};

// Global state for tokens
let citizenToken = null;
let staffToken = null;

export function setup() {
  console.log("🔧 Setting up smoke test...");

  // Try to authenticate test users
  const citizenAuth = http.post(
    `${BASE_URL}/api/auth/signin`,
    JSON.stringify({
      email: TEST_USERS.citizen.email,
      password: TEST_USERS.citizen.password,
    }),
    {
      headers: { "Content-Type": "application/json" },
    }
  );

  if (citizenAuth.status === 200) {
    const cookies = citizenAuth.cookies;
    citizenToken = cookies.mr_token ? cookies.mr_token[0].value : null;
  }

  return { citizenToken };
}

export default function (data) {
  // 1. Health check
  const healthCheck = http.get(`${BASE_URL}/api/health`);
  check(healthCheck, {
    "health check status is 200": (r) => r.status === 200,
    "health check returns ok": (r) => r.json("ok") === true,
  }) || errorRate.add(1);

  sleep(1);

  // 2. Get departments list (public endpoint)
  const depts = http.get(`${BASE_URL}/api/departments`);
  check(depts, {
    "departments status is 200": (r) => r.status === 200,
    "departments returns array": (r) => Array.isArray(r.json()),
  }) || errorRate.add(1);

  sleep(1);

  // 3. Try to create a report (if authenticated)
  if (data.citizenToken) {
    const report = generateReport();
    const reportRes = http.post(
      `${BASE_URL}/api/reports`,
      JSON.stringify(report),
      {
        headers: {
          "Content-Type": "application/json",
          Cookie: `mr_token=${data.citizenToken}`,
        },
      }
    );

    check(reportRes, {
      "report creation status is 201 or 401": (r) =>
        [201, 401].includes(r.status),
    }) || errorRate.add(1);

    if (reportRes.status === 201) {
      const trackingId = reportRes.json("trackingId");

      sleep(1);

      // 4. Track the report
      const trackRes = http.get(`${BASE_URL}/api/reports/track/${trackingId}`);
      check(trackRes, {
        "track status is 200": (r) => r.status === 200,
        "track returns report": (r) => r.json("trackingId") === trackingId,
      }) || errorRate.add(1);
    }
  }

  sleep(2);
}

export function teardown(data) {
  console.log("✅ Smoke test completed");
}
