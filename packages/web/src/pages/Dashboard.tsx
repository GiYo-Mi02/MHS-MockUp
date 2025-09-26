import { Routes, Route, Link, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ReportsMap, type ReportPoint } from '@/components/maps/ReportsMap'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api'

type DepartmentReport = {
  id: number
  trackingId: string
  title: string
  category: string
  description: string
  status: string
  urgency: string
  createdAt: string
  assignedAt: string | null
  resolvedAt: string | null
  expectedResolutionHours: number | null
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

type ReportLog = {
  created_at: string
  action: string | null
  newStatus: string | null
  remarks: string | null
}

const baseStatuses = ['Pending', 'In Progress', 'Resolved', 'Cancelled']

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

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [queueRes, statsRes] = await Promise.all([
        api.get('/dashboards/department'),
        api.get('/dashboards/department/stats')
      ])
      const data = queueRes.data as DepartmentReport[]
      setReports(data)
      setStats(statsRes.data as DepartmentStats)
      if (!data.length) {
        setSelectedId(null)
        setTimeline([])
      } else {
        if (!selectedId || !data.find((r) => r.id === selectedId)) {
          setSelectedId(data[0].id)
        }
      }
    } catch (e) {
      console.error(e)
      setError('Unable to load department queue right now.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.departmentId])

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
      await fetchData()
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
          <button onClick={fetchData} className="text-sm text-neutral-600 transition hover:text-brand dark:text-white/60 dark:hover:text-white">Refresh data</button>
        </div>
        {loading ? (
          <div className="card px-5 py-5 text-secondary">Loading queue…</div>
        ) : reports.length === 0 ? (
          <div className="card px-5 py-5 text-secondary">No reports assigned to your department yet.</div>
        ) : (
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
              <tbody className="divide-y divide-neutral-200 dark:divide-white/10">
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
                      <div className="font-medium text-neutral-900 dark:text-white">{r.citizenName || 'Anonymous'}</div>
                      <div className="text-faint">{r.citizenEmail || '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-neutral-700 dark:text-white/70">{r.category}</td>
                    <td className="px-4 py-3">
                      <span className="badge-outline">{r.urgency}</span>
                    </td>
                    <td className="px-4 py-3 text-neutral-700 dark:text-white/70">{r.status}</td>
                    <td className="px-4 py-3 text-faint">{new Date(r.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
              </div>
              <p className="mt-4 whitespace-pre-wrap text-secondary">{selectedReport.description}</p>
              <div className="mt-5 grid gap-3 text-xs text-neutral-600 dark:text-white/60 sm:grid-cols-2">
                <span><span className="text-faint">Citizen</span><br />{selectedReport.citizenName || 'Anonymous'}</span>
                <span><span className="text-faint">Email</span><br />{selectedReport.citizenEmail || '—'}</span>
                <span><span className="text-faint">Contact</span><br />{selectedReport.citizenContact || '—'}</span>
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
              <p className="text-secondary">Send an update and optionally adjust the report status. Citizens receive these updates by email once you submit.</p>
            </div>
            <div className="space-y-2">
              <label className="stat-label">Message</label>
              <textarea
                className="input-field min-h-[140px] resize-y"
                value={responseMessage}
                onChange={(e) => setResponseMessage(e.target.value)}
                placeholder="Share progress or next steps with the citizen"
              />
              <p className="text-xs text-neutral-500 dark:text-white/50">Your note is emailed to the citizen along with the latest status history.</p>
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
  const [data, setData] = useState<{ byDept: any[]; byStatus: any[]; recentReports: any[] }>({ byDept: [], byStatus: [], recentReports: [] })
  useEffect(() => {
    api
      .get('/dashboards/admin/overview')
      .then((res) => setData(res.data))
      .catch(() => setData({ byDept: [], byStatus: [], recentReports: [] }))
  }, [])
  const points = useMemo<ReportPoint[]>(() => {
    const list: ReportPoint[] = []
    data.recentReports?.forEach((item: any) => {
      if (item.locationLat == null || item.locationLng == null) return
      const lat = Number(item.locationLat)
      const lng = Number(item.locationLng)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
      list.push({
        id: item.id,
        trackingId: item.trackingId,
        status: item.status,
        category: item.category,
        lat,
        lng
      })
    })
    return list
  }, [data.recentReports])
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="card px-6 py-6 lg:col-span-2">
        <h2 className="text-lg font-semibold">Makati City overview</h2>
        {points.length ? (
          <div className="mt-4">
            <ReportsMap points={points} height="22rem" />
          </div>
        ) : (
          <p className="mt-3 text-secondary">Reports with map pins will appear here once coordinates are submitted.</p>
        )}
      </div>
      <div className="card px-6 py-6">
        <h2 className="text-lg font-semibold">Reports by department</h2>
        <ul className="mt-4 divide-y divide-neutral-200 text-sm text-neutral-700 dark:divide-white/10 dark:text-white/70">
          {data.byDept.map((d: any) => (
            <li key={d.id} className="flex items-center justify-between py-3">
              <span>{d.name}</span>
              <span className="font-mono text-neutral-900 dark:text-white">{d.total}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="card px-6 py-6">
        <h2 className="text-lg font-semibold">Reports by status</h2>
        <ul className="mt-4 divide-y divide-neutral-200 text-sm text-neutral-700 dark:divide-white/10 dark:text-white/70">
          {data.byStatus.map((s: any) => (
            <li key={s.status} className="flex items-center justify-between py-3">
              <span>{s.status}</span>
              <span className="font-mono text-neutral-900 dark:text-white">{s.total}</span>
            </li>
          ))}
        </ul>
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
