import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../../../supabase'
import { requireRole, type TokenPayload } from '../../../auth'
import { sendReportUpdateNotification } from '../../../services/report-email'
import { notifyCitizenOfStatusChange, notifyCitizenOfResponse } from '../../../services/notifications'
import { applyTrustTransition } from '../../../services/trust'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,PATCH,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const { id, action } = req.query

  try {
    // Handle specific actions
    if (action === 'status') {
      return handleStatusUpdate(req, res, String(id))
    } else if (action === 'respond') {
      return handleRespond(req, res, String(id))
    } else if (action === 'actions') {
      return handleActions(req, res, String(id))
    }

    // Default: get report by ID (for authenticated users)
    return res.status(404).json({ error: 'Unknown action' })
  } catch (error) {
    console.error('Reports API error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

async function handleStatusUpdate(req: VercelRequest, res: VercelResponse, id: string) {
  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const user = requireRole(req, res, 'STAFF', 'ADMIN')
  if (!user) return

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

  // Send email notification asynchronously
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
}

async function handleRespond(req: VercelRequest, res: VercelResponse, id: string) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const user = requireRole(req, res, 'STAFF', 'ADMIN')
  if (!user) return

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

  // Send email notification asynchronously
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
}

async function handleActions(req: VercelRequest, res: VercelResponse, id: string) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const user = requireRole(req, res, 'STAFF', 'ADMIN')
  if (!user) return

  const { message, status } = req.body || {}

  const trimmedMessage = typeof message === 'string' ? message.trim() : ''
  const newStatus = typeof status === 'string' && status.trim() ? status.trim() : null

  if (!trimmedMessage && !newStatus) {
    return res.status(400).json({ error: 'Provide a message or status update.' })
  }

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

  // Send email notification asynchronously
  if (!isAnonymous) {
    sendReportUpdateNotification({
      reportId: Number(id),
      message: trimmedMessage || null,
      newStatus,
      actorName: user.name || null
    }).catch((error: unknown) => {
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
}
