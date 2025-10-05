import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { useToast } from '@/lib/toast'
import { api } from '@/lib/api'

function resolveNextPath(search: string): string {
  const params = new URLSearchParams(search)
  const nextParam = params.get('next')
  if (!nextParam) return '/'
  return nextParam.startsWith('/') ? nextParam : '/'
}

export function VerifyAccount() {
  const { user, loading, refresh } = useAuth()
  const { showSuccess, showError } = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const nextPath = useMemo(() => resolveNextPath(location.search), [location.search])

  const [verificationCode, setVerificationCode] = useState('')
  const [requesting, setRequesting] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [devVerificationCode, setDevVerificationCode] = useState<string | null>(null)

  useEffect(() => {
    if (loading) return

    if (!user) {
      const redirect = encodeURIComponent(location.pathname + location.search)
      navigate(`/signin?next=${redirect}`, { replace: true })
      return
    }

    if (user.role !== 'CITIZEN') {
      navigate('/', { replace: true })
      return
    }

    if (user.isVerified) {
      navigate(nextPath, { replace: true })
    }
  }, [user, loading, navigate, location.pathname, location.search, nextPath])

  const verificationExpiresAt = useMemo(() => {
    if (!user?.verificationExpiresAt) return null
    const date = new Date(user.verificationExpiresAt)
    return Number.isNaN(date.getTime()) ? null : date
  }, [user?.verificationExpiresAt])

  const handleRequestVerification = async () => {
    if (!user || user.role !== 'CITIZEN') return
    setRequesting(true)
    try {
      const { data } = await api.post('/auth/verification/request', { method: 'email' })
      if (typeof data?.code === 'string') {
        setDevVerificationCode(data.code)
      } else {
        setDevVerificationCode(null)
      }
      void refresh()
      const deliverySkipped = Boolean(data?.deliverySkipped)
      showSuccess(
        'Verification code sent',
        deliverySkipped
          ? 'Email delivery is not configured. Use the code shown on this page to complete verification.'
          : 'Check your inbox for the 6-digit code and enter it below to finish verification.'
      )
    } catch (error: any) {
      const message = error?.response?.data?.error || 'Unable to send verification code right now.'
      showError('Verification code not sent', message)
    } finally {
      setRequesting(false)
    }
  }

  const handleConfirmVerification = async () => {
    if (!user || user.role !== 'CITIZEN') return
    const trimmed = verificationCode.trim()
    if (!trimmed) {
      showError('Enter the code', 'Type the 6-digit verification code from your email.')
      return
    }
    setConfirming(true)
    try {
      await api.post('/auth/verification/confirm', { code: trimmed })
      showSuccess('Account verified', 'Thanks! You now have full access to Makati Cares.')
      setVerificationCode('')
      setDevVerificationCode(null)
      const refreshed = await refresh()
      if (refreshed?.isVerified) {
        navigate(nextPath, { replace: true })
      }
    } catch (error: any) {
      const status = error?.response?.status
      const message = error?.response?.data?.error || 'Unable to verify the code.'
      if (status === 410) {
        showError('Code expired', message)
      } else if (status === 400) {
        showError('Invalid code', message)
      } else {
        showError('Verification failed', message)
      }
    } finally {
      setConfirming(false)
    }
  }

  if (loading) {
    return (
      <section className="mx-auto max-w-2xl">
        <div className="card px-8 py-10 text-secondary">Checking your session…</div>
      </section>
    )
  }

  if (!user || user.role !== 'CITIZEN') {
    return null
  }

  return (
    <section className="mx-auto max-w-3xl">
      <div className="card space-y-6 px-8 py-10">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-brand">Verify account</p>
          <h1 className="text-3xl font-semibold text-neutral-900 dark:text-white">Secure your Makati Cares account</h1>
          <p className="text-secondary">
            Enter the 6-digit code we emailed to <strong>{user.email}</strong>. Once verified, you can submit multiple reports,
            receive updates, and skip manual review queues more quickly.
          </p>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-6 py-5 text-sm text-neutral-700 dark:border-white/10 dark:bg-white/5 dark:text-white/70">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <p className="font-semibold">Didn't receive a code?</p>
              <p>Click resend and we’ll generate a fresh code. Codes expire after 15 minutes for your security.</p>
              {verificationExpiresAt && (
                <p className="text-xs text-neutral-500 dark:text-white/50">
                  Current code expires {verificationExpiresAt.toLocaleString()}.
                </p>
              )}
              {devVerificationCode && (
                <p className="text-xs font-mono text-amber-700 dark:text-amber-200">
                  Dev code: {devVerificationCode}
                </p>
              )}
            </div>
            <div className="flex w-full flex-col gap-2 lg:w-72">
              <button
                type="button"
                className="btn-secondary px-4 py-2 disabled:opacity-60"
                onClick={handleRequestVerification}
                disabled={requesting}
              >
                {requesting ? 'Sending…' : 'Resend verification code'}
              </button>
              <div className="flex gap-2">
                <input
                  className="input-field flex-1"
                  placeholder="Enter 6-digit code"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  maxLength={6}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                />
                <button
                  type="button"
                  className="btn-primary whitespace-nowrap px-4 py-2 disabled:opacity-60"
                  onClick={handleConfirmVerification}
                  disabled={confirming}
                >
                  {confirming ? 'Verifying…' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border border-brand/20 bg-brand/5 px-6 py-5 text-sm text-brand/80 dark:border-brand/30 dark:bg-brand/10 dark:text-brand/90">
          <p className="font-semibold uppercase tracking-[0.3em] text-xs">Why verify?</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>Submit unlimited reports every day and skip manual reviews sooner.</li>
            <li>Receive email notifications for status updates and staff responses.</li>
            <li>Help Makati prioritize verified citizens for urgent concerns.</li>
          </ul>
        </div>
      </div>
    </section>
  )
}
