import { Router } from 'express'

import {
  getCategoryMetrics,
  getDepartmentMetrics,
  getHeatmapBuckets,
  getSummaryMetrics,
  getTimeseries,
  resolveDateRange,
  type DateRange
} from '../services/analytics'

function serializeRange(range: DateRange) {
  return {
    from: range.from.toISOString(),
    to: range.to.toISOString(),
    days: range.days
  }
}

export const analyticsRouter = Router()

analyticsRouter.get('/summary', async (req, res, next) => {
  try {
    const range = resolveDateRange(req.query as Record<string, unknown>)
    const summary = await getSummaryMetrics(range)
    res.json({ range: serializeRange(range), summary })
  } catch (error) {
    next(error)
  }
})

analyticsRouter.get('/timeseries', async (req, res, next) => {
  try {
    const range = resolveDateRange(req.query as Record<string, unknown>)
    const timeseries = await getTimeseries(range)
    res.json({ range: serializeRange(range), timeseries })
  } catch (error) {
    next(error)
  }
})

analyticsRouter.get('/departments', async (req, res, next) => {
  try {
    const range = resolveDateRange(req.query as Record<string, unknown>)
    const departments = await getDepartmentMetrics(range)
    res.json({ range: serializeRange(range), departments })
  } catch (error) {
    next(error)
  }
})

analyticsRouter.get('/heatmap', async (req, res, next) => {
  try {
    const range = resolveDateRange(req.query as Record<string, unknown>)
    const precisionParam = Number(req.query.precision)
    const precision = Number.isFinite(precisionParam) ? precisionParam : undefined
    const heatmap = await getHeatmapBuckets(range, precision)
    res.json({ range: serializeRange(range), heatmap })
  } catch (error) {
    next(error)
  }
})

analyticsRouter.get('/categories', async (req, res, next) => {
  try {
    const range = resolveDateRange(req.query as Record<string, unknown>)
    const categories = await getCategoryMetrics(range)
    res.json({ range: serializeRange(range), categories })
  } catch (error) {
    next(error)
  }
})
