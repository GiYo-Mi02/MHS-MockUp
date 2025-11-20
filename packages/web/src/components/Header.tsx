import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { useTheme } from '@/lib/theme'
import { NotificationDropdown } from './NotificationDropdown'

const navLinks = [
  { to: '/report', label: 'Submit Report', private: false },
  { to: '/my-reports', label: 'My Reports', private: false, citizenOnly: true },
  { to: '/dashboard', label: 'Dashboard', private: true }
]

export function Header() {
  const { user, signout } = useAuth()
  const location = useLocation()
  const { theme, toggleTheme } = useTheme()
  const canSeeDashboard = user && (user.role === 'STAFF' || user.role === 'ADMIN')

  return (
    <header className="relative z-20 border-b border-neutral-200 bg-white/80 backdrop-blur dark:border-white/10 dark:bg-black/20">
      <div className="absolute inset-0 bg-gradient-to-r from-brand/15 via-transparent to-brand/15 dark:from-brand/25 dark:to-brand/30" aria-hidden />
      <div className="relative container flex items-center justify-between py-5">
        <Link
          to="/"
          aria-label="Go to Makati Aid home"
          className="flex items-center gap-3 text-neutral-900 transition hover:opacity-90 dark:text-white"
        >
          <span className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-white p-1 shadow-lg shadow-brand/40 dark:bg-white/90">
            <img
              src="/Logos.png"
              alt="Makati Aid logo"
              className="h-full w-full scale-150 object-contain"
              loading="eager"
            />
          </span>
          <div>
            <div className="text-sm uppercase tracking-[0.3em] text-neutral-500 dark:text-white/60">City of Makati</div>
            <div className="text-lg font-semibold">Makati Aid</div>
          </div>
        </Link>

        <nav className="hidden items-center gap-2 text-sm font-medium md:flex">
          {navLinks
            .filter((link) => {
              if (link.citizenOnly) return user?.role === 'CITIZEN'
              return link.private ? canSeeDashboard : true
            })
            .map((link) => {
              const isActive = location.pathname.startsWith(link.to)
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`rounded-full px-4 py-2 transition ${
                    isActive
                      ? 'bg-neutral-900/10 text-neutral-900 dark:bg-white/15 dark:text-white'
                      : 'text-neutral-600 hover:bg-neutral-900/5 hover:text-neutral-900 dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white'
                  }`}
                >
                  {link.label}
                </Link>
              )
            })}
        </nav>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleTheme}
            className="btn-secondary inline-flex h-10 w-10 items-center justify-center rounded-full"
            aria-label={`Activate ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          {user && <NotificationDropdown />}
          {!user ? (
            <div className="flex items-center gap-2">
              <Link to="/signin" className="btn-secondary hidden md:inline-flex">
                Sign In
              </Link>
              <Link to="/signup" className="btn-primary">
                Create Account
              </Link>
            </div>
          ) : (
            <button onClick={() => void signout()} className="btn-secondary">
              Sign Out
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
