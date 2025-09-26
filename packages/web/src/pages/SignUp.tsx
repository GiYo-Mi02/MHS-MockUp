import { useForm } from 'react-hook-form'
import { api } from '@/lib/api'
import { useNavigate } from 'react-router-dom'
import { useToast } from '@/lib/toast'

type Form = {
  name: string
  email: string
  password: string
  contactNumber?: string
  isAnonymous?: boolean
}

export function SignUp() {
  const { register, handleSubmit } = useForm<Form>({ defaultValues: { isAnonymous: false } })
  const { showSuccess, showError } = useToast()
  const navigate = useNavigate()

  const onSubmit = async (data: Form) => {
    try {
      const payload: any = {
        name: data.name,
        email: data.email,
        password: data.password,
        contactNumber: data.contactNumber,
        isAnonymous: !!data.isAnonymous
      }
      await api.post('/auth/signup', payload)
      showSuccess('Account created!', 'You can now sign in with your credentials.')
      navigate('/signin')
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
          <label className="surface-subtle flex items-start gap-3 px-4 py-3 text-sm">
            <input className="mt-1" type="checkbox" {...register('isAnonymous')} />
            <span>
              Submit reports anonymously
              <span className="block text-faint">Hide personal information from department responders.</span>
            </span>
          </label>
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
