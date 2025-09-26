import { useEffect, useMemo, useState } from 'react'
import { MapContainer, Marker, Popup, TileLayer, useMapEvents } from 'react-leaflet'
import type { LatLngExpression } from 'leaflet'
import { clsx } from 'clsx'
import { ensureLeafletIcons, MAKATI_BOUNDS, MAKATI_CENTER } from '@/lib/leaflet'

export type Coordinates = {
  lat: number
  lng: number
}

type MapPickerProps = {
  value: Coordinates | null
  onChange: (value: Coordinates | null) => void
  className?: string
  markerLabel?: string
}

function ClickCapture({ onSelect }: { onSelect: (coords: Coordinates) => void }) {
  useMapEvents({
    click({ latlng }) {
      onSelect({ lat: latlng.lat, lng: latlng.lng })
    }
  })
  return null
}

export function MapPicker({ value, onChange, className, markerLabel }: MapPickerProps) {
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
    ensureLeafletIcons()
  }, [])

  const center = useMemo<LatLngExpression>(() => {
    if (value) return [value.lat, value.lng]
    return MAKATI_CENTER
  }, [value])

  if (!isClient) {
    return <div className={clsx('h-64 w-full rounded-2xl bg-neutral-100 dark:bg-white/5', className)} />
  }

  return (
    <MapContainer
      center={center}
      maxBounds={MAKATI_BOUNDS}
      maxBoundsViscosity={0.7}
      style={{ height: '16rem', width: '100%' }}
      className={clsx('rounded-2xl shadow-inner shadow-neutral-900/5 dark:shadow-none', className)}
      zoom={14}
      scrollWheelZoom
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
      <ClickCapture onSelect={(coords) => onChange(coords)} />
      {value ? (
        <Marker
          position={[value.lat, value.lng]}
          draggable
          eventHandlers={{
            dragend: (event) => {
              const point = event.target.getLatLng()
              onChange({ lat: point.lat, lng: point.lng })
            }
          }}
        >
          {markerLabel ? <Popup>{markerLabel}</Popup> : null}
        </Marker>
      ) : null}
    </MapContainer>
  )
}
