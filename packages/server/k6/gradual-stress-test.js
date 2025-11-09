/**
 * Gradual Stress Test for MakatiReport
 * Slowly increases load to find the breaking point
 * Start small (10 VUs) and gradually increase to 200 VUs
 */

import http from "k6/http";
import { check, sleep, group } from "k6";
import { Counter, Trend } from "k6/metrics";

// Import shared configuration
import { BASE_URL, generateReport } from "./config.js";

// Custom metrics
const successfulReports = new Counter("successful_reports");
const errorRate = new Counter("errors");
const serverErrors = new Counter("server_errors");
const timeouts = new Counter("timeouts");

// Gradual ramp-up configuration
export const options = {
  stages: [
    { duration: "1m", target: 10 }, // Warm up: 0 → 10 users
    { duration: "2m", target: 10 }, // Hold at 10 users
    { duration: "1m", target: 25 }, // Ramp to 25 users
    { duration: "2m", target: 25 }, // Hold at 25 users
    { duration: "1m", target: 50 }, // Ramp to 50 users
    { duration: "2m", target: 50 }, // Hold at 50 users
    { duration: "1m", target: 100 }, // Ramp to 100 users
    { duration: "2m", target: 100 }, // Hold at 100 users
    { duration: "1m", target: 150 }, // Ramp to 150 users
    { duration: "2m", target: 150 }, // Hold at 150 users
    { duration: "1m", target: 200 }, // Ramp to 200 users
    { duration: "2m", target: 200 }, // Hold at 200 users - PEAK
    { duration: "2m", target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ["p(95)<2000", "p(99)<4000"],
    http_req_failed: ["rate<0.10"], // Allow 10% failure during gradual stress
  },
};

// Setup: Create a test citizen account
export function setup() {
  console.log("🔥 Starting GRADUAL STRESS TEST - Finding optimal capacity...");
  console.log("📈 Will gradually increase from 10 → 200 concurrent users");

  const timestamp = Date.now();
  const testEmail = `loadtest-${timestamp}@test.com`;

  console.log(`🔐 Creating test citizen: ${testEmail}`);

  // 1. Create test citizen account
  const signupPayload = {
    name: "Load Test User",
    email: testEmail,
    password: "Test123!@#",
  };

  const signupRes = http.post(
    `${BASE_URL}/api/auth/signup`,
    JSON.stringify(signupPayload),
    {
      headers: { "Content-Type": "application/json" },
      timeout: "10s",
    }
  );

  if (signupRes.status !== 200) {
    console.error(
      `❌ Failed to create test citizen: ${signupRes.status} ${signupRes.body}`
    );
    return { citizenId: null, token: null };
  }

  const signupData = signupRes.json();
  const citizenId = signupData.id;
  console.log(`✅ Created test citizen with ID: ${citizenId}`);

  // 2. Sign in to get authentication token
  console.log("🔐 Signing in to get auth token...");

  const signinPayload = {
    email: testEmail,
    password: "Test123!@#",
  };

  const signinRes = http.post(
    `${BASE_URL}/api/auth/signin`,
    JSON.stringify(signinPayload),
    {
      headers: { "Content-Type": "application/json" },
      timeout: "10s",
    }
  );

  if (signinRes.status !== 200) {
    console.error(
      `❌ Failed to sign in: ${signinRes.status} ${signinRes.body}`
    );
    return { citizenId: null, token: null };
  }

  // Extract token from cookies
  const cookies = signinRes.cookies;
  const token = cookies.mr_token?.[0]?.value;

  if (!token) {
    console.error("❌ Failed to extract auth token from cookies");
    return { citizenId: null, token: null };
  }

  console.log("✅ Successfully authenticated - ready for gradual load test");

  return {
    citizenId,
    token,
  };
}

// Main test: Submit reports with realistic pacing
export default function (data) {
  if (!data.citizenId || !data.token) {
    console.error("Skipping - setup failed to create test citizen");
    sleep(1);
    return;
  }

  group("Gradual Load - Report Submission", function () {
    const report = generateReport();
    report.citizenId = data.citizenId;

    const reportRes = http.post(
      `${BASE_URL}/api/reports`,
      JSON.stringify(report),
      {
        headers: {
          "Content-Type": "application/json",
          Cookie: `mr_token=${data.token}`,
        },
        timeout: "30s",
      }
    );

    const success = check(reportRes, {
      "status is not 5xx": (r) => r.status < 500,
      "response time OK": (r) => r.timings.duration < 3000,
    });

    if (reportRes.status >= 500) {
      serverErrors.add(1);
      errorRate.add(1);
    } else if (reportRes.status === 201) {
      successfulReports.add(1);
    } else if (reportRes.error || reportRes.status === 0) {
      timeouts.add(1);
      errorRate.add(1);
    } else if (reportRes.status >= 400) {
      errorRate.add(1);
      // Occasional logging for debugging
      if (Math.random() < 0.05) {
        console.warn(`Client error ${reportRes.status}: ${reportRes.body}`);
      }
    }
  });

  // Realistic think time: users don't spam requests
  sleep(Math.random() * 2 + 1); // 1-3 seconds between requests
}

export function teardown(data) {
  console.log("✅ Gradual stress test completed");
  console.log(`✔️  Successful reports: ${successfulReports.value || 0}`);
  console.log(`❌ Server errors (5xx): ${serverErrors.value || 0}`);
  console.log(`⏱️  Timeouts: ${timeouts.value || 0}`);
}
