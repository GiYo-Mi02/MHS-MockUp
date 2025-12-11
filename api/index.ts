import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Unified API Router for Vercel Serverless Functions
 * 
 * This single serverless function handles all API routes to stay within
 * Vercel's Hobby plan limit of 12 functions. Routes are matched by path
 * and delegated to appropriate handlers while keeping business logic separate.
 * 
 * Route Pattern: /api/* -> handled by this function
 */

// Import all route handlers (configured in vercel.json to prevent deployment as separate routes)
import healthHandler from './handlers/health.js'
import departmentsHandler from './handlers/departments.js'
import authHandler from './handlers/auth/[action].js'
import authVerificationRequestHandler from './handlers/auth/verification/request.js'
import authVerificationConfirmHandler from './handlers/auth/verification/confirm.js'
import reportsHandler from './handlers/reports/index.js'
import reportsActionHandler from './handlers/reports/[id]/[action].js'
import reportsTrackHandler from './handlers/reports/track/[trackingId].js'
import notificationsHandler from './handlers/notifications/index.js'
import notificationsReadAllHandler from './handlers/notifications/read-all.js'
import notificationsUnreadCountHandler from './handlers/notifications/unread-count.js'
import notificationReadHandler from './handlers/notifications/[id]/read.js'
import dashboardsHandler from './handlers/dashboards/[type].js'
import analyticsHandler from './handlers/analytics/[type].js'

interface RouteMatch {
  handler: (req: VercelRequest, res: VercelResponse) => Promise<any>
  params?: Record<string, string>
}

/**
 * Extract the API path from the request URL
 * Example: /api/reports/123/status -> reports/123/status
 */
function extractApiPath(req: VercelRequest): string {
  const url = req.url || ''
  // Remove query string
  const pathWithoutQuery = url.split('?')[0]
  // Remove /api prefix
  return pathWithoutQuery.replace(/^\/api\/?/, '')
}

/**
 * Match request path against route patterns
 * Supports static routes and dynamic parameters like [id], [action], etc.
 */
function matchRoute(path: string): RouteMatch | null {
  const segments = path.split('/').filter(Boolean)
  
  // Health check
  if (path === 'health' || path === '') {
    return { handler: healthHandler }
  }
  
  // Departments
  if (path === 'departments') {
    return { handler: departmentsHandler }
  }
  
  // Auth routes
  if (segments[0] === 'auth') {
    if (segments.length === 1) {
      return { handler: authHandler, params: { action: 'status' } }
    }
    if (segments[1] === 'verification') {
      if (segments[2] === 'request') {
        return { handler: authVerificationRequestHandler }
      }
      if (segments[2] === 'confirm') {
        return { handler: authVerificationConfirmHandler }
      }
    }
    // auth/[action] - login, logout, register, verify, etc.
    return { handler: authHandler, params: { action: segments[1] } }
  }
  
  // Reports routes
  if (segments[0] === 'reports') {
    if (segments.length === 1) {
      return { handler: reportsHandler }
    }
    if (segments[1] === 'track' && segments[2]) {
      return { handler: reportsTrackHandler, params: { trackingId: segments[2] } }
    }
    if (segments.length === 3) {
      // reports/[id]/[action]
      return {
        handler: reportsActionHandler,
        params: { id: segments[1], action: segments[2] }
      }
    }
  }
  
  // Notifications routes
  if (segments[0] === 'notifications') {
    if (segments.length === 1) {
      return { handler: notificationsHandler }
    }
    if (segments[1] === 'read-all') {
      return { handler: notificationsReadAllHandler }
    }
    if (segments[1] === 'unread-count') {
      return { handler: notificationsUnreadCountHandler }
    }
    if (segments.length === 3 && segments[2] === 'read') {
      return { handler: notificationReadHandler, params: { id: segments[1] } }
    }
  }
  
  // Dashboards routes
  if (segments[0] === 'dashboards' && segments[1]) {
    return { handler: dashboardsHandler, params: { type: segments[1] } }
  }
  
  // Analytics routes
  if (segments[0] === 'analytics' && segments[1]) {
    return { handler: analyticsHandler, params: { type: segments[1] } }
  }
  
  return null
}

/**
 * Main serverless function handler
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const apiPath = extractApiPath(req)
    const match = matchRoute(apiPath)
    
    if (!match) {
      return res.status(404).json({ 
        error: 'Not found',
        path: apiPath 
      })
    }
    
    // Inject route parameters into the request object
    if (match.params) {
      req.query = { ...req.query, ...match.params }
    }
    
    // Delegate to the appropriate handler
    return await match.handler(req, res)
  } catch (error) {
    console.error('API Router Error:', error)
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

// Vercel serverless function configuration
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb'
    }
  }
}
