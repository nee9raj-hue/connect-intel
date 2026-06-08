import { normalizeExtendedCrm } from './crmWorkflow.js'
import { getOrgCrmSettings } from './crmWorkflowRules.js'

const MS_DAY = 86400000

export const DEFAULT_SCORING_RULES = [
  { id: 'base', label: 'Base score', event: 'base', points: 30, enabled: true },
  { id: 'has_email', label: 'Has email', event: 'has_email', points: 12, enabled: true },
  { id: 'has_phone', label: 'Has phone', event: 'has_phone', points: 8, enabled: true },
  { id: 'has_company', label: 'Has company', event: 'has_company', points: 5, enabled: true },
  { id: 'email_open', label: 'Email opened', event: 'email_open', points: 10, enabled: true },
  { id: 'link_click', label: 'Link clicked', event: 'link_click', points: 25, enabled: true },
  { id: 'form_submit', label: 'Form submitted', event: 'form_submit', points: 15, enabled: true },
  { id: 'meeting_booked', label: 'Meeting scheduled', event: 'meeting_booked', points: 100, enabled: true },
  { id: 'status_replied', label: 'Stage: Replied', event: 'status_replied', points: 18, enabled: true },
  { id: 'status_won', label: 'Stage: Won', event: 'status_won', points: 25, enabled: true },
  { id: 'unsubscribe', label: 'Unsubscribed', event: 'unsubscribe', points: -25, enabled: true },
  { id: 'stale', label: 'No contact 21+ days', event: 'stale_contact', points: -10, enabled: true },
]

export function getOrgScoringRules(store, organizationId) {
  const settings = getOrgCrmSettings(store, organizationId)
  const rules = settings.scoringRules
  if (Array.isArray(rules) && rules.length) return rules
  return DEFAULT_SCORING_RULES
}

export function normalizeScoringRules(rules) {
  if (!Array.isArray(rules)) return DEFAULT_SCORING_RULES
  return rules.slice(0, 30).map((r, i) => ({
    id: String(r.id || `rule_${i}`).slice(0, 40),
    label: String(r.label || r.event || 'Rule').slice(0, 80),
    event: String(r.event || 'custom').slice(0, 40),
    points: Math.max(-100, Math.min(100, Number(r.points) || 0)),
    enabled: r.enabled !== false,
  }))
}

function marketingEventsForLead(marketingEvents, leadId) {
  return (marketingEvents || []).filter((e) => e.leadId === leadId)
}

function ruleMatches(event, entry, mktEvents) {
  const crm = normalizeExtendedCrm(entry.crm)
  const lead = entry.lead || {}

  switch (event) {
    case 'base':
      return true
    case 'has_email':
      return Boolean(lead.email && !String(lead.email).includes('locked'))
    case 'has_phone':
      return Boolean(lead.phone)
    case 'has_company':
      return Boolean(lead.company)
    case 'email_open':
      return mktEvents.some((e) => e.type === 'open')
    case 'link_click':
      return mktEvents.some((e) => e.type === 'click')
    case 'form_submit':
      return (crm.activities || []).some((a) => a.type === 'form_submit' || a.meta?.formId)
    case 'meeting_booked':
      return (crm.meetings || []).length > 0
    case 'status_replied':
      return crm.status === 'replied'
    case 'status_won':
      return crm.status === 'won'
    case 'status_lost':
      return crm.status === 'lost'
    case 'unsubscribe':
      return Boolean(crm.unsubscribedAt) || mktEvents.some((e) => e.type === 'unsubscribe')
    case 'stale_contact': {
      const last = crm.lastCommunicationAt || crm.lastEmailSentAt
      if (!last) return true
      return Date.now() - new Date(last).getTime() > 21 * MS_DAY
    }
    case 'recent_contact': {
      const last = crm.lastCommunicationAt || crm.lastEmailSentAt
      if (!last) return false
      return Date.now() - new Date(last).getTime() < 3 * MS_DAY
    }
    case 'deal_high':
      return Number(crm.dealValue) >= 100000
    default:
      return false
  }
}

/** CRM engagement score 0–100 using org-defined rules when configured. */
export function computeCrmLeadScore(entry, context = {}) {
  const { store, organizationId, marketingEvents } = context
  const rules =
    store && organizationId
      ? getOrgScoringRules(store, organizationId)
      : DEFAULT_SCORING_RULES

  const leadId = entry.lead?.id
  const mkt = leadId ? marketingEventsForLead(marketingEvents, leadId) : []

  let score = 0
  let usedBase = false

  for (const rule of rules) {
    if (!rule.enabled) continue
    if (!ruleMatches(rule.event, entry, mkt)) continue
    if (rule.event === 'base') {
      usedBase = true
      score += rule.points
    } else {
      score += rule.points
    }
  }

  if (!usedBase) {
    const lead = entry.lead || {}
    score += typeof lead.score === 'number' ? Math.round(lead.score * 0.4) : 30
  }

  return Math.max(0, Math.min(100, Math.round(score)))
}
