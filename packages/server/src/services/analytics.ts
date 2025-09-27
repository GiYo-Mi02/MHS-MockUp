import { pool } from '../db'

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
  const [rows] = await pool.query(
    `SELECT
        COUNT(*) AS totalReports,
        SUM(CASE WHEN status NOT IN ('Resolved', 'Cancelled') THEN 1 ELSE 0 END) AS activeReports,
        SUM(CASE WHEN status = 'Resolved' THEN 1 ELSE 0 END) AS resolvedReports,
        AVG(CASE WHEN resolved_at IS NOT NULL THEN TIMESTAMPDIFF(HOUR, created_at, resolved_at) END) AS avgResolutionHours,
        AVG(
          (SELECT TIMESTAMPDIFF(HOUR, r.created_at, l.created_at)
           FROM report_status_logs l
           WHERE l.report_id = r.report_id AND l.actor_type != 'citizen'
           ORDER BY l.created_at ASC
           LIMIT 1)
        ) AS avgFirstResponseHours,
        SUM(CASE
              WHEN status = 'Resolved'
               AND expected_resolution_hours IS NOT NULL
               AND resolved_at IS NOT NULL
               AND TIMESTAMPDIFF(HOUR, created_at, resolved_at) <= expected_resolution_hours
              THEN 1 ELSE 0 END) AS metSlaResolved,
        SUM(CASE
              WHEN status = 'Resolved'
               AND expected_resolution_hours IS NOT NULL
               AND resolved_at IS NOT NULL
               AND TIMESTAMPDIFF(HOUR, created_at, resolved_at) > expected_resolution_hours
              THEN 1 ELSE 0 END) AS breachSlaResolved
     FROM reports r
     WHERE r.created_at BETWEEN ? AND ?`,
    [range.from, range.to]
  )

  const row = (rows as any[])[0] || {}
  return {
    totalReports: Number(row.totalReports ?? 0),
    activeReports: Number(row.activeReports ?? 0),
    resolvedReports: Number(row.resolvedReports ?? 0),
    avgResolutionHours: row.avgResolutionHours !== null && row.avgResolutionHours !== undefined ? Number(row.avgResolutionHours) : null,
    avgFirstResponseHours:
      row.avgFirstResponseHours !== null && row.avgFirstResponseHours !== undefined ? Number(row.avgFirstResponseHours) : null,
    metSlaResolved: Number(row.metSlaResolved ?? 0),
    breachSlaResolved: Number(row.breachSlaResolved ?? 0)
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
  const [createdRows] = await pool.query(
    `SELECT DATE(created_at) AS day, COUNT(*) AS total
     FROM reports
     WHERE created_at BETWEEN ? AND ?
     GROUP BY DATE(created_at)
     ORDER BY day ASC`,
    [range.from, range.to]
  )

  const [resolvedRows] = await pool.query(
    `SELECT DATE(resolved_at) AS day, COUNT(*) AS total
     FROM reports
     WHERE resolved_at IS NOT NULL AND resolved_at BETWEEN ? AND ?
     GROUP BY DATE(resolved_at)
     ORDER BY day ASC`,
    [range.from, range.to]
  )

  const createdMap = new Map<string, number>()
  for (const row of createdRows as Array<{ day: Date | string; total: number }>) {
    const key = new Date(row.day).toISOString().slice(0, 10)
    createdMap.set(key, Number(row.total ?? 0))
  }

  const resolvedMap = new Map<string, number>()
  for (const row of resolvedRows as Array<{ day: Date | string; total: number }>) {
    const key = new Date(row.day).toISOString().slice(0, 10)
    resolvedMap.set(key, Number(row.total ?? 0))
  }

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
  const [rows] = await pool.query(
    `SELECT
        d.department_id AS id,
        d.name,
        COUNT(r.report_id) AS totalReports,
        SUM(CASE WHEN r.status NOT IN ('Resolved', 'Cancelled') THEN 1 ELSE 0 END) AS activeReports,
        SUM(CASE WHEN r.status = 'Resolved' THEN 1 ELSE 0 END) AS resolvedReports,
        AVG(CASE WHEN r.resolved_at IS NOT NULL THEN TIMESTAMPDIFF(HOUR, r.created_at, r.resolved_at) END) AS avgResolutionHours,
        AVG(
          (SELECT TIMESTAMPDIFF(HOUR, r.created_at, l.created_at)
           FROM report_status_logs l
           WHERE l.report_id = r.report_id AND l.actor_type != 'citizen'
           ORDER BY l.created_at ASC
           LIMIT 1)
        ) AS avgFirstResponseHours,
        SUM(CASE
              WHEN r.status = 'Resolved'
               AND r.expected_resolution_hours IS NOT NULL
               AND r.resolved_at IS NOT NULL
               AND TIMESTAMPDIFF(HOUR, r.created_at, r.resolved_at) <= r.expected_resolution_hours
              THEN 1 ELSE 0 END) AS metSlaResolved,
        SUM(CASE
              WHEN r.status = 'Resolved'
               AND r.expected_resolution_hours IS NOT NULL
               AND r.resolved_at IS NOT NULL
               AND TIMESTAMPDIFF(HOUR, r.created_at, r.resolved_at) > r.expected_resolution_hours
              THEN 1 ELSE 0 END) AS breachSlaResolved
     FROM departments d
     LEFT JOIN reports r
       ON r.assigned_department_id = d.department_id
      AND r.created_at BETWEEN ? AND ?
     GROUP BY d.department_id, d.name
     ORDER BY d.name ASC`,
    [range.from, range.to]
  )

  return (rows as any[]).map((row) => ({
    id: Number(row.id),
    name: row.name,
    totalReports: Number(row.totalReports ?? 0),
    activeReports: Number(row.activeReports ?? 0),
    resolvedReports: Number(row.resolvedReports ?? 0),
    avgResolutionHours:
      row.avgResolutionHours !== null && row.avgResolutionHours !== undefined ? Number(row.avgResolutionHours) : null,
    avgFirstResponseHours:
      row.avgFirstResponseHours !== null && row.avgFirstResponseHours !== undefined ? Number(row.avgFirstResponseHours) : null,
    metSlaResolved: Number(row.metSlaResolved ?? 0),
    breachSlaResolved: Number(row.breachSlaResolved ?? 0)
  }))
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

  const [rows] = await pool.query(
    `SELECT
        ROUND(location_lat, ?) AS lat,
        ROUND(location_lng, ?) AS lng,
        COUNT(*) AS totalReports,
        SUM(CASE WHEN status NOT IN ('Resolved', 'Cancelled') THEN 1 ELSE 0 END) AS activeReports,
        SUM(CASE WHEN status = 'Resolved' THEN 1 ELSE 0 END) AS resolvedReports
     FROM reports
     WHERE location_lat IS NOT NULL
       AND location_lng IS NOT NULL
       AND created_at BETWEEN ? AND ?
  GROUP BY ROUND(location_lat, ?), ROUND(location_lng, ?)
  ORDER BY totalReports DESC`,
    [decimals, decimals, range.from, range.to, decimals, decimals]
  )

  return (rows as any[]).map((row) => ({
    lat: Number(row.lat),
    lng: Number(row.lng),
    totalReports: Number(row.totalReports ?? 0),
    activeReports: Number(row.activeReports ?? 0),
    resolvedReports: Number(row.resolvedReports ?? 0)
  }))
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
  const [rows] = await pool.query(
    `SELECT
        category,
        COUNT(*) AS totalReports,
        SUM(CASE WHEN status NOT IN ('Resolved', 'Cancelled') THEN 1 ELSE 0 END) AS activeReports,
        SUM(CASE WHEN status = 'Resolved' THEN 1 ELSE 0 END) AS resolvedReports,
        AVG(CASE WHEN resolved_at IS NOT NULL THEN TIMESTAMPDIFF(HOUR, created_at, resolved_at) END) AS avgResolutionHours,
        AVG(
          (SELECT TIMESTAMPDIFF(HOUR, r.created_at, l.created_at)
           FROM report_status_logs l
           WHERE l.report_id = r.report_id AND l.actor_type != 'citizen'
           ORDER BY l.created_at ASC
           LIMIT 1)
        ) AS avgFirstResponseHours,
        SUM(CASE
              WHEN status = 'Resolved'
               AND expected_resolution_hours IS NOT NULL
               AND resolved_at IS NOT NULL
               AND TIMESTAMPDIFF(HOUR, created_at, resolved_at) <= expected_resolution_hours
              THEN 1 ELSE 0 END) AS metSlaResolved,
        SUM(CASE
              WHEN status = 'Resolved'
               AND expected_resolution_hours IS NOT NULL
               AND resolved_at IS NOT NULL
               AND TIMESTAMPDIFF(HOUR, created_at, resolved_at) > expected_resolution_hours
              THEN 1 ELSE 0 END) AS breachSlaResolved
     FROM reports r
     WHERE r.created_at BETWEEN ? AND ?
     GROUP BY category
     ORDER BY totalReports DESC`,
    [range.from, range.to]
  )

  return (rows as any[]).map((row) => ({
    category: row.category,
    totalReports: Number(row.totalReports ?? 0),
    activeReports: Number(row.activeReports ?? 0),
    resolvedReports: Number(row.resolvedReports ?? 0),
    avgResolutionHours:
      row.avgResolutionHours !== null && row.avgResolutionHours !== undefined ? Number(row.avgResolutionHours) : null,
    avgFirstResponseHours:
      row.avgFirstResponseHours !== null && row.avgFirstResponseHours !== undefined ? Number(row.avgFirstResponseHours) : null,
    metSlaResolved: Number(row.metSlaResolved ?? 0),
    breachSlaResolved: Number(row.breachSlaResolved ?? 0)
  }))
}