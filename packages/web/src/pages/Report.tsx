import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
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
  submitAnonymously: boolean
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
      locationLng: null,
      submitAnonymously: false
    }
  })
  const { user, loading, refresh } = useAuth()
  const { showSuccess, showError } = useToast()
  const navigate = useNavigate()
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
  const [verificationCode, setVerificationCode] = useState('')
  const [requestingVerification, setRequestingVerification] = useState(false)
  const [confirmingVerification, setConfirmingVerification] = useState(false)
  const [devVerificationCode, setDevVerificationCode] = useState<string | null>(null)

  useEffect(() => {
    register('locationLat')
    register('locationLng')
  }, [register])

  useEffect(() => {
    if (!loading && !user) {
      navigate('/signin?next=/report', { replace: true })
    }
  }, [loading, user, navigate])

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
  const submitAnonymously = watch('submitAnonymously')
  const selectedCoordinates = useMemo<Coordinates | null>(() => {
    if (
      typeof locationLat === 'number' &&
      typeof locationLng === 'number' &&
      !Number.isNaN(locationLat) &&
      !Number.isNaN(locationLng)
    ) {
      return { lat: locationLat, lng: locationLng }
    }
    return null
  }, [locationLat, locationLng])

  useEffect(() => {
    locationAddressRef.current = locationAddressValue ?? ''
  }, [locationAddressValue])

  useEffect(() => {
    if (!selectedCoordinates) {
      setReverseLookupPending(false)
      setReverseLookupError(null)
      lastReverseCoordsRef.current = null
      return
    }

    const coords = selectedCoordinates

    const alreadyResolved =
      lastReverseCoordsRef.current &&
      lastReverseCoordsRef.current.lat === coords.lat &&
      lastReverseCoordsRef.current.lng === coords.lng
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
        setReverseLookupError("We couldn't match these coordinates to an address. Feel free to type it manually.")
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

    void resolveAddress()

    return () => {
      cancelled = true
    }
  }, [selectedCoordinates, setValue])

  if (loading) {
    return (
      <section className="mx-auto max-w-5xl">
        <div className="card px-8 py-10 text-secondary">Checking your session…</div>
      </section>
    )
  }

  if (!user) {
    return null
  }

  const isCitizen = user.role === 'CITIZEN'

  if (!isCitizen) {
    return (
      <section className="mx-auto max-w-3xl">
        <div className="card px-8 py-10">
          <h1 className="text-2xl font-semibold">Citizen account required</h1>
          <p className="mt-2 text-secondary">
            Only citizen accounts can submit new reports. Please sign out and sign in with a citizen profile to continue.
          </p>
        </div>
      </section>
    )
  }

  const isVerified = Boolean(user.isVerified)
  const trustLevel = (user.trustLevel ?? 'MEDIUM') as 'LOW' | 'MEDIUM' | 'HIGH'
  const dailyLimit = user.dailyReportLimit ?? null
  const reportsToday = user.reportsSubmittedToday ?? 0
  const totalReports = user.totalReportsSubmitted ?? 0
  const verificationExpiresAt = user.verificationExpiresAt ? new Date(user.verificationExpiresAt) : null
  const reachedDailyLimit = dailyLimit !== null && reportsToday >= dailyLimit
  const requiresVerificationBeforeSubmission = !isVerified && totalReports >= 1
  const submissionBlocked = reachedDailyLimit || requiresVerificationBeforeSubmission
  const trustLevelLabel = trustLevel === 'HIGH' ? 'High' : trustLevel === 'LOW' ? 'Low' : 'Medium'
  const trustLevelIcon = trustLevel === 'HIGH' ? '🟢' : trustLevel === 'LOW' ? '🔴' : '🟡'
  const dailyLimitText = dailyLimit === null ? 'Unlimited reports per day' : `${reportsToday}/${dailyLimit} reports used today`

  const locationAddressRegister = register('locationAddress', {
    onChange: () => {
      addressEditedRef.current = true
      setAddressManuallyEdited(true)
    }
  })

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

  const handleRequestVerification = async () => {
    if (!user || user.role !== 'CITIZEN') return
    setRequestingVerification(true)
    try {
      const { data } = await api.post('/auth/verification/request', { method: 'email' })
      if (typeof data?.code === 'string') {
        setDevVerificationCode(data.code)
      } else {
        setDevVerificationCode(null)
      }
      try {
        await refresh()
      } catch (_err) {
        // ignore refresh errors
      }
      const deliverySkipped = Boolean(data?.deliverySkipped)
      showSuccess(
        'Verification code sent',
        deliverySkipped
          ? 'Email delivery is not configured. Use the code displayed below to verify your account.'
          : 'Check your inbox for the 6-digit code.'
      )
    } catch (error: any) {
      const message = error?.response?.data?.error || 'Unable to send verification code right now.'
      showError('Verification code not sent', message)
    } finally {
      setRequestingVerification(false)
    }
  }

  const handleConfirmVerification = async () => {
    if (!user || user.role !== 'CITIZEN') return
    const trimmed = verificationCode.trim()
    if (!trimmed) {
      showError('Verification required', 'Enter the verification code that was sent to you.')
      return
    }
    setConfirmingVerification(true)
    try {
      await api.post('/auth/verification/confirm', { code: trimmed })
      showSuccess('Account verified', 'Thanks! You can now submit reports without restrictions.')
      setVerificationCode('')
      setDevVerificationCode(null)
      try {
        await refresh()
      } catch (_err) {
        // ignore refresh errors
      }
    } catch (error: any) {
      const status = error?.response?.status
      const message = error?.response?.data?.error || 'Unable to verify the code.'
      if (status === 410) {
        showError('Code expired', message)
      } else if (status === 400) {
        showError('Invalid code', message)
      } else {
        showError('Verification failed', message)
      }
    } finally {
      setConfirmingVerification(false)
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
  const onSubmit = async (data: ReportFormData) => {
    try {
      if (submissionBlocked) {
        if (requiresVerificationBeforeSubmission) {
          showError('Verify your account', 'Verify your email before submitting additional reports.')
        } else if (reachedDailyLimit) {
          showError('Daily limit reached', 'You have reached today’s submission limit. Try again tomorrow.')
        }
        return
      }

      const payload = new window.FormData()
      payload.append('title', data.title)
      payload.append('description', data.description)
      payload.append('category', data.category)
      const shouldSubmitAnonymously = !!data.submitAnonymously
      payload.append('submitAnonymously', shouldSubmitAnonymously ? 'true' : 'false')
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
      const trackingId: string = res.data.trackingId
      const requiresManualReview = Boolean(res.data?.requiresManualReview)
      const detailMessage = requiresManualReview
        ? `Tracking ID ${trackingId}. Your report is queued for manual review before dispatch due to current safeguards—watch My Reports for updates.`
        : shouldSubmitAnonymously
          ? `Your tracking ID is ${trackingId}. We won't email anonymous submissions, so check the My Reports page or keep this ID handy to follow progress.`
          : `Your tracking ID is ${trackingId}. You can monitor progress anytime from My Reports or the tracking page.`

      showSuccess('Report submitted successfully!', detailMessage)
      try {
        await refresh()
      } catch (_err) {
        // ignore refresh failure
      }
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
      const errorCode = e?.response?.data?.code
      if (errorCode === 'VERIFICATION_REQUIRED') {
        showError('Verify your account', errorMessage)
      } else if (errorCode === 'TRUST_LIMIT') {
        showError('Daily limit reached', errorMessage)
      } else {
        showError('Submission failed', errorMessage)
      }
      if (errorCode === 'VERIFICATION_REQUIRED' || errorCode === 'TRUST_LIMIT') {
        try {
          await refresh()
        } catch (_err) {
          // ignore refresh failure
        }
      }
    }
  }

  return (
    <section className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-[1.3fr,0.7fr]">
      <div className="card px-8 py-10">
        <div className="mb-6 space-y-2">
          <h1 className="text-3xl font-semibold">Submit a report</h1>
          <p className="text-secondary">Provide clear details so the right department can action your request immediately.</p>
        </div>
        <div className="mb-6 space-y-4">
          {!isVerified && (
            <div className="rounded-2xl border border-amber-300 bg-amber-100/70 px-5 py-4 text-sm text-amber-900 dark:border-amber-500/50 dark:bg-amber-500/10 dark:text-amber-100">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <p className="font-semibold">Verify your account</p>
                  <p>Verified citizens can submit multiple reports and receive email updates.</p>
                  {requiresVerificationBeforeSubmission && (
                    <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">
                      You’ve already submitted your first report. Verify to continue filing new ones.
                    </p>
                  )}
                  {verificationExpiresAt && (
                    <p className="text-xs text-amber-700 dark:text-amber-100/80">
                      Current code expires {verificationExpiresAt.toLocaleString()}.
                    </p>
                  )}
                  {devVerificationCode && (
                    <p className="text-xs font-mono text-amber-700 dark:text-amber-200">
                      Dev code: {devVerificationCode}
                    </p>
                  )}
                </div>
                <div className="flex w-full flex-col gap-2 lg:w-72">
                  <button
                    type="button"
                    className="btn-secondary px-4 py-2 disabled:opacity-60"
                    onClick={handleRequestVerification}
                    disabled={requestingVerification}
                  >
                    {requestingVerification ? 'Sending…' : 'Send verification code'}
                  </button>
                  <div className="flex gap-2">
                    <input
                      className="input-field flex-1"
                      placeholder="Enter 6-digit code"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value)}
                    />
                    <button
                      type="button"
                      className="btn-primary whitespace-nowrap px-4 py-2 disabled:opacity-60"
                      onClick={handleConfirmVerification}
                      disabled={confirmingVerification}
                    >
                      {confirmingVerification ? 'Verifying…' : 'Confirm'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-5 py-4 text-sm text-neutral-700 dark:border-white/10 dark:bg-white/5 dark:text-white/70">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-neutral-500 dark:text-white/50">Trust status</p>
                <p className="text-sm font-medium text-neutral-900 dark:text-white">
                  {trustLevelIcon} {trustLevelLabel} trust · {dailyLimitText}
                </p>
              </div>
              <div className="text-xs text-neutral-500 dark:text-white/60">
                Total reports submitted: {totalReports}
              </div>
            </div>
            {trustLevel === 'LOW' && (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-200">
                Low-trust accounts are reviewed manually. Consistently valid reports improve your trust score.
              </p>
            )}
            {reachedDailyLimit && (
              <p className="mt-2 text-xs font-semibold text-red-600 dark:text-red-300">
                You’ve reached today’s submission limit. Try again tomorrow or build trust with valid reports.
              </p>
            )}
          </div>
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
              <option value="OTHERS">Others / General Assistance</option>
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

          <label className="surface-subtle flex items-start gap-3 px-4 py-3 text-sm">
            <input className="mt-1" type="checkbox" {...register('submitAnonymously')} />
            <span>
              Submit anonymously
              <span className="mt-1 block text-faint">
                Your location details still reach Makati staff, but your account information stays hidden.
              </span>
            </span>
          </label>

          {submitAnonymously && (
            <p className="text-xs text-amber-600 dark:text-amber-300">
              Keep your tracking ID safe — anonymous submissions won't receive email updates.
            </p>
          )}

          <button
            className="btn-primary disabled:opacity-60"
            type="submit"
            disabled={submissionBlocked}
          >
            {submissionBlocked && requiresVerificationBeforeSubmission ? 'Verify to submit' : 'Submit report'}
          </button>
          {submissionBlocked && (
            <p className="text-xs text-red-600 dark:text-red-300">
              {requiresVerificationBeforeSubmission
                ? 'Verify your account to submit additional reports.'
                : 'You’ve reached today’s submission limit. Try again tomorrow.'}
            </p>
          )}
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
