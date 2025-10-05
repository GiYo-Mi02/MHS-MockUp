import { Router, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { pool } from '../db'
import { requireAuth } from '../auth'
import { issueVerificationCode, verifyCitizenCode, type VerificationMethod } from '../services/verification'
import { getTrustMetadata } from '../services/trust'

export const authRouter = Router()

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret'
const TOKEN_COOKIE = 'mr_token'

type Role = 'CITIZEN' | 'STAFF' | 'ADMIN'

authRouter.post('/signup', async (req, res) => {
  const {
    name,
    email,
    password,
    contactNumber = null,
    isAnonymous = false
  } = req.body || {}

  if (!email || !password || !name) return res.status(400).json({ error: 'Missing fields' })

  const hash = await bcrypt.hash(password, 10)

  try {
    const [result] = await pool.query(
      `INSERT INTO citizens (full_name, contact_number, email, password_hash, is_anonymous)
       VALUES (?, ?, ?, ?, ?)`
      , [name, contactNumber, email, hash, !!isAnonymous]
    )
    const insertId = (result as any).insertId
    let devVerificationCode: string | undefined
    try {
      const verification = await issueVerificationCode({
        citizenId: insertId,
        method: 'email',
        destination: email
      })
      if (verification.deliverySkipped || process.env.NODE_ENV !== 'production') {
        devVerificationCode = verification.code
      }
    } catch (error) {
      console.error('Failed to issue verification code after signup:', error)
    }

    res.json({
      id: insertId,
      name,
      email,
      role: 'CITIZEN',
      verification: {
        required: true,
        ...(devVerificationCode ? { devCode: devVerificationCode } : undefined)
      }
    })
  } catch (e: any) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Email already exists' })
    console.error(e)
    res.status(500).json({ error: 'Signup failed' })
  }
})

authRouter.post('/signin', async (req, res) => {
  const { email, password } = req.body || {}
  if (!email || !password) return res.status(400).json({ error: 'Missing fields' })

  const queries = [
    {
      role: 'CITIZEN' as Role,
      sql: `SELECT citizen_id AS id, full_name AS name, email, password_hash, NULL AS departmentId FROM citizens WHERE email = ?`
    },
    {
      role: 'STAFF' as Role,
      sql: `SELECT staff_id AS id, full_name AS name, email, password_hash, department_id AS departmentId FROM department_staff WHERE email = ?`
    },
    {
      role: 'ADMIN' as Role,
      sql: `SELECT admin_id AS id, full_name AS name, email, password_hash, NULL AS departmentId FROM admins WHERE email = ?`
    }
  ]

  let foundUser: any = null

  for (const entry of queries) {
    const [rows] = await pool.query(entry.sql, [email])
    const list = rows as any[]
    if (list.length) {
      foundUser = { ...list[0], role: entry.role }
      break
    }
  }

  if (!foundUser) return res.status(401).json({ error: 'Invalid credentials' })

  const ok = await bcrypt.compare(password, foundUser.password_hash)
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' })

  const tokenPayload = {
    sub: String(foundUser.id),
    role: foundUser.role,
    name: foundUser.name,
    email: foundUser.email,
    departmentId: foundUser.departmentId ? Number(foundUser.departmentId) : null
  }

  const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' })
  res.cookie(TOKEN_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: false, maxAge: 7 * 24 * 3600 * 1000 })
  res.json({ ok: true, user: { ...tokenPayload } })
})

authRouter.post('/signout', (_req, res) => {
  res.clearCookie(TOKEN_COOKIE)
  res.json({ ok: true })
})

// Return current user from JWT cookie
authRouter.get('/me', async (req: Request, res: Response) => {
  try {
    const token = req.cookies?.[TOKEN_COOKIE]
    if (!token) return res.status(401).json({ error: 'Not authenticated' })
    const payload = jwt.verify(token, JWT_SECRET) as { sub: string; role: Role; departmentId: number | null }

    let sql: string
    if (payload.role === 'CITIZEN') {
      sql = `SELECT citizen_id AS id,
                     full_name AS name,
                     email,
                     is_verified,
                     trust_score,
                     verification_expires_at
                FROM citizens
               WHERE citizen_id = ?
               LIMIT 1`
    } else if (payload.role === 'STAFF') {
      sql = 'SELECT staff_id AS id, full_name AS name, email, department_id AS departmentId FROM department_staff WHERE staff_id = ? LIMIT 1'
    } else {
      sql = 'SELECT admin_id AS id, full_name AS name, email FROM admins WHERE admin_id = ? LIMIT 1'
    }

    const [rows] = await pool.query(sql, [payload.sub])
    const users = rows as any[]
    if (!users[0]) return res.status(401).json({ error: 'User not found' })
    const u = users[0]

    if (payload.role === 'CITIZEN') {
      const trustScore = Number(u.trust_score ?? 0)
      const { trustLevel, dailyReportLimit } = getTrustMetadata(trustScore)
      const [reportRows] = await pool.query(
        'SELECT COUNT(*) AS total FROM reports WHERE citizen_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)',
        [payload.sub]
      )
      const reportsToday = Number((reportRows as any[])[0]?.total ?? 0)
      const [totalRows] = await pool.query(
        'SELECT COUNT(*) AS total FROM reports WHERE citizen_id = ?',
        [payload.sub]
      )
      const totalReports = Number((totalRows as any[])[0]?.total ?? 0)

      return res.json({
        user: {
          id: u.id,
          name: u.name,
          email: u.email,
          role: payload.role,
          departmentId: null,
          isVerified: Boolean(u.is_verified),
          trustScore,
          trustLevel,
          dailyReportLimit,
          reportsSubmittedToday: reportsToday,
          totalReportsSubmitted: totalReports,
          verificationExpiresAt: u.verification_expires_at
            ? new Date(u.verification_expires_at).toISOString()
            : null
        }
      })
    }

    return res.json({
      user: {
        id: u.id,
        name: u.name,
        email: u.email,
        role: payload.role,
        departmentId: u.departmentId ? Number(u.departmentId) : payload.departmentId || null
      }
    })
  } catch (e) {
    console.error(e)
    return res.status(401).json({ error: 'Invalid token' })
  }
})

authRouter.post('/verification/request', requireAuth, async (req: Request, res: Response) => {
  const session = (req as any).user as { sub: string; role: Role }
  if (!session || session.role !== 'CITIZEN') {
    return res.status(403).json({ error: 'Citizen account required' })
  }

  const rawMethod = typeof req.body?.method === 'string' ? req.body.method.toLowerCase() : 'email'
  const method: VerificationMethod = rawMethod === 'phone' ? 'phone' : 'email'

  const [rows] = await pool.query(
    'SELECT email, contact_number, is_verified FROM citizens WHERE citizen_id = ? LIMIT 1',
    [session.sub]
  )
  const citizen = (rows as any[])[0]
  if (!citizen) {
    return res.status(404).json({ error: 'Citizen account not found' })
  }

  if (citizen.is_verified) {
    return res.json({ ok: true, alreadyVerified: true })
  }

  const destination = method === 'email' ? citizen.email : citizen.contact_number
  if (!destination) {
    return res.status(400).json({ error: `No ${method === 'email' ? 'email' : 'phone number'} on file.` })
  }

  try {
    const issued = await issueVerificationCode({
      citizenId: Number(session.sub),
      method,
      destination
    })

    const payload: Record<string, any> = {
      ok: true,
      delivery: method,
      expiresAt: issued.expiresAt.toISOString()
    }

    if (issued.deliverySkipped || process.env.NODE_ENV !== 'production') {
      payload.code = issued.code
      payload.deliverySkipped = issued.deliverySkipped
    }

    return res.json(payload)
  } catch (error) {
    console.error('Failed to issue verification code:', error)
    return res.status(500).json({ error: 'Unable to send verification code right now.' })
  }
})

authRouter.post('/verification/confirm', requireAuth, async (req: Request, res: Response) => {
  const session = (req as any).user as { sub: string; role: Role }
  if (!session || session.role !== 'CITIZEN') {
    return res.status(403).json({ error: 'Citizen account required' })
  }

  const code = typeof req.body?.code === 'string' ? req.body.code.trim() : ''
  if (!code) {
    return res.status(400).json({ error: 'Verification code is required.' })
  }

  const result = await verifyCitizenCode({ citizenId: Number(session.sub), code })
  if (!result.success) {
    if (result.reason === 'already_verified') {
      return res.json({ ok: true, alreadyVerified: true })
    }
    if (result.reason === 'expired') {
      return res.status(410).json({ error: 'Verification code expired. Please request a new one.' })
    }
    if (result.reason === 'invalid') {
      return res.status(400).json({ error: 'Invalid verification code.' })
    }
    return res.status(404).json({ error: 'Citizen account not found.' })
  }

  const [rows] = await pool.query(
    'SELECT trust_score FROM citizens WHERE citizen_id = ? LIMIT 1',
    [session.sub]
  )
  const citizen = (rows as any[])[0]
  const trustScore = Number(citizen?.trust_score ?? 0)
  const { trustLevel, dailyReportLimit } = getTrustMetadata(trustScore)

  return res.json({
    ok: true,
    method: result.method,
    trustScore,
    trustLevel,
    dailyReportLimit
  })
})
