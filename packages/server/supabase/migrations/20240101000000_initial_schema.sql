-- MakatiReport PostgreSQL Schema (Converted from MySQL)
-- This migration creates all tables with PostgreSQL syntax

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Departments Table
CREATE TABLE departments (
  department_id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  contact_email VARCHAR(100),
  contact_number VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Citizens Table with Trust System
CREATE TABLE citizens (
  citizen_id SERIAL PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  contact_number VARCHAR(20),
  email VARCHAR(100) UNIQUE,
  password_hash VARCHAR(255),
  is_anonymous BOOLEAN DEFAULT FALSE,
  is_verified BOOLEAN DEFAULT FALSE,
  verification_method VARCHAR(20) DEFAULT 'email' CHECK (verification_method IN ('email', 'phone', 'manual')),
  verification_code_hash VARCHAR(255),
  verification_expires_at TIMESTAMP NULL,
  verified_at TIMESTAMP NULL,
  trust_score INT DEFAULT 0,
  trust_level VARCHAR(20) GENERATED ALWAYS AS (
    CASE
      WHEN trust_score <= -2 THEN 'LOW'
      WHEN trust_score >= 3 THEN 'HIGH'
      ELSE 'MEDIUM'
    END
  ) STORED,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Admins Table
CREATE TABLE admins (
  admin_id SERIAL PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Department Staff Table
CREATE TABLE department_staff (
  staff_id SERIAL PRIMARY KEY,
  department_id INT NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  role VARCHAR(50) DEFAULT 'staff',
  email VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (department_id) REFERENCES departments(department_id) ON DELETE CASCADE
);

-- SLA Policies Table
CREATE TABLE sla_policies (
  sla_id SERIAL PRIMARY KEY,
  category VARCHAR(50) NOT NULL,
  urgency_level VARCHAR(20) DEFAULT 'Regular',
  expected_resolution_hours INT NOT NULL
);

-- Reports Table with Geospatial Support
CREATE TABLE reports (
  report_id SERIAL PRIMARY KEY,
  citizen_id INT,
  tracking_id VARCHAR(30) NOT NULL UNIQUE,
  title VARCHAR(150) NOT NULL,
  category VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  urgency_level VARCHAR(20) DEFAULT 'Regular',
  status VARCHAR(20) DEFAULT 'Pending',
  location_address TEXT,
  location_landmark TEXT,
  location_lat DECIMAL(9,6),
  location_lng DECIMAL(9,6),
  location_geom GEOGRAPHY(POINT, 4326), -- PostGIS geospatial column
  assigned_department_id INT,
  assigned_staff_id INT,
  is_anonymous BOOLEAN DEFAULT FALSE,
  requires_manual_review BOOLEAN DEFAULT FALSE,
  trust_credit_applied BOOLEAN DEFAULT FALSE,
  trust_penalty_applied BOOLEAN DEFAULT FALSE,
  expected_resolution_hours INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  assigned_at TIMESTAMP NULL,
  resolved_at TIMESTAMP NULL,
  FOREIGN KEY (citizen_id) REFERENCES citizens(citizen_id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_department_id) REFERENCES departments(department_id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_staff_id) REFERENCES department_staff(staff_id) ON DELETE SET NULL
);

-- Report Evidence Table (now stores Supabase Storage URLs)
CREATE TABLE report_evidence (
  evidence_id SERIAL PRIMARY KEY,
  report_id INT NOT NULL,
  file_url TEXT NOT NULL, -- Supabase Storage URL
  file_type VARCHAR(20) CHECK (file_type IN ('photo', 'video', 'audio')),
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (report_id) REFERENCES reports(report_id) ON DELETE CASCADE
);

-- Report Status Logs Table
CREATE TABLE report_status_logs (
  log_id SERIAL PRIMARY KEY,
  report_id INT NOT NULL,
  action VARCHAR(100) NOT NULL,
  actor_type VARCHAR(20) CHECK (actor_type IN ('citizen', 'staff', 'admin')),
  actor_id INT,
  old_status VARCHAR(20),
  new_status VARCHAR(20),
  remarks TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (report_id) REFERENCES reports(report_id) ON DELETE CASCADE
);

-- Notifications Table
CREATE TABLE notifications (
  notification_id SERIAL PRIMARY KEY,
  report_id INT,
  recipient_type VARCHAR(20) CHECK (recipient_type IN ('citizen', 'staff', 'admin')),
  recipient_id INT,
  message VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMP NULL,
  FOREIGN KEY (report_id) REFERENCES reports(report_id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX idx_reports_citizen_id ON reports(citizen_id);
CREATE INDEX idx_reports_department_id ON reports(assigned_department_id);
CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_reports_tracking_id ON reports(tracking_id);
CREATE INDEX idx_reports_created_at ON reports(created_at DESC);
CREATE INDEX idx_reports_location_geom ON reports USING GIST(location_geom);
CREATE INDEX idx_notifications_recipient ON notifications(recipient_type, recipient_id);
CREATE INDEX idx_notifications_read_at ON notifications(read_at);

-- Create function to auto-update location_geom from lat/lng
CREATE OR REPLACE FUNCTION update_location_geom()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.location_lat IS NOT NULL AND NEW.location_lng IS NOT NULL THEN
    NEW.location_geom = ST_SetSRID(ST_MakePoint(NEW.location_lng, NEW.location_lat), 4326)::geography;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update location_geom
CREATE TRIGGER trigger_update_location_geom
BEFORE INSERT OR UPDATE ON reports
FOR EACH ROW
EXECUTE FUNCTION update_location_geom();
