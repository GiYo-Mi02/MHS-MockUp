import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

export type Notification = {
  id: number
  reportId: number
  trackingId?: string | null
  reportTitle?: string | null
  reportStatus?: string | null
  message: string
  createdAt: string
  readAt: string | null
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const fetchNotifications = async () => {
    try {
      const [notifRes, countRes] = await Promise.all([
        api.get('/notifications'),
        api.get('/notifications/unread-count')
      ])
      const notificationsData: Notification[] = Array.isArray(notifRes.data)
        ? notifRes.data.map((item: any) => ({
            id: item.id,
            reportId: item.reportId,
            trackingId: item.trackingId ?? null,
            reportTitle: item.reportTitle ?? null,
            reportStatus: item.reportStatus ?? null,
            message: item.message,
            createdAt: item.createdAt,
            readAt: item.readAt || null
          }))
        : []
      setNotifications(notificationsData)
      setUnreadCount(countRes.data.count || 0)
    } catch (error) {
      console.error('Failed to fetch notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  const markAsRead = async (id: number) => {
    try {
      await api.patch(`/notifications/${id}/read`)
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, readAt: new Date().toISOString() } : n)
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (error) {
      console.error('Failed to mark notification as read:', error)
    }
  }

  const markAllAsRead = async () => {
    try {
      await api.patch('/notifications/read-all')
      setNotifications(prev => 
        prev.map(n => ({ ...n, readAt: n.readAt || new Date().toISOString() }))
      )
      setUnreadCount(0)
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error)
    }
  }

  useEffect(() => {
    fetchNotifications()
    
    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [])

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    refresh: fetchNotifications
  }
}