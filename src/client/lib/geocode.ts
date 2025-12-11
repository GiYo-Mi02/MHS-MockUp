import type { Coordinates } from '@/components/maps/MapPicker'

const NOMINATIM_REVERSE_ENDPOINT = 'https://nominatim.openstreetmap.org/reverse'

export type ReverseGeocodeResult = {
  formattedAddress: string
  raw: Record<string, unknown>
}

export async function reverseGeocode(coordinates: Coordinates): Promise<ReverseGeocodeResult | null> {
  const { lat, lng } = coordinates

  const params = new URLSearchParams({
    format: 'jsonv2',
    lat: lat.toString(),
    lon: lng.toString(),
    zoom: '18',
    addressdetails: '1'
  })

  try {
    const response = await fetch(`${NOMINATIM_REVERSE_ENDPOINT}?${params.toString()}`, {
      headers: {
        Accept: 'application/json'
      }
    })

    if (!response.ok) {
      return null
    }

    const data = await response.json() as { display_name?: string }

    if (!data?.display_name) {
      return null
    }

    return {
      formattedAddress: data.display_name,
      raw: data
    }
  } catch (error) {
    console.error('Reverse geocoding failed', error)
    return null
  }
}
