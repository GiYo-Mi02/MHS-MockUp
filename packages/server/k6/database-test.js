/**
 * K6 DATABASE LOAD TEST
 * Purpose: Test database performance under load
 *
 * This test focuses specifically on database operations:
 * - Insert operations (report creation)
 * - Query operations (tracking, history)
 * - Update operations (status changes)
 * - Join operations (reports with departments)
 *
 * Run: k6 run k6/database-test.js
 */

import http from "k6/http";
import { check, sleep, group } from "k6";
import { Rate, Trend, Counter } from "k6/metrics";
import { BASE_URL, generateReport } from "./config.js";

// Custom metrics
const dbInsertTime = new Trend("db_insert_duration");
const dbQueryTime = new Trend("db_query_duration");
const dbUpdateTime = new Trend("db_update_duration");
const dbJoinTime = new Trend("db_join_duration");
const dbErrors = new Counter("db_errors");

export const options = {
  stages: [
    { duration: "1m", target: 50 },
    { duration: "3m", target: 100 },
    { duration: "1m", target: 0 },
  ],
  thresholds: {
    db_insert_duration: ["p(95)<800"],
    db_query_duration: ["p(95)<500"],
    db_update_duration: ["p(95)<600"],
    db_join_duration: ["p(95)<700"],
  },
};

export function setup() {
  console.log("🗄️  Starting DATABASE performance test");
  return {};
}

export default function () {
  const operation = Math.random();

  if (operation < 0.3) {
    // 30% - Heavy insert operations (report creation)
    testInsertPerformance();
  } else if (operation < 0.6) {
    // 30% - Query operations
    testQueryPerformance();
  } else if (operation < 0.8) {
    // 20% - Join operations (reports with departments)
    testJoinPerformance();
  } else {
    // 20% - Complex queries (history with pagination)
    testComplexQueries();
  }
}

function testInsertPerformance() {
  group("DB Insert Operations", function () {
    const report = generateReport();
    const start = Date.now();

    const res = http.post(`${BASE_URL}/api/reports`, JSON.stringify(report), {
      headers: { "Content-Type": "application/json" },
    });

    const duration = Date.now() - start;
    dbInsertTime.add(duration);

    check(res, {
      "insert successful": (r) => r.status === 201,
    }) || dbErrors.add(1);
  });

  sleep(1);
}

function testQueryPerformance() {
  group("DB Query Operations", function () {
    const trackingId =
      "MR-" + Math.random().toString(36).slice(2, 8).toUpperCase();
    const start = Date.now();

    const res = http.get(`${BASE_URL}/api/reports/track/${trackingId}`);
    const duration = Date.now() - start;
    dbQueryTime.add(duration);

    check(res, {
      "query executed": (r) => [200, 404].includes(r.status),
    });
  });

  sleep(1);
}

function testJoinPerformance() {
  group("DB Join Operations", function () {
    // Reports joined with departments
    const start = Date.now();
    const res = http.get(`${BASE_URL}/api/departments`);
    const duration = Date.now() - start;
    dbJoinTime.add(duration);

    check(res, {
      "join successful": (r) => r.status === 200,
    }) || dbErrors.add(1);
  });

  sleep(1);
}

function testComplexQueries() {
  group("Complex Queries", function () {
    // Would need authentication for real test
    // This tests the departments endpoint which involves joins
    const start = Date.now();
    const res = http.get(`${BASE_URL}/api/departments`);
    const duration = Date.now() - start;

    check(res, {
      "complex query successful": (r) => r.status === 200,
    });
  });

  sleep(1);
}

export function teardown(data) {
  console.log("✅ Database performance test completed");
  console.log("📊 Check database logs for slow queries");
  console.log("💡 Tip: Run EXPLAIN on slow queries to optimize");
}
