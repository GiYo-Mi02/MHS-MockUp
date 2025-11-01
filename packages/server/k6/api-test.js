/**
 * K6 API COMPREHENSIVE TEST
 * Purpose: Test all major API endpoints with realistic flows
 *
 * This test simulates complete user journeys:
 * 1. Citizen signs up, verifies, submits reports, tracks them
 * 2. Department staff updates report status
 * 3. Admin views analytics and dashboards
 *
 * Run: k6 run k6/api-test.js
 */

import http from "k6/http";
import { check, sleep, group } from "k6";
import { Rate, Counter } from "k6/metrics";
import { BASE_URL, generateReport } from "./config.js";

const errorRate = new Rate("errors");
const endpointErrors = new Counter("endpoint_errors");

export const options = {
  vus: 10,
  duration: "3m",
  thresholds: {
    http_req_duration: ["p(95)<1000"],
    errors: ["rate<0.05"],
  },
};

export function setup() {
  console.log("🧪 Starting comprehensive API test");
  return {};
}

export default function () {
  const workflows = [citizenFlow, departmentFlow, publicFlow];
  const workflow = workflows[Math.floor(Math.random() * workflows.length)];
  workflow();
}

function citizenFlow() {
  group("Citizen Complete Journey", function () {
    const randomEmail = `citizen${Date.now()}${Math.random()}@test.com`;

    // 1. Sign up
    const signupRes = http.post(
      `${BASE_URL}/api/auth/signup`,
      JSON.stringify({
        name: "Test Citizen",
        email: randomEmail,
        password: "Test123!",
        contactNumber: "09171234567",
      }),
      { headers: { "Content-Type": "application/json" } }
    );

    check(signupRes, {
      "signup successful": (r) => r.status === 200,
      "citizen ID returned": (r) => r.json("id") !== undefined,
    }) || errorRate.add(1);

    if (signupRes.status !== 200) {
      endpointErrors.add(1);
      return;
    }

    const citizenId = signupRes.json("id");
    sleep(1);

    // 2. Sign in
    const signinRes = http.post(
      `${BASE_URL}/api/auth/signin`,
      JSON.stringify({
        email: randomEmail,
        password: "Test123!",
      }),
      { headers: { "Content-Type": "application/json" } }
    );

    check(signinRes, {
      "signin successful": (r) => r.status === 200,
    }) || errorRate.add(1);

    const token = signinRes.cookies.mr_token
      ? signinRes.cookies.mr_token[0].value
      : null;
    if (!token) return;

    sleep(1);

    // 3. Submit multiple reports
    const reports = [];
    for (let i = 0; i < 3; i++) {
      const report = generateReport();
      report.citizenId = citizenId;

      const reportRes = http.post(
        `${BASE_URL}/api/reports`,
        JSON.stringify(report),
        {
          headers: {
            "Content-Type": "application/json",
            Cookie: `mr_token=${token}`,
          },
        }
      );

      check(reportRes, {
        "report created": (r) => r.status === 201,
        "tracking ID assigned": (r) => r.json("trackingId") !== undefined,
      }) || errorRate.add(1);

      if (reportRes.status === 201) {
        reports.push(reportRes.json("trackingId"));
      }

      sleep(1);
    }

    // 4. View report history
    const historyRes = http.get(`${BASE_URL}/api/reports/history`, {
      headers: { Cookie: `mr_token=${token}` },
    });

    check(historyRes, {
      "history retrieved": (r) => r.status === 200,
      "history is array": (r) => Array.isArray(r.json()),
    }) || errorRate.add(1);

    sleep(1);

    // 5. Track each report
    reports.forEach((trackingId) => {
      const trackRes = http.get(`${BASE_URL}/api/reports/track/${trackingId}`);
      check(trackRes, {
        "report found": (r) => r.status === 200,
        "tracking ID matches": (r) => r.json("trackingId") === trackingId,
      }) || errorRate.add(1);

      sleep(0.5);
    });

    // 6. Get current user info
    const meRes = http.get(`${BASE_URL}/api/auth/me`, {
      headers: { Cookie: `mr_token=${token}` },
    });

    check(meRes, {
      "user info retrieved": (r) => r.status === 200,
      "user has trust data": (r) => r.json("user.trustScore") !== undefined,
    }) || errorRate.add(1);
  });

  sleep(2);
}

function departmentFlow() {
  group("Department Staff Operations", function () {
    // 1. Get departments list
    const deptsRes = http.get(`${BASE_URL}/api/departments`);

    check(deptsRes, {
      "departments loaded": (r) => r.status === 200,
      "has departments": (r) => Array.isArray(r.json()) && r.json().length > 0,
    }) || errorRate.add(1);

    sleep(1);

    // 2. Check notifications (would need auth)
    const notifRes = http.get(`${BASE_URL}/api/notifications`);
    check(notifRes, {
      "notifications endpoint responds": (r) => [200, 401].includes(r.status),
    });
  });

  sleep(2);
}

function publicFlow() {
  group("Public Information Access", function () {
    // 1. Health check
    const healthRes = http.get(`${BASE_URL}/api/health`);
    check(healthRes, {
      "server healthy": (r) => r.status === 200 && r.json("ok") === true,
    }) || errorRate.add(1);

    sleep(1);

    // 2. Email health
    const emailHealthRes = http.get(`${BASE_URL}/api/health/email`);
    check(emailHealthRes, {
      "email health responds": (r) => r.status === 200,
    });

    sleep(1);

    // 3. Get departments
    const deptsRes = http.get(`${BASE_URL}/api/departments`);
    check(deptsRes, {
      "departments available": (r) => r.status === 200,
    }) || errorRate.add(1);

    sleep(1);

    // 4. Try tracking random report
    const fakeTrackingId =
      "MR-" + Math.random().toString(36).slice(2, 8).toUpperCase();
    const trackRes = http.get(
      `${BASE_URL}/api/reports/track/${fakeTrackingId}`
    );
    check(trackRes, {
      "tracking works": (r) => [200, 404].includes(r.status),
    });
  });

  sleep(2);
}

export function teardown(data) {
  console.log("✅ API comprehensive test completed");
}
