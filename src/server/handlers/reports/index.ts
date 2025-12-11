import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../../supabase'
import { requireAuth, getTokenFromCookies, verifyToken } from '../../auth'
import { sendReportSubmissionReceipt } from '../../services/report-email'
import { notifyDepartmentOfNewReport } from '../../services/notifications'
import { getTrustMetadata, getInitialStatusForTrust, type TrustLevel } from '../../services/trust'
import { uploadEvidenceImage } from '../../services/storage'

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb'
    }
  }
}

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  try {
    if (req.method === 'POST') {
      return handleCreateReport(req, res)
    }

    if (req.method === 'GET') {
      return handleGetReportHistory(req, res)
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('Reports API error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

async function handleCreateReport(req: VercelRequest, res: VercelResponse) {
  // Handle both multipart/form-data and JSON
  const body = req.body || {}
  const files = (req as any).files || []
  
  console.log('[reports] Received request:', {
    method: req.method,
    contentType: req.headers['content-type'],
    bodyKeys: Object.keys(body),
    filesCount: files.length
  })
  
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

  console.log('[reports] Parsed fields:', {
    title,
    description: description.substring(0, 50) + '...',
    category,
    citizenId,
    hasLocation: !!locationLat && !!locationLng
  })

  if (!title || !description || !category) {
    console.error('[reports] Missing required fields:', { title: !!title, description: !!description, category: !!category })
    return res.status(400).json({ error: 'Missing required fields: title, description, and category are required' })
  }

  // For file uploads, we need multipart form handling - simplified here
  const uploadedEvidence: Array<{ fileUrl: string; fileType: string }> = []

  const { data: department, error: deptError } = await supabaseAdmin
    .from('departments')
    .select('department_id')
    .eq('code', category)
    .single()

  if (deptError || !department) {
    return res.status(400).json({ error: 'Invalid category/department' })
  }

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

  // Notify department staff of new report
  notifyDepartmentOfNewReport(
    reportId,
    department.department_id,
    title,
    isAnonymous ? undefined : citizenName,
    trackingId,
    {
      requiresManualReview,
      trustLevel: citizenTrustLevel ?? undefined
    }
  ).catch(err => console.error('Failed to notify department:', err))

  // Send email asynchronously
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
}

async function handleGetReportHistory(req: VercelRequest, res: VercelResponse) {
  const token = getTokenFromCookies(req)
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  const user = verifyToken(token)
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

  const formattedReports = (reports || []).map((r: any) => ({
    id: r.report_id,
    trackingId: r.tracking_id,
    status: r.status,
    createdAt: r.created_at,
    isAnonymous: r.is_anonymous,
    requiresManualReview: r.requires_manual_review
  }))

  res.json(formattedReports)
}
