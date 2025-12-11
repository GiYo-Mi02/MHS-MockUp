# Makati Report System - Comprehensive Documentation

> **Version:** 1.0.0  
> **Last Updated:** December 5, 2025  
> **Project Type:** Full-Stack Monorepo  
> **Status:** Production Ready

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture](#2-system-architecture)
3. [Technology Stack](#3-technology-stack)
4. [Project Structure](#4-project-structure)
5. [Database Schema](#5-database-schema)
6. [Authentication & Authorization](#6-authentication--authorization)
7. [API Reference](#7-api-reference)
8. [Frontend Pages & Components](#8-frontend-pages--components)
9. [Core Features](#9-core-features)
10. [Services & Business Logic](#10-services--business-logic)
11. [Security Implementation](#11-security-implementation)
12. [Deployment Guide](#12-deployment-guide)
13. [Environment Configuration](#13-environment-configuration)
14. [Testing](#14-testing)
15. [Troubleshooting](#15-troubleshooting)

---

## 1. Executive Summary

### 1.1 Project Overview

**Makati Report** is a full-stack citizen concern reporting system designed for Makati City, Philippines. The system enables citizens to submit reports about various city concerns (garbage, traffic, safety, infrastructure), which are then routed to the appropriate city departments for resolution.

### 1.2 Key Objectives

- **Streamlined Reporting:** Enable citizens to quickly submit concerns with supporting evidence
- **Efficient Routing:** Automatically assign reports to the correct department based on category
- **Real-time Tracking:** Allow citizens to track report status via tracking IDs
- **Department Management:** Provide department staff with tools to manage and respond to reports
- **City Analytics:** Give administrators comprehensive insights into city-wide performance
- **Trust System:** Implement spam prevention through citizen trust scoring

### 1.3 User Roles

| Role        | Description                                | Access Level                                         |
| ----------- | ------------------------------------------ | ---------------------------------------------------- |
| **CITIZEN** | Regular users who submit and track reports | Submit reports, track status, view history           |
| **STAFF**   | Department employees who handle reports    | Department queue, respond to citizens, update status |
| **ADMIN**   | City administrators                        | Full analytics, cross-department oversight           |

### 1.4 System Highlights

- ✅ Mobile-responsive React SPA with dark mode support
- ✅ Interactive Leaflet maps with geo-location
- ✅ Photo evidence upload (Cloudinary/local storage)
- ✅ Email notifications for status updates
- ✅ Trust-based spam prevention system
- ✅ SLA tracking and performance analytics
- ✅ Export capabilities (CSV, Excel, PDF)
- ✅ Rate limiting and security headers

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLIENT LAYER                                   │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                    React SPA (Vite)                                │  │
│  │  • Pages: Home, Report, Track, Dashboard, SignIn, SignUp          │  │
│  │  • Components: Maps, Forms, Toast, Notifications                   │  │
│  │  • State: React Context (Auth, Theme, Toast)                       │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                              │ HTTP/HTTPS                                │
│                              ▼                                           │
├─────────────────────────────────────────────────────────────────────────┤
│                           API LAYER                                      │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                   Express.js Server                                │  │
│  │  • Routes: auth, reports, departments, notifications, analytics   │  │
│  │  • Middleware: CORS, helmet, rate-limit, auth                     │  │
│  │  • Services: email, storage, trust, verification                  │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                              │                                           │
│                              ▼                                           │
├─────────────────────────────────────────────────────────────────────────┤
│                         DATA LAYER                                       │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐  │
│  │    Supabase      │    │    Cloudinary    │    │   Gmail SMTP     │  │
│  │   (PostgreSQL)   │    │  (Image CDN)     │    │  (Email)         │  │
│  └──────────────────┘    └──────────────────┘    └──────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow

```
Citizen Submits Report
         │
         ▼
    ┌─────────┐     ┌─────────────┐     ┌─────────────────┐
    │ Validate │────▶│ Check Trust │────▶│ Upload Evidence │
    │ Input    │     │ Level       │     │ (Cloudinary)    │
    └─────────┘     └─────────────┘     └─────────────────┘
                           │                     │
                           ▼                     ▼
                    ┌─────────────┐     ┌─────────────────┐
                    │ Assign Dept │────▶│ Create Report   │
                    │ (by category)│     │ (Supabase)      │
                    └─────────────┘     └─────────────────┘
                                               │
                           ┌───────────────────┴───────────────────┐
                           ▼                                       ▼
                    ┌─────────────┐                         ┌─────────────┐
                    │ Notify Staff│                         │ Email Citizen│
                    │ (In-app)    │                         │ (Receipt)    │
                    └─────────────┘                         └─────────────┘
```

### 2.3 Monorepo Structure

```
makati-report/
├── packages/
│   ├── web/        # React frontend (Vite)
│   └── server/     # Express backend (TypeScript)
├── docs/           # Documentation
└── package.json    # Root package (npm workspaces)
```

---

## 3. Technology Stack

### 3.1 Frontend Technologies

| Technology          | Version | Purpose                 |
| ------------------- | ------- | ----------------------- |
| **React**           | 18.3.1  | UI framework            |
| **Vite**            | 5.4.8   | Build tool & dev server |
| **TypeScript**      | 5.6.2   | Type safety             |
| **TailwindCSS**     | 3.4.13  | Styling                 |
| **React Router**    | 6.26.2  | Client-side routing     |
| **React Hook Form** | 7.53.0  | Form management         |
| **Axios**           | 1.7.7   | HTTP client             |
| **Leaflet**         | 1.9.4   | Interactive maps        |
| **React-Leaflet**   | 4.2.1   | React map components    |
| **Recharts**        | 2.12.7  | Analytics charts        |
| **Lucide React**    | 0.462.0 | Icons                   |
| **jsPDF**           | 2.5.1   | PDF export              |
| **xlsx**            | 0.18.5  | Excel export            |
| **Zod**             | 3.23.8  | Schema validation       |
| **clsx**            | 2.1.1   | Class name utility      |

### 3.2 Backend Technologies

| Technology             | Version | Purpose               |
| ---------------------- | ------- | --------------------- |
| **Node.js**            | 20+     | Runtime environment   |
| **Express**            | 4.19.2  | Web framework         |
| **TypeScript**         | 5.6.2   | Type safety           |
| **Supabase**           | 2.78.0  | Database (PostgreSQL) |
| **bcryptjs**           | 2.4.3   | Password hashing      |
| **jsonwebtoken**       | 9.0.2   | JWT authentication    |
| **nodemailer**         | 6.10.1  | Email service         |
| **cloudinary**         | 2.5.1   | Image storage         |
| **multer**             | 1.4.5   | File uploads          |
| **helmet**             | 8.1.0   | Security headers      |
| **express-rate-limit** | 8.2.1   | Rate limiting         |
| **compression**        | 1.8.1   | Response compression  |
| **cookie-parser**      | 1.4.6   | Cookie handling       |
| **dotenv**             | 16.4.5  | Environment variables |

### 3.3 External Services

| Service           | Purpose                                         |
| ----------------- | ----------------------------------------------- |
| **Supabase**      | PostgreSQL database with real-time capabilities |
| **Cloudinary**    | Image CDN and transformation                    |
| **Gmail SMTP**    | Transactional email delivery                    |
| **OpenStreetMap** | Map tiles for Leaflet                           |
| **Nominatim**     | Reverse geocoding                               |

---

## 4. Project Structure

### 4.1 Frontend Structure (`packages/web`)

```
packages/web/
├── public/
│   └── Makati-Cares.jpg        # Logo image
├── src/
│   ├── components/
│   │   ├── Footer.tsx          # Site footer
│   │   ├── Header.tsx          # Navigation header
│   │   ├── NotificationDropdown.tsx  # Staff notifications
│   │   ├── ProtectedRoute.tsx  # Auth guard
│   │   ├── maps/
│   │   │   ├── MapPicker.tsx   # Location selection
│   │   │   └── ReportsMap.tsx  # Report visualization
│   │   └── ui/
│   │       └── Toast.tsx       # Notification toasts
│   ├── lib/
│   │   ├── api.ts              # Axios instance
│   │   ├── auth.tsx            # Auth context
│   │   ├── geocode.ts          # Reverse geocoding
│   │   ├── leaflet.ts          # Map configuration
│   │   ├── notifications.ts    # Notification helpers
│   │   ├── theme.tsx           # Dark mode context
│   │   └── toast.tsx           # Toast context
│   ├── pages/
│   │   ├── Dashboard.tsx       # Staff/Admin dashboard
│   │   ├── Home.tsx            # Landing page
│   │   ├── MyReports.tsx       # Citizen report history
│   │   ├── Report.tsx          # Submit report form
│   │   ├── SignIn.tsx          # Login page
│   │   ├── SignUp.tsx          # Registration page
│   │   ├── Track.tsx           # Track report status
│   │   └── VerifyAccount.tsx   # Email verification
│   ├── main.tsx                # App entry point
│   └── styles.css              # Global styles
├── index.html
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

### 4.2 Backend Structure (`packages/server`)

```
packages/server/
├── scripts/
│   ├── db-init.ts              # Database initialization
│   ├── db-seed.ts              # Seed data
│   ├── schema.sql              # SQL schema (reference)
│   └── seed.sql                # Seed SQL (reference)
├── src/
│   ├── routes/
│   │   ├── analytics.ts        # Analytics endpoints
│   │   ├── auth.ts             # Authentication
│   │   ├── dashboards.ts       # Dashboard data
│   │   ├── departments.ts      # Department CRUD
│   │   ├── notifications.ts    # Notification management
│   │   └── reports.ts          # Report CRUD
│   ├── services/
│   │   ├── analytics.ts        # Analytics calculations
│   │   ├── email.ts            # Email transport
│   │   ├── notifications.ts    # In-app notifications
│   │   ├── report-email.ts     # Report email templates
│   │   ├── storage.ts          # File storage
│   │   ├── trust.ts            # Trust scoring
│   │   └── verification.ts     # Account verification
│   ├── auth.ts                 # Auth middleware
│   ├── db.ts                   # Legacy DB file
│   ├── index.ts                # Express entry point
│   └── supabase.ts             # Supabase client
├── k6/                         # Load testing scripts
├── uploads/                    # Local file storage
├── package.json
└── tsconfig.json
```

---

## 5. Database Schema

### 5.1 Entity Relationship Diagram

```
┌──────────────┐       ┌──────────────┐       ┌──────────────────┐
│ departments  │       │   citizens   │       │     admins       │
├──────────────┤       ├──────────────┤       ├──────────────────┤
│ department_id│◄──┐   │ citizen_id   │       │ admin_id         │
│ name         │   │   │ full_name    │       │ full_name        │
│ code         │   │   │ email        │       │ email            │
│ description  │   │   │ password_hash│       │ password_hash    │
│ contact_email│   │   │ is_verified  │       │ created_at       │
│ contact_number│  │   │ trust_score  │       └──────────────────┘
└──────────────┘   │   │ trust_level  │
       │           │   └──────────────┘
       │           │          │
       ▼           │          │
┌──────────────────┐          │
│ department_staff │          │
├──────────────────┤          │
│ staff_id         │          │
│ department_id    │──────────┤
│ full_name        │          │
│ email            │          │
│ password_hash    │          │
└──────────────────┘          │
       │                      │
       ▼                      ▼
┌─────────────────────────────────────────────┐
│                  reports                      │
├─────────────────────────────────────────────┤
│ report_id          │ citizen_id              │
│ tracking_id        │ assigned_department_id  │
│ title              │ assigned_staff_id       │
│ category           │ status                  │
│ description        │ urgency_level           │
│ location_address   │ is_anonymous            │
│ location_lat/lng   │ requires_manual_review  │
│ expected_resolution│ trust_credit_applied    │
│ created_at         │ resolved_at             │
└─────────────────────────────────────────────┘
       │
       ├───────────────────┬─────────────────────┐
       ▼                   ▼                     ▼
┌──────────────┐  ┌─────────────────┐  ┌───────────────────┐
│report_evidence│  │report_status_logs│  │  notifications   │
├──────────────┤  ├─────────────────┤  ├───────────────────┤
│ evidence_id   │  │ log_id          │  │ notification_id   │
│ report_id     │  │ report_id       │  │ report_id         │
│ file_url      │  │ action          │  │ recipient_type    │
│ file_type     │  │ actor_type      │  │ recipient_id      │
│ uploaded_at   │  │ old_status      │  │ message           │
└──────────────┘  │ new_status      │  │ read_at           │
                  │ remarks         │  └───────────────────┘
                  └─────────────────┘

┌──────────────┐
│ sla_policies │
├──────────────┤
│ sla_id       │
│ category     │
│ urgency_level│
│ expected_hours│
└──────────────┘
```

### 5.2 Table Definitions

#### `departments`

| Column         | Type         | Description            |
| -------------- | ------------ | ---------------------- |
| department_id  | INT (PK)     | Auto-increment ID      |
| name           | VARCHAR(100) | Department full name   |
| code           | VARCHAR(50)  | Unique category code   |
| description    | TEXT         | Department description |
| contact_email  | VARCHAR(100) | Contact email          |
| contact_number | VARCHAR(20)  | Contact phone          |

#### `citizens`

| Column                  | Type         | Description                |
| ----------------------- | ------------ | -------------------------- |
| citizen_id              | INT (PK)     | Auto-increment ID          |
| full_name               | VARCHAR(100) | Citizen name               |
| contact_number          | VARCHAR(20)  | Phone number               |
| email                   | VARCHAR(100) | Unique email               |
| password_hash           | VARCHAR(255) | Bcrypt hash                |
| is_anonymous            | BOOLEAN      | Anonymous flag             |
| is_verified             | BOOLEAN      | Email verified             |
| verification_method     | ENUM         | email/phone/manual         |
| verification_code_hash  | VARCHAR(255) | OTP hash                   |
| verification_expires_at | TIMESTAMP    | OTP expiry                 |
| trust_score             | INT          | -5 to +5 score             |
| trust_level             | ENUM         | LOW/MEDIUM/HIGH (computed) |
| created_at              | TIMESTAMP    | Registration date          |

#### `reports`

| Column                    | Type         | Description                                                  |
| ------------------------- | ------------ | ------------------------------------------------------------ |
| report_id                 | INT (PK)     | Auto-increment ID                                            |
| citizen_id                | INT (FK)     | Submitting citizen                                           |
| tracking_id               | VARCHAR(30)  | Public tracking ID (MR-XXXXXX)                               |
| title                     | VARCHAR(150) | Report headline                                              |
| category                  | VARCHAR(50)  | GARBAGE/TRAFFIC/SAFETY/ROADS/OTHERS                          |
| description               | TEXT         | Full description                                             |
| urgency_level             | VARCHAR(20)  | Regular/Urgent/Emergency                                     |
| status                    | VARCHAR(20)  | Pending/Manual Review/In Progress/Resolved/Cancelled/Invalid |
| location_address          | TEXT         | Street address                                               |
| location_landmark         | TEXT         | Nearby landmark                                              |
| location_lat              | DECIMAL(9,6) | GPS latitude                                                 |
| location_lng              | DECIMAL(9,6) | GPS longitude                                                |
| assigned_department_id    | INT (FK)     | Target department                                            |
| assigned_staff_id         | INT (FK)     | Assigned handler                                             |
| is_anonymous              | BOOLEAN      | Hidden identity                                              |
| requires_manual_review    | BOOLEAN      | Trust-based flag                                             |
| trust_credit_applied      | BOOLEAN      | Credit given                                                 |
| trust_penalty_applied     | BOOLEAN      | Penalty given                                                |
| expected_resolution_hours | INT          | SLA target                                                   |
| created_at                | TIMESTAMP    | Submission date                                              |
| assigned_at               | TIMESTAMP    | Assignment date                                              |
| resolved_at               | TIMESTAMP    | Resolution date                                              |

### 5.3 Report Status Flow

```
┌────────────┐
│  CITIZEN   │
│  SUBMITS   │
└─────┬──────┘
      │
      ▼
┌─────────────────────────────────────────────────────────┐
│                    TRUST CHECK                           │
├─────────────────┬──────────────────┬────────────────────┤
│   LOW TRUST     │  MEDIUM TRUST    │    HIGH TRUST      │
│  (score ≤ -2)   │  (-2 < score < 3)│   (score ≥ 3)      │
└────────┬────────┴────────┬─────────┴──────────┬─────────┘
         │                 │                     │
         ▼                 ▼                     ▼
┌─────────────────┐ ┌─────────────┐      ┌─────────────┐
│ Manual Review   │ │   Pending   │      │   Pending   │
│ (1 report/day)  │ │(5 reports/d)│      │ (Unlimited) │
└────────┬────────┘ └──────┬──────┘      └──────┬──────┘
         │                 │                     │
         └────────────────┬┴─────────────────────┘
                          ▼
                   ┌─────────────┐
                   │ In Progress │
                   └──────┬──────┘
                          │
         ┌────────────────┼────────────────┐
         ▼                ▼                ▼
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│  Resolved   │   │  Cancelled  │   │   Invalid   │
│ (+1 trust)  │   │ (no change) │   │ (-1 trust)  │
└─────────────┘   └─────────────┘   └─────────────┘
```

---

## 6. Authentication & Authorization

### 6.1 Authentication Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                      SIGNUP FLOW                                  │
├──────────────────────────────────────────────────────────────────┤
│  1. User submits: name, email, password, contactNumber           │
│  2. Server hashes password with bcrypt (10 rounds)               │
│  3. Insert into citizens table                                    │
│  4. Issue verification code (6-digit, 15min TTL)                 │
│  5. Send verification email (if SMTP configured)                 │
│  6. Return success with devCode in development                   │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                      SIGNIN FLOW                                  │
├──────────────────────────────────────────────────────────────────┤
│  1. User submits: email, password                                │
│  2. Server checks citizens → staff → admins tables               │
│  3. Compare password hash with bcrypt                            │
│  4. Generate JWT token (HS256, 7-day expiry)                     │
│  5. Set HttpOnly cookie (mr_token)                               │
│  6. Return user object with trust metadata                       │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                    VERIFICATION FLOW                              │
├──────────────────────────────────────────────────────────────────┤
│  1. POST /auth/verification/request                               │
│     → Generate 6-digit code                                       │
│     → Hash with bcrypt, store in citizens table                  │
│     → Set expiration (now + 15 minutes)                          │
│     → Send email with code                                        │
│                                                                   │
│  2. POST /auth/verification/confirm                               │
│     → Fetch citizen record                                        │
│     → Check expiration                                            │
│     → Compare code hash                                           │
│     → Set is_verified = true                                      │
│     → Clear verification fields                                   │
└──────────────────────────────────────────────────────────────────┘
```

### 6.2 JWT Token Structure

```javascript
{
  "sub": "123",           // User ID
  "email": "user@example.com",
  "role": "CITIZEN",      // CITIZEN | STAFF | ADMIN
  "departmentId": null,   // Only for STAFF
  "iat": 1733356800,      // Issued at
  "exp": 1733961600       // Expires (7 days)
}
```

### 6.3 Authorization Middleware

```typescript
// requireAuth - Validates JWT from cookie
export function requireAuth(req, res, next) {
  const token = req.cookies.mr_token;
  if (!token) return res.status(401).json({ error: "Not authenticated" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

// requireRole - Checks user role
export function requireRole(...roles: Role[]) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}
```

### 6.4 Protected Routes

| Route                   | Required Auth | Required Role |
| ----------------------- | ------------- | ------------- |
| `/report`               | ✅            | CITIZEN       |
| `/my-reports`           | ✅            | CITIZEN       |
| `/dashboard/department` | ✅            | STAFF         |
| `/dashboard/admin`      | ✅            | ADMIN         |
| `/track/:id`            | ❌            | Any           |
| `/signin`, `/signup`    | ❌            | Any           |

---

## 7. API Reference

### 7.1 Authentication Endpoints

#### `POST /api/auth/signup`

Create a new citizen account.

**Request Body:**

```json
{
  "name": "Juan Dela Cruz",
  "email": "juan@example.com",
  "password": "securepassword",
  "contactNumber": "09171234567"
}
```

**Response:**

```json
{
  "id": 1,
  "name": "Juan Dela Cruz",
  "email": "juan@example.com",
  "role": "CITIZEN",
  "verification": {
    "required": true,
    "devCode": "123456" // Only in development
  }
}
```

#### `POST /api/auth/signin`

Authenticate and receive JWT cookie.

**Request Body:**

```json
{
  "email": "juan@example.com",
  "password": "securepassword"
}
```

**Response:**

```json
{
  "user": {
    "id": 1,
    "name": "Juan Dela Cruz",
    "email": "juan@example.com",
    "role": "CITIZEN",
    "departmentId": null,
    "isVerified": true,
    "trustScore": 2,
    "trustLevel": "MEDIUM",
    "dailyReportLimit": 5,
    "reportsSubmittedToday": 1,
    "totalReportsSubmitted": 10
  }
}
```

#### `GET /api/auth/me`

Get current authenticated user.

#### `POST /api/auth/signout`

Clear authentication cookie.

#### `POST /api/auth/verification/request`

Request email verification code.

#### `POST /api/auth/verification/confirm`

Confirm verification code.

**Request Body:**

```json
{
  "code": "123456"
}
```

### 7.2 Report Endpoints

#### `POST /api/reports`

Submit a new report (multipart/form-data).

**Form Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| title | string | ✅ | Report headline |
| description | string | ✅ | Full description |
| category | string | ✅ | GARBAGE/TRAFFIC/SAFETY/ROADS/OTHERS |
| urgency | string | ❌ | Regular/Urgent/Emergency |
| locationAddress | string | ❌ | Street address |
| locationLat | number | ❌ | GPS latitude |
| locationLng | number | ❌ | GPS longitude |
| submitAnonymously | boolean | ❌ | Hide citizen info |
| citizenId | number | ❌ | Authenticated citizen ID |
| evidence | File[] | ❌ | Up to 5 images (max 5MB each) |

**Response:**

```json
{
  "id": 42,
  "trackingId": "MR-A1B2C3",
  "title": "Garbage pile on main road",
  "status": "Pending",
  "expectedResolutionHours": 24,
  "requiresManualReview": false,
  "trustLevel": "MEDIUM",
  "submittedToday": 2,
  "dailyLimit": 5
}
```

#### `GET /api/reports/track/:trackingId`

Get report details by tracking ID (public).

**Response:**

```json
{
  "trackingId": "MR-A1B2C3",
  "title": "Garbage pile on main road",
  "category": "GARBAGE",
  "description": "Large pile of garbage...",
  "status": "In Progress",
  "department": "Sanitation Department",
  "locationAddress": "123 Main St, Makati",
  "locationLat": 14.5547,
  "locationLng": 121.0244,
  "requiresManualReview": false,
  "evidence": [
    {
      "id": 1,
      "fileUrl": "https://res.cloudinary.com/...",
      "fileType": "photo"
    }
  ],
  "logs": [
    {
      "created_at": "2025-12-05T10:30:00Z",
      "action": "Report submitted",
      "newStatus": "Pending",
      "remarks": "Report created"
    }
  ]
}
```

#### `GET /api/reports/history`

Get citizen's report history (authenticated).

**Query Parameters:**

- `limit` (optional): Max results (default: 50, max: 100)

#### `POST /api/reports/:id/actions`

Staff response to a report.

**Request Body:**

```json
{
  "message": "Team dispatched to address the issue.",
  "status": "In Progress"
}
```

### 7.3 Dashboard Endpoints

#### `GET /api/dashboards/department`

Get department report queue (STAFF only).

**Query Parameters:**

- `page`: Page number (default: 1)
- `pageSize`: Items per page (default: 10)
- `search`: Search by tracking ID, title, or category

**Response:**

```json
{
  "items": [...],
  "page": 1,
  "pageSize": 10,
  "total": 45,
  "totalPages": 5
}
```

#### `GET /api/dashboards/department/stats`

Get department performance statistics.

#### `GET /api/dashboards/admin/overview`

Get admin city-wide overview (ADMIN only).

### 7.4 Analytics Endpoints

#### `GET /api/analytics/summary`

Get summary metrics for date range.

**Query Parameters:**

- `days`: Number of days (default: 30)

**Response:**

```json
{
  "range": {
    "from": "2025-11-05T00:00:00Z",
    "to": "2025-12-05T00:00:00Z",
    "days": 30
  },
  "summary": {
    "totalReports": 150,
    "activeReports": 45,
    "resolvedReports": 100,
    "avgResolutionHours": 18.5,
    "avgFirstResponseHours": 2.3,
    "metSlaResolved": 85,
    "breachSlaResolved": 15
  }
}
```

#### `GET /api/analytics/timeseries`

Get daily report counts.

#### `GET /api/analytics/departments`

Get per-department metrics.

#### `GET /api/analytics/categories`

Get per-category metrics.

#### `GET /api/analytics/heatmap`

Get geographic density buckets.

### 7.5 Notification Endpoints

#### `GET /api/notifications`

Get user's notifications.

**Query Parameters:**

- `limit`: Max results (default: 20)
- `unreadOnly`: Boolean filter

#### `PATCH /api/notifications/:id/read`

Mark notification as read.

#### `POST /api/notifications/mark-all-read`

Mark all notifications as read.

### 7.6 Health Endpoints

#### `GET /api/health`

System health check.

**Response:**

```json
{
  "ok": true,
  "name": "makati-report",
  "database": "connected",
  "ts": "2025-12-05T10:30:00Z"
}
```

#### `GET /api/health/email`

Email transport diagnostics.

---

## 8. Frontend Pages & Components

### 8.1 Page Components

#### Home (`/`)

**Purpose:** Landing page with system overview

**Features:**

- Hero section with call-to-action buttons
- Statistics display (response time, departments, resolved reports)
- "How it works" 3-step guide
- Responsive layout with dark mode support

**Key Elements:**

- "Submit a report" → `/report`
- "Track a report" → `/track`
- Statistics cards (3)
- Step-by-step guide (3 steps)

---

#### SignUp (`/signup`)

**Purpose:** New citizen registration

**Features:**

- Registration form with validation
- Fields: full name, email, password, contact number
- Auto-redirect to verification flow
- Link to sign in for existing users

**Form Fields:**

- `name` (required): Full name
- `email` (required): Valid email
- `password` (required): Secure password
- `contactNumber` (optional): PH mobile format

---

#### SignIn (`/signin`)

**Purpose:** User authentication

**Features:**

- Email/password login
- Error handling (invalid credentials, rate limit)
- Redirect to intended page after login
- Redirect unverified citizens to verification

**Query Parameters:**

- `next`: Redirect URL after successful login

---

#### VerifyAccount (`/verify`)

**Purpose:** Email verification workflow

**Features:**

- Request verification code button
- 6-digit code input
- 15-minute countdown timer
- Success redirect to intended page

---

#### Report (`/report`)

**Purpose:** Submit a new citizen report

**Features:**

- Protected route (requires CITIZEN authentication)
- Trust status display (level, daily limit, reports today)
- Verification prompt for unverified users
- Form fields:
  - Title (required)
  - Description (required, multiline)
  - Category dropdown (required)
  - Location address (auto-filled from map)
  - Interactive map picker with GPS
  - Photo evidence upload (drag & drop, max 3 files)
  - Anonymous submission checkbox

**Map Features:**

- Click to place marker
- Drag marker to adjust
- "Use my location" GPS button
- Reverse geocoding for address
- Makati-bounded view

**Evidence Upload:**

- Drag and drop zone
- File browser button
- Preview thumbnails
- Remove individual files
- Max 3 images, 4MB each

---

#### Track (`/track/:trackingId?`)

**Purpose:** Public report status tracking

**Features:**

- Tracking ID input form
- Report details display
- Status timeline/history
- Location map (if coordinates exist)
- Evidence attachments
- Help sidebar with contact info

**Displays:**

- Report title and tracking ID
- Current status badge
- Department name
- Manual review indicator
- Location address and map
- Attached evidence links
- Full status history timeline

---

#### MyReports (`/my-reports`)

**Purpose:** Citizen's report history

**Features:**

- Protected route (requires CITIZEN authentication)
- List of submitted reports
- Click to navigate to tracking page
- Status badges for each report

---

#### Dashboard (`/dashboard/*`)

**Purpose:** Staff and admin management interface

**Nested Routes:**

- `/dashboard/department` - Department staff view
- `/dashboard/admin` - City administrator view

##### Department View (DeptView)

**For:** STAFF role users

**Features:**

- Department snapshot statistics
  - Status counts (Pending, In Progress, Resolved, etc.)
  - SLA performance metrics
  - 14-day intake trend
- Interactive reports map
- Active reports table with:
  - Tracking ID
  - Citizen info (or "Anonymous")
  - Category
  - Urgency badge
  - Status badge
  - Submission date
  - Manual review indicator
- Search bar (tracking ID, title, category)
- Pagination ("Load more" button)
- Report detail panel:
  - Full report information
  - Citizen contact details
  - Location and coordinates
  - Attached photos gallery
  - Status timeline
- Response form:
  - Message textarea
  - Status dropdown
  - Send update button

##### Admin View (AdminView)

**For:** ADMIN role users

**Features:**

- Time range selector (30/60/90/180 days)
- Summary metrics cards:
  - Total reports
  - Active reports
  - Resolved reports
  - Avg resolution time
  - Avg first response
  - SLA compliance rate
- Trend chart (cumulative created vs resolved)
- Spatial density heatmap
- Department performance table
- Category performance table
- Export functionality (CSV, Excel, PDF)

### 8.2 Reusable Components

#### Header

- Logo with home link
- Navigation links
- Dark mode toggle
- User dropdown (when authenticated)
- Notification bell (for staff)
- Sign in/Sign up buttons (when unauthenticated)

#### Footer

- Copyright notice
- "Rapid Response Hub" tagline

#### MapPicker

- Interactive Leaflet map
- Click to place marker
- Draggable marker
- Makati-bounded view
- Props: `value`, `onChange`, `markerLabel`

#### ReportsMap

- Multiple report markers
- Heatmap overlay support
- Click handler for marker selection
- Fit bounds to all points
- Props: `points`, `heatmap`, `onSelect`, `selectedId`, `height`

#### Toast

- Success/Error/Info variants
- Auto-dismiss timer
- Stack multiple toasts
- Slide-in animation

#### NotificationDropdown

- Unread count badge
- Notification list
- Mark as read
- Mark all as read
- Navigate to related report

#### ProtectedRoute

- Auth guard wrapper
- Redirect to signin if unauthenticated
- Pass through if authenticated

---

## 9. Core Features

### 9.1 Report Submission

**Flow:**

1. Citizen accesses `/report` (must be authenticated)
2. System displays trust status and daily limit
3. Citizen fills form:
   - Title and description
   - Select category (auto-routes to department)
   - Optional: pin location on map
   - Optional: attach photo evidence
   - Optional: submit anonymously
4. Submit triggers:
   - Trust level check (may block if limit reached)
   - Evidence upload to Cloudinary
   - Report creation in database
   - Status log entry
   - Department staff notifications
   - Email receipt to citizen (if not anonymous)
5. Success response includes tracking ID

**Trust-Based Behavior:**
| Trust Level | Daily Limit | Initial Status |
|-------------|-------------|----------------|
| LOW | 1 | Manual Review |
| MEDIUM | 5 | Pending |
| HIGH | Unlimited | Pending |

### 9.2 Report Tracking

**Public Access:**

- Anyone can track a report with the tracking ID
- No authentication required
- Format: `MR-XXXXXX` (6 alphanumeric characters)

**Displayed Information:**

- Report title and category
- Current status
- Assigned department
- Location details
- Attached evidence
- Full status history

### 9.3 Department Queue Management

**Staff Capabilities:**

- View all reports assigned to their department
- Search and filter reports
- Paginated list (10 per page)
- View report details and evidence
- Respond with messages
- Update report status
- View citizen contact info (unless anonymous)

**Status Options:**

- Pending → In Progress
- In Progress → Resolved
- Any → Cancelled
- Any → Invalid

### 9.4 City Analytics

**Admin Dashboard Features:**

- Configurable time range (30/60/90/180 days)
- Summary metrics:
  - Total, active, resolved reports
  - Average resolution time
  - Average first response time
  - SLA compliance percentage
- Trend visualization (line chart)
- Geographic heatmap
- Department comparison table
- Category comparison table
- Export to CSV/Excel/PDF

### 9.5 Trust System

**Score Calculation:**

- Start at 0
- +1 for report marked "In Progress" or "Resolved"
- -1 for report marked "Invalid"
- Range: No fixed min/max, but levels based on thresholds

**Trust Levels:**
| Level | Score Range | Daily Limit | Manual Review |
|-------|-------------|-------------|---------------|
| LOW | ≤ -2 | 1 | Yes |
| MEDIUM | -1 to 2 | 5 | No |
| HIGH | ≥ 3 | Unlimited | No |

### 9.6 Email Notifications

**Triggered Emails:**

1. **Submission Receipt** - Sent when citizen submits report
   - Report title and tracking ID
   - Category and urgency
   - Status
   - Description summary
   - Location details
   - Next steps guidance

2. **Status Update** - Sent when staff updates status
   - Report reference
   - New status
   - Staff message (if provided)
   - Timeline link

**Email Skip Conditions:**

- Anonymous submissions
- SMTP not configured
- Citizen has no email

### 9.7 Evidence Management

**Upload Flow:**

1. Citizen selects files (drag & drop or file browser)
2. Client-side validation:
   - Image files only
   - Max 4MB per file
   - Max 3 files per report
3. Files sent as multipart/form-data
4. Server uploads to Cloudinary (if configured)
   - Auto-optimizes quality
   - Returns CDN URL
5. Fallback: Local storage under `/uploads/evidence`
6. URLs stored in `report_evidence` table

**Storage Providers:**
| Provider | Configuration | Features |
|----------|---------------|----------|
| Cloudinary | `CLOUDINARY_*` env vars | CDN, optimization, transformations |
| Local | Default fallback | `/uploads/evidence/` directory |

---

## 10. Services & Business Logic

### 10.1 Email Service (`services/email.ts`)

**Configuration:**

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your@gmail.com
SMTP_PASS=app-password
EMAIL_FROM="Makati Cares" <your@gmail.com>
```

**Functions:**

- `isEmailConfigured()` - Check if SMTP is set up
- `verifyEmailTransport()` - Test SMTP connection
- `sendEmail(options)` - Send an email
- `getEmailDiagnostics()` - Debug info for `/api/health/email`

### 10.2 Storage Service (`services/storage.ts`)

**Configuration:**

```env
CLOUDINARY_CLOUD_NAME=your-cloud
CLOUDINARY_API_KEY=123456789
CLOUDINARY_API_SECRET=secret
CLOUDINARY_FOLDER=makati-report/evidence
```

**Functions:**

- `isCloudinaryConfigured()` - Check if Cloudinary is set up
- `uploadEvidenceImage(file)` - Upload image, return URL

### 10.3 Trust Service (`services/trust.ts`)

**Functions:**

- `computeTrustLevel(score)` - Score → Level mapping
- `getDailyReportLimit(level)` - Get submission limit
- `shouldRequireManualReview(level)` - Check if LOW trust
- `getInitialStatusForTrust(level)` - Get initial status
- `getTrustMetadata(score)` - Get level and limit
- `applyTrustTransition(params)` - Update score on status change

### 10.4 Verification Service (`services/verification.ts`)

**Functions:**

- `issueVerificationCode(options)` - Generate and store OTP
- `verifyCitizenCode(options)` - Validate OTP

**OTP Specifications:**

- 6 digits, zero-padded
- 15-minute TTL (configurable)
- Stored as bcrypt hash
- Single-use (cleared on verification)

### 10.5 Notifications Service (`services/notifications.ts`)

**Functions:**

- `createNotification(data)` - Generic notification
- `createCitizenNotification(...)` - For citizens
- `createStaffNotification(...)` - For staff
- `notifyDepartmentOfNewReport(...)` - Alert all dept staff
- `notifyCitizenOfStatusChange(...)` - Status update alert
- `notifyCitizenOfResponse(...)` - Staff response alert

### 10.6 Analytics Service (`services/analytics.ts`)

**Functions:**

- `resolveDateRange(query)` - Parse date range from query
- `getSummaryMetrics(range)` - Aggregate statistics
- `getTimeseries(range)` - Daily counts
- `getDepartmentMetrics(range)` - Per-department stats
- `getCategoryMetrics(range)` - Per-category stats
- `getHeatmapBuckets(range, precision)` - Geographic clusters

---

## 11. Security Implementation

### 11.1 Security Headers (Helmet)

```javascript
app.use(
  helmet({
    contentSecurityPolicy: false, // Disabled for API
    crossOriginEmbedderPolicy: false,
  })
);
```

### 11.2 Rate Limiting

**General API:**

- Window: 1 minute
- Max requests: 100
- Skip: Health endpoints

**Auth Endpoints:**

- Window: 15 minutes
- Max requests: 20
- Applied to: `/api/auth/*`

**Load Testing Mode:**

- Set `DISABLE_RATE_LIMIT=true`
- Limits increased to 100,000

### 11.3 CORS Configuration

```javascript
const corsOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  process.env.CORS_ORIGIN,
];

app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
```

### 11.4 Password Security

- **Hashing:** bcrypt with 10 salt rounds
- **Storage:** Only hash stored, never plaintext
- **Comparison:** Timing-safe bcrypt compare

### 11.5 JWT Security

- **Algorithm:** HS256
- **Expiration:** 7 days
- **Storage:** HttpOnly cookie
- **Secret:** `JWT_SECRET` env variable

### 11.6 Input Validation

- Express JSON body parser with 10MB limit
- Multer file size limit (5MB per file)
- Category validation against departments
- Coordinate range validation
- Email format validation

### 11.7 SQL Injection Prevention

- Supabase client with parameterized queries
- No raw SQL string concatenation
- Input sanitization in services

---

## 12. Deployment Guide

### 12.1 Environment Setup

**Required Services:**

1. Supabase Project (PostgreSQL database)
2. Cloudinary Account (image storage)
3. Gmail Account with App Password (email)

### 12.2 Supabase Setup

1. Create new Supabase project
2. Get credentials from Project Settings > API:
   - Project URL
   - `anon` public key
   - `service_role` secret key

3. Run schema in SQL Editor:
   - Create tables (see `scripts/schema.sql`)
   - Run seed data (see `scripts/seed.sql`)

### 12.3 Deployment Options

#### Option A: Vercel (Frontend) + Render (Backend)

**Frontend (Vercel):**

```bash
cd packages/web
vercel deploy
```

**Backend (Render):**

1. Create new Web Service
2. Connect GitHub repo
3. Build command: `cd packages/server && npm install && npm run build`
4. Start command: `cd packages/server && npm start`
5. Add environment variables

#### Option B: Single VPS

```bash
# Build frontend
cd packages/web && npm run build

# Build backend
cd packages/server && npm run build

# Serve frontend with nginx
# Run backend with PM2
pm2 start packages/server/dist/index.js --name makati-api
```

### 12.4 Environment Variables

**Backend (`packages/server/.env`):**

```env
# Server
PORT=4000
CORS_ORIGIN=https://your-frontend.vercel.app

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiI...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiI...

# Auth
JWT_SECRET=your-super-secret-key-min-32-chars

# Cloudinary
CLOUDINARY_CLOUD_NAME=your-cloud
CLOUDINARY_API_KEY=123456789
CLOUDINARY_API_SECRET=your-secret
CLOUDINARY_FOLDER=makati-report/evidence

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM="Makati Cares" <your@gmail.com>
```

**Frontend (`packages/web/.env`):**

```env
VITE_API_URL=https://your-api.onrender.com/api
```

---

## 13. Environment Configuration

### 13.1 Complete Variable Reference

| Variable                    | Required | Default                | Description           |
| --------------------------- | -------- | ---------------------- | --------------------- |
| `PORT`                      | ❌       | 4000                   | Server port           |
| `CORS_ORIGIN`               | ❌       | localhost:5173         | Allowed origin        |
| `SUPABASE_URL`              | ✅       | -                      | Supabase project URL  |
| `SUPABASE_ANON_KEY`         | ✅       | -                      | Public API key        |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅       | -                      | Secret server key     |
| `JWT_SECRET`                | ✅       | dev_secret             | Token signing key     |
| `CLOUDINARY_CLOUD_NAME`     | ❌       | -                      | Cloudinary cloud name |
| `CLOUDINARY_API_KEY`        | ❌       | -                      | Cloudinary API key    |
| `CLOUDINARY_API_SECRET`     | ❌       | -                      | Cloudinary API secret |
| `CLOUDINARY_FOLDER`         | ❌       | makati-report/evidence | Upload folder         |
| `SMTP_HOST`                 | ❌       | -                      | Mail server host      |
| `SMTP_PORT`                 | ❌       | 587                    | Mail server port      |
| `SMTP_SECURE`               | ❌       | false                  | Use TLS               |
| `SMTP_USER`                 | ❌       | -                      | Mail username         |
| `SMTP_PASS`                 | ❌       | -                      | Mail password         |
| `EMAIL_FROM`                | ❌       | -                      | Sender address        |
| `PUBLIC_BASE_URL`           | ❌       | localhost:PORT         | Public API URL        |
| `VERIFICATION_TTL_MINUTES`  | ❌       | 15                     | OTP expiry time       |
| `DISABLE_RATE_LIMIT`        | ❌       | false                  | For load testing      |

### 13.2 Gmail App Password Setup

1. Enable 2-Factor Authentication on Google Account
2. Go to Security > App passwords
3. Generate password for "Mail"
4. Use generated password as `SMTP_PASS`

---

## 14. Testing

### 14.1 Load Testing (k6)

**Available Scripts:**

```bash
npm run test:smoke   # Basic functionality
npm run test:load    # Normal load simulation
npm run test:stress  # High load testing
npm run test:spike   # Sudden traffic spike
npm run test:soak    # Extended duration
npm run test:api     # API endpoint tests
npm run test:db      # Database operations
npm run test:all     # Full test suite
```

**Pre-Test Setup:**

```env
DISABLE_RATE_LIMIT=true
```

### 14.2 Manual Testing Checklist

**Authentication:**

- [ ] Sign up with valid data
- [ ] Sign up with duplicate email (error)
- [ ] Sign in with valid credentials
- [ ] Sign in with invalid credentials (error)
- [ ] Sign out clears session
- [ ] Verification code sent
- [ ] Verification code confirms
- [ ] Expired code rejected

**Report Submission:**

- [ ] Submit report without evidence
- [ ] Submit report with evidence
- [ ] Submit anonymous report
- [ ] Map location picker works
- [ ] GPS location works
- [ ] Reverse geocoding fills address
- [ ] Trust limit enforced
- [ ] Verification required for unverified users

**Report Tracking:**

- [ ] Track with valid ID
- [ ] Track with invalid ID (error)
- [ ] Status history displayed
- [ ] Evidence thumbnails shown
- [ ] Map displays location

**Department Dashboard:**

- [ ] Reports list loads
- [ ] Search filters reports
- [ ] Pagination works
- [ ] Report details display
- [ ] Response form submits
- [ ] Status update works
- [ ] Email sent on update

**Admin Analytics:**

- [ ] Summary metrics display
- [ ] Time range selector works
- [ ] Trend chart renders
- [ ] Heatmap displays
- [ ] Export CSV works
- [ ] Export Excel works
- [ ] Export PDF works

---

## 15. Troubleshooting

### 15.1 Common Issues

#### "Email verification failed"

**Cause:** SMTP not configured or credentials invalid

**Solution:**

1. Check `/api/health/email` endpoint
2. Verify Gmail app password
3. Ensure 2FA enabled on Gmail
4. Check firewall for port 587

#### "Failed to create report"

**Cause:** Database connection or constraint violation

**Solution:**

1. Check `/api/health` endpoint
2. Verify Supabase credentials
3. Check RLS policies in Supabase
4. Verify category exists in departments

#### "Rate limit exceeded"

**Cause:** Too many requests from same IP

**Solution:**

1. Wait for rate limit window (1-15 minutes)
2. For testing: Set `DISABLE_RATE_LIMIT=true`

#### "Invalid token"

**Cause:** JWT expired or malformed

**Solution:**

1. Sign out and sign in again
2. Clear cookies
3. Verify `JWT_SECRET` matches server

#### "Cloudinary upload failed"

**Cause:** Invalid credentials or quota exceeded

**Solution:**

1. Verify `CLOUDINARY_*` env vars
2. Check Cloudinary dashboard for quota
3. Ensure API key not restricted

#### "Map not loading"

**Cause:** Leaflet CSS not imported or network issue

**Solution:**

1. Verify `leaflet/dist/leaflet.css` imported
2. Check browser console for errors
3. Verify OpenStreetMap accessible

### 15.2 Debug Endpoints

| Endpoint                | Purpose                    |
| ----------------------- | -------------------------- |
| `GET /api/health`       | Database connection status |
| `GET /api/health/email` | SMTP configuration status  |

### 15.3 Logging

**Server logs location:** Console output (stdout)

**Key log prefixes:**

- `[auth]` - Authentication events
- `[verification]` - OTP operations
- `[email]` - Email sending
- `Error:` - Exception details

---

## Appendix A: API Error Codes

| Code                  | Status | Description                |
| --------------------- | ------ | -------------------------- |
| VERIFICATION_REQUIRED | 403    | Citizen must verify email  |
| TRUST_LIMIT           | 429    | Daily report limit reached |
| INVALID_CREDENTIALS   | 401    | Wrong email/password       |
| TOKEN_EXPIRED         | 401    | JWT needs refresh          |
| RATE_LIMITED          | 429    | Too many requests          |
| NOT_FOUND             | 404    | Resource doesn't exist     |
| VALIDATION_ERROR      | 400    | Invalid input data         |

## Appendix B: Status Reference

| Status        | Description         | Trust Impact |
| ------------- | ------------------- | ------------ |
| Pending       | Awaiting assignment | None         |
| Manual Review | Low-trust queue     | None         |
| In Progress   | Being handled       | +1           |
| Resolved      | Issue fixed         | +1           |
| Cancelled     | Withdrawn           | None         |
| Invalid       | Spam/false report   | -1           |

## Appendix C: Category-Department Mapping

| Category | Department Code | Department Name        |
| -------- | --------------- | ---------------------- |
| GARBAGE  | GARBAGE         | Sanitation Department  |
| TRAFFIC  | TRAFFIC         | Traffic Management     |
| SAFETY   | SAFETY          | Public Safety          |
| ROADS    | ROADS           | Roads & Infrastructure |
| OTHERS   | OTHERS          | General Services       |

---

**Document End**

_This documentation was generated for the Makati Report System v1.0.0. For updates, please refer to the project repository._
