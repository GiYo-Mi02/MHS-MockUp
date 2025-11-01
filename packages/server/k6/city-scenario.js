/**
 * K6 CITY-WIDE SCENARIO TEST
 * Purpose: Simulate realistic city-wide usage patterns
 *
 * This test models actual Makati City usage:
 * - Rush hour traffic (7-9 AM, 5-7 PM)
 * - Lunch break spike (12-1 PM)
 * - Weekend vs weekday patterns
 * - Department-specific loads
 * - Citizen behavior patterns
 *
 * Run: k6 run k6/city-scenario.js
 */

import http from "k6/http";
import { check, sleep, group } from "k6";
import { Rate, Trend, Counter } from "k6/metrics";
import { BASE_URL, CATEGORIES, generateReport, randomItem } from "./config.js";

// Custom metrics
const reportsByDepartment = new Counter("reports_by_department");
const citizenReports = new Counter("citizen_reports");
const anonymousReports = new Counter("anonymous_reports");
const urgentReports = new Counter("urgent_reports");
const resolutionChecks = new Counter("resolution_checks");

export const options = {
  scenarios: {
    // Scenario 1: Morning Rush (7-9 AM) - Traffic & Transit issues
    morning_rush: {
      executor: "ramping-vus",
      startTime: "0s",
      stages: [
        { duration: "2m", target: 50 }, // 7-7:30 AM
        { duration: "3m", target: 100 }, // 7:30-8 AM peak
        { duration: "3m", target: 80 }, // 8-8:30 AM
        { duration: "2m", target: 40 }, // 8:30-9 AM cooldown
      ],
      exec: "morningRush",
    },

    // Scenario 2: Regular Daytime Activity
    daytime_activity: {
      executor: "constant-vus",
      startTime: "10m",
      duration: "20m",
      vus: 30,
      exec: "daytimeActivity",
    },

    // Scenario 3: Lunch Break Spike (12-1 PM)
    lunch_spike: {
      executor: "ramping-vus",
      startTime: "30m",
      stages: [
        { duration: "2m", target: 60 }, // Lunch starts
        { duration: "3m", target: 120 }, // Peak lunch
        { duration: "3m", target: 60 }, // Returning to work
        { duration: "2m", target: 30 }, // Back to normal
      ],
      exec: "lunchActivity",
    },

    // Scenario 4: Evening Rush (5-7 PM)
    evening_rush: {
      executor: "ramping-vus",
      startTime: "40m",
      stages: [
        { duration: "2m", target: 60 },
        { duration: "4m", target: 120 }, // Peak evening traffic
        { duration: "3m", target: 90 },
        { duration: "2m", target: 40 },
      ],
      exec: "eveningRush",
    },

    // Scenario 5: Department Staff Processing Reports
    department_operations: {
      executor: "constant-vus",
      startTime: "0s",
      duration: "51m",
      vus: 10,
      exec: "departmentStaff",
    },

    // Scenario 6: Citizens Tracking Reports
    report_tracking: {
      executor: "constant-vus",
      startTime: "0s",
      duration: "51m",
      vus: 20,
      exec: "reportTracking",
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<1500", "p(99)<2500"],
    http_req_failed: ["rate<0.03"],
  },
};

export function setup() {
  console.log("🏙️  Starting CITY-WIDE scenario simulation");
  console.log("📊 Simulating full day in Makati City");
  return {};
}

// Morning Rush: Mostly traffic, utilities, and safety reports
export function morningRush() {
  group("Morning Rush Hour Reports", function () {
    const categories = ["TRAFFIC", "UTILITIES", "SAFETY"];
    const category = randomItem(categories);

    const report = generateReport();
    report.category = category;
    report.urgency = Math.random() > 0.5 ? "High" : "Critical";

    const res = http.post(`${BASE_URL}/api/reports`, JSON.stringify(report), {
      headers: { "Content-Type": "application/json" },
    });

    if (res.status === 201) {
      citizenReports.add(1);
      reportsByDepartment.add(1, { department: category });
      if (report.urgency === "Critical") urgentReports.add(1);
    }
  });

  sleep(2 + Math.random() * 3);
}

// Daytime: Mixed reports, more organized reporting
export function daytimeActivity() {
  group("Daytime Regular Activity", function () {
    const report = generateReport();
    report.urgency = Math.random() > 0.7 ? "High" : "Regular";

    const res = http.post(`${BASE_URL}/api/reports`, JSON.stringify(report), {
      headers: { "Content-Type": "application/json" },
    });

    if (res.status === 201) {
      citizenReports.add(1);
      reportsByDepartment.add(1, { department: report.category });
    }
  });

  sleep(5 + Math.random() * 5);
}

// Lunch Break: Mix of categories, some people checking reports
export function lunchActivity() {
  const activity = Math.random();

  if (activity < 0.6) {
    // 60% - Submit reports during break
    group("Lunch Break Submissions", function () {
      const report = generateReport();

      const res = http.post(`${BASE_URL}/api/reports`, JSON.stringify(report), {
        headers: { "Content-Type": "application/json" },
      });

      if (res.status === 201) {
        citizenReports.add(1);
        reportsByDepartment.add(1, { department: report.category });
      }
    });
  } else {
    // 40% - Check existing reports
    group("Lunch Break Tracking", function () {
      const trackingId =
        "MR-" + Math.random().toString(36).slice(2, 8).toUpperCase();
      http.get(`${BASE_URL}/api/reports/track/${trackingId}`);
      resolutionChecks.add(1);
    });
  }

  sleep(3 + Math.random() * 4);
}

// Evening Rush: Similar to morning, more anonymous reports
export function eveningRush() {
  group("Evening Rush Reports", function () {
    const categories = ["TRAFFIC", "SAFETY", "UTILITIES"];
    const report = generateReport();
    report.category = randomItem(categories);
    report.submitAnonymously = Math.random() > 0.6; // 40% anonymous

    const res = http.post(`${BASE_URL}/api/reports`, JSON.stringify(report), {
      headers: { "Content-Type": "application/json" },
    });

    if (res.status === 201) {
      if (report.submitAnonymously) {
        anonymousReports.add(1);
      } else {
        citizenReports.add(1);
      }
      reportsByDepartment.add(1, { department: report.category });
    }
  });

  sleep(2 + Math.random() * 3);
}

// Department Staff: View and update reports
export function departmentStaff() {
  group("Department Operations", function () {
    // Get departments
    http.get(`${BASE_URL}/api/departments`);

    sleep(2);

    // Check health
    http.get(`${BASE_URL}/api/health`);
  });

  sleep(10 + Math.random() * 10);
}

// Citizens tracking their reports
export function reportTracking() {
  group("Report Tracking by Citizens", function () {
    const trackingId =
      "MR-" + Math.random().toString(36).slice(2, 8).toUpperCase();
    http.get(`${BASE_URL}/api/reports/track/${trackingId}`);
    resolutionChecks.add(1);
  });

  sleep(8 + Math.random() * 7);
}

export function teardown(data) {
  console.log("✅ City-wide scenario simulation completed");
  console.log("");
  console.log("📊 Report Statistics:");
  console.log(`   Total Citizen Reports: ${citizenReports.value || 0}`);
  console.log(`   Anonymous Reports: ${anonymousReports.value || 0}`);
  console.log(`   Urgent Reports: ${urgentReports.value || 0}`);
  console.log(`   Resolution Checks: ${resolutionChecks.value || 0}`);
  console.log("");
  console.log("🏢 Department Load Distribution:");
  console.log("   (Check detailed metrics for breakdown by department)");
}
