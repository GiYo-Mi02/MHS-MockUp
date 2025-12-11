import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../../src/server/supabase'
import { requireAuth } from '../../src/server/auth'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,PATCH,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const user = requireAuth(req, res)
  if (!user) return

  const userId = Number(user.sub)
  const userRole = user.role.toLowerCase()

  try {
    if (req.method === 'GET') {
      const { data, error } = await supabaseAdmin
        .from('notifications')
        .select(`
          notification_id,
          report_id,
          message,
          created_at,
          read_at,
          reports!inner (
            tracking_id,
            title,
            status
          )
        `)
        .eq('recipient_type', userRole)
        .eq('recipient_id', userId)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error

      const formatted = data.map(n => ({
        id: n.notification_id,
        reportId: n.report_id,
        trackingId: (n as any).reports?.tracking_id,
        reportTitle: (n as any).reports?.title,
        reportStatus: (n as any).reports?.status,
        message: n.message,
        createdAt: n.created_at,
        readAt: n.read_at
      }))

      return res.json(formatted)
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('Notifications API error:', error)
    res.status(500).json({ error: 'Failed to load notifications' })
  }
}
