import express, { Request, Response } from 'express'
import cors from 'cors'

// Import routes
import healthRoutes from './routes/health.js'
import departmentsRoutes from './routes/departments.js'
import authRoutes from './routes/auth.js'
import reportsRoutes from './routes/reports.js'
import notificationsRoutes from './routes/notifications.js'
import dashboardsRoutes from './routes/dashboards.js'
import analyticsRoutes from './routes/analytics.js'

const app = express()

// Middleware
app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// API Routes
app.use('/api/health', healthRoutes)
app.use('/api/departments', departmentsRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/reports', reportsRoutes)
app.use('/api/notifications', notificationsRoutes)
app.use('/api/dashboards', dashboardsRoutes)
app.use('/api/analytics', analyticsRoutes)

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' })
})

// Error handler
app.use((err: any, req: Request, res: Response, next: any) => {
  console.error('Error:', err)
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  })
})

// Essential for Vercel serverless
export default app
