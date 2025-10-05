import { useForm } from 'react-hook-form'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { useToast } from '@/lib/toast'

type Form = { email: string; password: string }

export function SignIn() {
  const { register, handleSubmit } = useForm<Form>()
  const { signin } = useAuth()
  const { showSuccess, showError } = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const searchParams = new URLSearchParams(location.search)
  const nextParam = searchParams.get('next')
  const nextPath = nextParam && nextParam.startsWith('/') ? nextParam : '/'
  
  const onSubmit = async (data: Form) => {
    try {
      const authedUser = await signin(data.email, data.password)
      if (authedUser?.role === 'CITIZEN' && !authedUser.isVerified) {
        const safeNext = nextPath === '/verify' ? '/' : nextPath
        const encodedNext = encodeURIComponent(safeNext)
        showSuccess('Welcome back!', 'Enter the 6-digit code we sent to finish verifying your account.')
        navigate(`/verify?next=${encodedNext}`)
        return
      }
      showSuccess('Welcome back!', 'You have been signed in successfully.')
      navigate(nextPath)
    } catch (e: any) {
      const errorMessage = e?.response?.data?.error || 'Sign in failed'
      showError('Sign in failed', errorMessage)
    }
  }

  return (
    <section className="mx-auto max-w-md">
      <div className="card px-8 py-10">
        <div className="mb-6 space-y-2">
          <h1 className="text-2xl font-semibold">Welcome back</h1>
          <p className="text-secondary">Sign in to manage reports and keep the city moving.</p>
        </div>
        <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-2">
            <label className="stat-label">Email</label>
            <input className="input-field" type="email" autoComplete="email" {...register('email', { required: true })} />
          </div>
          <div className="space-y-2">
            <label className="stat-label">Password</label>
            <input className="input-field" type="password" autoComplete="current-password" {...register('password', { required: true })} />
          </div>
          <button className="btn-primary w-full" type="submit">Sign In</button>
        </form>
        <p className="mt-6 text-center text-faint">
          Need an account?{' '}
          <a href="/signup" className="text-brand hover:text-brand-focus dark:text-brand-softer dark:hover:text-white">Create one now</a>
        </p>
      </div>
    </section>
  )
}
