import type { PoolConnection } from 'mysql2/promise'
import { pool } from '../db'

export type TrustLevel = 'LOW' | 'MEDIUM' | 'HIGH'

export const POSITIVE_TRUST_STATUSES = new Set(['in progress', 'resolved'])
export const NEGATIVE_TRUST_STATUS = 'invalid'
export const MANUAL_REVIEW_STATUS = 'Manual Review'

export function computeTrustLevel(score: number | null | undefined): TrustLevel {
  const value = typeof score === 'number' && Number.isFinite(score) ? score : 0
  if (value <= -2) return 'LOW'
  if (value >= 3) return 'HIGH'
  return 'MEDIUM'
}

export function getDailyReportLimit(level: TrustLevel): number | null {
  switch (level) {
    case 'LOW':
      return 1
    case 'MEDIUM':
      return 5
    case 'HIGH':
    default:
      return null
  }
}

export function shouldRequireManualReview(level: TrustLevel): boolean {
  return level === 'LOW'
}

export function getInitialStatusForTrust(level: TrustLevel) {
  if (shouldRequireManualReview(level)) {
    return {
      status: MANUAL_REVIEW_STATUS,
      requiresManualReview: true
    }
  }
  return {
    status: 'Pending',
    requiresManualReview: false
  }
}

export function getTrustMetadata(score: number | null | undefined) {
  const trustLevel = computeTrustLevel(score)
  return {
    trustLevel,
    dailyReportLimit: getDailyReportLimit(trustLevel)
  }
}

export async function applyTrustTransition(params: {
  citizenId: number | null
  reportId: number
  previousStatus: string | null
  newStatus: string
  trustCreditApplied: boolean
  trustPenaltyApplied: boolean
  connection?: PoolConnection | null
}) {
  const {
    citizenId,
    reportId,
    previousStatus,
    newStatus,
    trustCreditApplied,
    trustPenaltyApplied,
    connection
  } = params

  if (!citizenId) {
    return { trustCreditApplied, trustPenaltyApplied }
  }

  const previous = (previousStatus || '').toLowerCase()
  const current = (newStatus || '').toLowerCase()
  let creditApplied = Boolean(trustCreditApplied)
  let penaltyApplied = Boolean(trustPenaltyApplied)
  const executor = connection ?? pool

  const isNegative = current === NEGATIVE_TRUST_STATUS
  const wasNegative = previous === NEGATIVE_TRUST_STATUS
  const isPositive = POSITIVE_TRUST_STATUSES.has(current)
  const wasPositive = POSITIVE_TRUST_STATUSES.has(previous)

  if (isNegative) {
    if (creditApplied) {
      await executor.query('UPDATE citizens SET trust_score = trust_score - 1 WHERE citizen_id = ?', [citizenId])
      await executor.query('UPDATE reports SET trust_credit_applied = FALSE WHERE report_id = ?', [reportId])
      creditApplied = false
    }
    if (!penaltyApplied) {
      await executor.query('UPDATE citizens SET trust_score = trust_score - 2 WHERE citizen_id = ?', [citizenId])
      await executor.query('UPDATE reports SET trust_penalty_applied = TRUE WHERE report_id = ?', [reportId])
      penaltyApplied = true
    }
    return { trustCreditApplied: creditApplied, trustPenaltyApplied: penaltyApplied }
  }

  if (penaltyApplied && wasNegative) {
    await executor.query('UPDATE citizens SET trust_score = trust_score + 2 WHERE citizen_id = ?', [citizenId])
    await executor.query('UPDATE reports SET trust_penalty_applied = FALSE WHERE report_id = ?', [reportId])
    penaltyApplied = false
  }

  if (isPositive) {
    if (!creditApplied) {
      await executor.query('UPDATE citizens SET trust_score = trust_score + 1 WHERE citizen_id = ?', [citizenId])
      await executor.query('UPDATE reports SET trust_credit_applied = TRUE WHERE report_id = ?', [reportId])
      creditApplied = true
    }
    return { trustCreditApplied: creditApplied, trustPenaltyApplied: penaltyApplied }
  }

  if (creditApplied && wasPositive) {
    await executor.query('UPDATE citizens SET trust_score = trust_score - 1 WHERE citizen_id = ?', [citizenId])
    await executor.query('UPDATE reports SET trust_credit_applied = FALSE WHERE report_id = ?', [reportId])
    creditApplied = false
  }

  return { trustCreditApplied: creditApplied, trustPenaltyApplied: penaltyApplied }
}
