import L, { type LatLngBoundsExpression, type LatLngExpression } from 'leaflet'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

let configured = false

export function ensureLeafletIcons() {
  if (configured) return
  configured = true
  // Force Leaflet to use our bundled icon assets instead of looking for default files
  const iconProto = L.Icon.Default.prototype as L.Icon.Default & { _getIconUrl?: () => string }
  if (iconProto._getIconUrl) {
    delete iconProto._getIconUrl
  }
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow
  })
}

export const MAKATI_CENTER: LatLngExpression = [14.554729, 121.024445]

export const MAKATI_BOUNDS: LatLngBoundsExpression = [
  [14.5118, 121.0019],
  [14.5839, 121.0635]
]
