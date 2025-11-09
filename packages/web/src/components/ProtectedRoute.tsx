import { ReactNode } from 'react'
import { useAuth } from '../lib/auth'
import { Navigate, useLocation } from 'react-router-dom'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  // If not logged in, redirect to signin
  if (!user) {
    return <Navigate to={`/signin?next=${encodeURIComponent(location.pathname)}`} replace />
  }

  // If citizen and not verified, redirect to verify page
  if (user.role === 'CITIZEN' && !user.isVerified) {
    return <Navigate to={`/verify?next=${encodeURIComponent(location.pathname)}`} replace />
  }

  return <>{children}</>
}
