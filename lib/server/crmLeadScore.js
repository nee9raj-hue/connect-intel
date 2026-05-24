import { normalizeExtendedCrm } from './crmWorkflow.js'

const MS_DAY = 86400000

/** CRM engagement score 0–100 for prioritization (separate from search lead.score). */
export function computeCrmLeadScore(entry) {
  const crm = normalizeExtendedCrm(entry.crm)
  const lead = entry.lead || {}
  let score = typeof lead.score === 'number' ? Math.round(lead.score * 0.4) : 30

  if (lead.email && !String(lead.email).includes('locked')) score += 12
  if (lead.phone) score += 8
  if (lead.company) score += 5

  const deal = Number(crm.dealValue) || 0
  if (deal >= 500000) score += 15
  else if (deal >= 100000) score += 10
  else if (deal >= 25000) score += 5

  const statusBoost = {
    replied: 18,
    follow_up: 10,
    contacted: 6,
    won: 25,
    lost: -20,
    new: 0,
  }
  score += statusBoost[crm.status] ?? 0

  if (crm.responseReceived) score += 8
  if ((crm.emails || []).length > 0) score += 6
  if ((crm.activities || []).length > 2) score += 5

  const last = crm.lastCommunicationAt || crm.lastEmailSentAt
  if (last) {
    const age = Date.now() - new Date(last).getTime()
    if (age < 3 * MS_DAY) score += 12
    else if (age < 7 * MS_DAY) score += 6
    else if (age > 21 * MS_DAY) score -= 10
  } else {
    score -= 5
  }

  if (crm.nextFollowUpAt && new Date(crm.nextFollowUpAt).getTime() < Date.now()) {
    score += 8
  }

  return Math.max(0, Math.min(100, Math.round(score)))
}

export function applyLeadScoresToEntries(entries) {
  for (const entry of entries) {
    const crm = normalizeExtendedCrm(entry.crm)
    crm.leadScore = computeCrmLeadScore(entry)
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
