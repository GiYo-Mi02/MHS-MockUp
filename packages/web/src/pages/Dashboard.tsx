import { Routes, Route, Link, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { ResponsiveContainer, ComposedChart, CartesianGrid, XAxis, YAxis, Line, Tooltip, type TooltipProps } from 'recharts'
import { ReportsMap, type ReportPoint } from '@/components/maps/ReportsMap'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api'
import { useToast } from '@/lib/toast'

type DepartmentReport = {
  id: number
  trackingId: string
  title: string
  category: string
  description: string
  status: string
  requiresManualReview: boolean
  urgency: string
  createdAt: string
  assignedAt: string | null
  resolvedAt: string | null
  expectedResolutionHours: number | null
  isAnonymous: boolean
  citizenName: string | null
  citizenEmail: string | null
  citizenContact: string | null
  locationAddress: string | null
  locationLat: number | null
  locationLng: number | null
}

type DepartmentStats = {
  statusCounts: Array<{ status: string; total: number }>
  overview: null | {
    totalReports: number | null
    resolvedReports: number | null
    avgResolutionHours: number | null
    metSla: number | null
  }
  recentTrends: Array<{ day: string; total: number }>
}

type DepartmentQueueResponse = {
  items: DepartmentReport[]
  page: number
  pageSize: number
  total: number
  totalPages: number
  search?: string
}

type ReportLog = {
  created_at: string
  action: string | null
  newStatus: string | null
  remarks: string | null
}

type ReportEvidence = {
  id: number
  fileUrl: string
  fileType: string | null
  uploaded_at?: string
}

type AnalyticsRange = {
  from: string
  to: string
  days: number
}

type AnalyticsSummary = {
  totalReports: number
  activeReports: number
  resolvedReports: number
  avgResolutionHours: number | null
  avgFirstResponseHours: number | null
  metSlaResolved: number
  breachSlaResolved: number
}

type AnalyticsTimeseriesPoint = {
  day: string
  created: number
  resolved: number
}

type AnalyticsDepartmentMetric = {
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

type AnalyticsCategoryMetric = {
  category: string
  totalReports: number
  activeReports: number
  resolvedReports: number
  avgResolutionHours: number | null
  avgFirstResponseHours: number | null
  metSlaResolved: number
  breachSlaResolved: number
}

type AnalyticsHeatmapBucket = {
  lat: number
  lng: number
  totalReports: number
  activeReports: number
  resolvedReports: number
}

type AnalyticsState = {
  range: AnalyticsRange | null
  summary: AnalyticsSummary | null
  timeseries: AnalyticsTimeseriesPoint[]
  departments: AnalyticsDepartmentMetric[]
  categories: AnalyticsCategoryMetric[]
  heatmap: AnalyticsHeatmapBucket[]
}

const ANALYTICS_PRESETS = [
  { label: 'Last 30 days', value: 30 },
  { label: 'Last 60 days', value: 60 },
  { label: 'Last 90 days', value: 90 },
  { label: 'Last 6 months', value: 180 }
]

const TIMESERIES_MAX_DAYS = 56
const TIMESERIES_LINE_STROKE = 2.5

const numberFormatter = new Intl.NumberFormat('en-US')

type ExportFormat = 'csv' | 'xlsx' | 'pdf'

type TimeseriesBucket = {
  key: string
  label: string
  start: string
  end: string
  created: number
  resolved: number
  cumulativeCreated: number
  cumulativeResolved: number
  tooltip: string
}

type TimeseriesChartResult = {
  chartData: TimeseriesBucket[]
  xTicks: string[]
  lineTicks: number[]
  lineMax: number
}

function buildTimeseriesChartData(data: AnalyticsTimeseriesPoint[]): TimeseriesChartResult {
  if (!data.length) {
    return {
      chartData: [],
      xTicks: [],
      lineTicks: [0, 1],
      lineMax: 1
    }
  }

  const recent = data.slice(-TIMESERIES_MAX_DAYS)
  const maxBuckets = 14
  const bucketSize = Math.max(1, Math.ceil(recent.length / maxBuckets))

  const buckets: TimeseriesBucket[] = []
  let runningCreated = 0
  let runningResolved = 0

  for (let i = 0; i < recent.length; i += bucketSize) {
    const slice = recent.slice(i, i + bucketSize)
    if (!slice.length) continue

    const created = slice.reduce((sum, point) => sum + point.created, 0)
    const resolved = slice.reduce((sum, point) => sum + point.resolved, 0)
    const start = new Date(slice[0].day)
    const end = new Date(slice[slice.length - 1].day)
    const sameDay = start.toDateString() === end.toDateString()
    const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()
    const startLabel = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    const endLabel = end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

    const label = sameDay
      ? startLabel
      : sameMonth
        ? `${startLabel}–${end.getDate()}`
        : `${startLabel} – ${endLabel}`

    const tooltip = `${startLabel}${sameDay ? '' : ` – ${endLabel}`} · Created ${created} · Resolved ${resolved}`

    runningCreated += created
    runningResolved += resolved

    buckets.push({
      key: `${slice[0].day}-${slice[slice.length - 1].day}`,
      label,
      start: slice[0].day,
      end: slice[slice.length - 1].day,
      created,
      resolved,
      cumulativeCreated: runningCreated,
      cumulativeResolved: runningResolved,
      tooltip
    })
  }

  const lineMax = buckets.reduce(
    (max, bucket) => Math.max(max, bucket.cumulativeCreated, bucket.cumulativeResolved),
    0
  )

  const buildTicks = (max: number, segments: number) => {
    if (max <= 0) return [0, 1]
    const ticks = Array.from({ length: segments + 1 }, (_, index) => Math.round((max / segments) * index))
    if (!ticks.includes(Math.round(max))) {
      ticks.push(Math.round(max))
    }
    const unique = Array.from(new Set(ticks)).sort((a, b) => a - b)
    if (unique.length <= 1) unique.push(unique[0] + 1)
    return unique
  }

  const lineTicks = buildTicks(lineMax, 4)
  const bucketLabelStep = Math.max(1, Math.ceil(buckets.length / 6))
  const xTicks = buckets
    .map((bucket, idx) => (idx % bucketLabelStep === 0 || idx === buckets.length - 1 ? bucket.label : ''))
    .filter((label) => label)

  return {
    chartData: buckets,
    xTicks,
    lineTicks,
    lineMax: Math.max(lineMax, 1)
  }
}

function formatHours(value: number | null) {
  if (value == null || Number.isNaN(value)) return '—'
  if (value < 1) {
    const minutes = Math.round(value * 60)
    return `${Math.max(minutes, 1)} min`
  }
  if (value >= 48) {
    const days = value / 24
    return `${days >= 7 ? Math.round(days) : Number(days.toFixed(1))} d`
  }
  return `${value >= 10 ? Math.round(value) : Number(value.toFixed(1))} h`
}

function formatSlaRate(met: number, breach: number) {
  const total = met + breach
  if (!total) return '—'
  const rate = (met / total) * 100
  if (rate >= 99.5) return '100%'
  if (rate <= 0.5) return '0%'
  return `${rate >= 10 ? rate.toFixed(1) : rate.toFixed(2)}%`
}

const baseStatuses = ['Pending', 'Manual Review', 'In Progress', 'Resolved', 'Cancelled', 'Invalid']
const DEPARTMENT_PAGE_SIZE = 10

function DeptView() {
  const { user } = useAuth()
  const [reports, setReports] = useState<DepartmentReport[]>([])
  const [stats, setStats] = useState<DepartmentStats | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [responseMessage, setResponseMessage] = useState('')
  const [statusChange, setStatusChange] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timeline, setTimeline] = useState<ReportLog[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalReports, setTotalReports] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [loadingMore, setLoadingMore] = useState(false)
  const tableBodyRef = useRef<HTMLTableSectionElement | null>(null)

  const fetchData = async (page: number = 1, search: string = '') => {
    const isFirstLoad = page === 1
    if (isFirstLoad) {
      setLoading(true)
    } else {
      setLoadingMore(true)
    }
    setError(null)
    try {
      const [queueRes, statsRes] = await Promise.all([
        api.get('/dashboards/department', {
          params: { page, pageSize: DEPARTMENT_PAGE_SIZE, search }
        }),
        api.get('/dashboards/department/stats')
      ])

      const queuePayload = queueRes.data as DepartmentQueueResponse | DepartmentReport[] | null | undefined
      const items = Array.isArray(queuePayload)
        ? queuePayload
        : queuePayload && typeof queuePayload === 'object' && Array.isArray(queuePayload.items)
          ? queuePayload.items
          : []

      const normalizedItems = items.map((item: any) => ({
        ...item,
        isAnonymous: Boolean(item.isAnonymous),
        requiresManualReview: Boolean(item.requiresManualReview)
      }))

      if (isFirstLoad) {
        setReports(normalizedItems as DepartmentReport[])
      } else {
        setReports((prev) => [...prev, ...normalizedItems])
      }

      setStats(statsRes.data as DepartmentStats)
      setCurrentPage(page)
      setTotalPages(queuePayload && typeof queuePayload === 'object' && 'totalPages' in queuePayload ? queuePayload.totalPages : 1)
      setTotalReports(queuePayload && typeof queuePayload === 'object' && 'total' in queuePayload ? queuePayload.total : 0)

      if (isFirstLoad && normalizedItems.length > 0) {
        setSelectedId(normalizedItems[0].id)
      }
    } catch (e) {
      console.error(e)
      setError('Unable to load department queue right now.')
    } finally {
      if (isFirstLoad) {
        setLoading(false)
      } else {
        setLoadingMore(false)
      }
    }
  }

  useEffect(() => {
    setCurrentPage(1)
    setReports([])
    fetchData(1, searchQuery)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.departmentId, searchQuery])

  const selectedReport = useMemo(() => reports.find((r) => r.id === selectedId) || null, [reports, selectedId])

  useEffect(() => {
    if (!selectedReport) return
    api
      .get(`/reports/track/${selectedReport.trackingId}`)
    .then((res) => setTimeline((res.data.logs as ReportLog[] | undefined) ?? []))
      .catch(() => setTimeline([]))
  }, [selectedReport?.id, selectedReport?.trackingId])

  const locationPoints = useMemo(() => {
    const points: ReportPoint[] = []
    reports.forEach((r) => {
      if (r.locationLat === null || r.locationLng === null) return
      const lat = Number(r.locationLat)
      const lng = Number(r.locationLng)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
      points.push({
        id: r.id,
        trackingId: r.trackingId,
        status: r.status,
        category: r.category,
        lat,
        lng
      })
    })
    return points
  }, [reports])

  const selectedCoordinates = useMemo(() => {
    if (!selectedReport) return null
    const lat = selectedReport.locationLat !== null ? Number(selectedReport.locationLat) : NaN
    const lng = selectedReport.locationLng !== null ? Number(selectedReport.locationLng) : NaN
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
    return { lat, lng }
  }, [selectedReport])

  const handleRespond = async (e: FormEvent) => {
    e.preventDefault()
    if (!selectedReport) return
    const trimmedMessage = responseMessage.trim()
    if (!trimmedMessage && !statusChange) {
      setError('Add a response message or choose a status update.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await api.post(`/reports/${selectedReport.id}/actions`, {
        message: trimmedMessage || undefined,
        status: statusChange || undefined
      })
      setResponseMessage('')
      setStatusChange('')
      const currentTracking = selectedReport.trackingId
      await fetchData(1, searchQuery)
      try {
        const timelineRes = await api.get(`/reports/track/${currentTracking}`)
        setTimeline((timelineRes.data.logs as ReportLog[] | undefined) ?? [])
      } catch (_err) {
        // ignore timeline refresh errors
      }
    } catch (err: any) {
      console.error(err)
      setError(err?.response?.data?.error || 'Unable to save response. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleLoadMore = () => {
    if (currentPage < totalPages && !loadingMore) {
      fetchData(currentPage + 1, searchQuery)
    }
  }

  const handleSearch = (value: string) => {
    setSearchQuery(value)
  }

  const statusMap = useMemo(() => {
    const map: Record<string, number> = {}
    stats?.statusCounts.forEach((item) => {
      map[item.status] = Number(item.total || 0)
    })
    return map
  }, [stats])

  const statusesToShow = useMemo(() => {
    const extras = (stats?.statusCounts || [])
      .map((item) => item.status)
      .filter((status) => !baseStatuses.includes(status))
    return [...baseStatuses, ...extras]
  }, [stats])

  const overview = useMemo(() => {
    if (!stats?.overview) return null
    return {
      totalReports: Number(stats.overview.totalReports ?? 0),
      resolvedReports: Number(stats.overview.resolvedReports ?? 0),
      avgResolutionHours:
        stats.overview.avgResolutionHours !== null && stats.overview.avgResolutionHours !== undefined
          ? Number(stats.overview.avgResolutionHours)
          : null,
      metSla: Number(stats.overview.metSla ?? 0)
    }
  }, [stats])

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Department Snapshot</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {statusesToShow.map((status) => (
            <div key={status} className="card px-5 py-6">
              <p className="stat-label">{status}</p>
              <p className="mt-3 text-3xl font-semibold text-neutral-900 dark:text-white">{statusMap[status] ?? 0}</p>
            </div>
          ))}
          {overview && (
            <div className="card px-5 py-6 xl:col-span-2">
              <p className="stat-label">SLA Performance</p>
              <div className="mt-3 grid gap-4 text-sm text-neutral-700 dark:text-white/70 sm:grid-cols-2 xl:flex xl:flex-wrap xl:items-center">
                <span className="surface-subtle px-4 py-3">Total: <strong className="ml-2 font-semibold text-neutral-900 dark:text-white">{overview.totalReports}</strong></span>
                <span className="surface-subtle px-4 py-3">Resolved: <strong className="ml-2 font-semibold text-neutral-900 dark:text-white">{overview.resolvedReports}</strong></span>
                <span className="surface-subtle px-4 py-3">
                  Avg Resolution:
                  <strong className="ml-2 font-semibold text-neutral-900 dark:text-white">{overview.avgResolutionHours !== null ? `${overview.avgResolutionHours.toFixed(1)}h` : '—'}</strong>
                </span>
                <span className="surface-subtle px-4 py-3">Met SLA: <strong className="ml-2 font-semibold text-neutral-900 dark:text-white">{overview.metSla}</strong></span>
              </div>
            </div>
          )}
          {stats?.recentTrends?.length ? (
            <div className="card px-5 py-6 xl:col-span-2">
              <p className="stat-label">14-day intake</p>
              <div className="mt-4 grid gap-2 text-xs text-neutral-700 dark:text-white/70 sm:grid-cols-2">
                {stats.recentTrends.slice(-8).map((trend) => (
                  <div key={trend.day} className="surface-subtle flex items-center justify-between px-4 py-3">
                    <span>{new Date(trend.day).toLocaleDateString()}</span>
                    <span className="text-sm font-semibold text-neutral-900 dark:text-white">{Number(trend.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

        {locationPoints.length > 0 && (
          <div className="card px-5 py-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg font-semibold">Report locations</h3>
              <p className="text-faint">{locationPoints.length} pin{locationPoints.length === 1 ? '' : 's'} on map</p>
            </div>
            <div className="mt-4">
              <ReportsMap
                points={locationPoints}
                height="20rem"
                selectedId={selectedId}
                onSelect={(id) => {
                  const numeric = typeof id === 'string' ? Number(id) : id
                  if (!Number.isNaN(numeric)) {
                    setSelectedId(numeric)
                  }
                }}
              />
            </div>
          </div>
        )}

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Active Reports</h2>
          <button onClick={() => fetchData(1, searchQuery)} className="text-sm text-neutral-600 transition hover:text-brand dark:text-white/60 dark:hover:text-white">Refresh data</button>
        </div>
        
        {/* Search Bar */}
        {reports.length > 0 && (
          <div className="card px-5 py-3">
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search by tracking ID, title, or category..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="flex-1 bg-transparent text-sm outline-none text-neutral-900 placeholder-neutral-400 dark:text-white dark:placeholder-neutral-500"
              />
              {searchQuery && (
                <button
                  onClick={() => handleSearch('')}
                  className="text-xs text-neutral-500 hover:text-neutral-700 dark:text-white/50 dark:hover:text-white/70"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        )}

        {loading ? (
          <div className="card px-5 py-5 text-secondary">Loading queue…</div>
        ) : reports.length === 0 ? (
          <div className="card px-5 py-5 text-secondary">
            {searchQuery ? 'No reports match your search.' : 'No reports assigned to your department yet.'}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="card overflow-hidden">
              <table className="min-w-full divide-y divide-neutral-200 text-sm text-neutral-700 dark:divide-white/10 dark:text-white/70">
                <thead className="bg-neutral-100 text-xs uppercase tracking-wide text-neutral-600 dark:bg-white/5 dark:text-white/50">
                  <tr>
                    <th className="px-4 py-3 text-left">Tracking ID</th>
                    <th className="px-4 py-3 text-left">Citizen</th>
                    <th className="px-4 py-3 text-left">Category</th>
                    <th className="px-4 py-3 text-left">Urgency</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Submitted</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-white/10" ref={tableBodyRef}>
                  {reports.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => setSelectedId(r.id)}
                      className={`cursor-pointer transition ${
                        selectedId === r.id
                          ? 'bg-neutral-200/70 dark:bg-white/10'
                          : 'bg-neutral-100/40 hover:bg-neutral-200/70 dark:bg-white/[0.02] dark:hover:bg-white/10'
                      }`}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-neutral-800 dark:text-white/80">{r.trackingId}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-neutral-900 dark:text-white">{r.isAnonymous ? 'Anonymous citizen' : (r.citizenName || '—')}</div>
                        <div className="text-faint">{r.isAnonymous ? 'Hidden for privacy' : (r.citizenEmail || '—')}</div>
                      </td>
                      <td className="px-4 py-3 text-neutral-700 dark:text-white/70">{r.category}</td>
                      <td className="px-4 py-3">
                        <span className="badge-outline">{r.urgency}</span>
                      </td>
                      <td className="px-4 py-3 text-neutral-700 dark:text-white/70">
                        <div className="flex flex-col gap-1">
                          <span className="badge-outline w-fit">{r.status}</span>
                          {r.requiresManualReview && (
                            <span className="text-[11px] text-amber-700 dark:text-amber-300">Queued for manual review</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-faint">{new Date(r.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Load More Button */}
            {currentPage < totalPages && (
              <div className="flex justify-center">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="rounded-full border border-neutral-300 px-6 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-60 dark:border-white/20 dark:text-white dark:hover:bg-white/10"
                >
                  {loadingMore ? 'Loading more…' : 'Load more reports'}
                </button>
              </div>
            )}

            {/* Pagination Info */}
            <div className="flex justify-between items-center px-4 py-2 text-xs text-neutral-600 dark:text-white/60">
              <span>Showing {reports.length} of {totalReports} report{totalReports !== 1 ? 's' : ''}</span>
              <span>Page {currentPage} of {totalPages}</span>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="card border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">
          {error}
        </div>
      )}

      {selectedReport && (
        <div className="grid gap-8 xl:grid-cols-[1.75fr,1fr]">
          <div className="space-y-6">
            <div className="card px-6 py-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold">Report details</h3>
                  <p className="text-sm font-semibold text-neutral-900 dark:text-white">{selectedReport.title}</p>
                  <p className="stat-label">Tracking ID: {selectedReport.trackingId}</p>
                </div>
                <span className="badge-outline">
                  {selectedReport.status}
                </span>
                {selectedReport.requiresManualReview && (
                  <p className="mt-2 text-xs text-amber-700 dark:text-amber-200">
                    This report is pending manual review before dispatch. Validate details before assigning field teams.
                  </p>
                )}
              </div>
              <p className="mt-4 whitespace-pre-wrap text-secondary">{selectedReport.description}</p>
              <div className="mt-5 grid gap-3 text-xs text-neutral-600 dark:text-white/60 sm:grid-cols-2">
                <span><span className="text-faint">Citizen</span><br />{selectedReport.isAnonymous ? 'Anonymous citizen' : (selectedReport.citizenName || '—')}</span>
                <span><span className="text-faint">Email</span><br />{selectedReport.isAnonymous ? 'Hidden for privacy' : (selectedReport.citizenEmail || '—')}</span>
                <span><span className="text-faint">Contact</span><br />{selectedReport.isAnonymous ? 'Hidden for privacy' : (selectedReport.citizenContact || '—')}</span>
                <span><span className="text-faint">Submitted</span><br />{new Date(selectedReport.createdAt).toLocaleString()}</span>
                <span><span className="text-faint">Urgency</span><br />{selectedReport.urgency}</span>
                <span><span className="text-faint">Expected SLA</span><br />
                  {selectedReport.expectedResolutionHours ? `${selectedReport.expectedResolutionHours}h` : '—'}
                </span>
                {selectedReport.locationAddress && (
                  <span><span className="text-faint">Location</span><br />{selectedReport.locationAddress}</span>
                )}
                {selectedCoordinates && (
                  <span><span className="text-faint">Coordinates</span><br />{selectedCoordinates.lat.toFixed(5)}, {selectedCoordinates.lng.toFixed(5)}</span>
                )}
              </div>
            </div>

            <div className="card px-6 py-6">
              <h3 className="text-lg font-semibold">Status timeline</h3>
              <ol className="mt-5 space-y-4 text-sm text-neutral-700 dark:text-white/70">
                {timeline.length === 0 && <li className="text-faint">No updates yet.</li>}
                {timeline.map((log, idx) => (
                  <li key={`${log.created_at}-${idx}`} className="relative surface-subtle p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="font-semibold text-neutral-900 dark:text-white">{log.action || (log.newStatus ? `Status changed to ${log.newStatus}` : 'Update')}</div>
                      <div className="text-faint">{new Date(log.created_at).toLocaleString()}</div>
                    </div>
                    {log.remarks && <div className="mt-2 text-secondary">{log.remarks}</div>}
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <form onSubmit={handleRespond} className="card px-6 py-6 space-y-5">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Respond to citizen</h3>
              <p className="text-secondary">
                {selectedReport.isAnonymous
                  ? 'Send an internal update or status change. Anonymous citizens do not receive email notifications, so keep your notes concise for internal tracking.'
                  : 'Send an update and optionally adjust the report status. Citizens receive these updates by email once you submit.'}
              </p>
            </div>
            <div className="space-y-2">
              <label className="stat-label">Message</label>
              <textarea
                className="input-field min-h-[140px] resize-y"
                value={responseMessage}
                onChange={(e) => setResponseMessage(e.target.value)}
                placeholder="Share progress or next steps with the citizen"
              />
              <p className="text-xs text-neutral-500 dark:text-white/50">
                {selectedReport.isAnonymous
                  ? 'Anonymous citizens will not receive an email, but your note is stored with the status history for internal reference.'
                  : 'Your note is emailed to the citizen along with the latest status history.'}
              </p>
            </div>
            <div className="space-y-2">
              <label className="stat-label">Update status</label>
              <select className="input-field" value={statusChange} onChange={(e) => setStatusChange(e.target.value)}>
                <option value="">Keep current status</option>
                {baseStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary w-full disabled:opacity-60"
            >
              {saving ? 'Sending…' : 'Send update'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

function AdminView() {
  const { showSuccess, showError, showInfo } = useToast()
  const [selectedPreset, setSelectedPreset] = useState<number>(ANALYTICS_PRESETS[0]?.value ?? 30)
  const [state, setState] = useState<AnalyticsState>({
    range: null,
    summary: null,
    timeseries: [],
    departments: [],
    categories: [],
    heatmap: []
  })
  const [mapPoints, setMapPoints] = useState<ReportPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const mountedRef = useRef(true)
  const exportMenuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!exportMenuOpen) return
    const handleClick = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setExportMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => {
      document.removeEventListener('mousedown', handleClick)
    }
  }, [exportMenuOpen])

  const fetchAnalytics = useCallback(async (days: number) => {
    setLoading(true)
    setError(null)

    try {
      type SummaryResponse = { range: AnalyticsRange; summary: AnalyticsSummary }
      type TimeseriesResponse = { range: AnalyticsRange; timeseries: AnalyticsTimeseriesPoint[] }
      type DepartmentsResponse = { range: AnalyticsRange; departments: AnalyticsDepartmentMetric[] }
      type CategoriesResponse = { range: AnalyticsRange; categories: AnalyticsCategoryMetric[] }
      type HeatmapResponse = { range: AnalyticsRange; heatmap: AnalyticsHeatmapBucket[] }
      type AdminOverviewResponse = {
        recentReports: Array<{
          id: number
          trackingId: string
          status: string
          category: string | null
          locationLat: number | null
          locationLng: number | null
        }>
      }

      const params = { params: { days } }

      const [
        summaryRes,
        timeseriesRes,
        departmentsRes,
        categoriesRes,
        heatmapRes,
        overviewRes
      ] = await Promise.all([
        api.get<SummaryResponse>('/analytics/summary', params),
        api.get<TimeseriesResponse>('/analytics/timeseries', params),
        api.get<DepartmentsResponse>('/analytics/departments', params),
        api.get<CategoriesResponse>('/analytics/categories', params),
        api.get<HeatmapResponse>('/analytics/heatmap', { params: { days, precision: 3 } }),
        api.get<AdminOverviewResponse>('/dashboards/admin/overview')
      ])

      if (!mountedRef.current) return

      setState({
        range: summaryRes.data.range,
        summary: summaryRes.data.summary,
        timeseries: timeseriesRes.data.timeseries ?? [],
        departments: departmentsRes.data.departments ?? [],
        categories: categoriesRes.data.categories ?? [],
        heatmap: heatmapRes.data.heatmap ?? []
      })

      const reports = overviewRes.data?.recentReports ?? []
      setMapPoints(
        reports
          .map((item) => ({
            id: item.id,
            trackingId: item.trackingId,
            status: item.status,
            category: item.category,
            lat: Number(item.locationLat),
            lng: Number(item.locationLng)
          }))
          .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng))
      )

      setLastUpdated(new Date())
    } catch (err) {
      console.error(err)
      if (!mountedRef.current) return
      setError('Unable to load analytics right now. Please try again in a moment.')
    } finally {
      if (mountedRef.current) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    fetchAnalytics(selectedPreset)
  }, [selectedPreset, fetchAnalytics])

  const handlePresetChange = (value: number) => {
    if (value === selectedPreset) return
    setSelectedPreset(value)
  }

  const handleExport = useCallback(
    async (format: ExportFormat) => {
      if (exporting) return

      const { chartData } = buildTimeseriesChartData(state.timeseries)
      if (!chartData.length) {
        setExportMenuOpen(false)
        showInfo('No analytics data', 'Try refreshing the dashboard and pick a different window.')
        return
      }

      setExportMenuOpen(false)
      setExporting(true)

      const rangeLabel = state.range?.days ?? selectedPreset
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      const fileBase = `analytics-trend-${rangeLabel}d-${timestamp}`

      const rows = chartData.map((bucket) => ({
        Range: bucket.label,
        Start: new Date(bucket.start).toLocaleDateString(),
        End: new Date(bucket.end).toLocaleDateString(),
        Created: bucket.created,
        Resolved: bucket.resolved,
        'Cumulative Created': bucket.cumulativeCreated,
        'Cumulative Resolved': bucket.cumulativeResolved
      }))

      try {
        if (format === 'csv' || format === 'xlsx') {
          const XLSX = await import('xlsx')
          const worksheet = XLSX.utils.json_to_sheet(rows)
          const workbook = XLSX.utils.book_new()
          XLSX.utils.book_append_sheet(workbook, worksheet, 'Trend')
          const extension = format === 'xlsx' ? 'xlsx' : 'csv'
          XLSX.writeFile(workbook, `${fileBase}.${extension}`, { bookType: extension })
        } else if (format === 'pdf') {
          const [{ default: jsPDF }, autoTableModule] = await Promise.all([
            import('jspdf'),
            import('jspdf-autotable')
          ])
          const autoTable = (autoTableModule.default ?? autoTableModule) as (doc: any, options: any) => void
          const doc = new jsPDF({ orientation: 'landscape' })
          autoTable(doc, {
            head: [['Range', 'Created', 'Resolved', 'Cumulative Created', 'Cumulative Resolved']],
            body: chartData.map((bucket) => [
              bucket.label,
              numberFormatter.format(bucket.created),
              numberFormatter.format(bucket.resolved),
              numberFormatter.format(bucket.cumulativeCreated),
              numberFormatter.format(bucket.cumulativeResolved)
            ]),
            styles: { fontSize: 10 }
          })
          doc.save(`${fileBase}.pdf`)
        }

        showSuccess('Export ready', `Downloaded ${format.toUpperCase()} file.`)
      } catch (err) {
        console.error(err)
        showError('Export failed', 'Please try again in a moment.')
      } finally {
        setExporting(false)
      }
    },
    [exporting, state.timeseries, state.range, selectedPreset, showInfo, showSuccess, showError]
  )

  const summary = state.summary
  const range = state.range
  const slaMet = summary?.metSlaResolved ?? 0
  const slaBreached = summary?.breachSlaResolved ?? 0

  const rangeLabel = range
    ? `${new Date(range.from).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} – ${new Date(range.to).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
    : 'Selected window'

  const totalHeatmapReports = state.heatmap.reduce((acc, bucket) => acc + bucket.totalReports, 0)
  const topHeatmapBucket = state.heatmap[0]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">City analytics</h2>
          <p className="text-sm text-secondary">Incident volume and SLA performance for the selected window.</p>
          {range ? (
            <p className="mt-1 text-xs text-secondary">Analyzing {range.days} days: {rangeLabel}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {ANALYTICS_PRESETS.map((preset) => {
            const isActive = preset.value === selectedPreset
            return (
              <button
                key={preset.value}
                type="button"
                onClick={() => handlePresetChange(preset.value)}
                disabled={loading && isActive}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  isActive
                    ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900 dark:bg-white/10 dark:text-white/70 dark:hover:bg-white/20'
                }`}
              >
                {preset.label}
              </button>
            )
          })}
          <button
            type="button"
            onClick={() => fetchAnalytics(selectedPreset)}
            className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-60 dark:border-white/20 dark:text-white dark:hover:bg-white/10"
            disabled={loading}
          >
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/50 dark:bg-rose-500/10 dark:text-rose-200">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-dashed border-neutral-200 px-6 py-12 text-center text-sm text-secondary dark:border-white/10">
          Loading analytics…
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="card space-y-2 px-5 py-4">
              <p className="text-xs uppercase tracking-wide text-secondary">Total reports</p>
              <p className="text-2xl font-semibold text-neutral-900 dark:text-white">
                {summary ? numberFormatter.format(summary.totalReports) : '—'}
              </p>
              <p className="text-xs text-secondary">Across all departments</p>
            </div>
            <div className="card space-y-2 px-5 py-4">
              <p className="text-xs uppercase tracking-wide text-secondary">Active reports</p>
              <p className="text-2xl font-semibold text-neutral-900 dark:text-white">
                {summary ? numberFormatter.format(summary.activeReports) : '—'}
              </p>
              <p className="text-xs text-secondary">Pending or in-progress cases</p>
            </div>
            <div className="card space-y-2 px-5 py-4">
              <p className="text-xs uppercase tracking-wide text-secondary">Resolved reports</p>
              <p className="text-2xl font-semibold text-neutral-900 dark:text-white">
                {summary ? numberFormatter.format(summary.resolvedReports) : '—'}
              </p>
              <p className="text-xs text-secondary">Closed within the window</p>
            </div>
            <div className="card space-y-2 px-5 py-4">
              <p className="text-xs uppercase tracking-wide text-secondary">Avg. resolution time</p>
              <p className="text-2xl font-semibold text-neutral-900 dark:text-white">
                {formatHours(summary?.avgResolutionHours ?? null)}
              </p>
              <p className="text-xs text-secondary">From citizen report to closure</p>
            </div>
            <div className="card space-y-2 px-5 py-4">
              <p className="text-xs uppercase tracking-wide text-secondary">Avg. first response</p>
              <p className="text-2xl font-semibold text-neutral-900 dark:text-white">
                {formatHours(summary?.avgFirstResponseHours ?? null)}
              </p>
              <p className="text-xs text-secondary">Time to first staff action</p>
            </div>
            <div className="card space-y-2 px-5 py-4">
              <p className="text-xs uppercase tracking-wide text-secondary">SLA compliance</p>
              <p className="text-2xl font-semibold text-neutral-900 dark:text-white">
                {formatSlaRate(slaMet, slaBreached)}
              </p>
              <p className="text-xs text-secondary">
                {summary ? `${numberFormatter.format(slaMet)} met · ${numberFormatter.format(slaBreached)} breached` : '—'}
              </p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="card px-6 py-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold">Trend of created vs resolved</h3>
                  <p className="text-sm text-secondary">Shows the last {Math.min(state.timeseries.length, TIMESERIES_MAX_DAYS)} days.</p>
                </div>
                <div className="flex items-center gap-3">
                  {lastUpdated ? (
                    <span className="text-xs text-secondary">
                      Updated {lastUpdated.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  ) : null}
                  {state.timeseries.length ? (
                    <div className="relative" ref={exportMenuRef}>
                      <button
                        type="button"
                        onClick={() => setExportMenuOpen((open) => !open)}
                        disabled={exporting}
                        className="rounded-full border border-neutral-300 px-4 py-1.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/20 dark:text-white dark:hover:bg-white/10"
                      >
                        {exporting ? 'Preparing…' : 'Export'}
                      </button>
                      {exportMenuOpen ? (
                        <div className="absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-lg border border-neutral-200 bg-white text-sm shadow-lg dark:border-white/10 dark:bg-neutral-900">
                          <button
                            type="button"
                            onClick={() => void handleExport('csv')}
                            className="block w-full px-4 py-2 text-left text-neutral-700 hover:bg-neutral-100 dark:text-white dark:hover:bg-white/10"
                          >
                            Export as CSV
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleExport('xlsx')}
                            className="block w-full px-4 py-2 text-left text-neutral-700 hover:bg-neutral-100 dark:text-white dark:hover:bg-white/10"
                          >
                            Export as Excel
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleExport('pdf')}
                            className="block w-full px-4 py-2 text-left text-neutral-700 hover:bg-neutral-100 dark:text-white dark:hover:bg-white/10"
                          >
                            Export as PDF
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
              <AnalyticsTimeseriesChart data={state.timeseries} />
            </div>
            <div className="card px-6 py-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold">Spatial density</h3>
                  <p className="text-sm text-secondary">
                    Heatmap clusters {numberFormatter.format(totalHeatmapReports)} reports into {state.heatmap.length} zones.
                  </p>
                </div>
                {topHeatmapBucket ? (
                  <span className="text-xs text-secondary">
                    Peak zone: {numberFormatter.format(topHeatmapBucket.totalReports)} reports
                  </span>
                ) : null}
              </div>
              <div className="mt-4">
                <ReportsMap points={mapPoints} heatmap={state.heatmap} height="20rem" />
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-secondary">
                  <span className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-rose-500/80" /> Higher density
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-orange-400/70" /> Moderate
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full border border-amber-400/70 bg-amber-300/70" /> Emerging
                  </span>
                  <span className="text-[11px] text-secondary/80">Pins show the latest citizen reports.</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="card px-6 py-6">
              <h3 className="text-lg font-semibold">Department performance</h3>
              <p className="text-sm text-secondary">Includes assigned reports for each department.</p>
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full divide-y divide-neutral-200 text-sm dark:divide-white/10">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-secondary">
                      <th className="py-2 pr-3 font-medium">Department</th>
                      <th className="px-3 py-2 font-medium">Total</th>
                      <th className="px-3 py-2 font-medium">Active</th>
                      <th className="px-3 py-2 font-medium">Resolved</th>
                      <th className="px-3 py-2 font-medium">Avg resolution</th>
                      <th className="px-3 py-2 font-medium">SLA met</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-white/5">
                    {state.departments.length ? (
                      state.departments.slice(0, 8).map((dept) => (
                        <tr key={dept.id} className="text-neutral-700 dark:text-white/80">
                          <td className="py-3 pr-3 font-medium text-neutral-900 dark:text-white">{dept.name}</td>
                          <td className="px-3 py-3 font-mono text-sm">{numberFormatter.format(dept.totalReports)}</td>
                          <td className="px-3 py-3 font-mono text-sm">{numberFormatter.format(dept.activeReports)}</td>
                          <td className="px-3 py-3 font-mono text-sm">{numberFormatter.format(dept.resolvedReports)}</td>
                          <td className="px-3 py-3 text-sm">{formatHours(dept.avgResolutionHours)}</td>
                          <td className="px-3 py-3 text-sm">{formatSlaRate(dept.metSlaResolved, dept.breachSlaResolved)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-4 text-center text-sm text-secondary">No department data for this window.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="card px-6 py-6">
              <h3 className="text-lg font-semibold">Top categories</h3>
              <p className="text-sm text-secondary">Ordered by total citizen reports in the window.</p>
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full divide-y divide-neutral-200 text-sm dark:divide-white/10">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-secondary">
                      <th className="py-2 pr-3 font-medium">Category</th>
                      <th className="px-3 py-2 font-medium">Total</th>
                      <th className="px-3 py-2 font-medium">Active</th>
                      <th className="px-3 py-2 font-medium">Resolved</th>
                      <th className="px-3 py-2 font-medium">Avg resolution</th>
                      <th className="px-3 py-2 font-medium">SLA met</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-white/5">
                    {state.categories.length ? (
                      state.categories.slice(0, 8).map((cat) => (
                        <tr key={cat.category} className="text-neutral-700 dark:text-white/80">
                          <td className="py-3 pr-3 font-medium text-neutral-900 dark:text-white">{cat.category || 'Uncategorized'}</td>
                          <td className="px-3 py-3 font-mono text-sm">{numberFormatter.format(cat.totalReports)}</td>
                          <td className="px-3 py-3 font-mono text-sm">{numberFormatter.format(cat.activeReports)}</td>
                          <td className="px-3 py-3 font-mono text-sm">{numberFormatter.format(cat.resolvedReports)}</td>
                          <td className="px-3 py-3 text-sm">{formatHours(cat.avgResolutionHours)}</td>
                          <td className="px-3 py-3 text-sm">{formatSlaRate(cat.metSlaResolved, cat.breachSlaResolved)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-4 text-center text-sm text-secondary">No category data for this window.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function AnalyticsTimeseriesChart({ data }: { data: AnalyticsTimeseriesPoint[] }) {
  const axisColor = 'rgba(148, 163, 184, 0.85)'
  const rightAxisColor = 'rgba(14, 165, 233, 0.8)'
  const gridColor = 'rgba(148, 163, 184, 0.12)'

  const { chartData, xTicks, lineTicks, lineMax } = useMemo(() => buildTimeseriesChartData(data), [data])

  const renderXAxisTick = ({ x = 0, y = 0, payload }: any) => {
    const value = String(payload?.value ?? '')
    const lines = value.split(' – ')
    return (
      <g transform={`translate(${x},${y})`}>
        <text fill={axisColor} fontSize={11} textAnchor="middle">
          {lines.map((line, index) => (
            <tspan key={`${line}-${index}`} x={0} dy={index === 0 ? 14 : 12}>
              {line}
            </tspan>
          ))}
        </text>
      </g>
    )
  }

  const renderTooltip = ({ active, payload }: TooltipProps<number, string>) => {
    if (!active || !payload?.length) return null
    const point = payload[0]?.payload as TimeseriesBucket | undefined
    if (!point) return null

    return (
      <div className="min-w-[220px] rounded-lg border border-neutral-200/80 bg-white/95 p-3 text-xs text-neutral-700 shadow-lg backdrop-blur dark:border-white/10 dark:bg-neutral-900/90 dark:text-neutral-100">
        <p className="text-sm font-semibold text-neutral-900 dark:text-white">{point.tooltip}</p>
        <div className="mt-2 space-y-1 text-[13px]">
          <div className="flex items-center justify-between text-sky-600 dark:text-sky-300">
            <span>Created</span>
            <span className="font-mono">{numberFormatter.format(point.created)}</span>
          </div>
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-300">
            <span>Resolved</span>
            <span className="font-mono">{numberFormatter.format(point.resolved)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-sky-700 dark:text-sky-200">
            <span>Cumulative created</span>
            <span className="font-mono">{numberFormatter.format(point.cumulativeCreated)}</span>
          </div>
          <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-200">
            <span>Cumulative resolved</span>
            <span className="font-mono">{numberFormatter.format(point.cumulativeResolved)}</span>
          </div>
        </div>
      </div>
    )
  }

  if (!chartData.length) {
    return <p className="mt-4 text-sm text-secondary">No timeline data captured for this window.</p>
  }

  const rightAxisMax = Math.max(lineMax, 1)

  return (
    <div className="mt-5 space-y-4">
      <div className="relative overflow-hidden rounded-2xl border border-neutral-200/70 bg-gradient-to-b from-white via-white to-neutral-50 px-5 pb-6 pt-6 shadow-inner dark:border-white/10 dark:from-white/5 dark:via-white/0 dark:to-white/0">
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 24, right: 40, left: 12, bottom: 36 }}>
              <defs>
                <linearGradient id="trend-created-gradient" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="trend-resolved-gradient" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#34d399" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0.05} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="4 4" stroke={gridColor} vertical={false} />
              <XAxis
                dataKey="label"
                ticks={xTicks}
                tick={renderXAxisTick}
                height={58}
                tickMargin={18}
                interval={0}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                ticks={lineTicks}
                domain={[0, rightAxisMax]}
                allowDecimals={false}
                width={44}
                axisLine={false}
                tickLine={false}
                tick={{ fill: rightAxisColor, fontSize: 11 }}
              />
              <Tooltip content={renderTooltip} cursor={{ fill: 'rgba(56, 189, 248, 0.08)' }} />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="cumulativeCreated"
                name="Created"
                stroke="#0ea5e9"
                strokeWidth={TIMESERIES_LINE_STROKE}
                dot={false}
                strokeDasharray="0"
                activeDot={{ r: 4 }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="cumulativeResolved"
                name="Resolved"
                stroke="#10b981"
                strokeWidth={TIMESERIES_LINE_STROKE}
                dot={false}
                strokeDasharray="4 2"
                activeDot={{ r: 4 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-6 text-xs text-secondary">
        <span className="flex items-center gap-2">
          <span className="h-2 w-5 rounded-full bg-sky-500/70" /> Created cumulative
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2 w-5 rounded-full bg-emerald-500/70" /> Resolved cumulative
        </span>
      </div>
    </div>
  )
}

export function Dashboard() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  useEffect(() => {
    if (!loading) {
      if (!user) navigate('/signin')
    }
  }, [loading, user, navigate])

  if (loading) return <div>Loading…</div>
  if (!user) return null
  const isAdmin = user.role === 'ADMIN'
  const isStaff = user.role === 'STAFF'

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Dashboard</h1>
          <p className="text-secondary">Monitor assignments, track performance, and respond to citizens.</p>
        </div>
        <nav className="flex gap-2">
          {isStaff && (
            <Link
              to="/dashboard/department"
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                location.pathname.startsWith('/dashboard/department')
                  ? 'bg-neutral-900/10 text-neutral-900 dark:bg-white/20 dark:text-white'
                  : 'bg-neutral-100 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200 dark:bg-white/5 dark:text-white/70 dark:hover:text-white dark:hover:bg-white/10'
              }`}
            >
              Department view
            </Link>
          )}
          {isAdmin && (
            <Link
              to="/dashboard/admin"
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                location.pathname.startsWith('/dashboard/admin')
                  ? 'bg-neutral-900/10 text-neutral-900 dark:bg-white/20 dark:text-white'
                  : 'bg-neutral-100 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200 dark:bg-white/5 dark:text-white/70 dark:hover:text-white dark:hover:bg-white/10'
              }`}
            >
              Admin overview
            </Link>
          )}
        </nav>
      </div>
      <Routes>
        <Route path="/" element={<Navigate to={isAdmin ? '/dashboard/admin' : isStaff ? '/dashboard/department' : '/'} replace />} />
        {isStaff && <Route path="/department" element={<DeptView />} />}
        {isAdmin && <Route path="/admin" element={<AdminView />} />}
      </Routes>
    </section>
  )
}
