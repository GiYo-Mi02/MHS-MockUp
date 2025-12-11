import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../../../supabase'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { trackingId } = req.query

  try {
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
      department: (department as any)?.name,
      departmentEmail: (department as any)?.contact_email,
      departmentContact: (department as any)?.contact_number,
      logs: (logs || []).map((l: any) => ({
        action: l.action,
        actorType: l.actor_type,
        actorId: l.actor_id,
        oldStatus: l.old_status,
        newStatus: l.new_status,
        remarks: l.remarks,
        created_at: l.created_at
      })),
      evidence: (evidence || []).map((e: any) => ({
        id: e.evidence_id,
        fileUrl: e.file_url,
        fileType: e.file_type,
        uploaded_at: e.uploaded_at
      }))
    }

    res.json(formattedReport)
  } catch (error) {
    console.error('Track report API error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}
