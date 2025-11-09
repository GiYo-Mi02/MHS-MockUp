import { Router, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '../supabase'
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
    const { data: result, error } = await supabaseAdmin
      .from('citizens')
      .insert({
        full_name: name,
        contact_number: contactNumber,
        email,
        password_hash: hash,
        is_anonymous: !!isAnonymous
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'Email already exists' })
      throw error
    }

    const insertId = result.citizen_id
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
    console.error(e)
    res.status(500).json({ error: 'Signup failed' })
  }
})

authRouter.post('/signin', async (req, res) => {
  const { email, password } = req.body || {}
  if (!email || !password) return res.status(400).json({ error: 'Missing fields' })

  let foundUser: any = null

  // Try CITIZEN
  const { data: citizenData, error: citizenError } = await supabaseAdmin
    .from('citizens')
    .select('citizen_id, full_name, email, password_hash, is_verified')
    .eq('email', email)
    .single()

  if (citizenData) {
    foundUser = {
      id: citizenData.citizen_id,
      name: citizenData.full_name,
      email: citizenData.email,
      password_hash: citizenData.password_hash,
      role: 'CITIZEN' as Role,
      departmentId: null,
      isVerified: Boolean(citizenData.is_verified)
    }
  }

  // Try STAFF
  if (!foundUser) {
    const { data: staffData, error: staffError } = await supabaseAdmin
      .from('department_staff')
      .select('staff_id, full_name, email, password_hash, department_id')
      .eq('email', email)
      .single()

    if (staffData) {
      foundUser = {
        id: staffData.staff_id,
        name: staffData.full_name,
        email: staffData.email,
        password_hash: staffData.password_hash,
        role: 'STAFF' as Role,
        departmentId: staffData.department_id
      }
    }
  }

  // Try ADMIN
  if (!foundUser) {
    const { data: adminData, error: adminError } = await supabaseAdmin
      .from('admins')
      .select('admin_id, full_name, email, password_hash')
      .eq('email', email)
      .single()

    if (adminData) {
      foundUser = {
        id: adminData.admin_id,
        name: adminData.full_name,
        email: adminData.email,
        password_hash: adminData.password_hash,
        role: 'ADMIN' as Role,
        departmentId: null
      }
    }
  }

  if (!foundUser) {
    console.error('[signin] User not found for email:', email)
    return res.status(401).json({ error: 'Invalid credentials' })
  }

  const ok = await bcrypt.compare(password, foundUser.password_hash)
  if (!ok) {
    console.error('[signin] Invalid password for user:', email)
    return res.status(401).json({ error: 'Invalid credentials' })
  }

  const tokenPayload = {
    sub: String(foundUser.id),
    role: foundUser.role,
    name: foundUser.name,
    email: foundUser.email,
    departmentId: foundUser.departmentId ? Number(foundUser.departmentId) : null
  }

  const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' })
  res.cookie(TOKEN_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: false, maxAge: 7 * 24 * 3600 * 1000 })
  console.log('[signin] Signed in user:', email, 'with role:', foundUser.role)
  
  // Return user data with isVerified flag (citizens may be unverified)
  const responseUser = {
    id: foundUser.id,
    name: foundUser.name,
    email: foundUser.email,
    role: foundUser.role,
    departmentId: foundUser.departmentId,
    ...(foundUser.role === 'CITIZEN' ? { isVerified: Boolean((foundUser as any).isVerified) } : { isVerified: true })
  }

  res.json({ ok: true, user: responseUser })
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

    let userData: any = null

    if (payload.role === 'CITIZEN') {
      const { data: citizenData, error } = await supabaseAdmin
        .from('citizens')
        .select('citizen_id, full_name, email, is_verified, trust_score, verification_expires_at')
        .eq('citizen_id', Number(payload.sub))
        .single()

      if (error || !citizenData) {
        console.error('[auth/me] Failed to load citizen data:', error)
        return res.status(401).json({ error: 'User not found' })
      }
      userData = {
        id: citizenData.citizen_id,
        name: citizenData.full_name,
        email: citizenData.email,
        is_verified: citizenData.is_verified,
        trust_score: citizenData.trust_score,
        verification_expires_at: citizenData.verification_expires_at
      }
    } else if (payload.role === 'STAFF') {
      const { data: staffData, error } = await supabaseAdmin
        .from('department_staff')
        .select('staff_id, full_name, email, department_id')
        .eq('staff_id', Number(payload.sub))
        .single()

      if (error || !staffData) {
        console.error('[auth/me] Failed to load staff data:', error)
        return res.status(401).json({ error: 'User not found' })
      }
      userData = {
        id: staffData.staff_id,
        name: staffData.full_name,
        email: staffData.email,
        departmentId: staffData.department_id
      }
    } else {
      const { data: adminData, error } = await supabaseAdmin
        .from('admins')
        .select('admin_id, full_name, email')
        .eq('admin_id', Number(payload.sub))
        .single()

      if (error || !adminData) {
        console.error('[auth/me] Failed to load admin data:', error)
        return res.status(401).json({ error: 'User not found' })
      }
      userData = {
        id: adminData.admin_id,
        name: adminData.full_name,
        email: adminData.email
      }
    }

    if (payload.role === 'CITIZEN') {
      const trustScore = Number(userData.trust_score ?? 0)
      const { trustLevel, dailyReportLimit } = getTrustMetadata(trustScore)
      
      const { count: reportsToday } = await supabaseAdmin
        .from('reports')
        .select('*', { count: 'exact', head: true })
        .eq('citizen_id', payload.sub)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

      const { count: totalReports } = await supabaseAdmin
        .from('reports')
        .select('*', { count: 'exact', head: true })
        .eq('citizen_id', payload.sub)

      // Normalize DB timestamp without timezone as UTC; append 'Z' if missing
      const rawExp = userData.verification_expires_at as string | null
      const verificationExpiresAtIso = rawExp
        ? (/Z$|[+-]\d{2}:\d{2}$/.test(String(rawExp))
            ? new Date(String(rawExp)).toISOString()
            : new Date(String(rawExp) + 'Z').toISOString())
        : null

      return res.json({
        user: {
          id: userData.id,
          name: userData.name,
          email: userData.email,
          role: payload.role,
          departmentId: null,
          isVerified: Boolean(userData.is_verified),
          trustScore,
          trustLevel,
          dailyReportLimit,
          reportsSubmittedToday: reportsToday ?? 0,
          totalReportsSubmitted: totalReports ?? 0,
          verificationExpiresAt: verificationExpiresAtIso
        }
      })
    }

    return res.json({
      user: {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        role: payload.role,
        departmentId: userData.departmentId ? Number(userData.departmentId) : payload.departmentId || null
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

  const { data: citizen, error } = await supabaseAdmin
    .from('citizens')
    .select('email, contact_number, is_verified')
    .eq('citizen_id', Number(session.sub))
    .single()

  if (error || !citizen) {
    console.error('[verification/request] Failed to load citizen:', error)
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

  const { data: citizen } = await supabaseAdmin
    .from('citizens')
    .select('trust_score')
    .eq('citizen_id', session.sub)
    .single()

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
