import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../../../supabase'
import { issueVerificationCode } from '../../../services/verification'
import { getTokenFromCookies, verifyToken } from '../../../auth'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Get user from auth token
    const token = getTokenFromCookies(req)
    if (!token) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const user = verifyToken(token)
    if (!user || user.role !== 'CITIZEN') {
      return res.status(403).json({ error: 'Citizen account required' })
    }

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

    const verification = await issueVerificationCode({
      citizenId: Number(user.sub),
      method: 'email',
      destination: citizen.email
    })

    res.json({
      ok: true,
      expiresAt: verification.expiresAt.toISOString(),
      deliverySkipped: verification.deliverySkipped,
      ...(verification.deliverySkipped || process.env.NODE_ENV !== 'production'
        ? { devCode: verification.code }
        : {})
    })
  } catch (error) {
    console.error('Failed to send verification code:', error)
    res.status(500).json({ error: 'Failed to send verification code' })
  }
}
