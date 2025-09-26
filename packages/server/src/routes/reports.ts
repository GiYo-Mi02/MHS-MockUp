import { Router, Request, Response } from 'express'
import { ResultSetHeader } from 'mysql2'
import { pool } from '../db'
import { requireAuth, requireRole } from '../auth'
import { sendReportUpdateNotification } from '../services/report-email'
import { notifyDepartmentOfNewReport, notifyCitizenOfStatusChange, notifyCitizenOfResponse } from '../services/notifications'

export const reportsRouter = Router()

function generateTrackingId() {
  return 'MR-' + Math.random().toString(36).slice(2, 8).toUpperCase()
}

// Create report
reportsRouter.post('/', async (req: Request, res: Response) => {
  const {
    title,
    description,
    category,
    urgency = 'Regular',
    locationAddress,
    locationLandmark,
    locationLat,
    locationLng,
    citizenId,
    evidence = []
  } = req.body || {}

  if (!title || !description || !category) return res.status(400).json({ error: 'Missing fields' })

  const [deptRows] = await pool.query('SELECT department_id FROM departments WHERE code = ? LIMIT 1', [category])
  const department = (deptRows as any[])[0]
  if (!department) return res.status(400).json({ error: 'Invalid category/department' })

  const [slaRows] = await pool.query(
    'SELECT expected_resolution_hours FROM sla_policies WHERE category = ? AND urgency_level = ? LIMIT 1',
    [category, urgency]
  )
  const sla = (slaRows as any[])[0]
  const expectedResolutionHours = sla ? sla.expected_resolution_hours : null

  const trackingId = generateTrackingId()

  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO reports (
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
        expected_resolution_hours
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    , [
      citizenId || null,
      trackingId,
      title,
      category,
      description,
      urgency,
      'Pending',
      locationAddress || null,
      locationLandmark || null,
      locationLat ?? null,
      locationLng ?? null,
      department.department_id,
      expectedResolutionHours
    ]
  )

  const reportId = result.insertId

  await pool.query(
    `INSERT INTO report_status_logs (report_id, action, actor_type, actor_id, old_status, new_status, remarks)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
    , [
      reportId,
      'Report submitted',
      citizenId ? 'citizen' : 'admin',
      citizenId || null,
      null,
      'Pending',
      'Report created'
    ]
  )

  if (Array.isArray(evidence) && evidence.length) {
    const values = evidence
      .filter((item: any) => item?.fileUrl)
      .map((item: any) => [reportId, item.fileUrl, item.fileType || 'photo'])
    if (values.length) {
      await pool.query(
        'INSERT INTO report_evidence (report_id, file_url, file_type) VALUES ?'
        , [values]
      )
    }
  }

  let citizenName: string | undefined
  if (citizenId) {
    const [citizenRows] = await pool.query('SELECT full_name FROM citizens WHERE citizen_id = ?', [citizenId])
    const citizen = (citizenRows as any[])[0]
    citizenName = citizen?.full_name || undefined
  }

  // Notify department staff of new report regardless of citizen presence
  await notifyDepartmentOfNewReport(reportId, department.department_id, title, citizenName, trackingId)

  res.status(201).json({ id: reportId, trackingId, title, status: 'Pending', expectedResolutionHours })
})

// Get by trackingId
reportsRouter.get('/track/:trackingId', async (req, res) => {
  const { trackingId } = req.params
  const [rows] = await pool.query(
    `SELECT r.report_id as id,
            r.tracking_id as trackingId,
            r.title,
            r.category,
            r.description,
            r.status,
            r.urgency_level as urgency,
            r.location_address as locationAddress,
            r.location_landmark as locationLandmark,
            r.location_lat as locationLat,
            r.location_lng as locationLng,
            r.created_at,
            r.assigned_at,
            r.resolved_at,
            r.expected_resolution_hours as expectedResolutionHours,
            d.name as department,
            d.contact_email as departmentEmail,
            d.contact_number as departmentContact
     FROM reports r
     JOIN departments d ON r.assigned_department_id = d.department_id
     WHERE r.tracking_id = ?
     LIMIT 1`,
    [trackingId]
  )
  const list = rows as any[]
  if (!list.length) return res.status(404).json({ error: 'Not found' })
  const report = list[0]
  const [logs] = await pool.query(
    `SELECT action, actor_type as actorType, actor_id as actorId, old_status as oldStatus, new_status as newStatus, remarks, created_at
     FROM report_status_logs WHERE report_id = ? ORDER BY created_at ASC`,
    [report.id]
  )
  const [evidence] = await pool.query(
    `SELECT evidence_id as id, file_url as fileUrl, file_type as fileType, uploaded_at
     FROM report_evidence WHERE report_id = ? ORDER BY uploaded_at ASC`,
    [report.id]
  )
  report.logs = logs
  report.evidence = evidence
  res.json(report)
})

// Update status
reportsRouter.patch('/:id/status', requireAuth, requireRole('STAFF', 'ADMIN'), async (req: Request, res: Response) => {
  const { id } = req.params
  const { status, remarks } = req.body || {}
  if (!status) return res.status(400).json({ error: 'Missing status' })

  const [existingRows] = await pool.query('SELECT status, citizen_id, tracking_id, title FROM reports WHERE report_id = ? LIMIT 1', [id])
  const existing = (existingRows as any[])[0]
  if (!existing) return res.status(404).json({ error: 'Report not found' })

  const normalizedStatus = status
  const shouldResolve = normalizedStatus.toLowerCase() === 'resolved'

  await pool.query(
    'UPDATE reports SET status = ?, resolved_at = CASE WHEN ? THEN NOW() ELSE resolved_at END WHERE report_id = ?',
    [normalizedStatus, shouldResolve, id]
  )

  const user = (req as any).user as { sub: string; role: string; name?: string }
  await pool.query(
    `INSERT INTO report_status_logs (report_id, action, actor_type, actor_id, old_status, new_status, remarks)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
    , [
      id,
      `Status updated to ${normalizedStatus}`,
      user.role.toLowerCase(),
      Number(user.sub),
      existing.status,
      normalizedStatus,
      remarks || null
    ]
  )

  // Send email notification
  await sendReportUpdateNotification({
    reportId: Number(id),
    message: remarks || null,
    newStatus: normalizedStatus,
    actorName: user.name || null
  })

  // Create in-app notification for citizen
  if (existing.citizen_id) {
    await notifyCitizenOfStatusChange(
      Number(id),
      existing.citizen_id,
      normalizedStatus,
      user.name,
      existing.tracking_id,
      existing.title
    )
  }

  res.json({ ok: true })
})

// Add department/admin response without changing status
reportsRouter.post('/:id/respond', requireAuth, requireRole('STAFF', 'ADMIN'), async (req: Request, res: Response) => {
  const { id } = req.params
  const { message } = req.body || {}
  if (!message) return res.status(400).json({ error: 'Message is required' })

  const [existingRows] = await pool.query('SELECT report_id, status, citizen_id, tracking_id, title FROM reports WHERE report_id = ? LIMIT 1', [id])
  const existing = (existingRows as any[])[0]
  if (!existing) return res.status(404).json({ error: 'Report not found' })

  const user = (req as any).user as { sub: string; role: string; name?: string }

  await pool.query(
    `INSERT INTO report_status_logs (report_id, action, actor_type, actor_id, old_status, new_status, remarks)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
    , [
      id,
      'Department response recorded',
      user.role.toLowerCase(),
      Number(user.sub),
      existing.status,
      existing.status,
      message
    ]
  )

  // Send email notification
  await sendReportUpdateNotification({
    reportId: Number(id),
    message,
    newStatus: null,
    actorName: user.name || null
  })

  // Create in-app notification for citizen
  if (existing.citizen_id) {
    await notifyCitizenOfResponse(
      Number(id),
      existing.citizen_id,
      user.name,
      existing.tracking_id,
      existing.title
    )
  }

  res.json({ ok: true })
})

// Combined action: update status and/or message with single response and email
reportsRouter.post('/:id/actions', requireAuth, requireRole('STAFF', 'ADMIN'), async (req: Request, res: Response) => {
  const { id } = req.params
  const { message, status } = req.body || {}

  const trimmedMessage = typeof message === 'string' ? message.trim() : ''
  const newStatus = typeof status === 'string' && status.trim() ? status.trim() : null

  if (!trimmedMessage && !newStatus) {
    return res.status(400).json({ error: 'Provide a message or status update.' })
  }

  const user = (req as any).user as { sub: string; role: string; name?: string }

  const connection = await pool.getConnection()
  let citizenId: number | null = null
  let statusChanged = false
  let messageRecorded = false

  try {
    await connection.beginTransaction()

    const [existingRows] = await connection.query('SELECT status, citizen_id, tracking_id, title FROM reports WHERE report_id = ? LIMIT 1 FOR UPDATE', [id])
    const existing = (existingRows as any[])[0]
    if (!existing) {
      await connection.rollback()
      return res.status(404).json({ error: 'Report not found' })
    }

    const actorType = user.role.toLowerCase()
    const actorId = Number(user.sub)
    let currentStatus: string | null = existing.status
    citizenId = existing.citizen_id ?? null

    if (newStatus) {
      const shouldResolve = newStatus.toLowerCase() === 'resolved'
      await connection.query(
        'UPDATE reports SET status = ?, resolved_at = CASE WHEN ? THEN NOW() ELSE resolved_at END WHERE report_id = ?',
        [newStatus, shouldResolve, id]
      )

      await connection.query(
        `INSERT INTO report_status_logs (report_id, action, actor_type, actor_id, old_status, new_status, remarks)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
        , [
          id,
          `Status updated to ${newStatus}`,
          actorType,
          actorId,
          currentStatus,
          newStatus,
          trimmedMessage || null
        ]
      )

      currentStatus = newStatus
      statusChanged = true
    }

    if (trimmedMessage && !newStatus) {
      await connection.query(
        `INSERT INTO report_status_logs (report_id, action, actor_type, actor_id, old_status, new_status, remarks)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
        , [
          id,
          'Department response recorded',
          actorType,
          actorId,
          currentStatus,
          currentStatus,
          trimmedMessage
        ]
      )
      messageRecorded = true
    }

    await connection.commit()
  } catch (err) {
    await connection.rollback()
    throw err
  } finally {
    connection.release()
  }

  await sendReportUpdateNotification({
    reportId: Number(id),
    message: trimmedMessage || null,
    newStatus,
    actorName: user.name || null
  })

  if (citizenId) {
    const [reportRows] = await pool.query('SELECT tracking_id, title FROM reports WHERE report_id = ? LIMIT 1', [id])
    const report = (reportRows as any[])[0]
    const trackingId = report?.tracking_id
    const title = report?.title

    if (statusChanged && newStatus) {
      await notifyCitizenOfStatusChange(Number(id), citizenId, newStatus, user.name, trackingId, title)
    } else if (messageRecorded && trimmedMessage) {
      await notifyCitizenOfResponse(Number(id), citizenId, user.name, trackingId, title)
    }
  }

  res.json({ ok: true })
})
