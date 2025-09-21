import { Router, Request, Response } from 'express'
import { pool } from '../db'
import { requireAuth, requireRole } from '../auth'

export const reportsRouter = Router()

function generateTrackingId() {
  return 'MR-' + Math.random().toString(36).slice(2, 8).toUpperCase()
}

// Create report
reportsRouter.post('/', async (req: Request, res: Response) => {
  const { title, description, category, location, photoUrl, citizenId } = req.body || {}
  if (!title || !description || !category) return res.status(400).json({ error: 'Missing fields' })

  // simple category routing to department code
  const [deptRows] = await pool.query('SELECT id FROM departments WHERE code = ? LIMIT 1', [category])
  const depts = deptRows as any[]
  const departmentId = depts[0]?.id || null
  if (!departmentId) return res.status(400).json({ error: 'Invalid category/department' })

  const trackingId = generateTrackingId()
  const [result] = await pool.query(
    'INSERT INTO reports (tracking_id, title, description, department_id, citizen_id, status, location, photo_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [trackingId, title, description, departmentId, citizenId || null, 'PENDING', location || null, photoUrl || null]
  )
  // @ts-ignore
  const reportId = result.insertId
  await pool.query('INSERT INTO status_logs (report_id, status, remarks) VALUES (?, ?, ?)', [reportId, 'PENDING', 'Report created'])
  res.status(201).json({ id: reportId, trackingId, status: 'PENDING' })
})

// Get by trackingId
reportsRouter.get('/track/:trackingId', async (req, res) => {
  const { trackingId } = req.params
  const [rows] = await pool.query(
    `SELECT r.id, r.tracking_id as trackingId, r.title, r.description, r.status, r.location, r.photo_url as photoUrl, d.name as department
     FROM reports r JOIN departments d ON r.department_id = d.id WHERE r.tracking_id = ? LIMIT 1`,
    [trackingId]
  )
  const list = rows as any[]
  if (!list.length) return res.status(404).json({ error: 'Not found' })
  const report = list[0]
  const [logs] = await pool.query('SELECT status, remarks, created_at FROM status_logs WHERE report_id = ? ORDER BY created_at ASC', [report.id])
  report.logs = logs
  res.json(report)
})

// Update status
reportsRouter.patch('/:id/status', requireAuth, requireRole('STAFF', 'ADMIN'), async (req: Request, res: Response) => {
  const { id } = req.params
  const { status, remarks } = req.body || {}
  if (!status) return res.status(400).json({ error: 'Missing status' })
  await pool.query('UPDATE reports SET status = ? WHERE id = ?', [status, id])
  await pool.query('INSERT INTO status_logs (report_id, status, remarks) VALUES (?, ?, ?)', [id, status, remarks || null])
  res.json({ ok: true })
})
