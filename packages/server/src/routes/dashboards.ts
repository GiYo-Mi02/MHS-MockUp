import { Router, Request, Response } from 'express'
import { supabaseAdmin } from '../supabase'
import { requireAuth, requireRole } from '../auth'
import { cacheStats } from '../middleware/cache'

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

  // Build filters
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

  // Apply search filters if provided
  if (searchTerm) {
    const searchFilter = `tracking_id.ilike.${likeTerm},title.ilike.${likeTerm},category.ilike.${likeTerm}`
    countQuery = countQuery.or(searchFilter)
    dataQuery = dataQuery.or(searchFilter)
  }

  // Get total count
  const { count: total, error: countError } = await countQuery

  if (countError) {
    console.error('Error counting reports:', countError)
    return res.status(500).json({ error: 'Failed to count reports' })
  }

  const totalCount = total || 0
  const totalPages = totalCount === 0 ? 1 : Math.max(1, Math.ceil(totalCount / pageSize))

  let page = Math.min(requestedPage, totalPages)
  if (page < 1) page = 1
  let offset = (page - 1) * pageSize

  // Fetch data
  const { data: rawRows, error: dataError } = await dataQuery
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1)

  if (dataError) {
    console.error('Error fetching reports:', dataError)
    return res.status(500).json({ error: 'Failed to fetch reports' })
  }

  // Adjust page if offset exceeds total
  if (totalCount > 0 && offset >= totalCount) {
    page = totalPages
    offset = (page - 1) * pageSize
    
    const { data: adjustedRows, error: adjustedError } = await dataQuery
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1)

    if (adjustedError) {
      console.error('Error fetching adjusted reports:', adjustedError)
      return res.status(500).json({ error: 'Failed to fetch reports' })
    }

    const rows = (adjustedRows || []).map(r => {
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

    return res.json({
      items: rows,
      page,
      pageSize,
      total: totalCount,
      totalPages,
      search: searchTerm
    })
  }

  const rows = (rawRows || []).map(r => {
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
})

// Apply caching to stats endpoint (30 second TTL)
dashboardsRouter.get('/department/stats', requireAuth, requireRole('STAFF', 'ADMIN'), cacheStats, async (req: Request, res: Response) => {
  const user = (req as any).user as { departmentId?: number; role: string }
  const departmentId = user.role === 'ADMIN' ? Number(req.query.departmentId) || null : user.departmentId || null
  if (!departmentId) return res.status(400).json({ error: 'Missing departmentId' })

  // Get status counts
  const { data: allReports, error: reportsError } = await supabaseAdmin
    .from('reports')
    .select('report_id, status, created_at, resolved_at, expected_resolution_hours')
    .eq('assigned_department_id', departmentId)

  if (reportsError) {
    console.error('Error fetching reports for stats:', reportsError)
    return res.status(500).json({ error: 'Failed to fetch statistics' })
  }

  // Calculate status counts
  const statusMap = new Map<string, number>()
  const reports = allReports || []
  
  reports.forEach(r => {
    const count = statusMap.get(r.status) || 0
    statusMap.set(r.status, count + 1)
  })

  const statusCounts = Array.from(statusMap.entries()).map(([status, total]) => ({
    status,
    total
  }))

  // Calculate overview stats
  const totalReports = reports.length
  const resolvedReports = reports.filter(r => r.status === 'Resolved').length
  
  const resolvedWithTimes = reports.filter(r => r.resolved_at && r.created_at)
  const avgResolutionHours = resolvedWithTimes.length > 0
    ? resolvedWithTimes.reduce((sum, r) => {
        const created = new Date(r.created_at).getTime()
        const resolved = new Date(r.resolved_at!).getTime()
        const hours = (resolved - created) / (1000 * 60 * 60)
        return sum + hours
      }, 0) / resolvedWithTimes.length
    : null

  const metSla = reports.filter(r => {
    if (!r.expected_resolution_hours || !r.resolved_at || !r.created_at) return false
    const created = new Date(r.created_at).getTime()
    const resolved = new Date(r.resolved_at).getTime()
    const hours = (resolved - created) / (1000 * 60 * 60)
    return hours <= r.expected_resolution_hours
  }).length

  const overview = {
    totalReports,
    resolvedReports,
    avgResolutionHours,
    metSla
  }

  // Get recent trends (last 14 days)
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
  
  const { data: recentReports, error: trendsError } = await supabaseAdmin
    .from('reports')
    .select('created_at')
    .eq('assigned_department_id', departmentId)
    .gte('created_at', fourteenDaysAgo)
    .order('created_at', { ascending: true })

  if (trendsError) {
    console.error('Error fetching trends:', trendsError)
    return res.status(500).json({ error: 'Failed to fetch trends' })
  }

  // Group by day
  const dayMap = new Map<string, number>()
  ;(recentReports || []).forEach(r => {
    const day = r.created_at.split('T')[0]
    const count = dayMap.get(day) || 0
    dayMap.set(day, count + 1)
  })

  const recentTrends = Array.from(dayMap.entries()).map(([day, total]) => ({
    day,
    total
  })).sort((a, b) => a.day.localeCompare(b.day))

  res.json({ statusCounts, overview, recentTrends })
})

// Admin overview: counts by department / status
dashboardsRouter.get('/admin/overview', requireAuth, requireRole('ADMIN'), async (_req: Request, res: Response) => {
  // Get all departments with report counts
  const { data: departments, error: deptError } = await supabaseAdmin
    .from('departments')
    .select('department_id, name')
    .order('name', { ascending: true })

  if (deptError) {
    console.error('Error fetching departments:', deptError)
    return res.status(500).json({ error: 'Failed to fetch departments' })
  }

  const { data: reports, error: reportsError } = await supabaseAdmin
    .from('reports')
    .select('report_id, assigned_department_id, status, location_lat, location_lng')

  if (reportsError) {
    console.error('Error fetching reports:', reportsError)
    return res.status(500).json({ error: 'Failed to fetch reports' })
  }

  // Count reports by department
  const deptCounts = new Map<number, number>()
  ;(reports || []).forEach(r => {
    const count = deptCounts.get(r.assigned_department_id) || 0
    deptCounts.set(r.assigned_department_id, count + 1)
  })

  const byDept = (departments || []).map(d => ({
    id: d.department_id,
    name: d.name,
    total: deptCounts.get(d.department_id) || 0
  }))

  // Count by status
  const statusCounts = new Map<string, number>()
  ;(reports || []).forEach(r => {
    const count = statusCounts.get(r.status) || 0
    statusCounts.set(r.status, count + 1)
  })

  const byStatus = Array.from(statusCounts.entries()).map(([status, total]) => ({
    status,
    total
  }))

  // Get recent reports with location
  const { data: recentReportsData, error: recentError } = await supabaseAdmin
    .from('reports')
    .select('report_id, tracking_id, title, category, status, location_lat, location_lng, created_at')
    .not('location_lat', 'is', null)
    .not('location_lng', 'is', null)
    .order('created_at', { ascending: false })
    .limit(200)

  if (recentError) {
    console.error('Error fetching recent reports:', recentError)
    return res.status(500).json({ error: 'Failed to fetch recent reports' })
  }

  const recentReports = (recentReportsData || []).map(r => ({
    id: r.report_id,
    trackingId: r.tracking_id,
    title: r.title,
    category: r.category,
    status: r.status,
    locationLat: r.location_lat,
    locationLng: r.location_lng,
    createdAt: r.created_at
  }))

  res.json({ byDept, byStatus, recentReports })
})
