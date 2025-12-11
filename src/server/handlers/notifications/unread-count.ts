import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../../supabase'
import { requireAuth } from '../../auth'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const user = requireAuth(req, res)
  if (!user) return

  const userId = Number(user.sub)
  const userRole = user.role.toLowerCase()

  try {
    const { count, error } = await supabaseAdmin
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_type', userRole)
      .eq('recipient_id', userId)
      .is('read_at', null)

    if (error) throw error

    res.json({ count: count || 0 })
  } catch (error) {
    console.error('Failed to get unread count:', error)
    res.json({ count: 0 })
  }
}
