import { Router, Request, Response } from 'express'
import { supabaseAdmin } from '../services/supabase.js'
import { requireAuth } from '../services/auth.js'

const router = Router()

// GET /api/notifications - Get all notifications for authenticated user
router.get('/', async (req: Request, res: Response) => {
  try {
    const user = requireAuth(req, res)
    if (!user) return

    const userId = Number(user.sub)
    const userRole = user.role.toLowerCase()

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
  } catch (error) {
    console.error('Notifications API error:', error)
    res.status(500).json({ error: 'Failed to load notifications' })
  }
})

// GET /api/notifications/unread-count - Get unread notification count
router.get('/unread-count', async (req: Request, res: Response) => {
  try {
    const user = requireAuth(req, res)
    if (!user) return

    const userId = Number(user.sub)
    const userRole = user.role.toLowerCase()

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
})

// PATCH /api/notifications/read-all - Mark all notifications as read
router.patch('/read-all', async (req: Request, res: Response) => {
  try {
    const user = requireAuth(req, res)
    if (!user) return

    const userId = Number(user.sub)
    const userRole = user.role.toLowerCase()

    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('recipient_type', userRole)
      .eq('recipient_id', userId)
      .is('read_at', null)

    if (error) throw error

    res.json({ ok: true })
  } catch (error) {
    console.error('Failed to mark all notifications as read:', error)
    res.status(500).json({ error: 'Failed to update notifications' })
  }
})

// PATCH /api/notifications/:id/read - Mark a specific notification as read
router.patch('/:id/read', async (req: Request, res: Response) => {
  try {
    const user = requireAuth(req, res)
    if (!user) return

    const { id } = req.params
    const userId = Number(user.sub)
    const userRole = user.role.toLowerCase()

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
})

export default router
