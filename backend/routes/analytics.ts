import { Router, Request, Response } from 'express'
import {
  getCategoryMetrics,
  getDepartmentMetrics,
  getHeatmapBuckets,
  getSummaryMetrics,
  getTimeseries,
  resolveDateRange,
  type DateRange
} from '../services/services/analytics.js'

const router = Router()

function serializeRange(range: DateRange) {
  return {
    from: range.from.toISOString(),
    to: range.to.toISOString(),
    days: range.days
  }
}

// GET /api/analytics/:type - Get analytics data by type
router.get('/:type', async (req: Request, res: Response) => {
  try {
    const { type } = req.params
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
})

export default router
