import { Router, Request, Response } from 'express'
import { pool } from '../db'
import { requireAuth } from '../auth'

export const notificationsRouter = Router()

// Get notifications for current user
notificationsRouter.get('/', requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user as { sub: string; role: string }
  const userId = Number(user.sub)
  const userRole = user.role.toLowerCase()

  try {
    const [rows] = await pool.query(
      `SELECT n.notification_id AS id,
              n.report_id AS reportId,
              r.tracking_id AS trackingId,
              r.title AS reportTitle,
              r.status AS reportStatus,
              n.message,
              n.created_at AS createdAt,
              n.read_at AS readAt
       FROM notifications n
       LEFT JOIN reports r ON r.report_id = n.report_id
       WHERE n.recipient_type = ? AND n.recipient_id = ?
       ORDER BY n.created_at DESC 
       LIMIT 50`,
      [userRole, userId]
    )
    
    res.json(rows)
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
    await pool.query(
      `UPDATE notifications 
       SET read_at = NOW() 
       WHERE notification_id = ? AND recipient_type = ? AND recipient_id = ? AND read_at IS NULL`,
      [id, userRole, userId]
    )
    
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
    await pool.query(
      `UPDATE notifications 
       SET read_at = NOW() 
       WHERE recipient_type = ? AND recipient_id = ? AND read_at IS NULL`,
      [userRole, userId]
    )
    
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
    const [rows] = await pool.query(
      `SELECT COUNT(*) as count
       FROM notifications 
       WHERE recipient_type = ? AND recipient_id = ? AND read_at IS NULL`,
      [userRole, userId]
    )
    
    const count = (rows as any[])[0]?.count || 0
    res.json({ count: Number(count) })
  } catch (error) {
    console.error('Failed to get unread count:', error)
    res.json({ count: 0 })
  }
})
