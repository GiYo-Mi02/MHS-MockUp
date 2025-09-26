import { pool } from '../db'
import { isEmailConfigured, sendEmail } from './email'

function formatDateTime(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value)
  return date.toLocaleString('en-PH', { timeZone: 'Asia/Manila' })
}

function buildHistoryHtml(logs: Array<{ created_at: string; action: string | null; newStatus: string | null; remarks: string | null }>): string {
  if (!logs.length) {
    return '<div style="padding:12px;background:#f8fafc;border-radius:6px;text-align:center;color:#64748b;">📋 No updates yet - this is a new report</div>'
  }

  const items = logs.map((log, idx) => {
    const title = log.action || (log.newStatus ? `Status changed to ${log.newStatus}` : 'Update')
    const remarks = log.remarks ? `<div style="margin-top:6px;padding:8px;background:#f1f5f9;border-radius:4px;color:#475569;font-size:13px;">"${log.remarks}"</div>` : ''
    const isLatest = idx === logs.length - 1
    const dotColor = isLatest ? '#3b82f6' : '#94a3b8'
    
    return `<div style="position:relative;padding-left:24px;margin-bottom:16px;${isLatest ? 'background:#fef7f0;border-left:3px solid #f97316;padding-left:21px;' : ''}">
      <div style="position:absolute;left:${isLatest ? '-4px' : '0'};top:6px;width:8px;height:8px;background:${dotColor};border-radius:50%;${isLatest ? 'box-shadow:0 0 0 3px #fed7aa;' : ''}"></div>
      <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px;">${formatDateTime(log.created_at)}</div>
      <div style="font-weight:600;color:#1e293b;margin-bottom:2px;">${isLatest ? '🔔 ' : ''}${title}</div>
      ${remarks}
    </div>`
  })

  return `<div style="border-left:2px solid #e2e8f0;padding-left:12px;">${items.join('')}</div>`
}

function buildHistoryText(logs: Array<{ created_at: string; action: string | null; newStatus: string | null; remarks: string | null }>): string {
  if (!logs.length) {
    return 'No status changes have been recorded yet.'
  }
  return logs
    .map((log) => {
      const title = log.action || (log.newStatus ? `Status changed to ${log.newStatus}` : 'Update')
      const remarks = log.remarks ? `\n${log.remarks}` : ''
      return `${formatDateTime(log.created_at)} - ${title}${remarks}`
    })
    .join('\n\n')
}

type NotifyOptions = {
  reportId: number
  message?: string | null
  newStatus?: string | null
  actorName?: string | null
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
            c.email as citizenEmail,
            c.full_name as citizenName
     FROM reports r
     LEFT JOIN citizens c ON r.citizen_id = c.citizen_id
     WHERE r.report_id = ?
     LIMIT 1`,
    [reportId]
  )
  const report = (reportRows as any[])[0]
  if (!report || !report.citizenEmail) {
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

  const mapLink = report.locationLat != null && report.locationLng != null
    ? `https://www.google.com/maps?q=${report.locationLat},${report.locationLng}`
    : null

  const greetingName = report.citizenName || 'Valued Citizen'
  const actorLine = actorName ? `<div style="margin:12px 0;padding:12px;background:#dbeafe;border-radius:8px;border-left:4px solid #3b82f6;"><strong>👤 ${actorName}</strong> has provided an update on your report.</div>` : ''
  const messageSection = message ? `<div style="margin:16px 0;padding:16px;background:#f0fdf4;border-radius:8px;border-left:4px solid #10b981;"><div style="font-size:13px;color:#065f46;font-weight:600;margin-bottom:6px;">💬 Latest Message:</div><div style="color:#047857;white-space:pre-line;">${message}</div></div>` : ''
  const statusBadgeColor = report.status === 'Resolved' ? '#10b981' : report.status === 'In Progress' ? '#f59e0b' : '#6b7280'
  const statusLine = newStatus ? `<div style="margin:12px 0;text-align:center;"><span style="display:inline-block;padding:6px 14px;background:${statusBadgeColor};color:white;border-radius:20px;font-size:12px;font-weight:600;text-transform:uppercase;">Status: ${newStatus}</span></div>` : `<div style="margin:12px 0;text-align:center;"><span style="display:inline-block;padding:6px 14px;background:${statusBadgeColor};color:white;border-radius:20px;font-size:12px;font-weight:600;text-transform:uppercase;">Status: ${report.status}</span></div>`
  const mapSection = mapLink
    ? `<div style="margin:12px 0;text-align:center;"><a href="${mapLink}" style="display:inline-block;padding:10px 16px;background:#3b82f6;color:white;text-decoration:none;border-radius:6px;font-weight:500;">📍 View Location on Map</a><br /><span style="font-size:11px;color:#64748b;margin-top:4px;display:block;">Coordinates: ${Number(report.locationLat).toFixed(5)}, ${Number(report.locationLng).toFixed(5)}</span></div>`
    : ''

  const subject = `🔔 ${report.title} Update - ${report.trackingId}`

  const html = `
    <div style="font-family:'Segoe UI',system-ui,-apple-system,sans-serif;max-width:600px;margin:0 auto;background:white;">
      <!-- Header -->
      <div style="background:linear-gradient(135deg,#1e40af 0%,#3b82f6 100%);color:white;padding:24px 20px;text-align:center;border-radius:12px 12px 0 0;">
        <h1 style="margin:0;font-size:24px;font-weight:600;">📋 Makati Cares</h1>
        <p style="margin:8px 0 0;opacity:0.9;font-size:16px;">Your Report Update</p>
      </div>
      
      <!-- Content -->
      <div style="padding:24px 20px;background:white;">
        <div style="text-align:center;margin-bottom:20px;">
          <h2 style="margin:0 0 8px;color:#1e293b;font-size:20px;">${report.title}</h2>
          <p style="margin:0;color:#64748b;font-size:14px;">Tracking ID: <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;font-family:monospace;">${report.trackingId}</code></p>
        </div>
        
        <div style="margin-bottom:20px;">
          <p style="margin:0 0 12px;font-size:16px;color:#374151;">Hello <strong>${greetingName}</strong> 👋,</p>
          <p style="margin:0 0 16px;color:#4b5563;">We have an important update regarding your concern submitted to the City of Makati.</p>
        </div>
        
        ${actorLine}
        ${statusLine}
        ${messageSection}
        
        <!-- Report Details Card -->
        <div style="margin:20px 0;padding:16px;border:1px solid #e2e8f0;border-radius:12px;background:#fafbfc;">
          <h3 style="margin:0 0 12px;color:#1e293b;font-size:16px;display:flex;align-items:center;">📋 Report Summary</h3>
          <div style="display:grid;grid-template-columns:120px 1fr;gap:8px;font-size:14px;">
            <span style="color:#64748b;font-weight:500;">Category:</span>
            <span style="color:#1e293b;">${report.category}</span>
            <span style="color:#64748b;font-weight:500;">Description:</span>
            <span style="color:#1e293b;">${report.description}</span>
          </div>
          ${mapSection}
        </div>
        
        <!-- Status Timeline -->
        <div style="margin:24px 0;">
          <h3 style="margin:0 0 16px;color:#1e293b;font-size:16px;display:flex;align-items:center;">📈 Progress Timeline</h3>
          ${buildHistoryHtml(logs)}
        </div>
        
        <!-- Footer -->
        <div style="margin:24px 0 0;padding:16px;background:#f8fafc;border-radius:8px;text-align:center;">
          <p style="margin:0 0 8px;color:#374151;font-size:14px;"><strong>Questions or concerns?</strong></p>
          <p style="margin:0;color:#64748b;font-size:13px;">Contact the Makati Action Center at <strong style="color:#1e293b;">168</strong> or visit any City Hall office</p>
          <p style="margin:8px 0 0;color:#94a3b8;font-size:11px;font-style:italic;">"Your City, Your Voice, Our Action"</p>
        </div>
      </div>
    </div>
  `

  const textBodyLines = [
    `Hello ${greetingName},`,
    '',
    `🔔 UPDATE: ${report.title} (${report.trackingId})`,
    '',
    actorName ? `👤 ${actorName} has provided an update on your report.` : '',
    newStatus ? `📊 STATUS: ${newStatus}` : `📊 CURRENT STATUS: ${report.status}`,
    '',
    message ? `💬 LATEST MESSAGE:\n${message}` : '',
    '',
    '📋 REPORT SUMMARY:',
    `Category: ${report.category}`,
    `Description: ${report.description}`,
    mapLink ? `📍 Location: ${mapLink}` : '',
    '',
    '📈 PROGRESS TIMELINE:',
    buildHistoryText(logs),
    '',
    '──────────────────────────',
    'Questions? Contact Makati Action Center at 168',
    `Track your report anytime with ID: ${report.trackingId}`,
    '',
    '"Your City, Your Voice, Our Action"',
    'Makati City Government'
  ].filter(Boolean)

  await sendEmail({
    to: report.citizenEmail,
    subject,
    html,
    text: textBodyLines.join('\n')
  })
}
