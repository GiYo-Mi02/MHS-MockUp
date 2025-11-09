import { supabaseAdmin } from '../supabase'

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
}) {
  const {
    citizenId,
    reportId,
    previousStatus,
    newStatus,
    trustCreditApplied,
    trustPenaltyApplied
  } = params

  if (!citizenId) {
    return { trustCreditApplied, trustPenaltyApplied }
  }

  const previous = (previousStatus || '').toLowerCase()
  const current = (newStatus || '').toLowerCase()
  let creditApplied = Boolean(trustCreditApplied)
  let penaltyApplied = Boolean(trustPenaltyApplied)

  const isNegative = current === NEGATIVE_TRUST_STATUS
  const wasNegative = previous === NEGATIVE_TRUST_STATUS
  const isPositive = POSITIVE_TRUST_STATUSES.has(current)
  const wasPositive = POSITIVE_TRUST_STATUSES.has(previous)

  if (isNegative) {
    if (creditApplied) {
      const { data: citizen } = await supabaseAdmin
        .from('citizens')
        .select('trust_score')
        .eq('citizen_id', citizenId)
        .single()
      
      await supabaseAdmin
        .from('citizens')
        .update({ trust_score: (citizen?.trust_score || 0) - 1 })
        .eq('citizen_id', citizenId)
      
      await supabaseAdmin
        .from('reports')
        .update({ trust_credit_applied: false })
        .eq('report_id', reportId)
      
      creditApplied = false
    }
    if (!penaltyApplied) {
      const { data: citizen } = await supabaseAdmin
        .from('citizens')
        .select('trust_score')
        .eq('citizen_id', citizenId)
        .single()
      
      await supabaseAdmin
        .from('citizens')
        .update({ trust_score: (citizen?.trust_score || 0) - 2 })
        .eq('citizen_id', citizenId)
      
      await supabaseAdmin
        .from('reports')
        .update({ trust_penalty_applied: true })
        .eq('report_id', reportId)
      
      penaltyApplied = true
    }
    return { trustCreditApplied: creditApplied, trustPenaltyApplied: penaltyApplied }
  }

  if (penaltyApplied && wasNegative) {
    const { data: citizen } = await supabaseAdmin
      .from('citizens')
      .select('trust_score')
      .eq('citizen_id', citizenId)
      .single()
    
    await supabaseAdmin
      .from('citizens')
      .update({ trust_score: (citizen?.trust_score || 0) + 2 })
      .eq('citizen_id', citizenId)
    
    await supabaseAdmin
      .from('reports')
      .update({ trust_penalty_applied: false })
      .eq('report_id', reportId)
    
    penaltyApplied = false
  }

  if (isPositive) {
    if (!creditApplied) {
      const { data: citizen } = await supabaseAdmin
        .from('citizens')
        .select('trust_score')
        .eq('citizen_id', citizenId)
        .single()
      
      await supabaseAdmin
        .from('citizens')
        .update({ trust_score: (citizen?.trust_score || 0) + 1 })
        .eq('citizen_id', citizenId)
      
      await supabaseAdmin
        .from('reports')
        .update({ trust_credit_applied: true })
        .eq('report_id', reportId)
      
      creditApplied = true
    }
    return { trustCreditApplied: creditApplied, trustPenaltyApplied: penaltyApplied }
  }

  if (creditApplied && wasPositive) {
    const { data: citizen } = await supabaseAdmin
      .from('citizens')
      .select('trust_score')
      .eq('citizen_id', citizenId)
      .single()
    
    await supabaseAdmin
      .from('citizens')
      .update({ trust_score: (citizen?.trust_score || 0) - 1 })
      .eq('citizen_id', citizenId)
    
    await supabaseAdmin
      .from('reports')
      .update({ trust_credit_applied: false })
      .eq('report_id', reportId)
    
    creditApplied = false
  }

  return { trustCreditApplied: creditApplied, trustPenaltyApplied: penaltyApplied }
}
