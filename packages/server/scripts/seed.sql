INSERT INTO departments (name, code, description, contact_email, contact_number) VALUES
('Sanitation', 'GARBAGE', 'Handles waste management and cleanliness', 'sanitation@makati.gov', '02-888-1001')
ON DUPLICATE KEY UPDATE description=VALUES(description), contact_email=VALUES(contact_email), contact_number=VALUES(contact_number);

INSERT INTO departments (name, code, description, contact_email, contact_number) VALUES
('Traffic Management', 'TRAFFIC', 'Manages road traffic incidents and violations', 'traffic@makati.gov', '02-888-1002')
ON DUPLICATE KEY UPDATE description=VALUES(description), contact_email=VALUES(contact_email), contact_number=VALUES(contact_number);

INSERT INTO departments (name, code, description, contact_email, contact_number) VALUES
('Public Safety', 'SAFETY', 'Responds to emergencies and safety concerns', 'safety@makati.gov', '02-888-1003')
ON DUPLICATE KEY UPDATE description=VALUES(description), contact_email=VALUES(contact_email), contact_number=VALUES(contact_number);

INSERT INTO departments (name, code, description, contact_email, contact_number) VALUES
('Infrastructure', 'ROADS', 'Maintains roads and public works', 'infrastructure@makati.gov', '02-888-1004')
ON DUPLICATE KEY UPDATE description=VALUES(description), contact_email=VALUES(contact_email), contact_number=VALUES(contact_number);

INSERT INTO sla_policies (category, urgency_level, expected_resolution_hours) VALUES
('GARBAGE', 'Regular', 48)
ON DUPLICATE KEY UPDATE expected_resolution_hours=VALUES(expected_resolution_hours);

INSERT INTO sla_policies (category, urgency_level, expected_resolution_hours) VALUES
('TRAFFIC', 'Regular', 24)
ON DUPLICATE KEY UPDATE expected_resolution_hours=VALUES(expected_resolution_hours);

INSERT INTO sla_policies (category, urgency_level, expected_resolution_hours) VALUES
('SAFETY', 'Urgent', 6)
ON DUPLICATE KEY UPDATE expected_resolution_hours=VALUES(expected_resolution_hours);

INSERT INTO admins (full_name, email, password_hash)
VALUES ('System Administrator', 'admin@makati.gov', '$2a$10$0HIHNJp116wRP4t2Uh.the2z8sgCDU6xF8wdjdMv8FAWk9XZ.mMiC')
ON DUPLICATE KEY UPDATE full_name=VALUES(full_name), password_hash=VALUES(password_hash);

INSERT INTO department_staff (department_id, full_name, role, email, password_hash)
SELECT department_id, 'Sanitation Staff', 'staff', 'sanitation.staff@makati.gov', '$2a$10$0HIHNJp116wRP4t2Uh.the2z8sgCDU6xF8wdjdMv8FAWk9XZ.mMiC'
FROM departments WHERE name = 'Sanitation'
ON DUPLICATE KEY UPDATE full_name=VALUES(full_name), password_hash=VALUES(password_hash);

INSERT INTO department_staff (department_id, full_name, role, email, password_hash)
SELECT department_id, 'Traffic Staff', 'staff', 'traffic.staff@makati.gov', '$2a$10$0HIHNJp116wRP4t2Uh.the2z8sgCDU6xF8wdjdMv8FAWk9XZ.mMiC'
FROM departments WHERE name = 'Traffic Management'
ON DUPLICATE KEY UPDATE full_name=VALUES(full_name), password_hash=VALUES(password_hash);

INSERT INTO citizens (full_name, contact_number, email, password_hash, is_anonymous)
VALUES ('Juan Dela Cruz', '09171234567', 'juan@example.com', '$2a$10$0HIHNJp116wRP4t2Uh.the2z8sgCDU6xF8wdjdMv8FAWk9XZ.mMiC', FALSE)
ON DUPLICATE KEY UPDATE full_name=VALUES(full_name), contact_number=VALUES(contact_number), password_hash=VALUES(password_hash);
