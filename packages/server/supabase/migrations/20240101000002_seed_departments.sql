-- Seed department data
-- This migration populates the departments table with Makati City departments

INSERT INTO departments (name, code, description, contact_email, contact_number) VALUES
('Sanitation', 'GARBAGE', 'Handles waste management and cleanliness', 'sanitation@makati.gov', '02-888-1001')
ON CONFLICT (code) DO UPDATE SET 
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  contact_email = EXCLUDED.contact_email,
  contact_number = EXCLUDED.contact_number;

INSERT INTO departments (name, code, description, contact_email, contact_number) VALUES
('Traffic Management', 'TRAFFIC', 'Manages road traffic incidents and violations', 'traffic@makati.gov', '02-888-1002')
ON CONFLICT (code) DO UPDATE SET 
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  contact_email = EXCLUDED.contact_email,
  contact_number = EXCLUDED.contact_number;

INSERT INTO departments (name, code, description, contact_email, contact_number) VALUES
('Public Safety', 'SAFETY', 'Responds to emergencies and safety concerns', 'safety@makati.gov', '02-888-1003')
ON CONFLICT (code) DO UPDATE SET 
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  contact_email = EXCLUDED.contact_email,
  contact_number = EXCLUDED.contact_number;

INSERT INTO departments (name, code, description, contact_email, contact_number) VALUES
('Infrastructure', 'ROADS', 'Maintains roads and public works', 'infrastructure@makati.gov', '02-888-1004')
ON CONFLICT (code) DO UPDATE SET 
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  contact_email = EXCLUDED.contact_email,
  contact_number = EXCLUDED.contact_number;

INSERT INTO departments (name, code, description, contact_email, contact_number) VALUES
('General Services Desk', 'OTHERS', 'Handles uncategorized citizen concerns and escalations', 'support@makati.gov', '02-888-1005')
ON CONFLICT (code) DO UPDATE SET 
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  contact_email = EXCLUDED.contact_email,
  contact_number = EXCLUDED.contact_number;

-- Seed SLA policies
INSERT INTO sla_policies (category, urgency_level, expected_resolution_hours) VALUES
('GARBAGE', 'Critical', 2),
('GARBAGE', 'High', 8),
('GARBAGE', 'Regular', 24),
('GARBAGE', 'Low', 48),
('TRAFFIC', 'Critical', 1),
('TRAFFIC', 'High', 4),
('TRAFFIC', 'Regular', 12),
('TRAFFIC', 'Low', 24),
('SAFETY', 'Critical', 1),
('SAFETY', 'High', 2),
('SAFETY', 'Regular', 8),
('SAFETY', 'Low', 24),
('ROADS', 'Critical', 4),
('ROADS', 'High', 12),
('ROADS', 'Regular', 48),
('ROADS', 'Low', 72),
('OTHERS', 'Critical', 4),
('OTHERS', 'High', 12),
('OTHERS', 'Regular', 48),
('OTHERS', 'Low', 72)
ON CONFLICT (category, urgency_level) DO UPDATE SET
  expected_resolution_hours = EXCLUDED.expected_resolution_hours;
