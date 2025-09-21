INSERT INTO departments (name, code) VALUES
('Sanitation', 'GARBAGE') ON DUPLICATE KEY UPDATE name=VALUES(name);
INSERT INTO departments (name, code) VALUES
('Traffic Management', 'TRAFFIC') ON DUPLICATE KEY UPDATE name=VALUES(name);
INSERT INTO departments (name, code) VALUES
('Public Safety', 'SAFETY') ON DUPLICATE KEY UPDATE name=VALUES(name);
INSERT INTO departments (name, code) VALUES
('Infrastructure', 'ROADS') ON DUPLICATE KEY UPDATE name=VALUES(name);
