import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { useForm } from 'react-hook-form'
import { api } from '@/lib/api'
import { useToast } from '@/lib/toast'
import { MapPicker, type Coordinates } from '@/components/maps/MapPicker'
import { reverseGeocode } from '@/lib/geocode'
import { useAuth } from '@/lib/auth'

type ReportFormData = {
  title: string
  description: string
  category: string
  locationAddress?: string
  locationLat: number | null
  locationLng: number | null
}

type EvidenceItem = {
  id: string
  file: File
  preview: string
  name: string
  size: number
}

const MAX_EVIDENCE_FILES = 3
const MAX_EVIDENCE_SIZE_MB = 4
const MAX_EVIDENCE_SIZE_BYTES = MAX_EVIDENCE_SIZE_MB * 1024 * 1024

export function Report() {
  const { register, handleSubmit, reset, setValue, watch } = useForm<ReportFormData>({
    defaultValues: {
      locationAddress: '',
      locationLat: null,
      locationLng: null
    }
  })
  const { user } = useAuth()
  const { showSuccess, showError } = useToast()
  const [geoError, setGeoError] = useState<string | null>(null)
  const [geoPending, setGeoPending] = useState(false)
  const [reverseLookupPending, setReverseLookupPending] = useState(false)
  const [reverseLookupError, setReverseLookupError] = useState<string | null>(null)
  const [addressManuallyEdited, setAddressManuallyEdited] = useState(false)

  const addressEditedRef = useRef(false)
  const locationAddressRef = useRef('')
  const lastReverseCoordsRef = useRef<Coordinates | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const dragCounterRef = useRef(0)
  const evidenceUrlsRef = useRef<Set<string>>(new Set())
  const [evidenceFiles, setEvidenceFiles] = useState<EvidenceItem[]>([])
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    register('locationLat')
    register('locationLng')
  }, [register])

  useEffect(() => {
    return () => {
      evidenceUrlsRef.current.forEach((url) => {
        URL.revokeObjectURL(url)
      })
      evidenceUrlsRef.current.clear()
    }
  }, [])

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

  const makeEvidenceId = () => (
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2, 10)
  )

  const releasePreview = (url: string) => {
    if (!url) return
    if (evidenceUrlsRef.current.has(url)) {
      URL.revokeObjectURL(url)
      evidenceUrlsRef.current.delete(url)
    }
  }

  const handleFilesSelected = (fileList: FileList | File[] | null) => {
    if (!fileList) return
    const incoming = Array.from(fileList)
    if (!incoming.length) return

    const remainingSlots = MAX_EVIDENCE_FILES - evidenceFiles.length
    if (remainingSlots <= 0) {
      showError('Attachment limit reached', `You can upload up to ${MAX_EVIDENCE_FILES} photos per report.`)
      return
    }

    const accepted: EvidenceItem[] = []
    let rejectedType = false
    let rejectedSize = false

    for (const file of incoming) {
      if (!file.type.startsWith('image/')) {
        rejectedType = true
        continue
      }
      if (file.size > MAX_EVIDENCE_SIZE_BYTES) {
        rejectedSize = true
        continue
      }
      const preview = URL.createObjectURL(file)
      evidenceUrlsRef.current.add(preview)
      accepted.push({
        id: makeEvidenceId(),
        file,
        preview,
        name: file.name,
        size: file.size
      })
      if (accepted.length >= remainingSlots) {
        break
      }
    }

    if (accepted.length) {
      setEvidenceFiles((prev) => [...prev, ...accepted])
    }

    if (rejectedType) {
      showError('Unsupported file type', 'Only image uploads are allowed for evidence.')
    }
    if (rejectedSize) {
      showError('File too large', `Each photo must be under ${MAX_EVIDENCE_SIZE_MB} MB.`)
    }
  }

  const handleFileInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    handleFilesSelected(event.target.files)
    if (event.target) {
      event.target.value = ''
    }
  }

  const handleRemoveEvidence = (id: string) => {
    setEvidenceFiles((prev) => {
      const target = prev.find((item) => item.id === id)
      if (target) {
        releasePreview(target.preview)
      }
      return prev.filter((item) => item.id !== id)
    })
  }

  const clearEvidence = () => {
    setEvidenceFiles((prev) => {
      prev.forEach((item) => releasePreview(item.preview))
      return []
    })
    evidenceUrlsRef.current.forEach((url) => {
      URL.revokeObjectURL(url)
    })
    evidenceUrlsRef.current.clear()
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    dragCounterRef.current = 0
    setIsDragging(false)
  }

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    dragCounterRef.current += 1
    setIsDragging(true)
  }

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1)
    if (dragCounterRef.current === 0) {
      setIsDragging(false)
    }
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    dragCounterRef.current = 0
    setIsDragging(false)
    handleFilesSelected(event.dataTransfer?.files ?? null)
  }

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

  const onSubmit = async (data: ReportFormData) => {
    try {
      const payload = new window.FormData()
      payload.append('title', data.title)
      payload.append('description', data.description)
      payload.append('category', data.category)
      if (data.locationAddress) {
        payload.append('locationAddress', data.locationAddress)
      }
      if (typeof data.locationLat === 'number' && !Number.isNaN(data.locationLat)) {
        payload.append('locationLat', String(data.locationLat))
      }
      if (typeof data.locationLng === 'number' && !Number.isNaN(data.locationLng)) {
        payload.append('locationLng', String(data.locationLng))
      }
      if (user?.role === 'CITIZEN') {
        payload.append('citizenId', String(user.id))
      }
      evidenceFiles.forEach((item) => {
        payload.append('evidence', item.file, item.name)
      })

      const res = await api.post('/reports', payload, {
        headers: { 'Content-Type': 'multipart/form-data' }
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
      clearEvidence()
      setIsDragging(false)
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

          <div className="grid gap-2">
            <label className="stat-label">Photo evidence (optional)</label>
            <div
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-8 text-center transition ${
                isDragging
                  ? 'border-brand bg-brand/10 dark:border-brand/60 dark:bg-brand/10'
                  : 'border-neutral-200 dark:border-white/15'
              }`}
            >
              <input
                ref={fileInputRef}
                id="evidence-upload"
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileInputChange}
              />
              <p className="text-sm font-medium text-neutral-700 dark:text-white/80">Drop photos here or</p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="btn-secondary mt-3 px-4 py-2"
              >
                Browse files
              </button>
              <p className="mt-3 text-xs text-neutral-500 dark:text-white/50">
                Up to {MAX_EVIDENCE_FILES} images, {MAX_EVIDENCE_SIZE_MB} MB each.
              </p>
            </div>

            {evidenceFiles.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2">
                {evidenceFiles.map((item) => (
                  <div
                    key={item.id}
                    className="relative overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50 shadow-sm dark:border-white/10 dark:bg-white/5"
                  >
                    <img src={item.preview} alt={item.name} className="h-32 w-full object-cover" />
                    <button
                      type="button"
                      className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-1 text-[11px] font-medium text-white hover:bg-black/90"
                      onClick={() => handleRemoveEvidence(item.id)}
                    >
                      Remove
                    </button>
                    <div className="truncate px-3 py-2 text-xs text-neutral-600 dark:text-white/60">
                      {item.name} · {(item.size / (1024 * 1024)).toFixed(1)} MB
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {user?.role !== 'CITIZEN' && (
            <p className="text-xs text-amber-600 dark:text-amber-300">
              Tip: Sign in to your Makati Cares account so you automatically receive email receipts and status updates.
            </p>
          )}

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
