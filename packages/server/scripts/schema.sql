SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS report_status_logs;
DROP TABLE IF EXISTS report_evidence;
DROP TABLE IF EXISTS reports;
DROP TABLE IF EXISTS sla_policies;
DROP TABLE IF EXISTS department_staff;
DROP TABLE IF EXISTS admins;
DROP TABLE IF EXISTS citizens;
DROP TABLE IF EXISTS departments;

SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE departments (
  department_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  contact_email VARCHAR(100),
  contact_number VARCHAR(20)
);

CREATE TABLE citizens (
  citizen_id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  contact_number VARCHAR(20),
  email VARCHAR(100) UNIQUE,
  password_hash VARCHAR(255),
  is_anonymous BOOLEAN DEFAULT FALSE,
  is_verified BOOLEAN DEFAULT FALSE,
  verification_method ENUM('email','phone','manual') DEFAULT 'email',
  verification_code_hash VARCHAR(255),
  verification_expires_at TIMESTAMP NULL,
  verified_at TIMESTAMP NULL,
  trust_score INT DEFAULT 0,
  trust_level ENUM('LOW','MEDIUM','HIGH') GENERATED ALWAYS AS (
    CASE
      WHEN trust_score <= -2 THEN 'LOW'
      WHEN trust_score >= 3 THEN 'HIGH'
      ELSE 'MEDIUM'
    END
  ) STORED,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE admins (
  admin_id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE department_staff (
  staff_id INT AUTO_INCREMENT PRIMARY KEY,
  department_id INT NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  role VARCHAR(50) DEFAULT 'staff',
  email VARCHAR(100) UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (department_id) REFERENCES departments(department_id)
);

CREATE TABLE sla_policies (
  sla_id INT AUTO_INCREMENT PRIMARY KEY,
  category VARCHAR(50) NOT NULL,
  urgency_level VARCHAR(20) DEFAULT 'Regular',
  expected_resolution_hours INT NOT NULL
);

CREATE TABLE reports (
  report_id INT AUTO_INCREMENT PRIMARY KEY,
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
  FOREIGN KEY (citizen_id) REFERENCES citizens(citizen_id),
  FOREIGN KEY (assigned_department_id) REFERENCES departments(department_id),
  FOREIGN KEY (assigned_staff_id) REFERENCES department_staff(staff_id)
);

CREATE TABLE report_evidence (
  evidence_id INT AUTO_INCREMENT PRIMARY KEY,
  report_id INT NOT NULL,
  file_url TEXT NOT NULL,
  file_type VARCHAR(20) CHECK (file_type IN ('photo','video','audio')),
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (report_id) REFERENCES reports(report_id) ON DELETE CASCADE
);

CREATE TABLE report_status_logs (
  log_id INT AUTO_INCREMENT PRIMARY KEY,
  report_id INT NOT NULL,
  action VARCHAR(100) NOT NULL,
  actor_type VARCHAR(20) CHECK (actor_type IN ('citizen','staff','admin')),
  actor_id INT,
  old_status VARCHAR(20),
  new_status VARCHAR(20),
  remarks TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (report_id) REFERENCES reports(report_id) ON DELETE CASCADE
);

CREATE TABLE notifications (
  notification_id INT AUTO_INCREMENT PRIMARY KEY,
  report_id INT,
  recipient_type VARCHAR(20) CHECK (recipient_type IN ('citizen','staff','admin')),
  recipient_id INT,
  message VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMP NULL,
  FOREIGN KEY (report_id) REFERENCES reports(report_id) ON DELETE CASCADE
);
