import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { pool } from '../db'
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
  const expiresAt = new Date(Date.now() + VERIFICATION_TTL_MINUTES * 60 * 1000)

  await pool.query(
    `UPDATE citizens
        SET verification_code_hash = ?,
            verification_expires_at = ?,
            verification_method = ?,
            is_verified = FALSE
      WHERE citizen_id = ?`,
    [hash, expiresAt, method, options.citizenId]
  )

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
    expiresAt,
    deliverySkipped: deliverySkipped || !isEmailConfigured()
  }
}

export type VerificationAttemptResult =
  | { success: true; method: VerificationMethod }
  | { success: false; reason: 'not_found' | 'already_verified' | 'expired' | 'invalid' }

export async function verifyCitizenCode(options: { citizenId: number; code: string }): Promise<VerificationAttemptResult> {
  const [rows] = await pool.query(
    'SELECT is_verified, verification_code_hash, verification_expires_at, verification_method FROM citizens WHERE citizen_id = ? LIMIT 1',
    [options.citizenId]
  )
  const citizen = (rows as any[])[0]
  if (!citizen) {
    return { success: false, reason: 'not_found' }
  }

  if (citizen.is_verified) {
    return { success: false, reason: 'already_verified' }
  }

  if (!citizen.verification_code_hash) {
    return { success: false, reason: 'invalid' }
  }

  if (citizen.verification_expires_at && new Date(citizen.verification_expires_at).getTime() < Date.now()) {
    return { success: false, reason: 'expired' }
  }

  const matches = await bcrypt.compare(options.code, citizen.verification_code_hash)
  if (!matches) {
    return { success: false, reason: 'invalid' }
  }

  await pool.query(
    `UPDATE citizens
        SET is_verified = TRUE,
            verified_at = NOW(),
            verification_code_hash = NULL,
            verification_expires_at = NULL
      WHERE citizen_id = ?`,
    [options.citizenId]
  )

  return {
    success: true,
    method: (citizen.verification_method as VerificationMethod) || 'email'
  }
}
