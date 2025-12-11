import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../../supabase'
import { requireRole, type TokenPayload } from '../../auth'

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

  const user = requireRole(req, res, 'STAFF', 'ADMIN')
  if (!user) return

  const { type } = req.query

  try {
    if (type === 'department') {
      return handleDepartmentQueue(req, res, user)
    } else if (type === 'stats') {
      return handleDepartmentStats(req, res, user)
    }

    return res.status(404).json({ error: 'Unknown dashboard type' })
  } catch (error) {
    console.error('Dashboard API error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}

async function handleDepartmentQueue(req: VercelRequest, res: VercelResponse, user: TokenPayload) {
  const departmentId = user.role === 'ADMIN' ? Number(req.query.departmentId) || null : user.departmentId || null
  if (!departmentId) {
    return res.status(400).json({ error: 'Missing departmentId' })
  }

  const parsedPage = Number(req.query.page)
  const parsedPageSize = Number(req.query.pageSize)
  const pageSize = Math.min(Math.max(Number.isFinite(parsedPageSize) && parsedPageSize > 0 ? parsedPageSize : 5, 1), 5)
  const requestedPage = Math.max(Number.isFinite(parsedPage) && parsedPage ? parsedPage : 1, 1)
  const searchTermRaw = typeof req.query.search === 'string' ? req.query.search.trim() : ''
  const searchTerm = searchTermRaw.slice(0, 100)

  const likeTerm = `%${searchTerm}%`

  let countQuery = supabaseAdmin
    .from('reports')
    .select('report_id', { count: 'exact', head: true })
    .eq('assigned_department_id', departmentId)

  let dataQuery = supabaseAdmin
    .from('reports')
    .select(`
      report_id,
      tracking_id,
      title,
      category,
      description,
      status,
      requires_manual_review,
      urgency_level,
      created_at,
      assigned_at,
      resolved_at,
      expected_resolution_hours,
      location_address,
      location_lat,
      location_lng,
      is_anonymous,
      citizens:citizen_id (
        full_name,
        email,
        contact_number
      )
    `)
    .eq('assigned_department_id', departmentId)

  if (searchTerm) {
    const searchFilter = `tracking_id.ilike.${likeTerm},title.ilike.${likeTerm},category.ilike.${likeTerm}`
    countQuery = countQuery.or(searchFilter)
    dataQuery = dataQuery.or(searchFilter)
  }

  const { count: total, error: countError } = await countQuery

  if (countError) {
    console.error('Error counting reports:', countError)
    return res.status(500).json({ error: 'Failed to count reports' })
  }

  const totalCount = total || 0
  const totalPages = totalCount === 0 ? 1 : Math.max(1, Math.ceil(totalCount / pageSize))

  let page = Math.min(requestedPage, totalPages)
  if (page < 1) page = 1
  const offset = (page - 1) * pageSize

  const { data: rawRows, error: dataError } = await dataQuery
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1)

  if (dataError) {
    console.error('Error fetching reports:', dataError)
    return res.status(500).json({ error: 'Failed to fetch reports' })
  }

  const rows = (rawRows || []).map((r: any) => {
    const citizen = Array.isArray(r.citizens) ? r.citizens[0] : r.citizens
    return {
      id: r.report_id,
      trackingId: r.tracking_id,
      title: r.title,
      category: r.category,
      description: r.description,
      status: r.status,
      requiresManualReview: r.requires_manual_review,
      urgency: r.urgency_level,
      createdAt: r.created_at,
      assignedAt: r.assigned_at,
      resolvedAt: r.resolved_at,
      expectedResolutionHours: r.expected_resolution_hours,
      locationAddress: r.location_address,
      locationLat: r.location_lat,
      locationLng: r.location_lng,
      isAnonymous: r.is_anonymous,
      citizenName: r.is_anonymous ? null : citizen?.full_name,
      citizenEmail: r.is_anonymous ? null : citizen?.email,
      citizenContact: r.is_anonymous ? null : citizen?.contact_number
    }
  })

  res.json({
    items: rows,
    page,
    pageSize,
    total: totalCount,
    totalPages,
    search: searchTerm
  })
}

async function handleDepartmentStats(req: VercelRequest, res: VercelResponse, user: TokenPayload) {
  const departmentId = user.role === 'ADMIN' ? Number(req.query.departmentId) || null : user.departmentId || null
  if (!departmentId) {
    return res.status(400).json({ error: 'Missing departmentId' })
  }

  const { data: allReports, error: reportsError } = await supabaseAdmin
    .from('reports')
    .select('report_id, status, created_at, resolved_at, expected_resolution_hours')
    .eq('assigned_department_id', departmentId)

  if (reportsError) {
    console.error('Error fetching reports for stats:', reportsError)
    return res.status(500).json({ error: 'Failed to fetch statistics' })
  }

  const statusMap = new Map<string, number>()
  const reports = allReports || []

  reports.forEach((r: any) => {
    const count = statusMap.get(r.status) || 0
    statusMap.set(r.status, count + 1)
  })

  const statusCounts = Array.from(statusMap.entries()).map(([status, total]) => ({
    status,
    total
  }))

  // Calculate SLA metrics
  let metSlaCount = 0
  let breachSlaCount = 0

  reports.forEach((r: any) => {
    if (r.status === 'Resolved' && r.expected_resolution_hours && r.resolved_at && r.created_at) {
      const created = new Date(r.created_at).getTime()
      const resolved = new Date(r.resolved_at).getTime()
      const hours = (resolved - created) / (1000 * 60 * 60)

      if (hours <= r.expected_resolution_hours) {
        metSlaCount++
      } else {
        breachSlaCount++
      }
    }
  })

  res.json({
    statusCounts,
    totalReports: reports.length,
    metSlaResolved: metSlaCount,
    breachSlaResolved: breachSlaCount
  })
}
