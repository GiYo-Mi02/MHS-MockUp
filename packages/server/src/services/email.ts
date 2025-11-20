import nodemailer, { type Transporter, type SentMessageInfo } from 'nodemailer'

const SMTP_HOST = process.env.SMTP_HOST || ''
const SMTP_PORT = Number(process.env.SMTP_PORT || 587)
const SMTP_USER = process.env.SMTP_USER || ''
const SMTP_PASS = process.env.SMTP_PASS || ''
const SMTP_SECURE = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true'
const EMAIL_FROM = process.env.EMAIL_FROM || ''
const FROM_ADDRESS = EMAIL_FROM || SMTP_USER || ''

let cachedTransporter: Transporter<SentMessageInfo> | null = null

function buildTransporter(): Transporter<SentMessageInfo> | null {
  if (!SMTP_HOST) {
    return null
  }

  if (cachedTransporter) {
    return cachedTransporter
  }

  cachedTransporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined
  })

  return cachedTransporter
}

export function isEmailConfigured(): boolean {
  return Boolean(SMTP_HOST && FROM_ADDRESS)
}

function maskEmail(value: string): string {
  if (!value) return ''
  const [local, domain] = value.split('@')
  if (!domain) return value
  if (local.length <= 2) return `${local[0] ?? ''}***@${domain}`
  return `${local[0]}***${local.slice(-1)}@${domain}`
}

export function getEmailDiagnostics() {
  return {
    configured: isEmailConfigured(),
    host: SMTP_HOST || null,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    fromAddress: FROM_ADDRESS || null,
    hasAuthUser: Boolean(SMTP_USER),
    maskedAuthUser: maskEmail(SMTP_USER)
  }
}

export async function verifyEmailTransport(): Promise<boolean> {
  const transporter = buildTransporter()
  if (!transporter || !FROM_ADDRESS) {
    console.warn('Email transport is not configured. Skipping verification test.')
    return false
  }

  try {
    // Add a timeout for verification (5 seconds)
    const verifyPromise = transporter.verify()
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Email verification timeout')), 5000)
    )
    
    await Promise.race([verifyPromise, timeoutPromise])
    console.info('Email transport verified for %s:%d (from %s)', SMTP_HOST, SMTP_PORT, FROM_ADDRESS)
    return true
  } catch (error) {
    // Don't throw errors for email verification - just log warnings
    console.warn('Email transport verification warning:', (error as Error)?.message || String(error))
    return false
  }
}

export type SendEmailOptions = {
  to: string
  subject: string
  html: string
  text: string
}

export async function sendEmail({ to, subject, html, text }: SendEmailOptions): Promise<{ skipped?: boolean }> {
  const transporter = buildTransporter()
  if (!transporter || !FROM_ADDRESS) {
    console.warn('Email transport is not configured. Skipping send to %s', to)
    return { skipped: true }
  }

  try {
    await transporter.sendMail({
      from: FROM_ADDRESS,
      to,
      subject,
      html,
      text
    })
  } catch (error) {
    console.error('Failed to send email to %s: %s', to, (error as Error).message)
    throw error
  }

  return {}
}
