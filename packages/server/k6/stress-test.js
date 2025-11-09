/**
 * K6 STRESS TEST
 * Purpose: Test system beyond normal capacity to find breaking points
 * VUs: Up to 500 concurrent users
 * Duration: 60 seconds
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
    { duration: "10s", target: 100 }, // Warm up
    { duration: "10s", target: 200 }, // Approaching stress
    { duration: "10s", target: 300 }, // Stress level
    { duration: "15s", target: 400 }, // High stress
    { duration: "10s", target: 500 }, // Breaking point
    { duration: "5s", target: 0 }, // Recovery
  ],
  thresholds: THRESHOLDS.stress,
};

export function setup() {
  console.log("⚠️  Starting STRESS TEST - Finding system limits...");
  console.log("🔥 Simulating major city-wide incident with surge of reports");

  // Create a test citizen account for load testing
  const email = `loadtest-${Date.now()}@test.com`;
  const password = "LoadTest123!";

  const signupPayload = {
    name: "K6 Stress Test User", // API expects 'name' not 'fullName'
    email: email,
    password: password,
    contactNumber: "09171234567",
  };

  console.log(`🔐 Creating test citizen: ${email}`);

  const signupRes = http.post(
    `${BASE_URL}/api/auth/signup`,
    JSON.stringify(signupPayload),
    {
      headers: { "Content-Type": "application/json" },
    }
  );

  if (signupRes.status === 200) {
    const signupData = JSON.parse(signupRes.body);
    const citizenId = signupData.id; // API returns 'id' not 'citizenId'
    console.log(`✅ Created test citizen with ID: ${citizenId}`);

    // Now sign in to get the token
    console.log(`🔐 Signing in to get auth token...`);
    const signinRes = http.post(
      `${BASE_URL}/api/auth/signin`,
      JSON.stringify({ email, password }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );

    if (signinRes.status === 200) {
      // Extract token from cookie
      const cookies = signinRes.cookies;
      const tokenCookie =
        cookies.mr_token && cookies.mr_token.length > 0
          ? cookies.mr_token[0]
          : null;

      if (tokenCookie) {
        console.log(`✅ Successfully authenticated - ready for load test`);
        return {
          citizenId: citizenId,
          token: tokenCookie.value,
          email: email,
        };
      } else {
        console.error(`❌ No token cookie received from signin`);
        console.error(`Signin response: ${signinRes.body}`);
        return { citizenId: null, token: null, email: null };
      }
    } else {
      console.error(`❌ Signin failed: ${signinRes.status}`);
      console.error(signinRes.body);
      return { citizenId: null, token: null, email: null };
    }
  } else {
    console.error(`❌ Failed to create test citizen: ${signupRes.status}`);
    console.error(signupRes.body);
    return { citizenId: null, token: null, email: null };
  }
}

export default function (data) {
  // Skip if setup failed
  if (!data.citizenId || !data.token) {
    console.error("Skipping - setup failed to create test citizen");
    sleep(1);
    return;
  }

  group("High-Stress Report Submission", function () {
    const report = generateReport();

    // Add citizen ID to report (authenticated submission)
    report.citizenId = data.citizenId;

    // Most users will create reports during stress scenarios
    const reportRes = http.post(
      `${BASE_URL}/api/reports`,
      JSON.stringify(report),
      {
        headers: {
          "Content-Type": "application/json",
          Cookie: `mr_token=${data.token}`, // Use correct cookie name 'mr_token'
        },
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
    } else if (reportRes.error || reportRes.status === 0) {
      timeouts.add(1);
      errorRate.add(1);
    } else if (reportRes.status >= 400) {
      // Log client errors for debugging
      if (Math.random() < 0.01) {
        // Log 1% to avoid spam
        console.warn(
          `Client error ${reportRes.status}: ${reportRes.body.substring(0, 100)}`
        );
      }
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
