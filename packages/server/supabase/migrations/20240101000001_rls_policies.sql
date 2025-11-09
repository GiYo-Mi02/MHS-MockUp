-- Row Level Security (RLS) Policies
-- Ensures data security and proper access control

-- Enable RLS on all tables
ALTER TABLE citizens ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE department_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_status_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_policies ENABLE ROW LEVEL SECURITY;

-- =============================================
-- CITIZENS POLICIES
-- =============================================

-- Citizens can read their own data
CREATE POLICY "Citizens can read own data"
ON citizens FOR SELECT
USING (auth.uid()::text = citizen_id::text OR is_anonymous = true);

-- Citizens can update their own data
CREATE POLICY "Citizens can update own data"
ON citizens FOR UPDATE
USING (auth.uid()::text = citizen_id::text);

-- Anyone can insert (for signup)
CREATE POLICY "Anyone can signup"
ON citizens FOR INSERT
WITH CHECK (true);

-- =============================================
-- ADMINS POLICIES
-- =============================================

-- Admins can read all admins
CREATE POLICY "Admins can read admins"
ON admins FOR SELECT
USING (auth.jwt()->>'role' = 'admin');

-- Only existing admins can create new admins
CREATE POLICY "Admins can create admins"
ON admins FOR INSERT
WITH CHECK (auth.jwt()->>'role' = 'admin');

-- =============================================
-- DEPARTMENT STAFF POLICIES
-- =============================================

-- Staff can read own data
CREATE POLICY "Staff can read own data"
ON department_staff FOR SELECT
USING (auth.uid()::text = staff_id::text OR auth.jwt()->>'role' = 'admin');

-- Admins can manage staff
CREATE POLICY "Admins can manage staff"
ON department_staff FOR ALL
USING (auth.jwt()->>'role' = 'admin');

-- =============================================
-- DEPARTMENTS POLICIES
-- =============================================

-- Everyone can read departments
CREATE POLICY "Anyone can read departments"
ON departments FOR SELECT
USING (true);

-- Only admins can modify departments
CREATE POLICY "Admins can modify departments"
ON departments FOR ALL
USING (auth.jwt()->>'role' = 'admin');

-- =============================================
-- REPORTS POLICIES
-- =============================================

-- Citizens can read their own reports
CREATE POLICY "Citizens can read own reports"
ON reports FOR SELECT
USING (
  auth.uid()::text = citizen_id::text 
  OR is_anonymous = true
  OR auth.jwt()->>'role' IN ('admin', 'staff')
);

-- Anyone can create reports (including anonymous)
CREATE POLICY "Anyone can create reports"
ON reports FOR INSERT
WITH CHECK (true);

-- Citizens can update own reports (only if pending)
CREATE POLICY "Citizens can update own pending reports"
ON reports FOR UPDATE
USING (
  auth.uid()::text = citizen_id::text 
  AND status = 'Pending'
);

-- Staff can update assigned reports
CREATE POLICY "Staff can update assigned reports"
ON reports FOR UPDATE
USING (
  auth.jwt()->>'role' = 'staff' 
  AND auth.uid()::text = assigned_staff_id::text
);

-- Admins can update any report
CREATE POLICY "Admins can update any report"
ON reports FOR UPDATE
USING (auth.jwt()->>'role' = 'admin');

-- =============================================
-- REPORT EVIDENCE POLICIES
-- =============================================

-- Citizens can read evidence for their reports
CREATE POLICY "Citizens can read own report evidence"
ON report_evidence FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM reports 
    WHERE reports.report_id = report_evidence.report_id 
    AND (
      auth.uid()::text = reports.citizen_id::text
      OR reports.is_anonymous = true
      OR auth.jwt()->>'role' IN ('admin', 'staff')
    )
  )
);

-- Anyone can upload evidence
CREATE POLICY "Anyone can upload evidence"
ON report_evidence FOR INSERT
WITH CHECK (true);

-- =============================================
-- REPORT STATUS LOGS POLICIES
-- =============================================

-- Anyone involved can read status logs
CREATE POLICY "Read report status logs"
ON report_status_logs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM reports 
    WHERE reports.report_id = report_status_logs.report_id 
    AND (
      auth.uid()::text = reports.citizen_id::text
      OR reports.is_anonymous = true
      OR auth.jwt()->>'role' IN ('admin', 'staff')
    )
  )
);

-- Staff and admins can insert logs
CREATE POLICY "Staff can create status logs"
ON report_status_logs FOR INSERT
WITH CHECK (
  auth.jwt()->>'role' IN ('admin', 'staff', 'citizen')
);

-- =============================================
-- NOTIFICATIONS POLICIES
-- =============================================

-- Users can read their own notifications
CREATE POLICY "Users can read own notifications"
ON notifications FOR SELECT
USING (
  (recipient_type = 'citizen' AND auth.uid()::text = recipient_id::text)
  OR (recipient_type = 'staff' AND auth.uid()::text = recipient_id::text)
  OR (recipient_type = 'admin' AND auth.uid()::text = recipient_id::text)
);

-- Users can mark their notifications as read
CREATE POLICY "Users can update own notifications"
ON notifications FOR UPDATE
USING (
  (recipient_type = 'citizen' AND auth.uid()::text = recipient_id::text)
  OR (recipient_type = 'staff' AND auth.uid()::text = recipient_id::text)
  OR (recipient_type = 'admin' AND auth.uid()::text = recipient_id::text)
);

-- System can create notifications
CREATE POLICY "System can create notifications"
ON notifications FOR INSERT
WITH CHECK (true);

-- =============================================
-- SLA POLICIES
-- =============================================

-- Everyone can read SLA policies
CREATE POLICY "Anyone can read SLA policies"
ON sla_policies FOR SELECT
USING (true);

-- Only admins can modify SLA policies
CREATE POLICY "Admins can modify SLA policies"
ON sla_policies FOR ALL
USING (auth.jwt()->>'role' = 'admin');
