import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import path from 'path'

import { authRouter } from './routes/auth'
import { departmentsRouter } from './routes/departments'
import { reportsRouter } from './routes/reports'
import { notificationsRouter } from './routes/notifications'
import { dashboardsRouter } from './routes/dashboards'
import { analyticsRouter } from './routes/analytics'
import { getEmailDiagnostics, verifyEmailTransport } from './services/email'

const app = express()

const PORT = Number(process.env.PORT || 4000)
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173'

app.use(cors({ origin: CORS_ORIGIN, credentials: true }))
app.use(express.json({ limit: '5mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, name: 'makati-report', ts: new Date().toISOString() })
})

app.get('/api/health/email', (_req, res) => {
  res.json(getEmailDiagnostics())
})

app.use('/api/auth', authRouter)
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

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`)
  void verifyEmailTransport()
})
