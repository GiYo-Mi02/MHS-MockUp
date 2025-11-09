import { supabaseAdmin } from '../supabase'

export type DateRange = {
  from: Date
  to: Date
  days: number
}

const DEFAULT_WINDOW_DAYS = 30
const MAX_WINDOW_DAYS = 180
const DEFAULT_HEATMAP_PRECISION = 3
const MIN_HEATMAP_PRECISION = 2
const MAX_HEATMAP_PRECISION = 5

function clampWindowDays(value: number | undefined): number {
  if (!value || !Number.isFinite(value)) return DEFAULT_WINDOW_DAYS
  const normalized = Math.round(value)
  if (normalized < 1) return 1
  if (normalized > MAX_WINDOW_DAYS) return MAX_WINDOW_DAYS
  return normalized
}

function normalizeDateInput(value: unknown): Date | null {
  if (typeof value !== 'string') return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

function clampPrecision(value: number | undefined): number {
  if (!value || !Number.isFinite(value)) return DEFAULT_HEATMAP_PRECISION
  const normalized = Math.round(value)
  if (normalized < MIN_HEATMAP_PRECISION) return MIN_HEATMAP_PRECISION
  if (normalized > MAX_HEATMAP_PRECISION) return MAX_HEATMAP_PRECISION
  return normalized
}

export function resolveDateRange(query: Record<string, unknown>): DateRange {
  const now = new Date()
  const toParam = normalizeDateInput(query.to)
  const fromParam = normalizeDateInput(query.from)
  const windowDays = clampWindowDays(Number(query.days))

  const endInput = toParam ?? now
  let endCandidate = new Date(endInput.getTime())

  let startCandidate: Date
  if (fromParam) {
    startCandidate = new Date(fromParam.getTime())
  } else {
    startCandidate = new Date(endCandidate.getTime())
    startCandidate.setHours(0, 0, 0, 0)
    startCandidate.setDate(startCandidate.getDate() - (windowDays - 1))
  }

  if (startCandidate > endCandidate) {
    const originalStart = new Date(startCandidate.getTime())
    startCandidate = new Date(endCandidate.getTime())
    endCandidate = originalStart
  }

  startCandidate.setHours(0, 0, 0, 0)
  endCandidate.setHours(23, 59, 59, 999)

  const diffDays =
    Math.max(1, Math.round((endCandidate.getTime() - startCandidate.getTime()) / (1000 * 60 * 60 * 24)) + 1)

  return { from: startCandidate, to: endCandidate, days: diffDays }
}

export type SummaryMetrics = {
  totalReports: number
  activeReports: number
  resolvedReports: number
  avgResolutionHours: number | null
  avgFirstResponseHours: number | null
  metSlaResolved: number
  breachSlaResolved: number
}

export async function getSummaryMetrics(range: DateRange): Promise<SummaryMetrics> {
  const { data: reports, error } = await supabaseAdmin
    .from('reports')
    .select('report_id, status, created_at, resolved_at, expected_resolution_hours')
    .gte('created_at', range.from.toISOString())
    .lte('created_at', range.to.toISOString())

  if (error) {
    console.error('Error fetching summary metrics:', error)
    throw new Error('Failed to fetch summary metrics')
  }

  const allReports = reports || []
  const totalReports = allReports.length
  const activeReports = allReports.filter(r => r.status !== 'Resolved' && r.status !== 'Cancelled').length
  const resolvedReports = allReports.filter(r => r.status === 'Resolved').length

  // Calculate average resolution hours
  const resolvedWithTimes = allReports.filter(r => r.resolved_at && r.created_at)
  const avgResolutionHours = resolvedWithTimes.length > 0
    ? resolvedWithTimes.reduce((sum, r) => {
        const created = new Date(r.created_at).getTime()
        const resolved = new Date(r.resolved_at!).getTime()
        const hours = (resolved - created) / (1000 * 60 * 60)
        return sum + hours
      }, 0) / resolvedWithTimes.length
    : null

  // Calculate SLA metrics
  const metSlaResolved = allReports.filter(r => {
    if (r.status !== 'Resolved' || !r.expected_resolution_hours || !r.resolved_at || !r.created_at) return false
    const created = new Date(r.created_at).getTime()
    const resolved = new Date(r.resolved_at).getTime()
    const hours = (resolved - created) / (1000 * 60 * 60)
    return hours <= r.expected_resolution_hours
  }).length

  const breachSlaResolved = allReports.filter(r => {
    if (r.status !== 'Resolved' || !r.expected_resolution_hours || !r.resolved_at || !r.created_at) return false
    const created = new Date(r.created_at).getTime()
    const resolved = new Date(r.resolved_at).getTime()
    const hours = (resolved - created) / (1000 * 60 * 60)
    return hours > r.expected_resolution_hours
  }).length

  // For avgFirstResponseHours, we need to query status logs - simplified for now
  // This would require fetching all status logs which might be expensive
  const avgFirstResponseHours = null // TODO: Implement if needed

  return {
    totalReports,
    activeReports,
    resolvedReports,
    avgResolutionHours,
    avgFirstResponseHours,
    metSlaResolved,
    breachSlaResolved
  }
}

export type TimeseriesPoint = {
  day: string
  created: number
  resolved: number
}

function buildDaySequence(range: DateRange): string[] {
  const days: string[] = []
  const cursor = new Date(range.from)
  while (cursor <= range.to) {
    days.push(cursor.toISOString().slice(0, 10))
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}

export async function getTimeseries(range: DateRange): Promise<TimeseriesPoint[]> {
  const { data: reports, error } = await supabaseAdmin
    .from('reports')
    .select('created_at, resolved_at')
    .gte('created_at', range.from.toISOString())
    .lte('created_at', range.to.toISOString())

  if (error) {
    console.error('Error fetching timeseries:', error)
    throw new Error('Failed to fetch timeseries')
  }

  const createdMap = new Map<string, number>()
  const resolvedMap = new Map<string, number>()

  ;(reports || []).forEach(r => {
    const createdDay = r.created_at.split('T')[0]
    createdMap.set(createdDay, (createdMap.get(createdDay) || 0) + 1)

    if (r.resolved_at) {
      const resolvedDate = new Date(r.resolved_at)
      if (resolvedDate >= range.from && resolvedDate <= range.to) {
        const resolvedDay = r.resolved_at.split('T')[0]
        resolvedMap.set(resolvedDay, (resolvedMap.get(resolvedDay) || 0) + 1)
      }
    }
  })

  return buildDaySequence(range).map((day) => ({
    day,
    created: createdMap.get(day) ?? 0,
    resolved: resolvedMap.get(day) ?? 0
  }))
}

export type DepartmentMetric = {
  id: number
  name: string
  totalReports: number
  activeReports: number
  resolvedReports: number
  avgResolutionHours: number | null
  avgFirstResponseHours: number | null
  metSlaResolved: number
  breachSlaResolved: number
}

export async function getDepartmentMetrics(range: DateRange): Promise<DepartmentMetric[]> {
  const { data: departments, error: deptError } = await supabaseAdmin
    .from('departments')
    .select('department_id, name')
    .order('name', { ascending: true })

  if (deptError) {
    console.error('Error fetching departments:', deptError)
    throw new Error('Failed to fetch departments')
  }

  const { data: reports, error: reportsError } = await supabaseAdmin
    .from('reports')
    .select('report_id, assigned_department_id, status, created_at, resolved_at, expected_resolution_hours')
    .gte('created_at', range.from.toISOString())
    .lte('created_at', range.to.toISOString())

  if (reportsError) {
    console.error('Error fetching reports:', reportsError)
    throw new Error('Failed to fetch reports')
  }

  // Group reports by department
  const deptReports = new Map<number, typeof reports>()
  ;(reports || []).forEach(r => {
    const deptId = r.assigned_department_id
    if (!deptReports.has(deptId)) {
      deptReports.set(deptId, [])
    }
    deptReports.get(deptId)!.push(r)
  })

  return (departments || []).map(dept => {
    const deptData = deptReports.get(dept.department_id) || []
    const totalReports = deptData.length
    const activeReports = deptData.filter(r => r.status !== 'Resolved' && r.status !== 'Cancelled').length
    const resolvedReports = deptData.filter(r => r.status === 'Resolved').length

    const resolvedWithTimes = deptData.filter(r => r.resolved_at && r.created_at)
    const avgResolutionHours = resolvedWithTimes.length > 0
      ? resolvedWithTimes.reduce((sum, r) => {
          const created = new Date(r.created_at).getTime()
          const resolved = new Date(r.resolved_at!).getTime()
          const hours = (resolved - created) / (1000 * 60 * 60)
          return sum + hours
        }, 0) / resolvedWithTimes.length
      : null

    const metSlaResolved = deptData.filter(r => {
      if (r.status !== 'Resolved' || !r.expected_resolution_hours || !r.resolved_at || !r.created_at) return false
      const created = new Date(r.created_at).getTime()
      const resolved = new Date(r.resolved_at).getTime()
      const hours = (resolved - created) / (1000 * 60 * 60)
      return hours <= r.expected_resolution_hours
    }).length

    const breachSlaResolved = deptData.filter(r => {
      if (r.status !== 'Resolved' || !r.expected_resolution_hours || !r.resolved_at || !r.created_at) return false
      const created = new Date(r.created_at).getTime()
      const resolved = new Date(r.resolved_at).getTime()
      const hours = (resolved - created) / (1000 * 60 * 60)
      return hours > r.expected_resolution_hours
    }).length

    return {
      id: dept.department_id,
      name: dept.name,
      totalReports,
      activeReports,
      resolvedReports,
      avgResolutionHours,
      avgFirstResponseHours: null, // TODO: Implement if needed
      metSlaResolved,
      breachSlaResolved
    }
  })
}

export type HeatmapBucket = {
  lat: number
  lng: number
  totalReports: number
  activeReports: number
  resolvedReports: number
}

export async function getHeatmapBuckets(range: DateRange, precision?: number): Promise<HeatmapBucket[]> {
  const decimals = clampPrecision(precision)

  const { data: reports, error } = await supabaseAdmin
    .from('reports')
    .select('report_id, location_lat, location_lng, status')
    .not('location_lat', 'is', null)
    .not('location_lng', 'is', null)
    .gte('created_at', range.from.toISOString())
    .lte('created_at', range.to.toISOString())

  if (error) {
    console.error('Error fetching heatmap data:', error)
    throw new Error('Failed to fetch heatmap data')
  }

  // Group by rounded coordinates
  const bucketMap = new Map<string, { totalReports: number; activeReports: number; resolvedReports: number }>()

  ;(reports || []).forEach(r => {
    const lat = Number(r.location_lat).toFixed(decimals)
    const lng = Number(r.location_lng).toFixed(decimals)
    const key = `${lat},${lng}`

    if (!bucketMap.has(key)) {
      bucketMap.set(key, { totalReports: 0, activeReports: 0, resolvedReports: 0 })
    }

    const bucket = bucketMap.get(key)!
    bucket.totalReports++
    if (r.status !== 'Resolved' && r.status !== 'Cancelled') {
      bucket.activeReports++
    }
    if (r.status === 'Resolved') {
      bucket.resolvedReports++
    }
  })

  const buckets = Array.from(bucketMap.entries()).map(([key, data]) => {
    const [lat, lng] = key.split(',').map(Number)
    return {
      lat,
      lng,
      ...data
    }
  })

  // Sort by totalReports descending
  buckets.sort((a, b) => b.totalReports - a.totalReports)

  return buckets
}

export type CategoryMetric = {
  category: string
  totalReports: number
  activeReports: number
  resolvedReports: number
  avgResolutionHours: number | null
  avgFirstResponseHours: number | null
  metSlaResolved: number
  breachSlaResolved: number
}

export async function getCategoryMetrics(range: DateRange): Promise<CategoryMetric[]> {
  const { data: reports, error } = await supabaseAdmin
    .from('reports')
    .select('report_id, category, status, created_at, resolved_at, expected_resolution_hours')
    .gte('created_at', range.from.toISOString())
    .lte('created_at', range.to.toISOString())

  if (error) {
    console.error('Error fetching category metrics:', error)
    throw new Error('Failed to fetch category metrics')
  }

  // Group by category
  const categoryMap = new Map<string, typeof reports>()
  ;(reports || []).forEach(r => {
    if (!categoryMap.has(r.category)) {
      categoryMap.set(r.category, [])
    }
    categoryMap.get(r.category)!.push(r)
  })

  const metrics = Array.from(categoryMap.entries()).map(([category, categoryData]) => {
    const totalReports = categoryData.length
    const activeReports = categoryData.filter(r => r.status !== 'Resolved' && r.status !== 'Cancelled').length
    const resolvedReports = categoryData.filter(r => r.status === 'Resolved').length

    const resolvedWithTimes = categoryData.filter(r => r.resolved_at && r.created_at)
    const avgResolutionHours = resolvedWithTimes.length > 0
      ? resolvedWithTimes.reduce((sum, r) => {
          const created = new Date(r.created_at).getTime()
          const resolved = new Date(r.resolved_at!).getTime()
          const hours = (resolved - created) / (1000 * 60 * 60)
          return sum + hours
        }, 0) / resolvedWithTimes.length
      : null

    const metSlaResolved = categoryData.filter(r => {
      if (r.status !== 'Resolved' || !r.expected_resolution_hours || !r.resolved_at || !r.created_at) return false
      const created = new Date(r.created_at).getTime()
      const resolved = new Date(r.resolved_at).getTime()
      const hours = (resolved - created) / (1000 * 60 * 60)
      return hours <= r.expected_resolution_hours
    }).length

    const breachSlaResolved = categoryData.filter(r => {
      if (r.status !== 'Resolved' || !r.expected_resolution_hours || !r.resolved_at || !r.created_at) return false
      const created = new Date(r.created_at).getTime()
      const resolved = new Date(r.resolved_at).getTime()
      const hours = (resolved - created) / (1000 * 60 * 60)
      return hours > r.expected_resolution_hours
    }).length

    return {
      category,
      totalReports,
      activeReports,
      resolvedReports,
      avgResolutionHours,
      avgFirstResponseHours: null, // TODO: Implement if needed
      metSlaResolved,
      breachSlaResolved
    }
  })

  // Sort by totalReports descending
  metrics.sort((a, b) => b.totalReports - a.totalReports)

  return metrics
}