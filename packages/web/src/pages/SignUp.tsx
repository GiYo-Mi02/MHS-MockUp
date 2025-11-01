import { useForm } from 'react-hook-form'
import { api } from '@/lib/api'
import { useLocation, useNavigate } from 'react-router-dom'
import { useToast } from '@/lib/toast'
import { useAuth } from '@/lib/auth'

type Form = {
  name: string
  email: string
  password: string
  contactNumber?: string
}

export function SignUp() {
  const { register, handleSubmit } = useForm<Form>()
  const { showSuccess, showError } = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const { signin } = useAuth()

  const resolveNextPath = (): string => {
    const params = new URLSearchParams(location.search)
    const nextParam = params.get('next')
    const nextPath = nextParam && nextParam.startsWith('/') ? nextParam : '/'
    // Avoid looping back to verify itself
    return nextPath === '/verify' ? '/' : nextPath
  }

  const onSubmit = async (data: Form) => {
    try {
      const payload: any = {
        name: data.name,
        email: data.email,
        password: data.password,
        contactNumber: data.contactNumber
      }
      await api.post('/auth/signup', payload)

      // Create a session so the user can access /verify and request/confirm codes
      await signin(data.email, data.password)

      const encodedNext = encodeURIComponent(resolveNextPath())
      showSuccess('Account created!', 'Enter the 6-digit code we sent to verify your account.')
      navigate(`/verify?next=${encodedNext}`)
    } catch (e: any) {
      const errorMessage = e?.response?.data?.error || 'Sign up failed'
      showError('Sign up failed', errorMessage)
    }
  }

  return (
    <section className="mx-auto max-w-xl">
      <div className="card px-8 py-10">
        <div className="mb-6 space-y-2">
          <h1 className="text-2xl font-semibold">Create a citizen account</h1>
          <p className="text-secondary">Save your details once and track every report effortlessly.</p>
        </div>
        <form className="grid gap-5" onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-2">
            <label className="stat-label">Full name</label>
            <input className="input-field" placeholder="Juan Dela Cruz" {...register('name', { required: true })} />
          </div>
          <div className="grid gap-2">
            <label className="stat-label">Email</label>
            <input className="input-field" type="email" autoComplete="email" {...register('email', { required: true })} />
          </div>
          <div className="grid gap-2">
            <label className="stat-label">Password</label>
            <input className="input-field" type="password" autoComplete="new-password" {...register('password', { required: true })} />
          </div>
          <div className="grid gap-2">
            <label className="stat-label">Contact number</label>
            <input className="input-field" type="tel" placeholder="09xx xxx xxxx" {...register('contactNumber')} />
          </div>
          <button className="btn-primary" type="submit">Create account</button>
        </form>
        <p className="mt-6 text-center text-faint">
          Already registered?{' '}
          <a href="/signin" className="text-brand hover:text-brand-focus dark:text-brand-softer dark:hover:text-white">Sign in</a>
        </p>
      </div>
    </section>
  )
}
