import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { api } from '@/lib/api'
import { useNavigate } from 'react-router-dom'

type Form = { name: string; email: string; password: string; role?: string; departmentId?: number }

export function SignUp() {
  const { register, handleSubmit } = useForm<Form>()
  const [departments, setDepartments] = useState<Array<{ id: number; name: string }>>([])
  const navigate = useNavigate()

  useEffect(() => {
    api.get('/departments').then((res) => setDepartments(res.data as any))
  }, [])

  const onSubmit = async (data: Form) => {
    try {
      const payload: any = { name: data.name, email: data.email, password: data.password, role: data.role || 'CITIZEN' }
      if (payload.role !== 'CITIZEN' && data.departmentId) payload.departmentId = data.departmentId
      await api.post('/auth/signup', payload)
      alert('Account created. You can now sign in.')
      navigate('/signin')
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Sign up failed')
    }
  }

  return (
    <section className="max-w-md">
      <h1 className="text-xl font-semibold mb-4">Create Account</h1>
      <form className="space-y-3" onSubmit={handleSubmit(onSubmit)}>
        <div>
          <label className="block text-sm">Full Name</label>
          <input className="w-full border rounded px-3 py-2" {...register('name', { required: true })} />
        </div>
        <div>
          <label className="block text-sm">Email</label>
          <input className="w-full border rounded px-3 py-2" type="email" {...register('email', { required: true })} />
        </div>
        <div>
          <label className="block text-sm">Password</label>
          <input className="w-full border rounded px-3 py-2" type="password" {...register('password', { required: true })} />
        </div>
        <div>
          <label className="block text-sm">Role</label>
          <select className="w-full border rounded px-3 py-2" {...register('role')}>
            <option value="CITIZEN">Citizen</option>
            <option value="STAFF">Department Staff</option>
            <option value="ADMIN">LGU Admin</option>
          </select>
        </div>
        <div>
          <label className="block text-sm">Department (for Staff/Admin)</label>
          <select className="w-full border rounded px-3 py-2" {...register('departmentId')}> 
            <option value="">Select…</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
        <button className="px-4 py-2 bg-blue-600 text-white rounded" type="submit">Create Account</button>
      </form>
    </section>
  )
}
