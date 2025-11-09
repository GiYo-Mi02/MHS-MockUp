import { Router, type Request, type Response } from 'express'
import type { Express } from 'express'
import multer from 'multer'
import { supabaseAdmin } from '../supabase'
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

  const { data: department, error: deptError } = await supabaseAdmin
    .from('departments')
    .select('department_id')
    .eq('code', category)
    .single()

  if (deptError || !department) return res.status(400).json({ error: 'Invalid category/department' })

  const { data: sla } = await supabaseAdmin
    .from('sla_policies')
    .select('expected_resolution_hours')
    .eq('category', category)
    .eq('urgency_level', urgency)
    .single()

  const expectedResolutionHours = sla?.expected_resolution_hours || null

  const trackingId = generateTrackingId()

  let citizenName: string | undefined
  let citizenHasEmail = false
  let citizenTrustLevel: TrustLevel | null = null
  let citizenDailyLimit: number | null = null
  let reportsSubmittedToday = 0

  if (citizenId) {
    const { data: citizen, error } = await supabaseAdmin
      .from('citizens')
      .select('full_name, email, is_verified, trust_score')
      .eq('citizen_id', citizenId)
      .single()

    if (error || !citizen) {
      return res.status(404).json({ error: 'Citizen account not found' })
    }

    citizenName = citizen?.full_name || undefined
    citizenHasEmail = typeof citizen?.email === 'string' && citizen.email.length > 0

    const isCitizenVerified = Boolean(citizen?.is_verified)
    const trustScore = Number(citizen?.trust_score ?? 0)
    const trustMeta = getTrustMetadata(trustScore)
    citizenTrustLevel = trustMeta.trustLevel
    citizenDailyLimit = trustMeta.dailyReportLimit ?? null

    // Skip verification check during load testing
    const isLoadTest = process.env.DISABLE_RATE_LIMIT === 'true'
    
    if (!isCitizenVerified && !isLoadTest) {
      const { count } = await supabaseAdmin
        .from('reports')
        .select('*', { count: 'exact', head: true })
        .eq('citizen_id', citizenId)

      const totalReports = count || 0
      if (totalReports >= 1) {
        return res.status(403).json({
          error: 'Please verify your account before submitting more reports.',
          code: 'VERIFICATION_REQUIRED'
        })
      }
    }

    if (citizenDailyLimit !== null && !isLoadTest) {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const { count } = await supabaseAdmin
        .from('reports')
        .select('*', { count: 'exact', head: true })
        .eq('citizen_id', citizenId)
        .gte('created_at', oneDayAgo)

      reportsSubmittedToday = count || 0
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

  const { data: newReport, error: insertError } = await supabaseAdmin
    .from('reports')
    .insert({
      citizen_id: citizenId ?? null,
      tracking_id: trackingId,
      title,
      category,
      description,
      urgency_level: urgency,
      status: initialStatus,
      location_address: locationAddress,
      location_landmark: locationLandmark,
      location_lat: locationLat ?? null,
      location_lng: locationLng ?? null,
      assigned_department_id: department.department_id,
      is_anonymous: isAnonymous,
      requires_manual_review: requiresManualReview,
      expected_resolution_hours: expectedResolutionHours
    })
    .select('report_id')
    .single()

  if (insertError || !newReport) {
    console.error('Error inserting report:', insertError)
    return res.status(500).json({ error: 'Failed to create report' })
  }

  const reportId = newReport.report_id

  await supabaseAdmin
    .from('report_status_logs')
    .insert({
      report_id: reportId,
      action: 'Report submitted',
      actor_type: 'citizen',
      actor_id: citizenId ?? null,
      old_status: null,
      new_status: initialStatus,
      remarks: requiresManualReview
        ? 'Report created · queued for manual review due to citizen trust level'
        : 'Report created'
    })

  const evidenceRecords = [...evidencePayload, ...uploadedEvidence]

  if (evidenceRecords.length > 0) {
    const evidenceData = evidenceRecords.map((item) => ({
      report_id: reportId,
      file_url: item.fileUrl,
      file_type: item.fileType || 'photo'
    }))
    
    await supabaseAdmin
      .from('report_evidence')
      .insert(evidenceData)
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

  // Send email asynchronously (fire-and-forget) - don't block response
  if (citizenId && citizenHasEmail && !isAnonymous) {
    sendReportSubmissionReceipt(reportId).catch(error => {
      console.error('Failed to send submission receipt email:', error)
    })
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

  const { data: reports, error } = await supabaseAdmin
    .from('reports')
    .select('report_id, tracking_id, status, created_at, is_anonymous, requires_manual_review')
    .eq('citizen_id', Number(user.sub))
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching citizen report history:', error)
    return res.status(500).json({ error: 'Failed to fetch reports' })
  }

  const formattedReports = (reports || []).map(r => ({
    id: r.report_id,
    trackingId: r.tracking_id,
    status: r.status,
    createdAt: r.created_at,
    isAnonymous: r.is_anonymous,
    requiresManualReview: r.requires_manual_review
  }))

  res.json(formattedReports)
})

// Get by trackingId
reportsRouter.get('/track/:trackingId', async (req, res) => {
  const { trackingId } = req.params
  
  const { data: report, error } = await supabaseAdmin
    .from('reports')
    .select(`
      report_id,
      tracking_id,
      title,
      category,
      description,
      status,
      urgency_level,
      location_address,
      location_landmark,
      location_lat,
      location_lng,
      created_at,
      assigned_at,
      resolved_at,
      expected_resolution_hours,
      requires_manual_review,
      departments:assigned_department_id (
        name,
        contact_email,
        contact_number
      )
    `)
    .eq('tracking_id', trackingId)
    .single()

  if (error || !report) {
    return res.status(404).json({ error: 'Not found' })
  }

  const { data: logs } = await supabaseAdmin
    .from('report_status_logs')
    .select('action, actor_type, actor_id, old_status, new_status, remarks, created_at')
    .eq('report_id', report.report_id)
    .order('created_at', { ascending: true })

  const { data: evidence } = await supabaseAdmin
    .from('report_evidence')
    .select('evidence_id, file_url, file_type, uploaded_at')
    .eq('report_id', report.report_id)
    .order('uploaded_at', { ascending: true })

  const department = Array.isArray(report.departments) ? report.departments[0] : report.departments

  const formattedReport = {
    id: report.report_id,
    trackingId: report.tracking_id,
    title: report.title,
    category: report.category,
    description: report.description,
    status: report.status,
    urgency: report.urgency_level,
    locationAddress: report.location_address,
    locationLandmark: report.location_landmark,
    locationLat: report.location_lat,
    locationLng: report.location_lng,
    created_at: report.created_at,
    assigned_at: report.assigned_at,
    resolved_at: report.resolved_at,
    expectedResolutionHours: report.expected_resolution_hours,
    requiresManualReview: report.requires_manual_review,
    department: department?.name,
    departmentEmail: department?.contact_email,
    departmentContact: department?.contact_number,
    logs: (logs || []).map(l => ({
      action: l.action,
      actorType: l.actor_type,
      actorId: l.actor_id,
      oldStatus: l.old_status,
      newStatus: l.new_status,
      remarks: l.remarks,
      created_at: l.created_at
    })),
    evidence: (evidence || []).map(e => ({
      id: e.evidence_id,
      fileUrl: e.file_url,
      fileType: e.file_type,
      uploaded_at: e.uploaded_at
    }))
  }

  res.json(formattedReport)
})

// Update status
reportsRouter.patch('/:id/status', requireAuth, requireRole('STAFF', 'ADMIN'), async (req: Request, res: Response) => {
  const { id } = req.params
  const { status, remarks } = req.body || {}
  if (!status) return res.status(400).json({ error: 'Missing status' })

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from('reports')
    .select('status, citizen_id, tracking_id, title, is_anonymous, trust_credit_applied, trust_penalty_applied')
    .eq('report_id', id)
    .single()

  if (fetchError || !existing) {
    return res.status(404).json({ error: 'Report not found' })
  }

  const normalizedStatus = status
  const shouldResolve = normalizedStatus.toLowerCase() === 'resolved'

  const updateData: any = { status: normalizedStatus }
  if (shouldResolve) {
    updateData.resolved_at = new Date().toISOString()
  }

  await supabaseAdmin
    .from('reports')
    .update(updateData)
    .eq('report_id', id)

  const user = (req as any).user as { sub: string; role: string; name?: string }
  
  await supabaseAdmin
    .from('report_status_logs')
    .insert({
      report_id: Number(id),
      action: `Status updated to ${normalizedStatus}`,
      actor_type: user.role.toLowerCase(),
      actor_id: Number(user.sub),
      old_status: existing.status,
      new_status: normalizedStatus,
      remarks: remarks || null
    })

  await applyTrustTransition({
    citizenId: existing.citizen_id ? Number(existing.citizen_id) : null,
    reportId: Number(id),
    previousStatus: existing.status,
    newStatus: normalizedStatus,
    trustCreditApplied: Boolean(existing.trust_credit_applied),
    trustPenaltyApplied: Boolean(existing.trust_penalty_applied)
  })

  // Send email notification asynchronously (fire-and-forget)
  if (!existing.is_anonymous) {
    sendReportUpdateNotification({
      reportId: Number(id),
      message: remarks || null,
      newStatus: normalizedStatus,
      actorName: user.name || null
    }).catch(error => {
      console.error('Failed to send update notification email:', error)
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

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from('reports')
    .select('report_id, status, citizen_id, tracking_id, title, is_anonymous')
    .eq('report_id', id)
    .single()

  if (fetchError || !existing) {
    return res.status(404).json({ error: 'Report not found' })
  }

  const user = (req as any).user as { sub: string; role: string; name?: string }

  await supabaseAdmin
    .from('report_status_logs')
    .insert({
      report_id: Number(id),
      action: 'Department response recorded',
      actor_type: user.role.toLowerCase(),
      actor_id: Number(user.sub),
      old_status: existing.status,
      new_status: existing.status,
      remarks: message
    })

  // Send email notification asynchronously (fire-and-forget)
  if (!existing.is_anonymous) {
    sendReportUpdateNotification({
      reportId: Number(id),
      message,
      newStatus: null,
      actorName: user.name || null
    }).catch(error => {
      console.error('Failed to send update notification email:', error)
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

  let citizenId: number | null = null
  let isAnonymous = false
  let statusChanged = false
  let messageRecorded = false
  let trustCreditApplied = false
  let trustPenaltyApplied = false
  let previousStatus: string | null = null
  let currentStatus: string | null = null
  let trackingId: string | undefined
  let title: string | undefined

  try {
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('reports')
      .select('status, citizen_id, tracking_id, title, is_anonymous, trust_credit_applied, trust_penalty_applied')
      .eq('report_id', id)
      .single()

    if (fetchError || !existing) {
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
    trackingId = existing.tracking_id
    title = existing.title

    if (newStatus) {
      const shouldResolve = newStatus.toLowerCase() === 'resolved'
      const updateData: any = { status: newStatus }
      if (shouldResolve) {
        updateData.resolved_at = new Date().toISOString()
      }

      await supabaseAdmin
        .from('reports')
        .update(updateData)
        .eq('report_id', id)

      await supabaseAdmin
        .from('report_status_logs')
        .insert({
          report_id: Number(id),
          action: `Status updated to ${newStatus}`,
          actor_type: actorType,
          actor_id: actorId,
          old_status: currentStatus,
          new_status: newStatus,
          remarks: trimmedMessage || null
        })

      currentStatus = newStatus
      statusChanged = true
    }

    if (trimmedMessage && !newStatus) {
      await supabaseAdmin
        .from('report_status_logs')
        .insert({
          report_id: Number(id),
          action: 'Department response recorded',
          actor_type: actorType,
          actor_id: actorId,
          old_status: currentStatus,
          new_status: currentStatus,
          remarks: trimmedMessage
        })
      messageRecorded = true
    }

    const finalStatus = currentStatus ?? previousStatus ?? 'Pending'

    await applyTrustTransition({
      citizenId,
      reportId: Number(id),
      previousStatus,
      newStatus: finalStatus,
      trustCreditApplied,
      trustPenaltyApplied
    })
  } catch (err) {
    console.error('Error in actions endpoint:', err)
    return res.status(500).json({ error: 'Failed to process action' })
  }

  // Send email notification asynchronously (fire-and-forget)
  if (!isAnonymous) {
    sendReportUpdateNotification({
      reportId: Number(id),
      message: trimmedMessage || null,
      newStatus,
      actorName: user.name || null
    }).catch(error => {
      console.error('Failed to send update notification email:', error)
    })
  }

  if (citizenId && !isAnonymous) {
    if (statusChanged && newStatus) {
      await notifyCitizenOfStatusChange(Number(id), citizenId, newStatus, user.name, trackingId, title)
    } else if (messageRecorded && trimmedMessage) {
      await notifyCitizenOfResponse(Number(id), citizenId, user.name, trackingId, title)
    }
  }

  res.json({ ok: true })
})
