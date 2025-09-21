import { useForm } from 'react-hook-form'
import { api } from '@/lib/api'

type FormData = {
  title: string
  description: string
  category: string
  location?: string
}


export function Report() {
  const { register, handleSubmit, reset } = useForm<FormData>()
  const onSubmit = async (data: FormData) => {
    try {
  const res = await api.post('/reports', data)
      alert(`Report submitted! Tracking ID: ${res.data.trackingId}`)
      reset()
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Failed to submit report')
    }
  }
  return (
    <section className="max-w-2xl">
      <h1 className="text-xl font-semibold mb-4">Submit a Report</h1>
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <div>
          <label className="block text-sm font-medium">Title</label>
          <input className="mt-1 w-full border rounded px-3 py-2" {...register('title', { required: true })} />
        </div>
        <div>
          <label className="block text-sm font-medium">Description</label>
          <textarea className="mt-1 w-full border rounded px-3 py-2" rows={5} {...register('description', { required: true })} />
        </div>
        <div>
          <label className="block text-sm font-medium">Category</label>
          <select className="mt-1 w-full border rounded px-3 py-2" {...register('category', { required: true })}>
            <option value="">Select a category</option>
            <option value="GARBAGE">Garbage</option>
            <option value="TRAFFIC">Traffic</option>
            <option value="SAFETY">Public Safety</option>
            <option value="ROADS">Infrastructure / Roads</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">Location</label>
          <input className="mt-1 w-full border rounded px-3 py-2" {...register('location')} />
        </div>
        <button className="px-4 py-2 bg-blue-600 text-white rounded" type="submit">Submit</button>
      </form>
    </section>
  )
}
