import type { VercelRequest, VercelResponse } from '@vercel/node'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '../../src/server/supabase'
import { signToken, setAuthCookie, clearAuthCookie, getTokenFromCookies, verifyToken, requireAuth } from '../../src/server/auth'
import { issueVerificationCode, verifyCitizenCode, type VerificationMethod } from '../../src/server/services/verification'
import { getTrustMetadata } from '../../src/server/services/trust'

type Role = 'CITIZEN' | 'STAFF' | 'ADMIN'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const { action } = req.query

  try {
    switch (action) {
      case 'signup':
        return handleSignup(req, res)
      case 'signin':
        return handleSignin(req, res)
      case 'signout':
        return handleSignout(req, res)
      case 'me':
        return handleMe(req, res)
      case 'verify':
        return handleVerify(req, res)
      case 'resend-code':
        return handleResendCode(req, res)
      default:
        return res.status(404).json({ error: 'Not found' })
    }
  } catch (error) {
    console.error('Auth API error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

async function handleSignup(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

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
}

async function handleSignin(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

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
}

async function handleSignout(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  clearAuthCookie(res)
  res.json({ ok: true })
}

async function handleMe(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const token = getTokenFromCookies(req)
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
}

async function handleVerify(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { code, citizenId, email } = req.body || {}
  if (!code) {
    return res.status(400).json({ error: 'Missing code' })
  }

  // Support both authenticated and unauthenticated verification
  let targetCitizenId: number | null = null

  // Try to get citizen ID from auth token first (for logged-in users)
  const token = getTokenFromCookies(req)
  if (token) {
    const user = verifyToken(token)
    if (user && user.role === 'CITIZEN') {
      targetCitizenId = Number(user.sub)
    }
  }

  // If not authenticated, require either citizenId or email in request body
  if (!targetCitizenId) {
    if (citizenId) {
      targetCitizenId = Number(citizenId)
    } else if (email) {
      // Look up citizen by email
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
}

async function handleResendCode(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const user = requireAuth(req, res)
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
}
