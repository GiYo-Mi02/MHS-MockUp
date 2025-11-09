import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '../supabase'
import { sendEmail, isEmailConfigured } from './email'

export type VerificationMethod = 'email' | 'phone' | 'manual'

const VERIFICATION_TTL_MINUTES = Number(process.env.VERIFICATION_TTL_MINUTES || 15)

function generateCode(): string {
  const value = crypto.randomInt(0, 1_000_000)
  return value.toString().padStart(6, '0')
}

export async function issueVerificationCode(options: {
  citizenId: number
  method?: VerificationMethod
  destination?: string | null
}) {
  const method: VerificationMethod = options.method ?? 'email'
  const code = generateCode()
  const hash = await bcrypt.hash(code, 10)
  
  // Calculate expiration time - use server's current timestamp
  const nowMs = Date.now()
  const ttlMs = VERIFICATION_TTL_MINUTES * 60 * 1000
  const expiresAtMs = nowMs + ttlMs
  const expiresAtIso = new Date(expiresAtMs).toISOString()

  console.log('[verification] Issuing code for citizen', options.citizenId, {
    code,
    nowMs,
    expiresAtMs,
    ttlMinutes: VERIFICATION_TTL_MINUTES,
    expiresAtIso
  })

  const { error: updateError } = await supabaseAdmin
    .from('citizens')
    .update({
      verification_code_hash: hash,
      verification_expires_at: expiresAtIso,
      verification_method: method,
      is_verified: false
    })
    .eq('citizen_id', options.citizenId)
  
  if (updateError) {
    console.error('[verification] Failed to update verification code in database:', updateError)
    throw new Error(`Failed to store verification code: ${updateError.message}`)
  }
  
  console.log('[verification] Successfully stored verification code for citizen', options.citizenId)

  let deliverySkipped = false
  if (method === 'email' && options.destination) {
    try {
      const subject = 'Verify your Makati Report account'
      const html = `
        <p>Hi there,</p>
        <p>Your verification code is <strong style="font-size:20px;">${code}</strong>.</p>
        <p>Enter this code in the Makati Report portal within ${VERIFICATION_TTL_MINUTES} minutes to confirm your email.</p>
        <p>If you did not request this, you can ignore the message.</p>
        <p>— Makati Report Team</p>
      `
      const text = `Your Makati Report verification code is ${code}. It expires in ${VERIFICATION_TTL_MINUTES} minutes.`
      const result = await sendEmail({ to: options.destination, subject, html, text })
      deliverySkipped = Boolean(result.skipped)
    } catch (error) {
      console.error('Failed to send verification email:', error)
      deliverySkipped = true
    }
  } else if (method === 'email' && !options.destination) {
    deliverySkipped = true
  } else if (method !== 'email') {
    deliverySkipped = true
  }

  return {
    code,
    expiresAt: new Date(expiresAtMs),
    deliverySkipped: deliverySkipped || !isEmailConfigured()
  }
}

export type VerificationAttemptResult =
  | { success: true; method: VerificationMethod }
  | { success: false; reason: 'not_found' | 'already_verified' | 'expired' | 'invalid' }

export async function verifyCitizenCode(options: { citizenId: number; code: string }): Promise<VerificationAttemptResult> {
  const { data: citizen, error } = await supabaseAdmin
    .from('citizens')
    .select('is_verified, verification_code_hash, verification_expires_at, verification_method')
    .eq('citizen_id', options.citizenId)
    .single()

  if (error || !citizen) {
    return { success: false, reason: 'not_found' }
  }

  if (citizen.is_verified) {
    return { success: false, reason: 'already_verified' }
  }

  if (!citizen.verification_code_hash) {
    return { success: false, reason: 'invalid' }
  }

  if (citizen.verification_expires_at) {
    // Parse DB timestamp. Supabase may return a string without timezone (e.g., "YYYY-MM-DDTHH:mm:ss.SSS").
    // In JS, such strings are treated as local time. Our DB stores UTC instants, so assume UTC if no TZ is present.
    const raw = String(citizen.verification_expires_at)
    const hasTz = /Z$|[+-]\d{2}:\d{2}$/.test(raw)
    const normalized = hasTz ? raw : raw + 'Z'
    const expiresAtMs = Date.parse(normalized)
    const nowMs = Date.now()
    const diffMs = expiresAtMs - nowMs
    
    console.log('[verification] Expiration check for citizen', options.citizenId, {
      expiresAtFromDb: citizen.verification_expires_at,
      normalized,
      expiresAtMs,
      nowMs,
      diffMs,
      diffSeconds: Math.round(diffMs / 1000),
      isExpired: diffMs < 0
    })
    
    if (diffMs < 0) {
      console.log('[verification] Code expired for citizen', options.citizenId)
      return { success: false, reason: 'expired' }
    }
  }

  const matches = await bcrypt.compare(options.code, citizen.verification_code_hash)
  if (!matches) {
    return { success: false, reason: 'invalid' }
  }

  await supabaseAdmin
    .from('citizens')
    .update({
      is_verified: true,
      verified_at: new Date().toISOString(),
      verification_code_hash: null,
      verification_expires_at: null
    })
    .eq('citizen_id', options.citizenId)

  return {
    success: true,
    method: (citizen.verification_method as VerificationMethod) || 'email'
  }
}
