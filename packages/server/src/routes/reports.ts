import { Router, type Request, type Response } from 'express'
import type { Express } from 'express'
import multer from 'multer'
import { ResultSetHeader } from 'mysql2'
import { pool } from '../db'
import { requireAuth, requireRole } from '../auth'
import { sendReportSubmissionReceipt, sendReportUpdateNotification } from '../services/report-email'
import { notifyDepartmentOfNewReport, notifyCitizenOfStatusChange, notifyCitizenOfResponse } from '../services/notifications'
import { uploadEvidenceImage } from '../services/storage'
import { applyTrustTransition, getInitialStatusForTrust, getTrustMetadata } from '../services/trust'
import type { TrustLevel } from '../services/trust'

export const reportsRouter = Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 5
  }
})

function generateTrackingId() {
  return 'MR-' + Math.random().toString(36).slice(2, 8).toUpperCase()
}

function parseNullableNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

function parseBooleanFlag(value: unknown): boolean {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on'
  }
  return Boolean(value)
}

function normalizeEvidencePayload(value: unknown): Array<{ fileUrl: string; fileType: string }> {
  if (!value) return []
  let parsed = value
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value)
    } catch (_err) {
      return []
    }
  }

  if (!Array.isArray(parsed)) return []

  return parsed
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const record = item as { fileUrl?: unknown; fileType?: unknown }
      if (typeof record.fileUrl !== 'string' || !record.fileUrl) return null
      return {
        fileUrl: record.fileUrl,
        fileType: typeof record.fileType === 'string' && record.fileType ? record.fileType : 'photo'
      }
    })
    .filter((item): item is { fileUrl: string; fileType: string } => Boolean(item))
}

// Create report
reportsRouter.post('/', upload.array('evidence', 5), async (req: Request, res: Response) => {
  const body = req.body || {}
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const description = typeof body.description === 'string' ? body.description.trim() : ''
  const category = typeof body.category === 'string' ? body.category.trim() : ''
  const urgency = typeof body.urgency === 'string' && body.urgency.trim() ? body.urgency.trim() : 'Regular'
  const locationAddress = typeof body.locationAddress === 'string' && body.locationAddress.trim() ? body.locationAddress.trim() : null
  const locationLandmark = typeof body.locationLandmark === 'string' && body.locationLandmark.trim() ? body.locationLandmark.trim() : null
  const locationLat = parseNullableNumber(body.locationLat)
  const locationLng = parseNullableNumber(body.locationLng)
  const submitAnonymously = parseBooleanFlag(body.submitAnonymously)
  const citizenId = parseNullableNumber(body.citizenId)
  const isAnonymous = submitAnonymously || !citizenId
  const evidencePayload = normalizeEvidencePayload(body.evidence)

  if (!title || !description || !category) return res.status(400).json({ error: 'Missing fields' })

  const files = (req.files as Express.Multer.File[] | undefined) ?? []
  const uploadedEvidence: Array<{ fileUrl: string; fileType: string }> = []

  for (const file of files) {
    try {
      const uploaded = await uploadEvidenceImage({
        buffer: file.buffer,
        mimetype: file.mimetype,
        originalname: file.originalname
      })
      uploadedEvidence.push({ fileUrl: uploaded.url, fileType: 'photo' })
    } catch (error) {
      console.error('Failed to upload evidence file %s:', file.originalname, error)
    }
  }

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

  let citizenName: string | undefined
  let citizenHasEmail = false
  let citizenTrustLevel: TrustLevel | null = null
  let citizenDailyLimit: number | null = null
  let reportsSubmittedToday = 0

  if (citizenId) {
    const [citizenRows] = await pool.query(
      'SELECT full_name, email, is_verified, trust_score FROM citizens WHERE citizen_id = ? LIMIT 1',
      [citizenId]
    )
    const citizen = (citizenRows as any[])[0]
    if (!citizen) {
      return res.status(404).json({ error: 'Citizen account not found' })
    }

    citizenName = citizen?.full_name || undefined
    citizenHasEmail = typeof citizen?.email === 'string' && citizen.email.length > 0

    const isCitizenVerified = Boolean(citizen?.is_verified)
    const trustScore = Number(citizen?.trust_score ?? 0)
    const trustMeta = getTrustMetadata(trustScore)
    citizenTrustLevel = trustMeta.trustLevel
    citizenDailyLimit = trustMeta.dailyReportLimit ?? null

    if (!isCitizenVerified) {
      const [countRows] = await pool.query(
        'SELECT COUNT(*) AS total FROM reports WHERE citizen_id = ?',
        [citizenId]
      )
      const totalReports = Number((countRows as any[])[0]?.total ?? 0)
      if (totalReports >= 1) {
        return res.status(403).json({
          error: 'Please verify your account before submitting more reports.',
          code: 'VERIFICATION_REQUIRED'
        })
      }
    }

    if (citizenDailyLimit !== null) {
      const [todayRows] = await pool.query(
        'SELECT COUNT(*) AS total FROM reports WHERE citizen_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)',
        [citizenId]
      )
      reportsSubmittedToday = Number((todayRows as any[])[0]?.total ?? 0)
      if (reportsSubmittedToday >= citizenDailyLimit) {
        return res.status(429).json({
          error: 'Daily report limit reached for your current trust level.',
          code: 'TRUST_LIMIT',
          meta: {
            trustLevel: citizenTrustLevel,
            limit: citizenDailyLimit,
            submittedToday: reportsSubmittedToday
          }
        })
      }
    }
  }

  const initialStatusData = citizenTrustLevel
    ? getInitialStatusForTrust(citizenTrustLevel)
    : { status: 'Pending', requiresManualReview: false }
  const initialStatus = initialStatusData.status
  const requiresManualReview = initialStatusData.requiresManualReview

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
        is_anonymous,
        requires_manual_review,
        expected_resolution_hours
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    , [
      citizenId ?? null,
      trackingId,
      title,
      category,
      description,
      urgency,
      initialStatus,
      locationAddress,
      locationLandmark,
      locationLat ?? null,
      locationLng ?? null,
      department.department_id,
      isAnonymous,
      requiresManualReview,
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
      'citizen',
      citizenId ?? null,
      null,
      initialStatus,
      requiresManualReview
        ? 'Report created · queued for manual review due to citizen trust level'
        : 'Report created'
    ]
  )

  const evidenceRecords = [...evidencePayload, ...uploadedEvidence]

  if (evidenceRecords.length) {
    const values = evidenceRecords.map((item) => [reportId, item.fileUrl, item.fileType || 'photo'])
    await pool.query(
      'INSERT INTO report_evidence (report_id, file_url, file_type) VALUES ?'
      , [values]
    )
  }

  // Notify department staff of new report regardless of citizen presence
  await notifyDepartmentOfNewReport(
    reportId,
    department.department_id,
    title,
    isAnonymous ? undefined : citizenName,
    trackingId,
    {
      requiresManualReview,
      trustLevel: citizenTrustLevel ?? undefined
    }
  )

  if (citizenId && citizenHasEmail && !isAnonymous) {
    try {
      await sendReportSubmissionReceipt(reportId)
    } catch (error) {
      console.error('Failed to send submission receipt email:', error)
    }
  }

  res.status(201).json({
    id: reportId,
    trackingId,
    title,
    status: initialStatus,
    expectedResolutionHours,
    requiresManualReview,
    trustLevel: citizenTrustLevel,
    submittedToday: citizenId ? reportsSubmittedToday + 1 : null,
    dailyLimit: citizenDailyLimit
  })
})

// Citizen report history
reportsRouter.get('/history', requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user as { sub: string; role: string }
  if (!user || user.role !== 'CITIZEN') {
    return res.status(403).json({ error: 'Citizen account required' })
  }

  const limitParam = Number(req.query.limit)
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(Math.floor(limitParam), 100) : 50

  const [rows] = await pool.query(
    `SELECT report_id as id,
            tracking_id as trackingId,
            status,
            created_at as createdAt,
            is_anonymous as isAnonymous,
            requires_manual_review as requiresManualReview
     FROM reports
     WHERE citizen_id = ?
     ORDER BY created_at DESC
     LIMIT ?`,
    [Number(user.sub), limit]
  )

  res.json(rows)
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
            r.requires_manual_review as requiresManualReview,
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

  const [existingRows] = await pool.query(
    'SELECT status, citizen_id, tracking_id, title, is_anonymous, trust_credit_applied, trust_penalty_applied FROM reports WHERE report_id = ? LIMIT 1',
    [id]
  )
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

  await applyTrustTransition({
    citizenId: existing.citizen_id ? Number(existing.citizen_id) : null,
    reportId: Number(id),
    previousStatus: existing.status,
    newStatus: normalizedStatus,
    trustCreditApplied: Boolean(existing.trust_credit_applied),
    trustPenaltyApplied: Boolean(existing.trust_penalty_applied)
  })

  // Send email notification
  if (!existing.is_anonymous) {
    await sendReportUpdateNotification({
      reportId: Number(id),
      message: remarks || null,
      newStatus: normalizedStatus,
      actorName: user.name || null
    })
  }

  // Create in-app notification for citizen
  if (existing.citizen_id && !existing.is_anonymous) {
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

  const [existingRows] = await pool.query('SELECT report_id, status, citizen_id, tracking_id, title, is_anonymous FROM reports WHERE report_id = ? LIMIT 1', [id])
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
  if (!existing.is_anonymous) {
    await sendReportUpdateNotification({
      reportId: Number(id),
      message,
      newStatus: null,
      actorName: user.name || null
    })
  }

  // Create in-app notification for citizen
  if (existing.citizen_id && !existing.is_anonymous) {
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
  let isAnonymous = false
  let statusChanged = false
  let messageRecorded = false
  let trustCreditApplied = false
  let trustPenaltyApplied = false
  let previousStatus: string | null = null
  let currentStatus: string | null = null

  try {
    await connection.beginTransaction()

    const [existingRows] = await connection.query(
      'SELECT status, citizen_id, tracking_id, title, is_anonymous, trust_credit_applied, trust_penalty_applied FROM reports WHERE report_id = ? LIMIT 1 FOR UPDATE',
      [id]
    )
    const existing = (existingRows as any[])[0]
    if (!existing) {
      await connection.rollback()
      return res.status(404).json({ error: 'Report not found' })
    }

    const actorType = user.role.toLowerCase()
    const actorId = Number(user.sub)
    previousStatus = existing.status
    currentStatus = existing.status
    citizenId = existing.citizen_id ?? null
    isAnonymous = Boolean(existing.is_anonymous)
    trustCreditApplied = Boolean(existing.trust_credit_applied)
    trustPenaltyApplied = Boolean(existing.trust_penalty_applied)

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

    const finalStatus = currentStatus ?? previousStatus ?? 'Pending'

    await applyTrustTransition({
      citizenId,
      reportId: Number(id),
      previousStatus,
      newStatus: finalStatus,
      trustCreditApplied,
      trustPenaltyApplied,
      connection
    })
  } catch (err) {
    await connection.rollback()
    throw err
  } finally {
    connection.release()
  }

  if (!isAnonymous) {
    await sendReportUpdateNotification({
      reportId: Number(id),
      message: trimmedMessage || null,
      newStatus,
      actorName: user.name || null
    })
  }

  if (citizenId && !isAnonymous) {
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
