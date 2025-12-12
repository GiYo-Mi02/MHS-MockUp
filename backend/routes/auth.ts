import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '../services/supabase.js'
import { signToken, setAuthCookie, clearAuthCookie, getTokenFromCookies, verifyToken, requireAuth } from '../services/auth.js'
import { issueVerificationCode, verifyCitizenCode } from '../services/services/verification.js'
import { getTrustMetadata } from '../services/services/trust.js'

const router = Router()

type Role = 'CITIZEN' | 'STAFF' | 'ADMIN'

// POST /api/auth/signup
router.post('/signup', async (req: Request, res: Response) => {
  const { name, email, password, contactNumber = null, isAnonymous = false } = req.body || {}

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Missing fields' })
  }

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
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Email already exists' })
      }
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
    } catch (verifyError) {
      console.error('Failed to issue verification code after signup:', verifyError)
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
    console.error('Signup error:', e)
    res.status(500).json({ error: 'Signup failed' })
  }
})

// POST /api/auth/signin
router.post('/signin', async (req: Request, res: Response) => {
  const { email, password } = req.body || {}
  if (!email || !password) {
    return res.status(400).json({ error: 'Missing fields' })
  }

  let foundUser: any = null

  // Try CITIZEN
  const { data: citizenData } = await supabaseAdmin
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
    const { data: staffData } = await supabaseAdmin
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
    const { data: adminData } = await supabaseAdmin
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
    return res.status(401).json({ error: 'Invalid credentials' })
  }

  const ok = await bcrypt.compare(password, foundUser.password_hash)
  if (!ok) {
    return res.status(401).json({ error: 'Invalid credentials' })
  }

  const tokenPayload = {
    sub: String(foundUser.id),
    role: foundUser.role,
    name: foundUser.name,
    email: foundUser.email,
    departmentId: foundUser.departmentId ? Number(foundUser.departmentId) : null
  }

  const token = signToken(tokenPayload)
  setAuthCookie(res, token)

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

// POST /api/auth/signout
router.post('/signout', (req: Request, res: Response) => {
  clearAuthCookie(res)
  res.json({ ok: true })
})

// GET /api/auth/me
router.get('/me', async (req: Request, res: Response) => {
  const token = getTokenFromCookies(req as any)
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  const payload = verifyToken(token)
  if (!payload) {
    return res.status(401).json({ error: 'Invalid token' })
  }

  let userData: any = null

  if (payload.role === 'CITIZEN') {
    const { data: citizenData, error } = await supabaseAdmin
      .from('citizens')
      .select('citizen_id, full_name, email, is_verified, trust_score, verification_expires_at')
      .eq('citizen_id', Number(payload.sub))
      .single()

    if (error || !citizenData) {
      return res.status(401).json({ error: 'User not found' })
    }

    const trustMeta = getTrustMetadata(citizenData.trust_score)

    // Get reports submitted today
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { count: reportsToday } = await supabaseAdmin
      .from('reports')
      .select('*', { count: 'exact', head: true })
      .eq('citizen_id', citizenData.citizen_id)
      .gte('created_at', oneDayAgo)

    const { count: totalReports } = await supabaseAdmin
      .from('reports')
      .select('*', { count: 'exact', head: true })
      .eq('citizen_id', citizenData.citizen_id)

    userData = {
      id: citizenData.citizen_id,
      name: citizenData.full_name,
      email: citizenData.email,
      role: 'CITIZEN',
      departmentId: null,
      isVerified: Boolean(citizenData.is_verified),
      trustScore: citizenData.trust_score,
      trustLevel: trustMeta.trustLevel,
      dailyReportLimit: trustMeta.dailyReportLimit,
      reportsSubmittedToday: reportsToday || 0,
      totalReportsSubmitted: totalReports || 0,
      verificationExpiresAt: citizenData.verification_expires_at
    }
  } else if (payload.role === 'STAFF') {
    const { data: staffData, error } = await supabaseAdmin
      .from('department_staff')
      .select('staff_id, full_name, email, department_id')
      .eq('staff_id', Number(payload.sub))
      .single()

    if (error || !staffData) {
      return res.status(401).json({ error: 'User not found' })
    }

    userData = {
      id: staffData.staff_id,
      name: staffData.full_name,
      email: staffData.email,
      role: 'STAFF',
      departmentId: staffData.department_id,
      isVerified: true
    }
  } else if (payload.role === 'ADMIN') {
    const { data: adminData, error } = await supabaseAdmin
      .from('admins')
      .select('admin_id, full_name, email')
      .eq('admin_id', Number(payload.sub))
      .single()

    if (error || !adminData) {
      return res.status(401).json({ error: 'User not found' })
    }

    userData = {
      id: adminData.admin_id,
      name: adminData.full_name,
      email: adminData.email,
      role: 'ADMIN',
      departmentId: null,
      isVerified: true
    }
  }

  if (!userData) {
    return res.status(401).json({ error: 'User not found' })
  }

  res.json({ user: userData })
})

// POST /api/auth/verify
router.post('/verify', async (req: Request, res: Response) => {
  const { code, citizenId, email } = req.body || {}
  if (!code) {
    return res.status(400).json({ error: 'Missing code' })
  }

  let targetCitizenId: number | null = null

  // Try to get citizen ID from auth token first
  const token = getTokenFromCookies(req as any)
  if (token) {
    const user = verifyToken(token)
    if (user && user.role === 'CITIZEN') {
      targetCitizenId = Number(user.sub)
    }
  }

  // If not authenticated, require citizenId or email
  if (!targetCitizenId) {
    if (citizenId) {
      targetCitizenId = Number(citizenId)
    } else if (email) {
      const { data: citizen, error } = await supabaseAdmin
        .from('citizens')
        .select('citizen_id')
        .eq('email', email)
        .single()

      if (error || !citizen) {
        return res.status(404).json({ error: 'User not found' })
      }
      targetCitizenId = citizen.citizen_id
    } else {
      return res.status(400).json({ error: 'Missing citizenId or email' })
    }
  }

  if (!targetCitizenId) {
    return res.status(400).json({ error: 'Unable to identify user' })
  }

  const result = await verifyCitizenCode({
    citizenId: targetCitizenId,
    code
  })

  if (!result.success) {
    const messages: Record<string, string> = {
      not_found: 'User not found',
      already_verified: 'Account already verified',
      expired: 'Verification code has expired',
      invalid: 'Invalid verification code'
    }
    console.error(`[verify] Failed for citizen ${targetCitizenId}:`, result.reason)
    return res.status(400).json({ error: messages[result.reason] || 'Verification failed' })
  }

  console.log(`[verify] Success for citizen ${targetCitizenId}`)
  res.json({ ok: true, method: result.method })
})

// POST /api/auth/resend-code
router.post('/resend-code', async (req: Request, res: Response) => {
  const user = requireAuth(req as any, res as any)
  if (!user) return

  const { data: citizen, error } = await supabaseAdmin
    .from('citizens')
    .select('email, is_verified')
    .eq('citizen_id', Number(user.sub))
    .single()

  if (error || !citizen) {
    return res.status(404).json({ error: 'User not found' })
  }

  if (citizen.is_verified) {
    return res.status(400).json({ error: 'Account already verified' })
  }

  try {
    const verification = await issueVerificationCode({
      citizenId: Number(user.sub),
      method: 'email',
      destination: citizen.email
    })

    res.json({
      ok: true,
      expiresAt: verification.expiresAt.toISOString(),
      ...(verification.deliverySkipped || process.env.NODE_ENV !== 'production'
        ? { devCode: verification.code }
        : {})
    })
  } catch (error) {
    console.error('Failed to resend verification code:', error)
    res.status(500).json({ error: 'Failed to send verification code' })
  }
})

// POST /api/auth/verification/request
router.post('/verification/request', async (req: Request, res: Response) => {
  const user = requireAuth(req as any, res as any)
  if (!user) return

  const { method, destination } = req.body || {}
  if (!method || !destination) {
    return res.status(400).json({ error: 'Missing method or destination' })
  }

  try {
    const verification = await issueVerificationCode({
      citizenId: Number(user.sub),
      method,
      destination
    })

    res.json({
      ok: true,
      expiresAt: verification.expiresAt.toISOString(),
      ...(verification.deliverySkipped || process.env.NODE_ENV !== 'production'
        ? { devCode: verification.code }
        : {})
    })
  } catch (error) {
    console.error('Failed to send verification code:', error)
    res.status(500).json({ error: 'Failed to send verification code' })
  }
})

// POST /api/auth/verification/confirm
router.post('/verification/confirm', async (req: Request, res: Response) => {
  const user = requireAuth(req as any, res as any)
  if (!user) return

  const { code } = req.body || {}
  if (!code) {
    return res.status(400).json({ error: 'Missing code' })
  }

  const result = await verifyCitizenCode({
    citizenId: Number(user.sub),
    code
  })

  if (!result.success) {
    const messages: Record<string, string> = {
      not_found: 'User not found',
      already_verified: 'Account already verified',
      expired: 'Verification code has expired',
      invalid: 'Invalid verification code'
    }
    return res.status(400).json({ error: messages[result.reason] || 'Verification failed' })
  }

  res.json({ ok: true, method: result.method })
})

export default router
