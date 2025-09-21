import { useAuth } from '@/lib/auth'

export function Header() {
  const { user, signout } = useAuth()
  const canSeeDashboard = user && (user.role === 'STAFF' || user.role === 'ADMIN')
  return (
    <header className="bg-white border-b">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <a href="/" className="font-semibold text-lg">MakatiReport</a>
        <nav className="space-x-4">
          <a href="/report" className="text-sm text-blue-600">Submit Report</a>
          {canSeeDashboard && <a href="/dashboard" className="text-sm">Dashboard</a>}
          {!user ? (
            <>
              <a href="/signin" className="text-sm">Sign In</a>
              <a href="/signup" className="text-sm">Sign Up</a>
            </>
          ) : (
            <button onClick={() => void signout()} className="text-sm">Sign Out</button>
          )}
        </nav>
      </div>
    </header>
  )
}
