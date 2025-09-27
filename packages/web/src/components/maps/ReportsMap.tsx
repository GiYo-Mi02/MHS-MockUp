import { useEffect, useMemo, useState } from 'react'
import { CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
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

export type HeatmapPoint = {
  lat: number
  lng: number
  totalReports: number
  activeReports?: number
  resolvedReports?: number
}

type ReportsMapProps = {
  points: ReportPoint[]
  heatmap?: HeatmapPoint[]
  className?: string
  onSelect?: (id: number | string) => void
  selectedId?: number | string | null
  height?: string | number
}

function FitPoints({ points, heatmap }: { points: ReportPoint[]; heatmap: HeatmapPoint[] }) {
  const map = useMap()

  useEffect(() => {
    const coordinates = [
      ...points.map((pt) => ({ lat: pt.lat, lng: pt.lng })),
      ...heatmap.map((pt) => ({ lat: pt.lat, lng: pt.lng }))
    ]

    if (!coordinates.length) {
      map.setView(MAKATI_CENTER as LatLngExpression, 13)
      return
    }
    const bounds = L.latLngBounds(coordinates.map((pt) => [pt.lat, pt.lng]))
    map.fitBounds(bounds, { padding: [32, 32] })
  }, [map, points, heatmap])

  return null
}

export function ReportsMap({ points, heatmap, className, onSelect, selectedId, height = '18rem' }: ReportsMapProps) {
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
    ensureLeafletIcons()
  }, [])

  const normalizedPoints = useMemo(() => points.filter((pt) => Number.isFinite(pt.lat) && Number.isFinite(pt.lng)), [points])
  const normalizedHeatmap = useMemo(() => {
    if (!heatmap?.length) return { buckets: [] as HeatmapPoint[], max: 0 }
    const buckets = heatmap
      .map((bucket) => ({
        lat: Number(bucket.lat),
        lng: Number(bucket.lng),
        totalReports: Number(bucket.totalReports ?? 0),
        activeReports: bucket.activeReports ?? undefined,
        resolvedReports: bucket.resolvedReports ?? undefined
      }))
      .filter((bucket) => Number.isFinite(bucket.lat) && Number.isFinite(bucket.lng) && bucket.totalReports > 0)
    const max = buckets.reduce((currentMax, bucket) => Math.max(currentMax, bucket.totalReports), 0)
    return { buckets, max }
  }, [heatmap])

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
      <FitPoints points={normalizedPoints} heatmap={normalizedHeatmap.buckets} />
      {normalizedHeatmap.buckets.map((bucket) => {
        const intensity = normalizedHeatmap.max ? bucket.totalReports / normalizedHeatmap.max : 0
        const radius = 10 + intensity * 24
        let fillColor = '#facc15'
        if (intensity > 0.66) fillColor = '#f43f5e'
        else if (intensity > 0.33) fillColor = '#fb923c'

        return (
          <CircleMarker
            key={`${bucket.lat}-${bucket.lng}-heatmap`}
            center={[bucket.lat, bucket.lng]}
            radius={radius}
            pathOptions={{ color: fillColor, fillColor, fillOpacity: 0.28, weight: 0 }}
          >
            <Popup>
              <div className="space-y-1 text-sm">
                <div className="font-semibold">{bucket.totalReports} reports</div>
                {bucket.activeReports != null ? (
                  <div className="text-xs">Active: {bucket.activeReports}</div>
                ) : null}
                {bucket.resolvedReports != null ? (
                  <div className="text-xs text-neutral-500 dark:text-white/70">Resolved: {bucket.resolvedReports}</div>
                ) : null}
              </div>
            </Popup>
          </CircleMarker>
        )
      })}
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
