import { pool } from '../db'
import type { TrustLevel } from './trust'

export type CreateNotificationData = {
  reportId: number
  recipientType: 'citizen' | 'staff' | 'admin'
  recipientId: number
  message: string
}

export async function createNotification(data: CreateNotificationData): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO notifications (report_id, recipient_type, recipient_id, message)
       VALUES (?, ?, ?, ?)`,
      [data.reportId, data.recipientType, data.recipientId, data.message]
    )
  } catch (error) {
    console.error('Failed to create notification:', error)
  }
}

export async function createCitizenNotification(reportId: number, citizenId: number, message: string): Promise<void> {
  await createNotification({
    reportId,
    recipientType: 'citizen',
    recipientId: citizenId,
    message
  })
}

export async function createStaffNotification(reportId: number, staffId: number, message: string): Promise<void> {
  await createNotification({
    reportId,
    recipientType: 'staff', 
    recipientId: staffId,
    message
  })
}

export async function notifyDepartmentOfNewReport(
  reportId: number,
  departmentId: number,
  reportTitle: string,
  citizenName?: string,
  trackingId?: string,
  options?: {
    requiresManualReview?: boolean
    trustLevel?: TrustLevel
  }
): Promise<void> {
  try {
    // Get all staff in the department
    const [staffRows] = await pool.query(
      'SELECT staff_id FROM department_staff WHERE department_id = ?',
      [departmentId]
    )
    
    const staff = staffRows as Array<{ staff_id: number }>
    const submitterName = citizenName || 'Anonymous citizen'
    const tracking = trackingId ? ` (ID ${trackingId})` : ''
    const manualFlag = options?.requiresManualReview ? ' ⚠️ Manual review required' : ''
    const trustNote = options?.trustLevel ? ` [Citizen trust: ${options.trustLevel}]` : ''
    const message = `📋 New report assigned${tracking}: "${reportTitle}" submitted by ${submitterName}${manualFlag}${trustNote}`
    
    // Create notifications for all department staff
    for (const member of staff) {
      await createStaffNotification(reportId, member.staff_id, message)
    }
  } catch (error) {
    console.error('Failed to notify department of new report:', error)
  }
}

export async function notifyCitizenOfStatusChange(
  reportId: number,
  citizenId: number,
  newStatus: string,
  actorName?: string,
  trackingId?: string,
  reportTitle?: string
): Promise<void> {
  const actor = actorName ? ` by ${actorName}` : ''
  const contextParts = [
    trackingId ? `ID ${trackingId}` : null,
    reportTitle ? `"${reportTitle}"` : null
  ].filter(Boolean)
  const context = contextParts.length ? ` on ${contextParts.join(' • ')}` : ''
  const message = `🔔 Status update${context}: now "${newStatus}"${actor}`
  await createCitizenNotification(reportId, citizenId, message)
}

export async function notifyCitizenOfResponse(
  reportId: number,
  citizenId: number,
  actorName?: string,
  trackingId?: string,
  reportTitle?: string
): Promise<void> {
  const actor = actorName ? ` from ${actorName}` : ''
  const contextParts = [
    trackingId ? `ID ${trackingId}` : null,
    reportTitle ? `"${reportTitle}"` : null
  ].filter(Boolean)
  const context = contextParts.length ? ` on ${contextParts.join(' • ')}` : ''
  const message = `💬 New response${context}${actor}`
  await createCitizenNotification(reportId, citizenId, message)
}