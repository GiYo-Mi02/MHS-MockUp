import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useToast } from '@/lib/toast'

type HistoryItem = {
  id: number
  trackingId: string
  status: string
  createdAt: string
  isAnonymous: boolean
  requiresManualReview: boolean
}

type TrustLevel = 'LOW' | 'MEDIUM' | 'HIGH'

const POSITIVE_TRUST_STATUSES = new Set(['in progress', 'resolved'])
const NEGATIVE_TRUST_STATUS = 'invalid'

const TRUST_LEVEL_DETAILS: Record<TrustLevel, {
  label: string
  badgeClass: string
  description: string
  goal: string
  range: [number, number]
}> = {
  LOW: {
    label: 'Low trust',
    badgeClass: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200',
    description: 'Reports require manual review and you are limited to one submission per day.',
    goal: 'Raise your trust score above -2 by filing valid reports that move beyond "Manual Review".',
    range: [-8, -1]
  },
  MEDIUM: {
    label: 'Medium trust',
    badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200',
    description: 'You can submit several reports each day while Makati monitors your reliability.',
    goal: 'Reach a trust score of +3 (e.g., consistent valid and resolved reports) to unlock unlimited daily submissions.',
    range: [-2, 3]
  },
  HIGH: {
    label: 'High trust',
    badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200',
    description: 'Unlimited daily submissions with expedited routing thanks to your track record.',
    goal: 'Keep your score at +3 or above—invalid reports can still reduce your trust level.',
    range: [3, 6]
  }
}

export function MyReports() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const { showError } = useToast()
  const [items, setItems] = useState<HistoryItem[]>([])
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    if (!loading) {
      if (!user) {
        navigate('/signin?next=/my-reports', { replace: true })
      }
    }
  }, [loading, user, navigate])

  useEffect(() => {
    if (loading || !user || user.role !== 'CITIZEN') {
      return
    }

    let cancelled = false
    setFetching(true)

    async function loadHistory() {
      try {
        const res = await api.get('/reports/history')
        if (cancelled) return
        const data = Array.isArray(res.data) ? res.data : []
        const normalized = data.map((item: any) => ({
          id: Number(item.id),
          trackingId: String(item.trackingId),
          status: String(item.status ?? 'Pending'),
          createdAt: String(item.createdAt ?? new Date().toISOString()),
          isAnonymous: Boolean(item.isAnonymous),
          requiresManualReview: Boolean(item.requiresManualReview)
        }))
        setItems(normalized)
      } catch (error: any) {
        if (!cancelled) {
          const message = error?.response?.data?.error || 'Failed to load your report history.'
          showError('Unable to load history', message)
          setItems([])
        }
      } finally {
        if (!cancelled) {
          setFetching(false)
        }
      }
    }

    void loadHistory()

    return () => {
      cancelled = true
    }
  }, [loading, user, showError])

  const trustSummary = useMemo(() => {
    if (!user || user.role !== 'CITIZEN') {
      return null
    }

    const GAUGE_MIN = -8
    const GAUGE_MAX = 6
    const gaugeSpan = GAUGE_MAX - GAUGE_MIN

    const rawScore = typeof user.trustScore === 'number' && Number.isFinite(user.trustScore) ? user.trustScore : 0
    const inferredLevel: TrustLevel =
      (user.trustLevel as TrustLevel | undefined) ?? (rawScore <= -2 ? 'LOW' : rawScore >= 3 ? 'HIGH' : 'MEDIUM')
    const details = TRUST_LEVEL_DETAILS[inferredLevel]
    const dailyLimit = user.dailyReportLimit ?? null
    const reportsToday = user.reportsSubmittedToday ?? 0
    const totalReports = user.totalReportsSubmitted ?? 0
    const [rangeMin, rangeMax] = details.range
    const clampedScore = Math.max(rangeMin, Math.min(rawScore, rangeMax))
    const rangeSpan = Math.max(1, rangeMax - rangeMin)
    const progress = Math.max(0, Math.min((clampedScore - rangeMin) / rangeSpan, 1))
    const overallProgress = Math.max(0, Math.min((rawScore - GAUGE_MIN) / gaugeSpan, 1))
    const progressPercent = Math.round(progress * 100)

    const trustImpact = items.reduce(
      (acc, item) => {
        const status = (item.status || '').toLowerCase()
        if (POSITIVE_TRUST_STATUSES.has(status)) acc.positive += 1
        if (status === NEGATIVE_TRUST_STATUS) acc.negative += 1
        return acc
      },
      { positive: 0, negative: 0 }
    )

    const dailyUsageText = dailyLimit === null
      ? 'Unlimited daily submissions'
      : `${reportsToday}/${dailyLimit} reports used today`

    const nextThreshold = inferredLevel === 'HIGH' ? null : inferredLevel === 'MEDIUM' ? 3 : -2

    const gaugeTickConfig = [
      { value: -2, label: 'Medium tier' },
      { value: 0, label: 'Neutral' },
      { value: 3, label: 'High tier' }
    ]

    const tickMarks = gaugeTickConfig
      .filter((tick) => tick.value >= GAUGE_MIN && tick.value <= GAUGE_MAX)
      .map((tick) => ({
        ...tick,
        position: Math.max(0, Math.min((tick.value - GAUGE_MIN) / gaugeSpan, 1))
      }))

    return {
      score: rawScore,
      level: inferredLevel,
      details,
      dailyLimit,
      reportsToday,
      totalReports,
      progress,
      overallProgress,
  progressPercent,
      rangeMin,
      rangeMax,
      dailyUsageText,
      positiveCount: trustImpact.positive,
      negativeCount: trustImpact.negative,
      nextThreshold,
      tickMarks,
      gaugeRange: { min: GAUGE_MIN, max: GAUGE_MAX }
    }
  }, [user, items])

  const content = useMemo(() => {
    if (loading || fetching) {
      return <div className="card px-6 py-6 text-secondary">Loading your recent submissions…</div>
    }

    if (!user || user.role !== 'CITIZEN') {
      return (
        <div className="card px-6 py-8">
          <h1 className="text-2xl font-semibold">Citizen account required</h1>
          <p className="mt-2 text-secondary">Only citizen accounts can view personal report history.</p>
        </div>
      )
    }

    if (items.length === 0) {
      return (
        <div className="card px-6 py-8 text-secondary">
          No submissions yet. Once you file a report, its tracking ID will appear here for quick access.
        </div>
      )
    }

    return (
      <div className="card overflow-hidden">
        <table className="min-w-full divide-y divide-neutral-200 text-sm text-neutral-700 dark:divide-white/10 dark:text-white/70">
          <thead className="bg-neutral-100 text-xs uppercase tracking-wide text-neutral-600 dark:bg-white/5 dark:text-white/50">
            <tr>
              <th className="px-4 py-3 text-left">Tracking ID</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Submitted</th>
              <th className="px-4 py-3 text-left">Anonymous</th>
              <th className="px-4 py-3 text-left" aria-label="Actions" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-white/10">
            {items.map((item) => (
              <tr key={item.id} className="bg-neutral-100/40 transition hover:bg-neutral-200/70 dark:bg-white/[0.02] dark:hover:bg-white/10">
                <td className="px-4 py-3 font-mono text-xs text-neutral-800 dark:text-white/80">{item.trackingId}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1">
                    <span className="badge-outline">{item.status}</span>
                    {item.requiresManualReview && (
                      <span className="text-[11px] text-amber-700 dark:text-amber-300">Queued for manual review</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-faint">{new Date(item.createdAt).toLocaleString()}</td>
                <td className="px-4 py-3 text-faint">{item.isAnonymous ? 'Yes' : 'No'}</td>
                <td className="px-4 py-3 text-right">
                  <Link
                    to={`/track/${item.trackingId}`}
                    className="btn-secondary px-3 py-1 text-xs"
                  >
                    Track status
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }, [items, loading, fetching, user])

  return (
    <section className="mx-auto max-w-4xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold">My report history</h1>
        <p className="text-secondary">
          Keep a record of every tracking ID you file. Anonymous submissions stay private, but you can still follow progress here.
        </p>
      </div>
      {trustSummary && (
        <div className="grid gap-4 lg:grid-cols-[1.3fr,0.7fr]">
          <div className="card px-6 py-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-neutral-500 dark:text-white/50">Trust score</p>
                <div className="flex items-baseline gap-3">
                  <span className="text-3xl font-semibold text-neutral-900 dark:text-white">
                    {trustSummary.score >= 0 ? '+' : ''}{trustSummary.score.toFixed(1)}
                  </span>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${trustSummary.details.badgeClass}`}>
                    {trustSummary.details.label}
                  </span>
                </div>
              </div>
              <div className="max-w-[220px] text-right text-sm text-neutral-500 dark:text-white/60">
                {trustSummary.details.description}
              </div>
            </div>
            <div className="mt-6 grid gap-6 lg:grid-cols-[auto,1fr] lg:items-center">
              <div className="flex flex-col items-center gap-3">
                <div className="relative h-40 w-72 max-w-full">
                  <svg viewBox="0 0 120 70" className="h-full w-full text-neutral-300 dark:text-white/20">
                    <defs>
                      <linearGradient id="trustGaugeGradient" x1="10" y1="60" x2="110" y2="60" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor="#ef4444" />
                        <stop offset="55%" stopColor="#f97316" />
                        <stop offset="100%" stopColor="#22c55e" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M10 60 A50 50 0 0 1 110 60"
                      fill="transparent"
                      stroke="currentColor"
                      strokeWidth={10}
                      strokeLinecap="round"
                      className="opacity-40"
                      pathLength={1}
                    />
                    <path
                      d="M10 60 A50 50 0 0 1 110 60"
                      fill="transparent"
                      stroke="url(#trustGaugeGradient)"
                      strokeWidth={10}
                      strokeLinecap="round"
                      pathLength={1}
                      style={{ strokeDasharray: 1, strokeDashoffset: 1 - trustSummary.overallProgress }}
                    />
                    {trustSummary.tickMarks.map((tick) => {
                      const angle = (-90 + tick.position * 180) * (Math.PI / 180)
                      const cx = 60
                      const cy = 60
                      const outerRadius = 50
                      const innerRadius = 44
                      const x1 = cx + Math.cos(angle) * innerRadius
                      const y1 = cy + Math.sin(angle) * innerRadius
                      const x2 = cx + Math.cos(angle) * outerRadius
                      const y2 = cy + Math.sin(angle) * outerRadius
                      return (
                        <g key={tick.value}>
                          <line
                            x1={x1}
                            y1={y1}
                            x2={x2}
                            y2={y2}
                            stroke="currentColor"
                            strokeWidth={1.5}
                            className="opacity-70"
                          />
                        </g>
                      )
                    })}
                  </svg>
                  <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
                    <span className="text-lg font-semibold text-neutral-900 dark:text-white">
                      {trustSummary.progressPercent}%
                    </span>
                    <span className="text-xs text-neutral-500 dark:text-white/60">progress to next tier</span>
                  </div>
                </div>
                <p className="text-center text-xs text-neutral-500 dark:text-white/60">
                  {trustSummary.nextThreshold === null
                    ? 'Stay above +3 to keep your top-tier benefits.'
                    : trustSummary.level === 'LOW'
                      ? 'Bring your score to -2 or higher to move into Medium trust.'
                      : 'Reach +3 to unlock High trust benefits.'}
                </p>
              </div>
              <div className="space-y-4 text-sm">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-wide text-neutral-500 dark:text-white/60">Daily limit</p>
                    <p className="font-medium text-neutral-800 dark:text-white/80">{trustSummary.dailyUsageText}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-wide text-neutral-500 dark:text-white/60">Reports on record</p>
                    <p className="font-medium text-neutral-800 dark:text-white/80">{trustSummary.totalReports}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-wide text-neutral-500 dark:text-white/60">Today&apos;s usage</p>
                    <p className="font-medium text-neutral-800 dark:text-white/80">{trustSummary.reportsToday}</p>
                  </div>
                </div>
                <p className="text-xs text-neutral-500 dark:text-white/60">
                  {trustSummary.details.goal}
                </p>
              </div>
            </div>
          </div>
          <aside className="card px-6 py-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Trust impact tracker</h2>
              <p className="mt-1 text-sm text-neutral-600 dark:text-white/70">
                How your recent reports are shaping your score.
              </p>
            </div>
            <div className="space-y-3 text-sm">
              <div className="surface-subtle flex items-center justify-between rounded-xl px-4 py-3">
                <span className="font-medium text-neutral-700 dark:text-white/80">Positive outcomes</span>
                <span className="text-base font-semibold text-emerald-600 dark:text-emerald-300">{trustSummary.positiveCount}</span>
              </div>
              <div className="surface-subtle flex items-center justify-between rounded-xl px-4 py-3">
                <span className="font-medium text-neutral-700 dark:text-white/80">Invalidated reports</span>
                <span className="text-base font-semibold text-red-600 dark:text-red-300">{trustSummary.negativeCount}</span>
              </div>
            </div>
            <ul className="list-disc space-y-2 pl-5 text-xs text-neutral-500 dark:text-white/60">
              <li>Resolved or in-progress reports boost your trust score.</li>
              <li>Invalid reports subtract trust quickly—double-check before submitting.</li>
              <li>Manual review is faster when you attach evidence and precise locations.</li>
            </ul>
          </aside>
        </div>
      )}
      {content}
      {user?.role === 'CITIZEN' && (
        <div className="text-sm text-secondary">
          Need to file a new issue?{' '}
          <Link to="/report" className="text-brand hover:text-brand-focus dark:text-brand-softer dark:hover:text-white">Submit another report</Link>.
        </div>
      )}
    </section>
  )
}
