import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { Toast, ToastData, ToastType } from '@/components/ui/Toast'

interface ToastContextValue {
  showToast: (options: Omit<ToastData, 'id'>) => void
  showSuccess: (title: string, message?: string) => void
  showError: (title: string, message?: string) => void
  showWarning: (title: string, message?: string) => void
  showInfo: (title: string, message?: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

interface ToastProviderProps {
  children: ReactNode
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastData[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }, [])

  const showToast = useCallback((options: Omit<ToastData, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9)
    const toast: ToastData = {
      id,
      duration: 5000, // Default 5 seconds
      closeable: true,
      ...options
    }
    
    setToasts(prev => [...prev, toast])
  }, [])

  const showSuccess = useCallback((title: string, message?: string) => {
    showToast({ type: 'success', title, message })
  }, [showToast])

  const showError = useCallback((title: string, message?: string) => {
    showToast({ type: 'error', title, message, duration: 7000 })
  }, [showToast])

  const showWarning = useCallback((title: string, message?: string) => {
    showToast({ type: 'warning', title, message, duration: 6000 })
  }, [showToast])

  const showInfo = useCallback((title: string, message?: string) => {
    showToast({ type: 'info', title, message })
  }, [showToast])

  return (
    <ToastContext.Provider value={{
      showToast,
      showSuccess,
      showError,
      showWarning,
      showInfo
    }}>
      {children}
      
      {/* Toast Container */}
      <div 
        className="pointer-events-none fixed inset-0 z-50 flex items-start justify-end p-6"
        aria-live="assertive"
        aria-atomic="true"
      >
        <div className="flex w-full max-w-sm flex-col items-end space-y-4">
          {toasts.map(toast => (
            <Toast
              key={toast.id}
              toast={toast}
              onClose={removeToast}
            />
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  )
}