import { Router, Request, Response } from 'express'
import { pool } from '../db'
import { requireAuth, requireRole } from '../auth'

export const dashboardsRouter = Router()

// Department queue for STAFF: reports assigned to their department
dashboardsRouter.get('/department', requireAuth, requireRole('STAFF', 'ADMIN'), async (req: Request, res: Response) => {
  const user = (req as any).user as { departmentId?: number; role: string }
  const departmentId = user.role === 'ADMIN' ? Number(req.query.departmentId) || null : user.departmentId || null
  if (!departmentId) return res.status(400).json({ error: 'Missing departmentId' })

  const parsedPage = Number(req.query.page)
  const parsedPageSize = Number(req.query.pageSize)
  const pageSize = Math.min(Math.max(Number.isFinite(parsedPageSize) && parsedPageSize > 0 ? parsedPageSize : 5, 1), 5)
  const requestedPage = Math.max(Number.isFinite(parsedPage) && parsedPage ? parsedPage : 1, 1)
  const searchTermRaw = typeof req.query.search === 'string' ? req.query.search.trim() : ''
  const searchTerm = searchTermRaw.slice(0, 100)

  const likeTerm = `%${searchTerm}%`
  const filterClause = searchTerm
    ? ` AND (
        r.tracking_id LIKE ?
        OR r.title LIKE ?
        OR c.full_name LIKE ?
        OR c.email LIKE ?
        OR r.category LIKE ?
      )`
    : ''

  const filterParams = searchTerm ? [likeTerm, likeTerm, likeTerm, likeTerm, likeTerm] : []

  const countQuery = `
    SELECT COUNT(*) as total
    FROM reports r
    LEFT JOIN citizens c ON r.citizen_id = c.citizen_id
    WHERE r.assigned_department_id = ?${filterClause}
  `
  const [countRows] = await pool.query(countQuery, [departmentId, ...filterParams])
  const total = Number((countRows as any[])[0]?.total ?? 0)
  const totalPages = total === 0 ? 1 : Math.max(1, Math.ceil(total / pageSize))

  let page = Math.min(requestedPage, totalPages)
  if (page < 1) page = 1
  let offset = (page - 1) * pageSize

  const baseQuery = `
    SELECT r.report_id as id,
      r.tracking_id as trackingId,
      r.title,
      r.category,
      r.description,
      r.status,
      r.requires_manual_review as requiresManualReview,
      r.urgency_level as urgency,
      r.created_at as createdAt,
      r.assigned_at as assignedAt,
      r.resolved_at as resolvedAt,
      r.expected_resolution_hours as expectedResolutionHours,
      r.location_address as locationAddress,
      r.location_lat as locationLat,
      r.location_lng as locationLng,
      r.is_anonymous as isAnonymous,
      CASE WHEN r.is_anonymous THEN NULL ELSE c.full_name END as citizenName,
      CASE WHEN r.is_anonymous THEN NULL ELSE c.email END as citizenEmail,
      CASE WHEN r.is_anonymous THEN NULL ELSE c.contact_number END as citizenContact
    FROM reports r
    LEFT JOIN citizens c ON r.citizen_id = c.citizen_id
    WHERE r.assigned_department_id = ?${filterClause}
    ORDER BY r.created_at DESC
    LIMIT ? OFFSET ?
  `

  let [rows] = await pool.query(baseQuery, [departmentId, ...filterParams, pageSize, offset])

  if (total > 0 && offset >= total) {
    page = totalPages
    offset = (page - 1) * pageSize
    ;[rows] = await pool.query(baseQuery, [departmentId, ...filterParams, pageSize, offset])
  }

  res.json({
    items: rows,
    page,
    pageSize,
    total,
    totalPages,
    search: searchTerm
  })
})

dashboardsRouter.get('/department/stats', requireAuth, requireRole('STAFF', 'ADMIN'), async (req: Request, res: Response) => {
  const user = (req as any).user as { departmentId?: number; role: string }
  const departmentId = user.role === 'ADMIN' ? Number(req.query.departmentId) || null : user.departmentId || null
  if (!departmentId) return res.status(400).json({ error: 'Missing departmentId' })

  const [statusCounts] = await pool.query(
    `SELECT status, COUNT(*) as total
     FROM reports
     WHERE assigned_department_id = ?
     GROUP BY status`,
    [departmentId]
  )

  const [slaStats] = await pool.query(
    `SELECT
        COUNT(*) as totalReports,
        SUM(CASE WHEN status = 'Resolved' THEN 1 ELSE 0 END) as resolvedReports,
        AVG(CASE WHEN resolved_at IS NOT NULL THEN TIMESTAMPDIFF(HOUR, created_at, resolved_at) END) as avgResolutionHours,
        SUM(CASE WHEN expected_resolution_hours IS NOT NULL AND resolved_at IS NOT NULL AND TIMESTAMPDIFF(HOUR, created_at, resolved_at) <= expected_resolution_hours THEN 1 ELSE 0 END) as metSla
     FROM reports
     WHERE assigned_department_id = ?`,
    [departmentId]
  )

  const [recentTrends] = await pool.query(
    `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') as day, COUNT(*) as total
     FROM reports
     WHERE assigned_department_id = ?
       AND created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)
     GROUP BY DATE(created_at)
     ORDER BY day ASC`,
    [departmentId]
  )

  const overview = (slaStats as any[])[0] || null
  res.json({ statusCounts, overview, recentTrends })
})

// Admin overview: counts by department / status
dashboardsRouter.get('/admin/overview', requireAuth, requireRole('ADMIN'), async (_req: Request, res: Response) => {
  const [byDept] = await pool.query(
    `SELECT d.department_id as id, d.name, COUNT(r.report_id) as total
     FROM departments d
     LEFT JOIN reports r ON r.assigned_department_id = d.department_id
     GROUP BY d.department_id, d.name
     ORDER BY d.name`
  )
  const [byStatus] = await pool.query(
    `SELECT status, COUNT(*) as total FROM reports GROUP BY status`
  )
  const [recentReports] = await pool.query(
    `SELECT report_id as id,
            tracking_id as trackingId,
            title,
            category,
            status,
            location_lat as locationLat,
            location_lng as locationLng,
            created_at as createdAt
     FROM reports
     WHERE location_lat IS NOT NULL AND location_lng IS NOT NULL
     ORDER BY created_at DESC
     LIMIT 200`
  )
  res.json({ byDept, byStatus, recentReports })
})
