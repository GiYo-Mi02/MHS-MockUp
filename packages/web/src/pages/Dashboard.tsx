import { Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api'

function DeptView() {
  const { user } = useAuth()
  const [rows, setRows] = useState<any[]>([])
  useEffect(() => {
    api
      .get('/dashboards/department')
      .then((res) => setRows(res.data as any[]))
      .catch(() => setRows([]))
  }, [user?.departmentId])
  return (
    <div>
      <h2 className="font-semibold mb-2">Department Queue</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full border">
          <thead><tr className="bg-gray-50"><th className="p-2 text-left">Tracking ID</th><th className="p-2 text-left">Title</th><th className="p-2 text-left">Status</th><th className="p-2 text-left">Created</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-2">{r.trackingId}</td>
                <td className="p-2">{r.title}</td>
                <td className="p-2">{r.status}</td>
                <td className="p-2">{new Date(r.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AdminView() {
  const [data, setData] = useState<{ byDept: any[]; byStatus: any[] }>({ byDept: [], byStatus: [] })
  useEffect(() => {
    api
      .get('/dashboards/admin/overview')
      .then((res) => setData(res.data))
      .catch(() => setData({ byDept: [], byStatus: [] }))
  }, [])
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div>
        <h2 className="font-semibold mb-2">Reports by Department</h2>
        <ul className="border rounded divide-y">
          {data.byDept.map((d: any) => (
            <li key={d.id} className="p-2 flex justify-between"><span>{d.name}</span><span className="font-mono">{d.total}</span></li>
          ))}
        </ul>
      </div>
      <div>
        <h2 className="font-semibold mb-2">Reports by Status</h2>
        <ul className="border rounded divide-y">
          {data.byStatus.map((s: any) => (
            <li key={s.status} className="p-2 flex justify-between"><span>{s.status}</span><span className="font-mono">{s.total}</span></li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export function Dashboard() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  useEffect(() => {
    if (!loading) {
      if (!user) navigate('/signin')
    }
  }, [loading, user, navigate])

  if (loading) return <div>Loading…</div>
  if (!user) return null
  const isAdmin = user.role === 'ADMIN'
  const isStaff = user.role === 'STAFF'

  return (
    <section>
      <h1 className="text-xl font-semibold mb-4">Dashboard</h1>
      <nav className="space-x-2 mb-4">
        {isStaff && <Link to="/dashboard/department">Department</Link>}
        {isAdmin && <Link to="/dashboard/admin">Admin</Link>}
      </nav>
      <Routes>
        <Route path="/" element={<Navigate to={isAdmin ? '/dashboard/admin' : isStaff ? '/dashboard/department' : '/'} replace />} />
        {isStaff && <Route path="/department" element={<DeptView />} />}
        {isAdmin && <Route path="/admin" element={<AdminView />} />}
      </Routes>
    </section>
  )
}
