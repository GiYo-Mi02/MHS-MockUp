import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '@/lib/api'
import { ReportsMap, type ReportPoint } from '@/components/maps/ReportsMap'

export function Track() {
  const { trackingId } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState<any | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState(trackingId ?? '')
  const [loading, setLoading] = useState(false)

  const fetchReport = useCallback(async (id: string) => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const res = await api.get(`/reports/track/${id}`)
      setData(res.data)
    } catch (e: any) {
      setData(null)
      setError(e?.response?.data?.error || 'Tracking ID not found')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!trackingId) {
      setData(null)
      setError(null)
      return
    }
    const normalized = trackingId.trim()
    setQuery(normalized)
    void fetchReport(normalized)
  }, [trackingId, fetchReport])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalized = query.trim().toUpperCase()
    if (!normalized) {
      setError('Please enter a tracking ID to continue.')
      setData(null)
      return
    }
    if (normalized !== (trackingId ?? '')) {
      navigate(`/track/${normalized}`)
    } else {
      void fetchReport(normalized)
    }
  }

  const reportTitle = data?.title || (data?.category ? `${data.category} report` : 'Report details')
  const requiresManualReview = Boolean(data?.requiresManualReview)

  const locationPoint = useMemo<ReportPoint | null>(() => {
    if (!data || data.locationLat == null || data.locationLng == null) return null
    const lat = Number(data.locationLat)
    const lng = Number(data.locationLng)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
    return {
      id: data.id ?? data.trackingId,
      trackingId: data.trackingId,
      status: data.status,
      category: data.category,
      lat,
      lng
    }
  }, [data])

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold">Track your report</h1>
        <p className="text-secondary">
          Enter the tracking ID from your confirmation email to follow progress.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card flex flex-col gap-4 px-6 py-6 md:flex-row md:items-end">
        <div className="w-full md:flex-1">
          <label className="stat-label">Tracking ID</label>
          <input
            className="input-field mt-2"
            placeholder="e.g. MR-1A2B3C"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <button type="submit" className="btn-primary md:min-w-[160px]">Check status</button>
      </form>

      {loading && <div className="card px-6 py-8 text-secondary">Fetching latest status…</div>}
      {!loading && !data && !error && (
        <div className="card px-6 py-8 text-secondary">
          Enter a tracking ID above to see status updates and department actions.
        </div>
      )}
      {!loading && error && (
        <div className="card border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">{error}</div>
      )}

      {!loading && data && (
        <div className="grid gap-8 lg:grid-cols-[1.1fr,0.9fr]">
          <div className="space-y-6">
            <div className="card px-6 py-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold">{reportTitle}</h2>
                  <p className="text-secondary">Department: {data.department}</p>
                  <p className="mt-1 text-xs font-mono text-neutral-500 dark:text-white/40">Tracking ID: {data.trackingId}</p>
                </div>
                <span className="badge-soft">
                  {data.status}
                </span>
              </div>
              {requiresManualReview && (
                <p className="mt-3 text-sm text-amber-700 dark:text-amber-200">
                  This report is queued for manual review. A coordinator will validate the details before dispatching a response team.
                </p>
              )}
              {data.locationAddress && (
                <p className="mt-4 text-neutral-700 dark:text-white/70">Location: {data.locationAddress}</p>
              )}
              {data.evidence?.length ? (
                <div className="mt-6 space-y-3">
                  <p className="stat-label">Attachments</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {data.evidence.map((file: any) => (
                      <a
                        key={file.id}
                        href={file.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="surface-subtle px-4 py-3 text-sm hover:bg-neutral-200/70 dark:hover:bg-white/10"
                      >
                        View {file.fileType}
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}
              {locationPoint && (
                <div className="mt-6 space-y-2">
                  <p className="stat-label">Map</p>
                  <ReportsMap points={[locationPoint]} height="18rem" />
                  <p className="text-xs text-neutral-500 dark:text-white/50">
                    Coordinates: {locationPoint.lat.toFixed(5)}, {locationPoint.lng.toFixed(5)}
                  </p>
                </div>
              )}
            </div>

            <div className="card px-6 py-6">
              <h3 className="text-lg font-semibold">Status history</h3>
              {Array.isArray(data.logs) && data.logs.length > 0 ? (
                <ol className="mt-5 space-y-4">
                  {data.logs.map((log: any, idx: number) => (
                    <li key={`${log.created_at}-${idx}`} className="relative pl-6">
                      <span className="absolute left-0 top-2 h-2.5 w-2.5 rounded-full bg-brand" />
                      <div className="stat-label">
                        {new Date(log.created_at).toLocaleString()}
                      </div>
                      <div className="font-medium text-neutral-900 dark:text-white">
                        {log.action || log.newStatus || log.status || 'Update'}
                      </div>
                      {log.remarks && <div className="text-secondary">{log.remarks}</div>}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-4 text-secondary">No updates logged yet. Check back again soon.</p>
              )}
            </div>
          </div>

          <aside className="card px-6 py-6">
            <h3 className="text-lg font-semibold">Need help?</h3>
            <p className="mt-2 text-secondary">
              Reach out to your barangay desk or call the Makati Action Center at <span className="font-semibold text-neutral-900 dark:text-white">168</span> for urgent follow ups.
            </p>
            <div className="mt-6 grid gap-3 text-sm text-neutral-700 dark:text-white/60">
              <div className="surface-subtle p-4">
                <p className="text-faint uppercase tracking-wide">Next steps</p>
                <p className="mt-1 text-neutral-700 dark:text-white/70">Use the tracking ID when coordinating with any city offices.</p>
              </div>
              <div className="surface-subtle p-4">
                <p className="text-faint uppercase tracking-wide">Email updates</p>
                <p className="mt-1 text-neutral-700 dark:text-white/70">Turn on notifications in your profile to get updates straight to your inbox.</p>
              </div>
            </div>
          </aside>
        </div>
      )}
    </section>
  )
}
