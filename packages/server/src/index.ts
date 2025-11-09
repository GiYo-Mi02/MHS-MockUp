import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import path from 'path'
import compression from 'compression'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'

import { authRouter } from './routes/auth'
import { departmentsRouter } from './routes/departments'
import { reportsRouter } from './routes/reports'
import { notificationsRouter } from './routes/notifications'
import { dashboardsRouter } from './routes/dashboards'
import { analyticsRouter } from './routes/analytics'
import { getEmailDiagnostics, verifyEmailTransport } from './services/email'
import { checkDatabaseHealth } from './supabase'

const app = express()

const PORT = Number(process.env.PORT || 4000)
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173'

// Trust proxy for rate limiting behind Render's reverse proxy
app.set('trust proxy', 1)

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // Disable for API
  crossOriginEmbedderPolicy: false
}))

// Enable compression for all responses
app.use(compression())

// CORS configuration
app.use(cors({ origin: CORS_ORIGIN, credentials: true }))

// Body parsers with increased limits for file uploads
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))
app.use(cookieParser())

// Rate limiting for API routes (adjust based on needs)
// Set DISABLE_RATE_LIMIT=true for load testing
const isLoadTest = process.env.DISABLE_RATE_LIMIT === 'true'

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: isLoadTest ? 100000 : 100, // 100k for tests, 100 for production
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again later.',
  skip: (req) => {
    // Skip rate limiting for health checks or during load tests
    return req.path === '/api/health' || req.path === '/api/health/email' || isLoadTest
  }
})

// Apply rate limiting to all API routes
app.use('/api/', apiLimiter)

// Separate, more lenient rate limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isLoadTest ? 100000 : 20, // 100k for tests, 20 for production
  skipSuccessfulRequests: false,
  message: 'Too many authentication attempts, please try again later.',
  skip: () => isLoadTest // Skip during load tests
})

app.get('/api/health', async (_req, res) => {
  const dbHealthy = await checkDatabaseHealth()
  res.json({ 
    ok: true, 
    name: 'makati-report', 
    database: dbHealthy ? 'connected' : 'disconnected',
    ts: new Date().toISOString() 
  })
})

app.get('/api/health/email', (_req, res) => {
  res.json(getEmailDiagnostics())
})

// Apply stricter rate limiting to auth routes
app.use('/api/auth', authLimiter, authRouter)

// Regular rate limiting for other routes (via apiLimiter above)
app.use('/api/departments', departmentsRouter)
app.use('/api/reports', reportsRouter)
app.use('/api/notifications', notificationsRouter)
app.use('/api/dashboards', dashboardsRouter)
app.use('/api/analytics', analyticsRouter)

// Static for any uploads (not used when Cloudinary)
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')))

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err)
  res.status(500).json({ error: 'Internal Server Error' })
})

const server = app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`)
  console.log('⚡ Performance optimizations enabled:')
  console.log('  - Compression middleware')
  console.log(isLoadTest 
    ? '  - Rate limiting: DISABLED (Load Test Mode)' 
    : '  - Rate limiting (100 req/min per IP)')
  console.log('  - Helmet security headers')
  console.log('  - 10MB request body limit')
  void verifyEmailTransport()
})

// Optimize server for high concurrency
server.keepAliveTimeout = 65000 // Slightly higher than ALB timeout (60s)
server.headersTimeout = 66000 // Should be higher than keepAliveTimeout
server.maxHeadersCount = 100
server.timeout = 30000 // 30 second timeout for requests

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server')
  server.close(() => {
    console.log('HTTP server closed')
  })
})

export default app
