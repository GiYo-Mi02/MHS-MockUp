import nodemailer, { type Transporter } from 'nodemailer'

const SMTP_HOST = process.env.SMTP_HOST || ''
const SMTP_PORT = Number(process.env.SMTP_PORT || 587)
const SMTP_USER = process.env.SMTP_USER || ''
const SMTP_PASS = process.env.SMTP_PASS || ''
const SMTP_SECURE = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true'
const EMAIL_FROM = process.env.EMAIL_FROM || SMTP_USER || ''

let cachedTransporter: Transporter | null = null

function buildTransporter(): Transporter | null {
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
  return Boolean(SMTP_HOST && EMAIL_FROM)
}

export type SendEmailOptions = {
  to: string
  subject: string
  html: string
  text: string
}

export async function sendEmail({ to, subject, html, text }: SendEmailOptions): Promise<{ skipped?: boolean }> {
  const transporter = buildTransporter()
  if (!transporter || !EMAIL_FROM) {
    console.warn('Email transport is not configured. Skipping send to %s', to)
    return { skipped: true }
  }

  await transporter.sendMail({
    from: EMAIL_FROM,
    to,
    subject,
    html,
    text
  })

  return {}
}
