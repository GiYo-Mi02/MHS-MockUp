import { useEffect, useState } from 'react'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastData {
  id: string
  title: string
  message?: string
  type: ToastType
  duration?: number
  closeable?: boolean
}

interface ToastProps {
  toast: ToastData
  onClose: (id: string) => void
}

const toastIcons = {
  success: (
    <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  error: (
    <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  warning: (
    <svg className="h-5 w-5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
    </svg>
  ),
  info: (
    <svg className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

const toastStyles = {
  success: 'bg-white border-l-4 border-l-green-500 shadow-lg dark:bg-neutral-800 dark:border-l-green-400',
  error: 'bg-white border-l-4 border-l-red-500 shadow-lg dark:bg-neutral-800 dark:border-l-red-400',
  warning: 'bg-white border-l-4 border-l-yellow-500 shadow-lg dark:bg-neutral-800 dark:border-l-yellow-400',
  info: 'bg-white border-l-4 border-l-blue-500 shadow-lg dark:bg-neutral-800 dark:border-l-blue-400'
}

export function Toast({ toast, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)

  useEffect(() => {
    // Trigger entrance animation
    const showTimer = setTimeout(() => setIsVisible(true), 50)
    
    // Auto-dismiss after duration
    let dismissTimer: NodeJS.Timeout
    if (toast.duration && toast.duration > 0) {
      dismissTimer = setTimeout(() => {
        handleClose()
      }, toast.duration)
    }

    return () => {
      clearTimeout(showTimer)
      if (dismissTimer) clearTimeout(dismissTimer)
    }
  }, [toast.duration])

  const handleClose = () => {
    setIsLeaving(true)
    setTimeout(() => onClose(toast.id), 300) // Match exit animation duration
  }

  return (
    <div
      className={`
        pointer-events-auto mb-4 transform transition-all duration-300 ease-out
        ${isVisible && !isLeaving 
          ? 'translate-x-0 opacity-100' 
          : 'translate-x-full opacity-0'
        }
      `}
    >
      <div className={`rounded-lg p-4 ${toastStyles[toast.type]}`}>
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            {toastIcons[toast.type]}
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-neutral-900 dark:text-white">
              {toast.title}
            </h3>
            {toast.message && (
              <p className="mt-1 text-sm text-neutral-600 dark:text-white/70">
                {toast.message}
              </p>
            )}
          </div>

          {(toast.closeable !== false) && (
            <button
              type="button"
              onClick={handleClose}
              className="flex-shrink-0 rounded-md p-1.5 text-neutral-400 transition hover:text-neutral-600 dark:text-white/40 dark:hover:text-white/60"
              aria-label="Close notification"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}