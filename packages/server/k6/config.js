// K6 Load Testing Configuration
// This file contains reusable configuration for all K6 tests

export const BASE_URL = __ENV.BASE_URL || "http://localhost:4000";

// Test users with different roles
export const TEST_USERS = {
  citizen: {
    email: "testcitizen@example.com",
    password: "Test123!",
    name: "Test Citizen",
  },
  staff: {
    email: "staff@makati.gov.ph",
    password: "Staff123!",
    name: "Department Staff",
  },
  admin: {
    email: "admin@makati.gov.ph",
    password: "Admin123!",
    name: "LGU Admin",
  },
};

// Realistic department categories (must match database department codes)
export const CATEGORIES = [
  "GARBAGE", // Sanitation department
  "TRAFFIC", // Traffic Management
  "SAFETY", // Public Safety
  "ROADS", // Infrastructure
  "OTHERS", // General Services Desk
];

// Urgency levels
export const URGENCY_LEVELS = ["Critical", "High", "Regular", "Low"];

// Sample report data
export const SAMPLE_REPORTS = [
  {
    title: "Broken streetlight on Ayala Avenue",
    description:
      "The streetlight near the intersection has been out for 3 days, making it dangerous at night.",
    category: "ROADS",
    urgency: "High",
  },
  {
    title: "Uncollected garbage on Buendia Street",
    description:
      "Garbage has been piling up for 2 days. It's attracting pests and creating health hazards.",
    category: "GARBAGE",
    urgency: "Regular",
  },
  {
    title: "Traffic light malfunction",
    description:
      "Traffic light at Makati Ave is stuck on red in all directions causing traffic jam.",
    category: "TRAFFIC",
    urgency: "Critical",
  },
  {
    title: "Illegal parking blocking sidewalk",
    description:
      "Multiple vehicles are permanently parked on the sidewalk, forcing pedestrians onto the road.",
    category: "TRAFFIC",
    urgency: "Regular",
  },
  {
    title: "Pothole causing accidents",
    description:
      "Large pothole on Jupiter Street has caused several motorcycle accidents.",
    category: "ROADS",
    urgency: "High",
  },
  {
    title: "Street flooding during rain",
    description:
      "Drainage system clogged, causing street to flood even with light rain.",
    category: "ROADS",
    urgency: "High",
  },
  {
    title: "Noise pollution from construction",
    description:
      "Construction site operating beyond allowed hours, disturbing residents.",
    category: "OTHERS",
    urgency: "Regular",
  },
  {
    title: "Stray dogs in residential area",
    description:
      "Pack of stray dogs roaming the neighborhood, posing danger to children.",
    category: "SAFETY",
    urgency: "High",
  },
];

// Thresholds for different test scenarios
export const THRESHOLDS = {
  // Smoke test - verify system works with minimal load
  smoke: {
    http_req_duration: ["p(95)<500", "p(99)<1000"],
    http_req_failed: ["rate<0.01"], // Less than 1% failure
  },

  // Load test - normal expected load
  load: {
    http_req_duration: ["p(95)<800", "p(99)<1500"],
    http_req_failed: ["rate<0.02"], // Less than 2% failure
  },

  // Stress test - push beyond normal capacity
  stress: {
    http_req_duration: ["p(95)<1500", "p(99)<3000"],
    http_req_failed: ["rate<0.05"], // Less than 5% failure
  },

  // Spike test - sudden traffic surge
  spike: {
    http_req_duration: ["p(95)<2000", "p(99)<4000"],
    http_req_failed: ["rate<0.10"], // Less than 10% failure
  },

  // Soak test - sustained load over time
  soak: {
    http_req_duration: ["p(95)<1000", "p(99)<2000"],
    http_req_failed: ["rate<0.03"], // Less than 3% failure
  },
};

// Helper to get random item from array
export function randomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

// Helper to generate random location in Makati
export function randomMakatiLocation() {
  // Makati City bounds approximately
  const minLat = 14.545,
    maxLat = 14.575;
  const minLng = 121.015,
    maxLng = 121.055;

  return {
    lat: minLat + Math.random() * (maxLat - minLat),
    lng: minLng + Math.random() * (maxLng - minLng),
  };
}

// Helper to generate random report
export function generateReport() {
  const sample = randomItem(SAMPLE_REPORTS);
  const location = randomMakatiLocation();

  return {
    title: sample.title + " " + Math.random().toString(36).substring(7),
    description: sample.description,
    category: sample.category,
    urgency: sample.urgency,
    locationAddress: `${Math.floor(Math.random() * 1000)} Ayala Avenue, Makati City`,
    locationLandmark: "Near Makati Medical Center",
    locationLat: location.lat,
    locationLng: location.lng,
    submitAnonymously: Math.random() > 0.7, // 30% anonymous
  };
}
