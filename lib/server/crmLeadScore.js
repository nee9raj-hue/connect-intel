import { computeCrmLeadScore as computeScoreWithRules } from './crmScoringRules.js'

export { DEFAULT_SCORING_RULES, getOrgScoringRules, normalizeScoringRules } from './crmScoringRules.js'

/** CRM engagement score 0–100 (org rules when store + organizationId provided). */
export function computeCrmLeadScore(entry, context = {}) {
  if (context.store && context.organizationId) {
    return computeScoreWithRules(entry, context)
  }
  return computeScoreWithRules(entry, context)
}

export function applyLeadScoresToEntries(entries, context = {}) {
  for (const entry of entries) {
    const crm = entry.crm || {}
    crm.leadScore = computeCrmLeadScore(entry, context)
    entry.crm = crm
  }
  return entries
}

export function pickRoundRobinAssignee(store, organizationId, memberUserIds) {
  const ids = memberUserIds.filter(Boolean)
  if (!ids.length) return null
  const org = store.organizations.find((o) => o.id === organizationId)
  const cursor = org?.crmSettings?.roundRobinCursor ?? 0
  const next = ids[cursor % ids.length]
  if (org) {
    org.crmSettings = org.crmSettings || {}
    org.crmSettings.roundRobinCursor = (cursor + 1) % ids.length
  }
  return next
}
