import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth'

type Form = { email: string; password: string }

export function SignIn() {
  const { register, handleSubmit } = useForm<Form>()
  const { signin } = useAuth()
  const navigate = useNavigate()
  const onSubmit = async (data: Form) => {
    try {
      await signin(data.email, data.password)
      navigate('/')
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Sign in failed')
    }
  }
  return (
    <section className="max-w-md">
      <h1 className="text-xl font-semibold mb-4">Sign In</h1>
      <form className="space-y-3" onSubmit={handleSubmit(onSubmit)}>
        <div>
          <label className="block text-sm">Email</label>
          <input className="w-full border rounded px-3 py-2" type="email" {...register('email', { required: true })} />
        </div>
        <div>
          <label className="block text-sm">Password</label>
          <input className="w-full border rounded px-3 py-2" type="password" {...register('password', { required: true })} />
        </div>
        <button className="px-4 py-2 bg-blue-600 text-white rounded" type="submit">Sign In</button>
      </form>
    </section>
  )
}
