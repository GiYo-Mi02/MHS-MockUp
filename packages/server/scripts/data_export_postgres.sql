
-- PostgreSQL Data Migration
-- Converted from MySQL dump
-- Generated: 2025-11-01T15:31:07.207Z

BEGIN;

-- Disable triggers during import
SET session_replication_role = replica;

-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Nov 01, 2025 at 04:23 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12


START TRANSACTION;








--
-- Database: "makati_report"
--

-- --------------------------------------------------------

--
-- Table structure for table "admins"
--

CREATE TABLE "admins" (
  "admin_id" int(11) NOT NULL,
  "full_name" varchar(100) NOT NULL,
  "email" varchar(100) DEFAULT NULL,
  "password_hash" varchar(255) NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHAR

--
-- Dumping data for table "admins"
--

INSERT INTO admins ("admin_id", "full_name", "email", "password_hash", "created_at") VALUES
(1, 'System Administrator', 'admin@makati.gov', '$2a$10$0HIHNJp116wRP4t2Uh.the2z8sgCDU6xF8wdjdMv8FAWk9XZ.mMiC', '2025-10-05 11:24:43');

-- --------------------------------------------------------

--
-- Table structure for table "citizens"
--

CREATE TABLE "citizens" (
  "citizen_id" int(11) NOT NULL,
  "full_name" varchar(100) NOT NULL,
  "contact_number" varchar(20) DEFAULT NULL,
  "email" varchar(100) DEFAULT NULL,
  "password_hash" varchar(255) DEFAULT NULL,
  "is_anonymous" tinyint(1) DEFAULT 0,
  "is_verified" tinyint(1) DEFAULT 0,
  "verification_method" VARCHAR(20) DEFAULT 'email',
  "verification_code_hash" varchar(255) DEFAULT NULL,
  "verification_expires_at" timestamp NULL DEFAULT NULL,
  "verified_at" timestamp NULL DEFAULT NULL,
  "trust_score" int(11) DEFAULT 0,
  "trust_level" VARCHAR(20) GENERATED ALWAYS AS (case when "trust_score" <= -2 then 'LOW' when "trust_score" >= 3 then 'HIGH' else 'MEDIUM' end) STORED,
  "created_at" timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHAR

--
-- Dumping data for table "citizens"
--

INSERT INTO citizens ("citizen_id", "full_name", "contact_number", "email", "password_hash", "is_anonymous", "is_verified", "verification_method", "verification_code_hash", "verification_expires_at", "verified_at", "trust_score", "created_at") VALUES
(1, 'Juan Dela Cruz', '09171234567', 'juan@example.com', '$2a$10$0HIHNJp116wRP4t2Uh.the2z8sgCDU6xF8wdjdMv8FAWk9XZ.mMiC', 0, 1, 'email', NULL, NULL, '2025-06-01 00:00:00', 3, '2025-10-05 11:24:43'),
(2, 'Gio Joshua Gonzales', '09686866446', 'ggonzales.k12254495@umak.edu.ph', '$2a$10$Ebw1pQk22uywi1AakQ6fA.biCia3I5wrwd/M3u0FFJMs6.BogF0I.', 0, 1, 'email', NULL, NULL, '2025-10-05 11:39:48', 3, '2025-10-05 11:25:11'),
(3, 'Joshua Corpuz ', '09950558771', 'ggiojoshua2006@gmail.com', '$2a$10$ybQZVHNXFwWlIw3rsbfxjuqw3CPkphqZdoyzGWXh0VmQeytEHAmwy', 0, 0, 'email', '$2a$10$zlxvd8IqF60eGnjCLpLwqefHdwxox5CLz2Xtn4sg2y1BAIqji21M6', '2025-10-14 09:50:31', NULL, 0, '2025-10-14 09:35:31'),
(4, 'Eliza Gonzales', '09276941551', '29zhaigonzales@gmail.com', '$2a$10$e.Rl1NNChB4JghilMZEoI.ZJDaenSiGYJyeS8AjjMxSJ1MMV6owlO', 0, 1, 'email', NULL, NULL, '2025-10-16 04:44:09', 0, '2025-10-16 04:43:48');

-- --------------------------------------------------------

--
-- Table structure for table "departments"
--

CREATE TABLE "departments" (
  "department_id" int(11) NOT NULL,
  "name" varchar(100) NOT NULL,
  "code" varchar(50) NOT NULL,
  "description" text DEFAULT NULL,
  "contact_email" varchar(100) DEFAULT NULL,
  "contact_number" varchar(20) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHAR

--
-- Dumping data for table "departments"
--

INSERT INTO departments ("department_id", "name", "code", "description", "contact_email", "contact_number") VALUES
(1, 'Sanitation', 'GARBAGE', 'Handles waste management and cleanliness', 'sanitation@makati.gov', '02-888-1001'),
(2, 'Traffic Management', 'TRAFFIC', 'Manages road traffic incidents and violations', 'traffic@makati.gov', '02-888-1002'),
(3, 'Public Safety', 'SAFETY', 'Responds to emergencies and safety concerns', 'safety@makati.gov', '02-888-1003'),
(4, 'Infrastructure', 'ROADS', 'Maintains roads and public works', 'infrastructure@makati.gov', '02-888-1004'),
(5, 'General Services Desk', 'OTHERS', 'Handles uncategorized citizen concerns and escalations', 'support@makati.gov', '02-888-1005');

-- --------------------------------------------------------

--
-- Table structure for table "department_staff"
--

CREATE TABLE "department_staff" (
  "staff_id" int(11) NOT NULL,
  "department_id" int(11) NOT NULL,
  "full_name" varchar(100) NOT NULL,
  "role" varchar(50) DEFAULT 'staff',
  "email" varchar(100) DEFAULT NULL,
  "password_hash" varchar(255) NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHAR

--
-- Dumping data for table "department_staff"
--

INSERT INTO department_staff ("staff_id", "department_id", "full_name", "role", "email", "password_hash", "created_at") VALUES
(1, 1, 'Sanitation Staff', 'staff', 'sanitation.staff@makati.gov', '$2a$10$0HIHNJp116wRP4t2Uh.the2z8sgCDU6xF8wdjdMv8FAWk9XZ.mMiC', '2025-10-05 11:24:43'),
(2, 2, 'Traffic Staff', 'staff', 'traffic.staff@makati.gov', '$2a$10$0HIHNJp116wRP4t2Uh.the2z8sgCDU6xF8wdjdMv8FAWk9XZ.mMiC', '2025-10-05 11:24:43'),
(3, 3, 'Public Safety Staff', 'staff', 'safety.staff@makati.gov', '$2a$10$0HIHNJp116wRP4t2Uh.the2z8sgCDU6xF8wdjdMv8FAWk9XZ.mMiC', '2025-10-05 11:24:43'),
(4, 4, 'Infrastructure Staff', 'staff', 'infrastructure.staff@makati.gov', '$2a$10$0HIHNJp116wRP4t2Uh.the2z8sgCDU6xF8wdjdMv8FAWk9XZ.mMiC', '2025-10-05 11:24:43'),
(5, 5, 'Citizen Support Staff', 'staff', 'support.staff@makati.gov', '$2a$10$0HIHNJp116wRP4t2Uh.the2z8sgCDU6xF8wdjdMv8FAWk9XZ.mMiC', '2025-10-05 11:24:43');

-- --------------------------------------------------------

--
-- Table structure for table "notifications"
--

CREATE TABLE "notifications" (
  "notification_id" int(11) NOT NULL,
  "report_id" int(11) DEFAULT NULL,
  "recipient_type" varchar(20) DEFAULT NULL CHECK ("recipient_type" in ('citizen','staff','admin')),
  "recipient_id" int(11) DEFAULT NULL,
  "message" varchar(255) NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT current_timestamp(),
  "read_at" timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHAR

--
-- Dumping data for table "notifications"
--

INSERT INTO notifications ("notification_id", "report_id", "recipient_type", "recipient_id", "message", "created_at", "read_at") VALUES
(1, 8, 'staff', 1, '📋 New report assigned (ID MR-LIATZK): \"I want to submit a report regarding to your department performance!\" submitted by Gio Joshua Gonzales [Citizen trust: MEDIUM]', '2025-10-05 11:49:19', '2025-10-05 11:50:41'),
(2, 8, 'citizen', 2, '🔔 Status update on ID MR-LIATZK • \"I want to submit a report regarding to your department performance!\": now \"Resolved\" by Sanitation Staff', '2025-10-05 11:50:35', '2025-10-05 11:51:59'),
(3, 9, 'staff', 1, '📋 New report assigned (ID MR-PUA9SC): \"Test report\" submitted by Gio Joshua Gonzales [Citizen trust: MEDIUM]', '2025-10-14 09:32:43', '2025-10-16 04:54:01'),
(4, 9, 'citizen', 2, '🔔 Status update on ID MR-PUA9SC • \"Test report\": now \"Resolved\" by Sanitation Staff', '2025-10-14 09:34:22', NULL),
(5, 10, 'staff', 1, '📋 New report assigned (ID MR-RABY30): \"This is a test report\" submitted by Gio Joshua Gonzales [Citizen trust: MEDIUM]', '2025-10-16 05:16:22', NULL),
(6, 10, 'citizen', 2, '🔔 Status update on ID MR-RABY30 • \"This is a test report\": now \"Resolved\" by Sanitation Staff', '2025-10-22 06:01:52', NULL),
-- --------------------------------------------------------

--
-- Table structure for table "report_evidence"
--

CREATE TABLE "report_evidence" (
  "evidence_id" int(11) NOT NULL,
  "report_id" int(11) NOT NULL,
  "file_url" text NOT NULL,
  "file_type" varchar(20) DEFAULT NULL CHECK ("file_type" in ('photo','video','audio')),
  "uploaded_at" timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHAR

--
-- Dumping data for table "report_evidence"
--

INSERT INTO report_evidence ("evidence_id", "report_id", "file_url", "file_type", "uploaded_at") VALUES
(1, 10, 'https://res.cloudinary.com/dcgejrmm0/image/upload/v1760591781/makati-report/evidence/ctch9jkkh6rtqab0uc0f.jpg', 'photo', '2025-10-16 05:16:22');

-- --------------------------------------------------------

--
-- Table structure for table "report_status_logs"
--

CREATE TABLE "report_status_logs" (
  "log_id" int(11) NOT NULL,
  "report_id" int(11) NOT NULL,
  "action" varchar(100) NOT NULL,
  "actor_type" varchar(20) DEFAULT NULL CHECK ("actor_type" in ('citizen','staff','admin')),
  "actor_id" int(11) DEFAULT NULL,
  "old_status" varchar(20) DEFAULT NULL,
  "new_status" varchar(20) DEFAULT NULL,
  "remarks" text DEFAULT NULL,
  "created_at" timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHAR

--
-- Dumping data for table "report_status_logs"
--

INSERT INTO report_status_logs ("log_id", "report_id", "action", "actor_type", "actor_id", "old_status", "new_status", "remarks", "created_at") VALUES
(1, 1, 'Initial Response', 'staff', 1, 'Pending', 'In Progress', 'Crew dispatched to clear trash overflow.', '2025-07-01 02:05:00'),
(2, 1, 'Resolution', 'staff', 1, 'In Progress', 'Resolved', 'Trash cleared and bins sanitized.', '2025-07-02 09:15:00'),
(3, 3, 'Initial Response', 'staff', 3, 'Pending', 'In Progress', 'Area cordoned off and Meralco notified.', '2025-07-05 00:20:00'),
(4, 4, 'Initial Response', 'staff', 2, 'Pending', 'In Progress', 'Technician deployed to intersection.', '2025-07-10 08:50:00'),
(5, 4, 'Resolution', 'staff', 2, 'In Progress', 'Resolved', 'Controller board replaced and recalibrated.', '2025-07-11 00:50:00'),
(6, 5, 'Investigation Scheduled', 'staff', 4, 'Pending', 'Pending', 'Survey crew scheduling inspection window.', '2025-07-15 01:30:00'),
(7, 6, 'Initial Response', 'staff', 1, 'Pending', 'In Progress', 'Routes adjusted to cover missed alley.', '2025-06-20 01:10:00'),
(8, 6, 'Resolution', 'staff', 1, 'In Progress', 'Resolved', 'Overtime crew completed delayed pick-up.', '2025-06-23 00:20:00'),
(9, 7, 'Incident Cleared', 'admin', 1, 'In Progress', 'Cancelled', 'MMDA team already cleared debris prior to city arrival.', '2025-06-28 15:10:00'),
(10, 2, 'Initial Coordination', 'staff', 5, 'Pending', 'In Progress', 'Coordinating with barangay council to align volunteer schedule.', '2025-07-18 03:35:00'),
(11, 8, 'Report submitted', 'citizen', 2, NULL, 'Pending', 'Report created', '2025-10-05 11:49:19'),
(12, 8, 'Status updated to Resolved', 'staff', 1, 'Pending', 'Resolved', 'Thank you for submitting your report it already has been resolved!', '2025-10-05 11:50:32'),
(13, 9, 'Report submitted', 'citizen', 2, NULL, 'Pending', 'Report created', '2025-10-14 09:32:43'),
(14, 9, 'Status updated to Resolved', 'staff', 1, 'Pending', 'Resolved', 'This case is resolved.', '2025-10-14 09:34:19'),
(15, 10, 'Report submitted', 'citizen', 2, NULL, 'Pending', 'Report created', '2025-10-16 05:16:22'),
(16, 10, 'Status updated to Resolved', 'staff', 1, 'Pending', 'Resolved', 'OKAY NA TO BOSS', '2025-10-22 05:59:19'),


-- --------------------------------------------------------

--
-- Table structure for table "sla_policies"
--

CREATE TABLE "sla_policies" (
  "sla_id" int(11) NOT NULL,
  "category" varchar(50) NOT NULL,
  "urgency_level" varchar(20) DEFAULT 'Regular',
  "expected_resolution_hours" int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHAR

--
-- Dumping data for table "sla_policies"
--

INSERT INTO sla_policies ("sla_id", "category", "urgency_level", "expected_resolution_hours") VALUES
(1, 'GARBAGE', 'Regular', 48),
(2, 'TRAFFIC', 'Regular', 24),
(3, 'SAFETY', 'Urgent', 6),
(4, 'OTHERS', 'Regular', 72);

--
-- Indexes for dumped tables
--

--
-- Indexes for table "admins"
--
ALTER TABLE "admins"
  ADD PRIMARY KEY ("admin_id"),
  ADD UNIQUE KEY "email" ("email");

--
-- Indexes for table "citizens"
--
ALTER TABLE "citizens"
  ADD PRIMARY KEY ("citizen_id"),
  ADD UNIQUE KEY "email" ("email");

--
-- Indexes for table "departments"
--
ALTER TABLE "departments"
  ADD PRIMARY KEY ("department_id"),
  ADD UNIQUE KEY "code" ("code");

--
-- Indexes for table "department_staff"
--
ALTER TABLE "department_staff"
  ADD PRIMARY KEY ("staff_id"),
  ADD UNIQUE KEY "email" ("email"),
  ADD KEY "department_id" ("department_id");

--
-- Indexes for table "notifications"
--
ALTER TABLE "notifications"
  ADD PRIMARY KEY ("notification_id"),
  ADD KEY "report_id" ("report_id");

--
-- Indexes for table "reports"
--
ALTER TABLE "reports"
  ADD PRIMARY KEY ("report_id"),
  ADD UNIQUE KEY "tracking_id" ("tracking_id"),
  ADD KEY "citizen_id" ("citizen_id"),
  ADD KEY "assigned_department_id" ("assigned_department_id"),
  ADD KEY "assigned_staff_id" ("assigned_staff_id");

--
-- Indexes for table "report_evidence"
--
ALTER TABLE "report_evidence"
  ADD PRIMARY KEY ("evidence_id"),
  ADD KEY "report_id" ("report_id");

--
-- Indexes for table "report_status_logs"
--
ALTER TABLE "report_status_logs"
  ADD PRIMARY KEY ("log_id"),
  ADD KEY "report_id" ("report_id");

--
-- Indexes for table "sla_policies"
--
ALTER TABLE "sla_policies"
  ADD PRIMARY KEY ("sla_id");

--
--  for dumped tables
--

--
--  for table "admins"
--
ALTER TABLE "admins"
  MODIFY "admin_id" int(11) NOT NULL , =2;

--
--  for table "citizens"
--
ALTER TABLE "citizens"
  MODIFY "citizen_id" int(11) NOT NULL , =5;

--
--  for table "departments"
--
ALTER TABLE "departments"
  MODIFY "department_id" int(11) NOT NULL , =6;

--
--  for table "department_staff"
--
ALTER TABLE "department_staff"
  MODIFY "staff_id" int(11) NOT NULL , =6;

--
--  for table "notifications"
--
ALTER TABLE "notifications"
  MODIFY "notification_id" int(11) NOT NULL , =52414;

--
--  for table "reports"
--
ALTER TABLE "reports"
  MODIFY "report_id" int(11) NOT NULL , =52418;

--
--  for table "report_evidence"
--
ALTER TABLE "report_evidence"
  MODIFY "evidence_id" int(11) NOT NULL , =2;

--
--  for table "report_status_logs"
--
ALTER TABLE "report_status_logs"
  MODIFY "log_id" int(11) NOT NULL , =52424;

--
--  for table "sla_policies"
--
ALTER TABLE "sla_policies"
  MODIFY "sla_id" int(11) NOT NULL , =5;

--
-- Constraints for dumped tables
--

--
-- Constraints for table "department_staff"
--
ALTER TABLE "department_staff"
  ADD CONSTRAINT "department_staff_ibfk_1" FOREIGN KEY ("department_id") REFERENCES "departments" ("department_id");

--
-- Constraints for table "notifications"
--
ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_ibfk_1" FOREIGN KEY ("report_id") REFERENCES "reports" ("report_id") ON DELETE CASCADE;

--
-- Constraints for table "reports"
--
ALTER TABLE "reports"
  ADD CONSTRAINT "reports_ibfk_1" FOREIGN KEY ("citizen_id") REFERENCES "citizens" ("citizen_id"),
  ADD CONSTRAINT "reports_ibfk_2" FOREIGN KEY ("assigned_department_id") REFERENCES "departments" ("department_id"),
  ADD CONSTRAINT "reports_ibfk_3" FOREIGN KEY ("assigned_staff_id") REFERENCES "department_staff" ("staff_id");

--
-- Constraints for table "report_evidence"
--
ALTER TABLE "report_evidence"
  ADD CONSTRAINT "report_evidence_ibfk_1" FOREIGN KEY ("report_id") REFERENCES "reports" ("report_id") ON DELETE CASCADE;

--
-- Constraints for table "report_status_logs"
--
ALTER TABLE "report_status_logs"
  ADD CONSTRAINT "report_status_logs_ibfk_1" FOREIGN KEY ("report_id") REFERENCES "reports" ("report_id") ON DELETE CASCADE;
COMMIT;






-- Re-enable triggers
SET session_replication_role = DEFAULT;

-- Reset sequences to correct values
SELECT setval('departments_department_id_seq', (SELECT MAX(department_id) FROM departments));
SELECT setval('citizens_citizen_id_seq', (SELECT MAX(citizen_id) FROM citizens));
SELECT setval('admins_admin_id_seq', (SELECT MAX(admin_id) FROM admins));
SELECT setval('department_staff_staff_id_seq', (SELECT MAX(staff_id) FROM department_staff));
SELECT setval('sla_policies_sla_id_seq', (SELECT MAX(sla_id) FROM sla_policies));
SELECT setval('reports_report_id_seq', (SELECT MAX(report_id) FROM reports));
SELECT setval('report_evidence_evidence_id_seq', (SELECT MAX(evidence_id) FROM report_evidence));
SELECT setval('report_status_logs_log_id_seq', (SELECT MAX(log_id) FROM report_status_logs));
SELECT setval('notifications_notification_id_seq', (SELECT MAX(notification_id) FROM notifications));

COMMIT;

-- Verify import
DO $$
DECLARE
  table_name TEXT;
  row_count INT;
BEGIN
  RAISE NOTICE 'Data Import Summary:';
  RAISE NOTICE '=====================';
  
  FOR table_name IN 
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
  LOOP
    EXECUTE format('SELECT COUNT(*) FROM %I', table_name) INTO row_count;
    RAISE NOTICE '%: % rows', table_name, row_count;
  END LOOP;
END $$;
