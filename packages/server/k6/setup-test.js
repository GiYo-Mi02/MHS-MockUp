/**
 * K6 SETUP TEST
 * Purpose: Verify that the authentication setup works before running full stress test
 * This creates a test citizen and makes one authenticated report submission
 *
 * Run: k6 run k6/setup-test.js
 */

import http from "k6/http";
import { check } from "k6";
import { BASE_URL, generateReport } from "./config.js";

export const options = {
  vus: 1,
  iterations: 1,
};

export function setup() {
  console.log("🧪 Testing authentication setup...");

  const email = `setuptest-${Date.now()}@test.com`;
  const password = "SetupTest123!";

  // Step 1: Create citizen account
  console.log(`📝 Step 1: Creating citizen account with email: ${email}`);
  const signupPayload = {
    name: "Setup Test User",
    email: email,
    password: password,
    contactNumber: "09171234567",
  };

  const signupRes = http.post(
    `${BASE_URL}/api/auth/signup`,
    JSON.stringify(signupPayload),
    {
      headers: { "Content-Type": "application/json" },
    }
  );

  console.log(`   Status: ${signupRes.status}`);
  console.log(`   Body: ${signupRes.body}`);

  if (signupRes.status !== 200) {
    console.error(`❌ Signup failed with status ${signupRes.status}`);
    return { success: false, citizenId: null, token: null };
  }

  const signupData = JSON.parse(signupRes.body);
  const citizenId = signupData.id;
  console.log(`✅ Created citizen with ID: ${citizenId}`);

  // Step 2: Sign in to get token
  console.log(`🔐 Step 2: Signing in to get authentication token...`);
  const signinRes = http.post(
    `${BASE_URL}/api/auth/signin`,
    JSON.stringify({ email, password }),
    {
      headers: { "Content-Type": "application/json" },
    }
  );

  console.log(`   Status: ${signinRes.status}`);
  console.log(`   Body: ${signinRes.body.substring(0, 200)}...`);

  if (signinRes.status !== 200) {
    console.error(`❌ Signin failed with status ${signinRes.status}`);
    return { success: false, citizenId: citizenId, token: null };
  }

  // Extract token cookie
  const cookies = signinRes.cookies;
  console.log(`   Cookies received: ${JSON.stringify(Object.keys(cookies))}`);

  const tokenCookie =
    cookies.mr_token && cookies.mr_token.length > 0
      ? cookies.mr_token[0]
      : null;

  if (!tokenCookie) {
    console.error(`❌ No mr_token cookie received`);
    return { success: false, citizenId: citizenId, token: null };
  }

  console.log(
    `✅ Received auth token (first 20 chars): ${tokenCookie.value.substring(0, 20)}...`
  );

  return {
    success: true,
    citizenId: citizenId,
    token: tokenCookie.value,
    email: email,
  };
}

export default function (data) {
  if (!data.success) {
    console.error("❌ Setup failed - cannot test report submission");
    return;
  }

  console.log(`📋 Step 3: Creating authenticated report...`);

  const report = generateReport();
  report.citizenId = data.citizenId;

  console.log(`   Report title: ${report.title}`);
  console.log(`   Report category: ${report.category}`);
  console.log(`   Citizen ID: ${report.citizenId}`);
  console.log(`   Using token: ${data.token.substring(0, 20)}...`);
  console.log(`   Full report payload: ${JSON.stringify(report, null, 2)}`);

  const reportRes = http.post(
    `${BASE_URL}/api/reports`,
    JSON.stringify(report),
    {
      headers: {
        "Content-Type": "application/json",
        Cookie: `mr_token=${data.token}`,
      },
    }
  );

  console.log(`   Status: ${reportRes.status}`);
  console.log(`   Body: ${reportRes.body.substring(0, 300)}...`);

  const passed = check(reportRes, {
    "report created successfully": (r) => r.status === 201,
    "response contains tracking ID": (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.trackingId && body.trackingId.startsWith("MR-");
      } catch {
        return false;
      }
    },
  });

  if (passed) {
    const reportData = JSON.parse(reportRes.body);
    console.log(`✅ Report created successfully!`);
    console.log(`   Tracking ID: ${reportData.trackingId}`);
    console.log(`   Report ID: ${reportData.id}`);
    console.log(`   Status: ${reportData.status}`);
  } else {
    console.error(`❌ Report creation failed`);
  }
}

export function teardown(data) {
  if (data.success) {
    console.log("\n✅ ============================================");
    console.log("✅ SETUP TEST PASSED - Ready for stress test!");
    console.log("✅ ============================================");
    console.log(`   Citizen ID: ${data.citizenId}`);
    console.log(`   Email: ${data.email}`);
    console.log(`   Token: ${data.token.substring(0, 30)}...`);
    console.log("\n🚀 You can now run: run-tests.bat (option 3)");
  } else {
    console.log("\n❌ ============================================");
    console.log("❌ SETUP TEST FAILED - Fix issues before stress test");
    console.log("❌ ============================================");
  }
}
