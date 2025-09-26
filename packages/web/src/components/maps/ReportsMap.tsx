import { useEffect, useMemo, useState } from 'react'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import L, { type LatLngExpression } from 'leaflet'
import { clsx } from 'clsx'
import { ensureLeafletIcons, MAKATI_BOUNDS, MAKATI_CENTER } from '@/lib/leaflet'

export type ReportPoint = {
  id: number | string
  trackingId: string
  status?: string | null
  category?: string | null
  lat: number
  lng: number
}

type ReportsMapProps = {
  points: ReportPoint[]
  className?: string
  onSelect?: (id: number | string) => void
  selectedId?: number | string | null
  height?: string | number
}

function FitPoints({ points }: { points: ReportPoint[] }) {
  const map = useMap()

  useEffect(() => {
    if (!points.length) {
      map.setView(MAKATI_CENTER as LatLngExpression, 13)
      return
    }
    const bounds = L.latLngBounds(points.map((pt) => [pt.lat, pt.lng]))
    map.fitBounds(bounds, { padding: [32, 32] })
  }, [map, points])

  return null
}

export function ReportsMap({ points, className, onSelect, selectedId, height = '18rem' }: ReportsMapProps) {
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
    ensureLeafletIcons()
  }, [])

  const normalizedPoints = useMemo(() => points.filter((pt) => Number.isFinite(pt.lat) && Number.isFinite(pt.lng)), [points])

  if (!isClient) {
    return <div className={clsx('h-64 w-full rounded-2xl bg-neutral-100 dark:bg-white/5', className)} />
  }

  return (
    <MapContainer
  center={MAKATI_CENTER as LatLngExpression}
      zoom={13}
      maxBounds={MAKATI_BOUNDS}
      maxBoundsViscosity={0.7}
  style={{ height: typeof height === 'number' ? `${height}px` : height, width: '100%' }}
      className={clsx('rounded-2xl shadow-inner shadow-neutral-900/5 dark:shadow-none', className)}
      scrollWheelZoom
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
      <FitPoints points={normalizedPoints} />
      {normalizedPoints.map((pt) => (
        <Marker
          key={pt.id}
          position={[pt.lat, pt.lng]}
          eventHandlers={onSelect ? { click: () => onSelect(pt.id) } : undefined}
        >
          <Popup>
            <div className="space-y-1 text-sm">
              <div className="font-semibold">{pt.trackingId}</div>
              {pt.category ? <div className="text-xs">{pt.category}</div> : null}
              {pt.status ? <div className="text-xs text-neutral-500 dark:text-white/70">Status: {pt.status}</div> : null}
              {selectedId === pt.id ? <div className="text-xs font-medium text-brand">Selected</div> : null}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
