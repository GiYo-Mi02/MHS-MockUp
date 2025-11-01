/**
 * K6 SPIKE TEST
 * Purpose: Test system's ability to handle sudden traffic spikes
 * Pattern: Sudden surge from 0 to peak, then back down
 *
 * Simulates scenarios like:
 * - Major disaster announcement (typhoon, earthquake alert)
 * - Viral social media post about city service
 * - News coverage causing sudden awareness
 *
 * Run: k6 run k6/spike-test.js
 */

import http from "k6/http";
import { check, sleep, group } from "k6";
import { Rate, Counter } from "k6/metrics";
import { BASE_URL, THRESHOLDS, generateReport } from "./config.js";

// Custom metrics
const errorRate = new Rate("errors");
const spikeHandled = new Counter("spike_requests_handled");
const spikeFailed = new Counter("spike_requests_failed");

export const options = {
  stages: [
    { duration: "10s", target: 10 }, // Normal baseline
    { duration: "30s", target: 300 }, // SUDDEN SPIKE!
    { duration: "1m", target: 300 }, // Sustained spike
    { duration: "30s", target: 500 }, // SECOND SPIKE!
    { duration: "1m", target: 100 }, // Cool down
    { duration: "30s", target: 0 }, // Back to normal
  ],
  thresholds: THRESHOLDS.spike,
};

export function setup() {
  console.log("⚡ Starting SPIKE TEST - Sudden traffic surge simulation");
  console.log("📱 Simulating viral incident causing mass reports");
  return {};
}

export default function () {
  group("Spike Traffic Simulation", function () {
    const report = generateReport();

    const reportRes = http.post(
      `${BASE_URL}/api/reports`,
      JSON.stringify(report),
      {
        headers: { "Content-Type": "application/json" },
        timeout: "20s",
      }
    );

    if (reportRes.status === 201) {
      spikeHandled.add(1);

      // During spike, some users will immediately track
      const trackingId = reportRes.json("trackingId");
      if (trackingId && Math.random() > 0.5) {
        http.get(`${BASE_URL}/api/reports/track/${trackingId}`);
      }
    } else {
      spikeFailed.add(1);
      errorRate.add(1);
    }

    check(reportRes, {
      "system responds during spike": (r) => r.status !== 0,
      "no timeouts": (r) => !r.error,
    });
  });

  // Very short sleep during spike
  sleep(0.5);
}

export function teardown(data) {
  console.log("✅ Spike test completed");
  console.log(`✔️  Requests handled: ${spikeHandled.value || 0}`);
  console.log(`❌ Requests failed: ${spikeFailed.value || 0}`);

  const total = (spikeHandled.value || 0) + (spikeFailed.value || 0);
  if (total > 0) {
    const successRate = (((spikeHandled.value || 0) / total) * 100).toFixed(2);
    console.log(`📊 Success rate during spike: ${successRate}%`);
  }
}
