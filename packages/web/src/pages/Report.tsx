import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { api } from '@/lib/api'
import { useToast } from '@/lib/toast'
import { MapPicker, type Coordinates } from '@/components/maps/MapPicker'
import { reverseGeocode } from '@/lib/geocode'

type FormData = {
  title: string
  description: string
  category: string
  locationAddress?: string
  locationLat: number | null
  locationLng: number | null
}

export function Report() {
  const { register, handleSubmit, reset, setValue, watch } = useForm<FormData>({
    defaultValues: {
      locationAddress: '',
      locationLat: null,
      locationLng: null
    }
  })
  const { showSuccess, showError } = useToast()
  const [geoError, setGeoError] = useState<string | null>(null)
  const [geoPending, setGeoPending] = useState(false)
  const [reverseLookupPending, setReverseLookupPending] = useState(false)
  const [reverseLookupError, setReverseLookupError] = useState<string | null>(null)
  const [addressManuallyEdited, setAddressManuallyEdited] = useState(false)

  const addressEditedRef = useRef(false)
  const locationAddressRef = useRef('')
  const lastReverseCoordsRef = useRef<Coordinates | null>(null)

  useEffect(() => {
    register('locationLat')
    register('locationLng')
  }, [register])

  const locationLat = watch('locationLat')
  const locationLng = watch('locationLng')
  const locationAddressValue = watch('locationAddress')

  useEffect(() => {
    locationAddressRef.current = locationAddressValue ?? ''
  }, [locationAddressValue])

  const locationAddressRegister = register('locationAddress', {
    onChange: () => {
      addressEditedRef.current = true
      setAddressManuallyEdited(true)
    }
  })

  const selectedCoordinates = useMemo<Coordinates | null>(() => {
    if (typeof locationLat === 'number' && typeof locationLng === 'number' && !Number.isNaN(locationLat) && !Number.isNaN(locationLng)) {
      return { lat: locationLat, lng: locationLng }
    }
    return null
  }, [locationLat, locationLng])

  const handleCoordinatesChange = (coords: Coordinates | null) => {
    setValue('locationLat', coords ? coords.lat : null, { shouldDirty: true })
    setValue('locationLng', coords ? coords.lng : null, { shouldDirty: true })
    if (!coords) {
      setReverseLookupPending(false)
      setReverseLookupError(null)
      lastReverseCoordsRef.current = null
    } else if (!lastReverseCoordsRef.current || lastReverseCoordsRef.current.lat !== coords.lat || lastReverseCoordsRef.current.lng !== coords.lng) {
      lastReverseCoordsRef.current = null
    }
  }

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setGeoError('Location services are not available in this browser.')
      return
    }
    setGeoPending(true)
    setGeoError(null)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        handleCoordinatesChange({ lat: coords.latitude, lng: coords.longitude })
        setGeoPending(false)
      },
      (err) => {
        setGeoPending(false)
        setGeoError(err.message || 'We could not access your location. Please select a point on the map instead.')
      },
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: 20_000 }
    )
  }

  useEffect(() => {
    if (!selectedCoordinates) {
      setReverseLookupPending(false)
      setReverseLookupError(null)
      lastReverseCoordsRef.current = null
      return
    }

    const coords = selectedCoordinates

    const alreadyResolved = lastReverseCoordsRef.current && lastReverseCoordsRef.current.lat === coords.lat && lastReverseCoordsRef.current.lng === coords.lng
    if (alreadyResolved) {
      return
    }

    let cancelled = false
    setReverseLookupPending(true)
    setReverseLookupError(null)

    async function resolveAddress() {
      const result = await reverseGeocode(coords)

      if (cancelled) {
        return
      }

      setReverseLookupPending(false)
      lastReverseCoordsRef.current = coords

      if (!result) {
        setReverseLookupError('We couldn\'t match these coordinates to an address. Feel free to type it manually.')
        return
      }

      const hasManualAddress = addressEditedRef.current && locationAddressRef.current.trim().length > 0
      if (hasManualAddress) {
        return
      }

      setValue('locationAddress', result.formattedAddress, { shouldDirty: true })
      addressEditedRef.current = false
      setAddressManuallyEdited(false)
    }

    resolveAddress()

    return () => {
      cancelled = true
    }
  }, [selectedCoordinates, setValue])

  const onSubmit = async (data: FormData) => {
    try {
      const res = await api.post('/reports', {
        title: data.title,
        description: data.description,
        category: data.category,
        locationAddress: data.locationAddress || null,
        locationLat: typeof data.locationLat === 'number' ? data.locationLat : null,
        locationLng: typeof data.locationLng === 'number' ? data.locationLng : null
      })
      
      showSuccess(
        'Report submitted successfully!', 
        `Your tracking ID is ${res.data.trackingId}. You can use this to monitor your report's progress.`
      )
      
      reset()
      handleCoordinatesChange(null)
      setGeoError(null)
      setReverseLookupError(null)
      addressEditedRef.current = false
      setAddressManuallyEdited(false)
    } catch (e: any) {
      const errorMessage = e?.response?.data?.error || 'Failed to submit report'
      showError('Submission failed', errorMessage)
    }
  }

  return (
    <section className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-[1.3fr,0.7fr]">
      <div className="card px-8 py-10">
        <div className="mb-6 space-y-2">
          <h1 className="text-3xl font-semibold">Submit a report</h1>
          <p className="text-secondary">Provide clear details so the right department can action your request immediately.</p>
        </div>
        <form className="grid gap-5" onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-2">
            <label className="stat-label">Title</label>
            <input className="input-field" placeholder="Brief headline" {...register('title', { required: true })} />
          </div>
          <div className="grid gap-2">
            <label className="stat-label">Description</label>
            <textarea className="input-field min-h-[160px]" placeholder="Describe what happened" {...register('description', { required: true })} />
          </div>
          <div className="grid gap-2">
            <label className="stat-label">Category</label>
            <select className="input-field" {...register('category', { required: true })}>
              <option value="">Select a category</option>
              <option value="GARBAGE">Garbage & Waste</option>
              <option value="TRAFFIC">Traffic & Roads</option>
              <option value="SAFETY">Public Safety</option>
              <option value="ROADS">Infrastructure</option>
            </select>
          </div>
          <div className="grid gap-2">
            <label className="stat-label">Location details (optional)</label>
            <input
              className="input-field"
              placeholder="Street, barangay, or landmark"
              {...locationAddressRegister}
            />
            {selectedCoordinates && !addressManuallyEdited && locationAddressValue && !reverseLookupPending && !reverseLookupError && (
              <p className="text-xs text-neutral-500 dark:text-white/60">Filled automatically from the map pin. You can still edit it.</p>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">Pin the location</h2>
                <p className="text-faint">Tap the map or use GPS so responders can navigate faster.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn-secondary px-4 py-2"
                  onClick={handleUseCurrentLocation}
                  disabled={geoPending}
                >
                  {geoPending ? 'Locating…' : 'Use my location'}
                </button>
                {selectedCoordinates && (
                  <button
                    type="button"
                    className="text-sm text-neutral-600 underline-offset-4 hover:underline dark:text-white/70"
                    onClick={() => handleCoordinatesChange(null)}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
            <MapPicker value={selectedCoordinates} onChange={handleCoordinatesChange} markerLabel="Report location" />
            <div className="text-xs text-neutral-500 dark:text-white/50">
              {selectedCoordinates ? (
                <span>
                  Selected coordinates:&nbsp;
                  <code className="rounded bg-neutral-100 px-2 py-1 dark:bg-white/10">{selectedCoordinates.lat.toFixed(5)}, {selectedCoordinates.lng.toFixed(5)}</code>
                </span>
              ) : (
                <span>No pin yet. Select a spot on the map or pull your current GPS.</span>
              )}
            </div>
            {reverseLookupPending && <p className="text-xs text-primary">Looking up the address…</p>}
            {reverseLookupError && <p className="text-xs text-red-600 dark:text-red-300">{reverseLookupError}</p>}
            {geoError && <p className="text-xs text-red-600 dark:text-red-300">{geoError}</p>}
          </div>

          <button className="btn-primary" type="submit">Submit report</button>
        </form>
      </div>

      <aside className="card px-6 py-8">
        <h2 className="text-lg font-semibold">Tips for faster resolutions</h2>
        <ul className="mt-4 space-y-4 text-sm text-neutral-700 dark:text-white/70">
          <li className="surface-subtle p-4">Attach photos when possible to show the situation on-site.</li>
          <li className="surface-subtle p-4">Use the location field to pinpoint the closest landmark.</li>
          <li className="surface-subtle p-4">Choose the urgency on the follow-up screen if the issue is critical.</li>
        </ul>
      </aside>
    </section>
  )
}
