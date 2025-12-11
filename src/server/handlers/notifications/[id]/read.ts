import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../../../src/server/supabase'
import { requireAuth } from '../../../src/server/auth'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*')
  res.setHeader('Access-Control-Allow-Methods', 'PATCH,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const user = requireAuth(req, res)
  if (!user) return

  const { id } = req.query
  const userId = Number(user.sub)
  const userRole = user.role.toLowerCase()

  try {
    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('notification_id', id)
      .eq('recipient_type', userRole)
      .eq('recipient_id', userId)
      .is('read_at', null)

    if (error) throw error

    res.json({ ok: true })
  } catch (error) {
    console.error('Failed to mark notification as read:', error)
    res.status(500).json({ error: 'Failed to update notification' })
  }
}
