import { Router, Request, Response } from 'express'
import { supabaseAdmin } from '../supabase'
import { requireAuth } from '../auth'

export const notificationsRouter = Router()

// Get notifications for current user
notificationsRouter.get('/', requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user as { sub: string; role: string }
  const userId = Number(user.sub)
  const userRole = user.role.toLowerCase()

  try {
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
    
    res.json(formatted)
  } catch (error) {
    console.error('Failed to fetch notifications:', error)
    res.status(500).json({ error: 'Failed to load notifications' })
  }
})

// Mark notification as read
notificationsRouter.patch('/:id/read', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params
  const user = (req as any).user as { sub: string; role: string }
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
})

// Mark all notifications as read
notificationsRouter.patch('/read-all', requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user as { sub: string; role: string }
  const userId = Number(user.sub)
  const userRole = user.role.toLowerCase()

  try {
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

// Get unread count
notificationsRouter.get('/unread-count', requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user as { sub: string; role: string }
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
})
