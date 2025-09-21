import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '@/lib/api'

export function Track() {
  const { trackingId } = useParams()
  const [data, setData] = useState<any | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!trackingId) return
    api
      .get(`/reports/track/${trackingId}`)
      .then((res) => setData(res.data))
      .catch((e) => setError(e.response?.data?.error || 'Not found'))
  }, [trackingId])
  return (
    <section>
      <h1 className="text-xl font-semibold mb-4">Track Report</h1>
      <p className="text-sm text-gray-600">Tracking ID: {trackingId}</p>
      {!data && !error && <div className="mt-4">Loading…</div>}
      {error && <div className="mt-4 text-red-600">{error}</div>}
      {data && (
        <div className="mt-4 space-y-4">
          <div className="p-4 border rounded bg-white">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="font-semibold text-lg">{data.title}</h2>
                <p className="text-sm text-gray-600">Department: {data.department}</p>
              </div>
              <span className="px-2 py-1 text-xs rounded bg-gray-100">{data.status}</span>
            </div>
            {data.location && <p className="mt-2 text-sm">Location: {data.location}</p>}
            {data.photoUrl && (
              <img src={data.photoUrl} alt="Report" className="mt-3 max-h-64 rounded border" />
            )}
          </div>
          <div>
            <h3 className="font-semibold mb-2">Status History</h3>
            <ol className="border rounded divide-y bg-white">
              {data.logs?.map((l: any, idx: number) => (
                <li key={idx} className="p-3 flex items-start justify-between">
                  <div>
                    <div className="font-medium">{l.status}</div>
                    {l.remarks && <div className="text-sm text-gray-600">{l.remarks}</div>}
                  </div>
                  <div className="text-xs text-gray-500">{new Date(l.created_at).toLocaleString()}</div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </section>
  )
}
