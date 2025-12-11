import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  getCategoryMetrics,
  getDepartmentMetrics,
  getHeatmapBuckets,
  getSummaryMetrics,
  getTimeseries,
  resolveDateRange,
  type DateRange
} from '../../services/analytics'

function serializeRange(range: DateRange) {
  return {
    from: range.from.toISOString(),
    to: range.to.toISOString(),
    days: range.days
  }
}

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

  const { type } = req.query

  try {
    const range = resolveDateRange(req.query as Record<string, unknown>)

    switch (type) {
      case 'summary': {
        const summary = await getSummaryMetrics(range)
        return res.json({ range: serializeRange(range), summary })
      }
      case 'timeseries': {
        const timeseries = await getTimeseries(range)
        return res.json({ range: serializeRange(range), timeseries })
      }
      case 'departments': {
        const departments = await getDepartmentMetrics(range)
        return res.json({ range: serializeRange(range), departments })
      }
      case 'heatmap': {
        const precisionParam = Number(req.query.precision)
        const precision = Number.isFinite(precisionParam) ? precisionParam : undefined
        const heatmap = await getHeatmapBuckets(range, precision)
        return res.json({ range: serializeRange(range), heatmap })
      }
      case 'categories': {
        const categories = await getCategoryMetrics(range)
        return res.json({ range: serializeRange(range), categories })
      }
      default:
        return res.status(404).json({ error: 'Unknown analytics type' })
    }
  } catch (error) {
    console.error('Analytics API error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}
