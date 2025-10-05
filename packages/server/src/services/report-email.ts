import { pool } from '../db'
import { isEmailConfigured, sendEmail } from './email'

function formatDateTime(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value)
  return date.toLocaleString('en-PH', { timeZone: 'Asia/Manila' })
}

function buildHistoryHtml(logs: Array<{ created_at: string; action: string | null; newStatus: string | null; remarks: string | null }>): string {
  if (!logs.length) {
    return `
      <div style="padding:16px;border-radius:16px;background:rgba(241,245,249,0.9);border:1px dashed rgba(148, 163, 184, 0.6);color:#475569;font-size:13px;text-align:center;">
        We’ll let you know as soon as activity begins for this report.
      </div>
    `
  }

  const items = logs.map((log, idx) => {
    const title = log.action || (log.newStatus ? `Status changed to ${log.newStatus}` : 'Update logged')
    const remarks = log.remarks ? `<div style="margin-top:10px;padding:12px;border-radius:12px;background:rgba(241,245,249,0.8);color:#475569;font-size:13px;line-height:1.6;">${log.remarks}</div>` : ''
    const isLatest = idx === logs.length - 1
    const latestBadge = isLatest
      ? `<span style="display:inline-flex;align-items:center;padding:4px 10px;border-radius:999px;background:rgba(37, 99, 235, 0.14);color:#1d4ed8;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;">Latest update</span>`
      : ''

    return `<div style="margin-bottom:16px;padding:16px 20px;border-radius:16px;background:${isLatest ? 'rgba(37,99,235,0.06)' : '#ffffff'};border:1px solid ${isLatest ? 'rgba(37,99,235,0.25)' : 'rgba(226,232,240,0.9)'};box-shadow:${isLatest ? '0 14px 26px rgba(37, 99, 235, 0.12)' : '0 8px 18px rgba(15, 23, 42, 0.06)'};">
      <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.14em;margin-bottom:6px;">${formatDateTime(log.created_at)}</div>
      <div style="color:#1e293b;font-weight:600;font-size:14px;line-height:1.6;">${title}</div>
      ${latestBadge ? `<div style="margin-top:8px;">${latestBadge}</div>` : ''}
      ${remarks}
    </div>`
  })

  return `<div>${items.join('')}</div>`
}

function buildHistoryText(logs: Array<{ created_at: string; action: string | null; newStatus: string | null; remarks: string | null }>): string {
  if (!logs.length) {
    return 'No timeline entries yet.'
  }
  return logs
    .map((log, index) => {
      const title = log.action || (log.newStatus ? `Status changed to ${log.newStatus}` : 'Update logged')
      const remarks = log.remarks ? `\nNotes: ${log.remarks}` : ''
      const prefix = index === logs.length - 1 ? '[Latest]' : '•'
      return `${prefix} ${formatDateTime(log.created_at)} — ${title}${remarks}`
    })
    .join('\n\n')
}

type NotifyOptions = {
  reportId: number
  message?: string | null
  newStatus?: string | null
  actorName?: string | null
}

type LocationInput = {
  locationAddress?: string | null
  locationLat?: string | number | null
  locationLng?: string | number | null
}


type EmailLayoutOptions = {
  heroIconHtml?: string
  title: string
  subtitle: string
  body: string
  accentFrom?: string
  accentTo?: string
}

function renderEmailLayout({ heroIconHtml, title, subtitle, body, accentFrom = '#1d4ed8', accentTo = '#2563eb' }: EmailLayoutOptions): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#f6f9fc;padding:24px 0;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;">
      <tr>
        <td>
          <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 24px 48px rgba(15, 23, 42, 0.08);">
            <tr>
              <td style="background:linear-gradient(135deg, ${accentFrom} 0%, ${accentTo} 100%);color:#f8fafc;padding:32px 32px 28px;text-align:left;">
                <div style="display:flex;align-items:center;gap:14px;">
                  ${heroIconHtml ?? ''}
                  <div>
                    <p style="margin:0 0 6px;font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(241,245,249,0.75);">Makati Cares</p>
                    <h1 style="margin:0;font-size:26px;font-weight:700;color:#ffffff;">${title}</h1>
                    <p style="margin:10px 0 0;font-size:15px;color:rgba(241,245,249,0.85);">${subtitle}</p>
                  </div>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 32px 12px;background:#ffffff;"><div style="color:#0f172a;font-size:15px;line-height:1.7;">${body}</div></td>
            </tr>
            <tr>
              <td style="padding:0 32px 32px;background:#ffffff;">
                <div style="margin-top:24px;padding:18px 20px;border-radius:16px;background:linear-gradient(135deg, rgba(37, 99, 235, 0.12) 0%, rgba(56, 189, 248, 0.12) 100%);border:1px solid rgba(37, 99, 235, 0.18);text-align:center;">
                  <p style="margin:0 0 4px;color:#1e293b;font-weight:600;font-size:14px;">Need help right now?</p>
                  <p style="margin:0;color:#334155;font-size:13px;">Call the Makati Action Center <strong>168</strong> or visit your nearest barangay office.</p>
                </div>
              </td>
            </tr>
            <tr>
              <td style="background:#0f172a;padding:18px 32px;text-align:center;color:#e2e8f0;font-size:12px;">
                <div style="margin-bottom:4px;font-weight:600;">"Your City, Your Voice, Our Action"</div>
                <div>City Government of Makati</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `
}

function normalizeCoordinate(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function buildLocationSections(info: LocationInput): { html: string; textLines: string[] } {
  const address = typeof info.locationAddress === 'string' && info.locationAddress.trim().length > 0 ? info.locationAddress.trim() : null
  const lat = normalizeCoordinate(info.locationLat)
  const lng = normalizeCoordinate(info.locationLng)
  const hasCoords = lat !== null && lng !== null
  const mapLink = hasCoords ? `https://www.google.com/maps?q=${lat},${lng}` : null

  if (!address && !mapLink) {
    return {
      html: '',
      textLines: []
    }
  }

  const htmlParts: string[] = []
  if (address) {
    htmlParts.push(`<div style="padding:14px;border-radius:14px;background:rgba(226, 232, 240, 0.35);">
      <div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.22em;font-weight:600;">Address</div>
      <div style="margin-top:8px;color:#0f172a;font-size:14px;line-height:1.6;">${address}</div>
    </div>`)
  }
  if (mapLink && lat !== null && lng !== null) {
    htmlParts.push(`<div style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;">
      <a href="${mapLink}" style="display:inline-flex;align-items:center;padding:10px 20px;border-radius:999px;background:#1d4ed8;color:#ffffff;font-weight:600;font-size:13px;text-decoration:none;box-shadow:0 10px 22px rgba(29, 78, 216, 0.24);">Open map</a>
      <div style="font-size:12px;color:#475569;background:rgba(148,163,184,0.16);padding:6px 12px;border-radius:999px;">${lat.toFixed(5)}, ${lng.toFixed(5)}</div>
    </div>`)
  }

  const html = `
    <div style="margin:26px 0 0;padding:24px;border-radius:20px;background:#ffffff;border:1px solid rgba(226, 232, 240, 0.9);box-shadow:0 14px 30px rgba(15, 23, 42, 0.08);">
      <div style="font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#1e3a8a;font-weight:700;">Location details</div>
      <div style="font-size:15px;color:#0f172a;font-weight:600;margin-top:6px;">Helping responders navigate faster</div>
      <div style="margin-top:18px;display:grid;gap:16px;">
        ${htmlParts.join('')}
      </div>
    </div>
  `

  const textLines: string[] = []
  if (address) {
    textLines.push(`Location: ${address}`)
  }
  if (mapLink && lat !== null && lng !== null) {
    textLines.push(`Map: ${mapLink}`)
    textLines.push(`Coordinates: ${lat.toFixed(5)}, ${lng.toFixed(5)}`)
  }

  return { html, textLines }
}

export async function sendReportSubmissionReceipt(reportId: number): Promise<void> {
  if (!isEmailConfigured()) {
    return
  }

  const [reportRows] = await pool.query(
    `SELECT r.report_id as id,
            r.tracking_id as trackingId,
            r.title,
            r.description,
            r.category,
            r.status,
            r.location_address as locationAddress,
            r.location_lat as locationLat,
            r.location_lng as locationLng,
            r.created_at as createdAt,
            r.expected_resolution_hours as expectedResolutionHours,
            r.is_anonymous as isAnonymous,
            c.email as citizenEmail,
            c.full_name as citizenName
     FROM reports r
     LEFT JOIN citizens c ON r.citizen_id = c.citizen_id
     WHERE r.report_id = ?
     LIMIT 1`,
    [reportId]
  )

  const report = (reportRows as any[])[0]
  if (!report || !report.citizenEmail || report.isAnonymous) {
    return
  }

  const greetingName = report.citizenName || 'Valued Citizen'
  const submittedAt = formatDateTime(report.createdAt)
  const statusBadgeColor = report.status === 'Resolved' ? '#10b981' : report.status === 'In Progress' ? '#f59e0b' : '#6366f1'
  const expectedTimelineLabel = report.expectedResolutionHours
    ? `Estimated resolution: within ${report.expectedResolutionHours} hour(s)`
    : null

  const locationSections = buildLocationSections(report)

  const subject = `Report received - ${report.trackingId}`

  const summaryCard = `
    <div style="margin:24px 0 0;padding:24px;border-radius:22px;background:#ffffff;border:1px solid rgba(226, 232, 240, 0.9);box-shadow:0 16px 32px rgba(15, 23, 42, 0.08);">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.26em;color:#64748b;font-weight:600;">Report snapshot</div>
      <div style="margin-top:10px;font-size:18px;color:#0f172a;font-weight:700;line-height:1.5;">${report.title}</div>
      <div style="margin-top:18px;display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:18px;">
        <div style="padding:16px;border-radius:16px;background:rgba(226, 232, 240, 0.38);">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.24em;color:#475569;font-weight:700;">Tracking ID</div>
          <div style="margin-top:10px;font-size:20px;font-weight:700;color:#0f172a;">${report.trackingId}</div>
          <div style="margin-top:6px;font-size:12px;color:#64748b;">Submitted ${submittedAt}</div>
        </div>
        <div style="padding:16px;border-radius:16px;background:rgba(219, 234, 254, 0.55);">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.24em;color:#1d4ed8;font-weight:700;">Status</div>
          <div style="margin-top:10px;display:flex;align-items:center;gap:10px;">
            <span style="display:inline-flex;align-items:center;padding:6px 16px;border-radius:999px;background:${statusBadgeColor};color:#ffffff;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">${report.status}</span>
          </div>
          ${expectedTimelineLabel ? `<div style="margin-top:10px;font-size:12px;color:#1d4ed8;">${expectedTimelineLabel}</div>` : ''}
        </div>
        <div style="padding:16px;border-radius:16px;background:rgba(240, 253, 244, 0.8);">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.24em;color:#047857;font-weight:700;">Category</div>
          <div style="margin-top:8px;font-size:15px;color:#0f172a;font-weight:600;">${report.category}</div>
          <div style="margin-top:8px;font-size:13px;color:#475569;line-height:1.6;">${report.description}</div>
        </div>
      </div>
    </div>
  `

  const journeySection = `
    <div style="margin:28px 0 0;padding:24px;border-radius:22px;background:#ffffff;border:1px solid rgba(226,232,240,0.9);box-shadow:0 16px 32px rgba(15, 23, 42, 0.08);">
      <div style="font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#0ea5e9;font-weight:700;">What happens next</div>
      <div style="font-size:15px;color:#0f172a;margin-top:6px;font-weight:600;">We’re guiding your concern to the right team</div>
      <ol style="margin:20px 0 0;padding-left:18px;color:#0f172a;font-size:14px;line-height:1.8;">
        <li>The report is prioritized and routed to the responsible department.</li>
        <li>You’ll receive an email notification each time the status changes.</li>
        <li>Track progress anytime using your Makati Cares portal tracking ID.</li>
      </ol>
    </div>
  `

  const body = `
    <p style="margin:0 0 16px;color:#334155;font-size:15px;">Hello <strong>${greetingName}</strong>,</p>
    <p style="margin:0 0 18px;color:#475569;font-size:15px;">Maraming salamat for trusting Makati Cares. Your concern is now logged and our rapid response desk is assigning it to the right department.</p>
    ${summaryCard}
    ${locationSections.html}
    ${journeySection}
  `

  const html = renderEmailLayout({
    title: 'Report received successfully',
    subtitle: 'You’ll get notified every step of the way while we work on your concern.',
    body,
    accentFrom: '#0ea5e9',
    accentTo: '#2563eb'
  })

  const textBodyLines = [
    `Hello ${greetingName},`,
    '',
  'Report received successfully',
  `Title: ${report.title} (${report.trackingId})`,
    '',
    `Submitted: ${submittedAt}`,
    `Status: ${report.status}`,
    '',
  'Summary:',
  `Category: ${report.category}`,
  `Description: ${report.description}`,
    ...locationSections.textLines,
    '',
    'Next steps:',
  '- We assign the report to the appropriate department.',
  '- You will receive email updates when the status changes.',
  '- Keep the tracking ID handy to monitor progress anytime.',
    '',
    'Need help? Call Makati Action Center at 168.',
    '',
    'Thank you for helping us improve the city.',
    'Makati City Government'
  ]

  await sendEmail({
    to: report.citizenEmail,
    subject,
    html,
    text: textBodyLines.join('\n')
  })
}

export async function sendReportUpdateNotification({ reportId, message, newStatus, actorName }: NotifyOptions): Promise<void> {
  if (!isEmailConfigured()) {
    return
  }

  const [reportRows] = await pool.query(
    `SELECT r.report_id as id,
            r.tracking_id as trackingId,
            r.title,
            r.description,
            r.category,
            r.status,
            r.location_address as locationAddress,
            r.location_lat as locationLat,
            r.location_lng as locationLng,
            r.is_anonymous as isAnonymous,
            c.email as citizenEmail,
            c.full_name as citizenName
     FROM reports r
     LEFT JOIN citizens c ON r.citizen_id = c.citizen_id
     WHERE r.report_id = ?
     LIMIT 1`,
    [reportId]
  )
  const report = (reportRows as any[])[0]
  if (!report || !report.citizenEmail || report.isAnonymous) {
    return
  }

  const [logRows] = await pool.query(
    `SELECT created_at, action, new_status as newStatus, remarks
     FROM report_status_logs
     WHERE report_id = ?
     ORDER BY created_at ASC`,
    [reportId]
  )

  const logs = (logRows as any[]).slice(-15) // limit email size to most recent 15 entries

  const greetingName = report.citizenName || 'Valued Citizen'
  const actorLine = actorName
    ? `
      <div style="margin:18px 0;padding:18px;border-radius:18px;background:rgba(219, 234, 254, 0.65);border:1px solid rgba(37, 99, 235, 0.22);">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.22em;color:#1d4ed8;font-weight:700;">Update posted</div>
        <div style="margin-top:8px;font-size:14px;color:#1e3a8a;font-weight:600;">${actorName} shared a new progress update.</div>
        <div style="margin-top:6px;font-size:12px;color:#475569;line-height:1.6;">We’ve recorded it below and added it to your progress timeline.</div>
      </div>
    `
    : ''
  const messageSection = message
    ? `
      <div style="margin:0 0 24px;padding:20px;border-radius:20px;background:rgba(240, 253, 244, 0.92);border:1px solid rgba(16, 185, 129, 0.35);box-shadow:0 10px 24px rgba(16, 185, 129, 0.12);">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.22em;color:#047857;font-weight:700;">Latest note</div>
        <div style="margin-top:10px;color:#065f46;font-size:13px;line-height:1.8;white-space:pre-line;">${message}</div>
      </div>
    `
    : ''
  const currentStatus = newStatus && newStatus.trim().length > 0 ? newStatus : report.status
  const statusBadgeColor = currentStatus === 'Resolved' ? '#10b981' : currentStatus === 'In Progress' ? '#f59e0b' : '#6b7280'
  const statusBadge = `<span style="display:inline-flex;align-items:center;gap:6px;padding:6px 16px;border-radius:999px;background:${statusBadgeColor};color:#ffffff;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">${currentStatus}</span>`
  const locationSections = buildLocationSections(report)

  const subject = `Report update - ${report.trackingId}`

  const summarySection = `
    <div style="margin:6px 0 24px;padding:24px;border-radius:22px;background:#ffffff;border:1px solid rgba(226,232,240,0.9);box-shadow:0 18px 34px rgba(15, 23, 42, 0.1);display:flex;flex-wrap:wrap;gap:24px;justify-content:space-between;align-items:flex-start;">
      <div style="min-width:220px;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.22em;color:#64748b;font-weight:600;">Tracking ID</div>
        <div style="margin-top:10px;font-size:22px;font-weight:700;color:#0f172a;">${report.trackingId}</div>
        <div style="margin-top:6px;font-size:14px;color:#475569;line-height:1.5;">${report.title}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;align-items:flex-end;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.22em;color:#64748b;font-weight:600;">Current status</div>
        <div>${statusBadge}</div>
        ${actorName ? `<div style="font-size:12px;color:#1d4ed8;background:rgba(219, 234, 254, 0.7);padding:8px 16px;border-radius:999px;font-weight:600;">Update from ${actorName}</div>` : ''}
      </div>
    </div>
  `

  const messageBlock = messageSection
    ? messageSection
    : `<div style="margin:0 0 24px;padding:18px;border-radius:18px;background:#ffffff;border:1px dashed rgba(148, 163, 184, 0.55);color:#475569;font-size:13px;text-align:center;">No additional notes were provided with this update.</div>`

  const detailsCard = `
    <div style="margin:0 0 26px;padding:24px;border-radius:22px;background:#ffffff;border:1px solid rgba(226,232,240,0.9);box-shadow:0 16px 32px rgba(15, 23, 42, 0.08);">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.22em;color:#1e3a8a;font-weight:700;">Report details</div>
      <div style="margin-top:6px;font-size:15px;color:#0f172a;font-weight:600;">What our teams are currently working with</div>
      <div style="margin-top:18px;display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;">
        <div style="padding:16px;border-radius:16px;background:rgba(226,232,240,0.38);">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.22em;color:#1d4ed8;font-weight:700;">Category</div>
          <div style="margin-top:8px;font-size:15px;color:#0f172a;font-weight:600;">${report.category}</div>
        </div>
        <div style="padding:16px;border-radius:16px;background:rgba(241,245,249,0.9);">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.22em;color:#475569;font-weight:700;">Description</div>
          <div style="margin-top:8px;font-size:13px;color:#475569;line-height:1.6;">${report.description}</div>
        </div>
        ${report.locationAddress ? `<div style="padding:16px;border-radius:16px;background:rgba(241,245,249,0.9);">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.22em;color:#475569;font-weight:700;">Address</div>
          <div style="margin-top:8px;font-size:13px;color:#475569;line-height:1.6;">${report.locationAddress}</div>
        </div>` : ''}
      </div>
    </div>
  `

  const timelineSection = `
    <div style="margin:0;padding:24px;border-radius:22px;background:#ffffff;border:1px solid rgba(226,232,240,0.9);box-shadow:0 16px 32px rgba(15, 23, 42, 0.08);">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.22em;color:#3730a3;font-weight:700;">Progress timeline</div>
      <div style="margin-top:6px;font-size:15px;color:#0f172a;font-weight:600;">A clear record of every action we’ve taken</div>
      <div style="margin-top:18px;">
      ${buildHistoryHtml(logs)}
      </div>
    </div>
  `

  const body = `
    <p style="margin:0 0 18px;color:#334155;font-size:15px;">Hello <strong>${greetingName}</strong>,</p>
    <p style="margin:0 0 22px;color:#475569;font-size:15px;">Here’s the latest progress from Makati Cares on your concern. We’ll keep these updates flowing until everything is resolved.</p>
    ${summarySection}
    ${actorLine}
    ${messageBlock}
    ${detailsCard}
    ${locationSections.html}
    ${timelineSection}
  `

  const html = renderEmailLayout({
    title: 'You have a fresh update',
    subtitle: `Tracking ${report.trackingId} · ${currentStatus}`,
    body,
    accentFrom: '#312e81',
    accentTo: '#2563eb'
  })

  const textBodyLines = [
    `Hello ${greetingName},`,
    '',
    `Update: ${report.title} (${report.trackingId})`,
    `Status: ${currentStatus}`,
    actorName ? `Updated by: ${actorName}` : '',
    '',
    message ? `Latest note:\n${message}` : '',
    '',
    'Summary:',
    `Category: ${report.category}`,
    `Description: ${report.description}`,
    ...locationSections.textLines,
    '',
    'Timeline:',
    buildHistoryText(logs),
    '',
    'Questions? Contact Makati Action Center at 168',
    `Track your report anytime with ID: ${report.trackingId}`,
    '',
    'Makati City Government'
  ].filter(Boolean)

  await sendEmail({
    to: report.citizenEmail,
    subject,
    html,
    text: textBodyLines.join('\n')
  })
}
