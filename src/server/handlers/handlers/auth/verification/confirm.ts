import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../../../src/server/supabase'
import { verifyCitizenCode } from '../../../src/server/services/verification'
import { getTokenFromCookies, verifyToken } from '../../../src/server/auth'

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
        return res.status(400).json({ error: 'Missing citizenId or email. Please log in first.' })
      }
    }

    if (!targetCitizenId) {
      return res.status(400).json({ error: 'Unable to identify user' })
    }

    console.log(`[verify] Attempting verification for citizen ${targetCitizenId} with code: ${code}`)

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
  } catch (error) {
    console.error('Verification API error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}
