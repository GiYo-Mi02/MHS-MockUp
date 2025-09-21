import { Router, Request, Response } from 'express'
import { pool } from '../db'
import { requireAuth, requireRole } from '../auth'

export const dashboardsRouter = Router()

// Department queue for STAFF: reports assigned to their department
dashboardsRouter.get('/department', requireAuth, requireRole('STAFF', 'ADMIN'), async (req: Request, res: Response) => {
  const user = (req as any).user as { departmentId?: number; role: string }
  const departmentId = user.role === 'ADMIN' ? (req.query.departmentId as string | undefined) : String(user.departmentId || '')
  if (!departmentId) return res.status(400).json({ error: 'Missing departmentId' })
  const [rows] = await pool.query(
    `SELECT r.id, r.tracking_id as trackingId, r.title, r.status, r.created_at
     FROM reports r WHERE r.department_id = ? ORDER BY r.created_at DESC LIMIT 200`,
    [departmentId]
  )
  res.json(rows)
})

// Admin overview: counts by department / status
dashboardsRouter.get('/admin/overview', requireAuth, requireRole('ADMIN'), async (_req: Request, res: Response) => {
  const [byDept] = await pool.query(
    `SELECT d.id, d.name, COUNT(r.id) as total
     FROM departments d
     LEFT JOIN reports r ON r.department_id = d.id
     GROUP BY d.id, d.name
     ORDER BY d.name`
  )
  const [byStatus] = await pool.query(
    `SELECT status, COUNT(*) as total FROM reports GROUP BY status`
  )
  res.json({ byDept, byStatus })
})
