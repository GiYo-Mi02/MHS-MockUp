import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useNotifications, Notification } from '@/lib/notifications'
import { useAuth } from '@/lib/auth'

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffInMs = now.getTime() - date.getTime()
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60))
  const diffInHours = Math.floor(diffInMinutes / 60)
  const diffInDays = Math.floor(diffInHours / 24)

  if (diffInMinutes < 1) return 'Just now'
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`
  if (diffInHours < 24) return `${diffInHours}h ago`
  if (diffInDays < 7) return `${diffInDays}d ago`
  return date.toLocaleDateString()
}

export function NotificationDropdown() {
  const { user } = useAuth()
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead } = useNotifications()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  if (!user) return null

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.readAt) {
      await markAsRead(notification.id)
    }
    setIsOpen(false)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative rounded-full p-2 text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900 dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white"
        aria-label={`Notifications (${unreadCount} unread)`}
      >
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-medium text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border border-neutral-200 bg-white shadow-lg dark:border-white/10 dark:bg-neutral-900">
          <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-white/10">
            <h3 className="font-semibold text-neutral-900 dark:text-white">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-neutral-600 hover:text-neutral-900 dark:text-white/60 dark:hover:text-white"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-neutral-500 dark:text-white/50">
                Loading notifications...
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-6 text-center">
                <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-neutral-100 dark:bg-white/5 flex items-center justify-center">
                  <svg className="h-6 w-6 text-neutral-400 dark:text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-sm text-neutral-500 dark:text-white/50">
                  No notifications yet
                </p>
                <p className="mt-1 text-xs text-neutral-400 dark:text-white/40">
                  You'll see updates about your reports here
                </p>
              </div>
            ) : (
              notifications.map((notification) => (
                <Link
                  key={notification.id}
                  to={notification.trackingId ? `/track/${notification.trackingId}` : `/track/${notification.reportId}`}
                  onClick={() => handleNotificationClick(notification)}
                  className={`block border-b border-neutral-100 px-4 py-3 transition hover:bg-neutral-50 dark:border-white/5 dark:hover:bg-white/5 ${
                    !notification.readAt
                      ? 'bg-blue-50 border-l-4 border-l-blue-500 dark:bg-blue-500/10 dark:border-l-blue-400'
                      : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${!notification.readAt ? 'font-medium text-neutral-900 dark:text-white' : 'text-neutral-700 dark:text-white/70'}`}>
                        {notification.message}
                      </p>
                      {(notification.reportTitle || notification.reportStatus) && (
                        <p className="mt-1 text-xs text-neutral-400 dark:text-white/40">
                          {notification.reportTitle && <span className="font-medium text-neutral-500 dark:text-white/60">{notification.reportTitle}</span>}
                          {notification.reportTitle && notification.reportStatus && <span className="mx-1">•</span>}
                          {notification.reportStatus && (
                            <span className="uppercase tracking-wide text-blue-500 dark:text-blue-300">
                              {notification.reportStatus}
                            </span>
                          )}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-neutral-500 dark:text-white/50">
                        {formatRelativeTime(notification.createdAt)}
                      </p>
                    </div>
                    {!notification.readAt && (
                      <div className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0 mt-2"></div>
                    )}
                  </div>
                </Link>
              ))
            )}
          </div>

          {notifications.length > 0 && (
            <div className="border-t border-neutral-200 px-4 py-3 text-center dark:border-white/10">
              <Link
                to="/notifications"
                onClick={() => setIsOpen(false)}
                className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                View all notifications
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}