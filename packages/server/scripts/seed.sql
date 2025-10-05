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

INSERT INTO departments (name, code, description, contact_email, contact_number) VALUES
('General Services Desk', 'OTHERS', 'Handles uncategorized citizen concerns and escalations', 'support@makati.gov', '02-888-1005')
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

INSERT INTO sla_policies (category, urgency_level, expected_resolution_hours) VALUES
('OTHERS', 'Regular', 72)
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

INSERT INTO department_staff (department_id, full_name, role, email, password_hash)
SELECT department_id, 'Public Safety Staff', 'staff', 'safety.staff@makati.gov', '$2a$10$0HIHNJp116wRP4t2Uh.the2z8sgCDU6xF8wdjdMv8FAWk9XZ.mMiC'
FROM departments WHERE name = 'Public Safety'
ON DUPLICATE KEY UPDATE full_name=VALUES(full_name), password_hash=VALUES(password_hash);

INSERT INTO department_staff (department_id, full_name, role, email, password_hash)
SELECT department_id, 'Infrastructure Staff', 'staff', 'infrastructure.staff@makati.gov', '$2a$10$0HIHNJp116wRP4t2Uh.the2z8sgCDU6xF8wdjdMv8FAWk9XZ.mMiC'
FROM departments WHERE name = 'Infrastructure'
ON DUPLICATE KEY UPDATE full_name=VALUES(full_name), password_hash=VALUES(password_hash);

INSERT INTO department_staff (department_id, full_name, role, email, password_hash)
SELECT department_id, 'Citizen Support Staff', 'staff', 'support.staff@makati.gov', '$2a$10$0HIHNJp116wRP4t2Uh.the2z8sgCDU6xF8wdjdMv8FAWk9XZ.mMiC'
FROM departments WHERE name = 'General Services Desk'
ON DUPLICATE KEY UPDATE full_name=VALUES(full_name), password_hash=VALUES(password_hash);

INSERT INTO citizens (
	full_name,
	contact_number,
	email,
	password_hash,
	is_anonymous,
	is_verified,
	verification_method,
	verified_at,
	trust_score
)
VALUES (
	'Juan Dela Cruz',
	'09171234567',
	'juan@example.com',
	'$2a$10$0HIHNJp116wRP4t2Uh.the2z8sgCDU6xF8wdjdMv8FAWk9XZ.mMiC',
	FALSE,
	TRUE,
	'email',
	'2025-06-01 08:00:00',
	3
)
ON DUPLICATE KEY UPDATE
	full_name = VALUES(full_name),
	contact_number = VALUES(contact_number),
	password_hash = VALUES(password_hash),
	is_anonymous = VALUES(is_anonymous),
	is_verified = VALUES(is_verified),
	verification_method = VALUES(verification_method),
	verified_at = VALUES(verified_at),
	trust_score = VALUES(trust_score);

SET @citizen_id := (SELECT citizen_id FROM citizens WHERE email = 'juan@example.com');
SET @garbage_dept := (SELECT department_id FROM departments WHERE code = 'GARBAGE');
SET @traffic_dept := (SELECT department_id FROM departments WHERE code = 'TRAFFIC');
SET @safety_dept := (SELECT department_id FROM departments WHERE code = 'SAFETY');
SET @roads_dept := (SELECT department_id FROM departments WHERE code = 'ROADS');
SET @others_dept := (SELECT department_id FROM departments WHERE code = 'OTHERS');

SET @garbage_staff := (SELECT staff_id FROM department_staff WHERE email = 'sanitation.staff@makati.gov');
SET @traffic_staff := (SELECT staff_id FROM department_staff WHERE email = 'traffic.staff@makati.gov');
SET @safety_staff := (SELECT staff_id FROM department_staff WHERE email = 'safety.staff@makati.gov');
SET @roads_staff := (SELECT staff_id FROM department_staff WHERE email = 'infrastructure.staff@makati.gov');
SET @others_staff := (SELECT staff_id FROM department_staff WHERE email = 'support.staff@makati.gov');

INSERT INTO reports (
	citizen_id,
	tracking_id,
	title,
	category,
	description,
	urgency_level,
	status,
	location_address,
	location_landmark,
	location_lat,
	location_lng,
	assigned_department_id,
	assigned_staff_id,
	is_anonymous,
	expected_resolution_hours,
	created_at,
	assigned_at,
	resolved_at
)
VALUES (
	@citizen_id,
	'MR-20250701-001',
	'Overflowing Trash Bins at Legazpi',
	'GARBAGE',
	'Trash bins near the park entrance are overflowing after the weekend market.',
	'Regular',
	'Resolved',
	'Legazpi Active Park, Makati City',
	'Entrance beside Rada Street',
	14.554321,
	121.022456,
	@garbage_dept,
	@garbage_staff,
	FALSE,
	48,
	'2025-07-01 09:15:00',
	'2025-07-01 10:00:00',
	'2025-07-02 17:30:00'
)
ON DUPLICATE KEY UPDATE
	title=VALUES(title),
	description=VALUES(description),
	status=VALUES(status),
	assigned_department_id=VALUES(assigned_department_id),
	assigned_staff_id=VALUES(assigned_staff_id),
	expected_resolution_hours=VALUES(expected_resolution_hours),
	created_at=VALUES(created_at),
	assigned_at=VALUES(assigned_at),
	resolved_at=VALUES(resolved_at),
	urgency_level=VALUES(urgency_level),
	location_address=VALUES(location_address),
	location_landmark=VALUES(location_landmark),
	location_lat=VALUES(location_lat),
	location_lng=VALUES(location_lng);

INSERT INTO reports (
	citizen_id,
	tracking_id,
	title,
	category,
	description,
	urgency_level,
	status,
	location_address,
	location_landmark,
	location_lat,
	location_lng,
	assigned_department_id,
	assigned_staff_id,
	is_anonymous,
	expected_resolution_hours,
	created_at,
	assigned_at,
	resolved_at
)
VALUES (
	@citizen_id,
	'MR-20250718-007',
	'Community Assistance Request',
	'OTHERS',
	'Barangay is asking for assistance coordinating volunteers for tree planting.',
	'Regular',
	'In Progress',
	'Barangay Bel-Air Multi-purpose Hall',
	'Lobby information desk',
	14.558742,
	121.024981,
	@others_dept,
	@others_staff,
	FALSE,
	72,
	'2025-07-18 11:05:00',
	'2025-07-18 11:30:00',
	NULL
)
ON DUPLICATE KEY UPDATE
	title=VALUES(title),
	description=VALUES(description),
	status=VALUES(status),
	assigned_department_id=VALUES(assigned_department_id),
	assigned_staff_id=VALUES(assigned_staff_id),
	expected_resolution_hours=VALUES(expected_resolution_hours),
	created_at=VALUES(created_at),
	assigned_at=VALUES(assigned_at),
	resolved_at=VALUES(resolved_at),
	urgency_level=VALUES(urgency_level),
	location_address=VALUES(location_address),
	location_landmark=VALUES(location_landmark),
	location_lat=VALUES(location_lat),
	location_lng=VALUES(location_lng);

INSERT INTO reports (
	citizen_id,
	tracking_id,
	title,
	category,
	description,
	urgency_level,
	status,
	location_address,
	location_landmark,
	location_lat,
	location_lng,
	assigned_department_id,
	assigned_staff_id,
	is_anonymous,
	expected_resolution_hours,
	created_at,
	assigned_at,
	resolved_at
)
VALUES (
	@citizen_id,
	'MR-20250705-002',
	'Loose Electrical Wires Along Dela Rosa',
	'SAFETY',
	'Pedestrians reported exposed electrical wiring near the underpass construction.',
	'Urgent',
	'In Progress',
	'Dela Rosa Street underpass, Makati CBD',
	'Across Ayala South bound entrance',
	14.556987,
	121.019876,
	@safety_dept,
	@safety_staff,
	FALSE,
	6,
	'2025-07-05 07:45:00',
	'2025-07-05 08:10:00',
	NULL
)
ON DUPLICATE KEY UPDATE
	title=VALUES(title),
	description=VALUES(description),
	status=VALUES(status),
	assigned_department_id=VALUES(assigned_department_id),
	assigned_staff_id=VALUES(assigned_staff_id),
	expected_resolution_hours=VALUES(expected_resolution_hours),
	created_at=VALUES(created_at),
	assigned_at=VALUES(assigned_at),
	resolved_at=VALUES(resolved_at),
	urgency_level=VALUES(urgency_level),
	location_address=VALUES(location_address),
	location_landmark=VALUES(location_landmark),
	location_lat=VALUES(location_lat),
	location_lng=VALUES(location_lng);

INSERT INTO reports (
	citizen_id,
	tracking_id,
	title,
	category,
	description,
	urgency_level,
	status,
	location_address,
	location_landmark,
	location_lat,
	location_lng,
	assigned_department_id,
	assigned_staff_id,
	is_anonymous,
	expected_resolution_hours,
	created_at,
	assigned_at,
	resolved_at
)
VALUES (
	@citizen_id,
	'MR-20250710-003',
	'Defective Stoplight at Gil Puyat',
	'TRAFFIC',
	'Northbound stoplight remains flashing yellow causing backups.',
	'Regular',
	'Resolved',
	'Gil Puyat Ave. corner N. Garcia St.',
	'Near fire station entrance',
	14.559842,
	121.030215,
	@traffic_dept,
	@traffic_staff,
	FALSE,
	24,
	'2025-07-10 16:20:00',
	'2025-07-10 16:45:00',
	'2025-07-11 09:05:00'
)
ON DUPLICATE KEY UPDATE
	title=VALUES(title),
	description=VALUES(description),
	status=VALUES(status),
	assigned_department_id=VALUES(assigned_department_id),
	assigned_staff_id=VALUES(assigned_staff_id),
	expected_resolution_hours=VALUES(expected_resolution_hours),
	created_at=VALUES(created_at),
	assigned_at=VALUES(assigned_at),
	resolved_at=VALUES(resolved_at),
	urgency_level=VALUES(urgency_level),
	location_address=VALUES(location_address),
	location_landmark=VALUES(location_landmark),
	location_lat=VALUES(location_lat),
	location_lng=VALUES(location_lng);

INSERT INTO reports (
	citizen_id,
	tracking_id,
	title,
	category,
	description,
	urgency_level,
	status,
	location_address,
	location_landmark,
	location_lat,
	location_lng,
	assigned_department_id,
	assigned_staff_id,
	is_anonymous,
	expected_resolution_hours,
	created_at,
	assigned_at,
	resolved_at
)
VALUES (
	@citizen_id,
	'MR-20250715-004',
	'Pothole Cluster Near Ayala Avenue',
	'ROADS',
	'Multiple potholes forming near the bus lane turn causing vehicle damage.',
	'Regular',
	'Pending',
	'Ayala Avenue corner Paseo de Roxas',
	'Bus lane turning bay',
	14.554879,
	121.025741,
	@roads_dept,
	@roads_staff,
	FALSE,
	72,
	'2025-07-15 06:30:00',
	NULL,
	NULL
)
ON DUPLICATE KEY UPDATE
	title=VALUES(title),
	description=VALUES(description),
	status=VALUES(status),
	assigned_department_id=VALUES(assigned_department_id),
	assigned_staff_id=VALUES(assigned_staff_id),
	expected_resolution_hours=VALUES(expected_resolution_hours),
	created_at=VALUES(created_at),
	assigned_at=VALUES(assigned_at),
	resolved_at=VALUES(resolved_at),
	urgency_level=VALUES(urgency_level),
	location_address=VALUES(location_address),
	location_landmark=VALUES(location_landmark),
	location_lat=VALUES(location_lat),
	location_lng=VALUES(location_lng);

INSERT INTO reports (
	citizen_id,
	tracking_id,
	title,
	category,
	description,
	urgency_level,
	status,
	location_address,
	location_landmark,
	location_lat,
	location_lng,
	assigned_department_id,
	assigned_staff_id,
	is_anonymous,
	expected_resolution_hours,
	created_at,
	assigned_at,
	resolved_at
)
VALUES (
	@citizen_id,
	'MR-20250620-005',
	'Missed Garbage Pick-up in Poblacion',
	'GARBAGE',
	'Weekly garbage collection missed for two consecutive days in the alley.',
	'Regular',
	'Resolved',
	'Poblacion Alleyway, Kalayaan Ave.',
	'Behind Barangay Hall',
	14.565422,
	121.033512,
	@garbage_dept,
	@garbage_staff,
	FALSE,
	48,
	'2025-06-20 07:10:00',
	'2025-06-20 09:00:00',
	'2025-06-23 08:40:00'
)
ON DUPLICATE KEY UPDATE
	title=VALUES(title),
	description=VALUES(description),
	status=VALUES(status),
	assigned_department_id=VALUES(assigned_department_id),
	assigned_staff_id=VALUES(assigned_staff_id),
	expected_resolution_hours=VALUES(expected_resolution_hours),
	created_at=VALUES(created_at),
	assigned_at=VALUES(assigned_at),
	resolved_at=VALUES(resolved_at),
	urgency_level=VALUES(urgency_level),
	location_address=VALUES(location_address),
	location_landmark=VALUES(location_landmark),
	location_lat=VALUES(location_lat),
	location_lng=VALUES(location_lng);

INSERT INTO reports (
	citizen_id,
	tracking_id,
	title,
	category,
	description,
	urgency_level,
	status,
	location_address,
	location_landmark,
	location_lat,
	location_lng,
	assigned_department_id,
	assigned_staff_id,
	is_anonymous,
	expected_resolution_hours,
	created_at,
	assigned_at,
	resolved_at
)
VALUES (
	@citizen_id,
	'MR-20250628-006',
	'Vehicle Collision Debris',
	'TRAFFIC',
	'Road debris left after a collision causing obstruction in outer lane.',
	'Regular',
	'Cancelled',
	'EDSA corner Ayala, Makati',
	'Outer lane near MRT entrance',
	14.551234,
	121.028765,
	@traffic_dept,
	@traffic_staff,
	FALSE,
	24,
	'2025-06-28 22:15:00',
	'2025-06-28 22:30:00',
	NULL
)
ON DUPLICATE KEY UPDATE
	title=VALUES(title),
	description=VALUES(description),
	status=VALUES(status),
	assigned_department_id=VALUES(assigned_department_id),
	assigned_staff_id=VALUES(assigned_staff_id),
	expected_resolution_hours=VALUES(expected_resolution_hours),
	created_at=VALUES(created_at),
	assigned_at=VALUES(assigned_at),
	resolved_at=VALUES(resolved_at),
	urgency_level=VALUES(urgency_level),
	location_address=VALUES(location_address),
	location_landmark=VALUES(location_landmark),
	location_lat=VALUES(location_lat),
	location_lng=VALUES(location_lng);

INSERT INTO report_status_logs (report_id, action, actor_type, actor_id, old_status, new_status, remarks, created_at)
SELECT r.report_id,
			 'Initial Response',
			 'staff',
			 @garbage_staff,
			 'Pending',
			 'In Progress',
			 'Crew dispatched to clear trash overflow.',
			 '2025-07-01 10:05:00'
FROM reports r
WHERE r.tracking_id = 'MR-20250701-001'
	AND NOT EXISTS (
		SELECT 1 FROM report_status_logs l WHERE l.report_id = r.report_id AND l.action = 'Initial Response'
	);

INSERT INTO report_status_logs (report_id, action, actor_type, actor_id, old_status, new_status, remarks, created_at)
SELECT r.report_id,
			 'Resolution',
			 'staff',
			 @garbage_staff,
			 'In Progress',
			 'Resolved',
			 'Trash cleared and bins sanitized.',
			 '2025-07-02 17:15:00'
FROM reports r
WHERE r.tracking_id = 'MR-20250701-001'
	AND NOT EXISTS (
		SELECT 1 FROM report_status_logs l WHERE l.report_id = r.report_id AND l.action = 'Resolution'
	);

INSERT INTO report_status_logs (report_id, action, actor_type, actor_id, old_status, new_status, remarks, created_at)
SELECT r.report_id,
			 'Initial Response',
			 'staff',
			 @safety_staff,
			 'Pending',
			 'In Progress',
			 'Area cordoned off and Meralco notified.',
			 '2025-07-05 08:20:00'
FROM reports r
WHERE r.tracking_id = 'MR-20250705-002'
	AND NOT EXISTS (
		SELECT 1 FROM report_status_logs l WHERE l.report_id = r.report_id AND l.action = 'Initial Response'
	);

INSERT INTO report_status_logs (report_id, action, actor_type, actor_id, old_status, new_status, remarks, created_at)
SELECT r.report_id,
			 'Initial Response',
			 'staff',
			 @traffic_staff,
			 'Pending',
			 'In Progress',
			 'Technician deployed to intersection.',
			 '2025-07-10 16:50:00'
FROM reports r
WHERE r.tracking_id = 'MR-20250710-003'
	AND NOT EXISTS (
		SELECT 1 FROM report_status_logs l WHERE l.report_id = r.report_id AND l.action = 'Initial Response'
	);

INSERT INTO report_status_logs (report_id, action, actor_type, actor_id, old_status, new_status, remarks, created_at)
SELECT r.report_id,
			 'Resolution',
			 'staff',
			 @traffic_staff,
			 'In Progress',
			 'Resolved',
			 'Controller board replaced and recalibrated.',
			 '2025-07-11 08:50:00'
FROM reports r
WHERE r.tracking_id = 'MR-20250710-003'
	AND NOT EXISTS (
		SELECT 1 FROM report_status_logs l WHERE l.report_id = r.report_id AND l.action = 'Resolution'
	);

INSERT INTO report_status_logs (report_id, action, actor_type, actor_id, old_status, new_status, remarks, created_at)
SELECT r.report_id,
			 'Investigation Scheduled',
			 'staff',
			 @roads_staff,
			 'Pending',
			 'Pending',
			 'Survey crew scheduling inspection window.',
			 '2025-07-15 09:30:00'
FROM reports r
WHERE r.tracking_id = 'MR-20250715-004'
	AND NOT EXISTS (
		SELECT 1 FROM report_status_logs l WHERE l.report_id = r.report_id AND l.action = 'Investigation Scheduled'
	);

INSERT INTO report_status_logs (report_id, action, actor_type, actor_id, old_status, new_status, remarks, created_at)
SELECT r.report_id,
			 'Initial Response',
			 'staff',
			 @garbage_staff,
			 'Pending',
			 'In Progress',
			 'Routes adjusted to cover missed alley.',
			 '2025-06-20 09:10:00'
FROM reports r
WHERE r.tracking_id = 'MR-20250620-005'
	AND NOT EXISTS (
		SELECT 1 FROM report_status_logs l WHERE l.report_id = r.report_id AND l.action = 'Initial Response'
	);

INSERT INTO report_status_logs (report_id, action, actor_type, actor_id, old_status, new_status, remarks, created_at)
SELECT r.report_id,
			 'Resolution',
			 'staff',
			 @garbage_staff,
			 'In Progress',
			 'Resolved',
			 'Overtime crew completed delayed pick-up.',
			 '2025-06-23 08:20:00'
FROM reports r
WHERE r.tracking_id = 'MR-20250620-005'
	AND NOT EXISTS (
		SELECT 1 FROM report_status_logs l WHERE l.report_id = r.report_id AND l.action = 'Resolution'
	);

INSERT INTO report_status_logs (report_id, action, actor_type, actor_id, old_status, new_status, remarks, created_at)
SELECT r.report_id,
			 'Incident Cleared',
			 'admin',
			 (SELECT admin_id FROM admins ORDER BY admin_id LIMIT 1),
			 'In Progress',
			 'Cancelled',
			 'MMDA team already cleared debris prior to city arrival.',
			 '2025-06-28 23:10:00'
FROM reports r
WHERE r.tracking_id = 'MR-20250628-006'
	AND NOT EXISTS (
		SELECT 1 FROM report_status_logs l WHERE l.report_id = r.report_id AND l.action = 'Incident Cleared'
	);

INSERT INTO report_status_logs (report_id, action, actor_type, actor_id, old_status, new_status, remarks, created_at)
SELECT r.report_id,
			 'Initial Coordination',
			 'staff',
			 @others_staff,
			 'Pending',
			 'In Progress',
			 'Coordinating with barangay council to align volunteer schedule.',
			 '2025-07-18 11:35:00'
FROM reports r
WHERE r.tracking_id = 'MR-20250718-007'
	AND NOT EXISTS (
		SELECT 1 FROM report_status_logs l WHERE l.report_id = r.report_id AND l.action = 'Initial Coordination'
	);
