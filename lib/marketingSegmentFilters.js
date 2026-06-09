/**
 * Shared segment filter schema — used by server segment resolution and frontend builder.
 */

export const HOT_LEAD_SCORE_MIN = 70

export const SEGMENT_FILTER_DEFAULTS = {
  status: 'all',
  cities: [],
  states: [],
  contact: 'any',
  tagIds: [],
  tagMode: 'any',
  assigneeUserId: '',
  source: '',
  industry: '',
  country: '',
  openedCampaignId: '',
  clickedCampaignId: '',
  notOpenedCampaignId: '',
  createdAfter: '',
  createdBefore: '',
  lastActivityDays: null,
  smartTags: [],
  followUpDue: false,
  overdueFollowUp: false,
  minLeadScore: null,
  staleDays: null,
  logic: 'and',
}

function normalizeKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function locationMatches(value, filter) {
  const v = normalizeKey(value)
  const f = normalizeKey(filter)
  if (!f) return true
  if (!v) return false
  return v === f || v.includes(f) || f.includes(v)
}

function hasSendableEmail(lead) {
  const email = String(lead?.email || lead?.work_email || '').trim().toLowerCase()
  return email.includes('@') && email !== 'n/a' && email !== 'na'
}

function hasPhone(lead) {
  const p = String(lead?.phone || lead?.mobile || '').replace(/\D/g, '')
  return p.length >= 8
}

function matchesContact(lead, contact) {
  const hasEmail = hasSendableEmail(lead)
  const hasPh = hasPhone(lead)
  switch (contact) {
    case 'has_email':
      return hasEmail
    case 'no_email':
      return !hasEmail
    case 'has_phone':
      return hasPh
    case 'no_phone':
      return !hasPh
    case 'has_both':
      return hasEmail && hasPh
    case 'missing_both':
      return !hasEmail && !hasPh
    case 'bounced_email':
      return Boolean(lead?.emailBouncedAt)
    default:
      return true
  }
}

function leadEntry(leadOrEntry) {
  return leadOrEntry?.lead || leadOrEntry
}

function leadCrm(leadOrEntry) {
  const lead = leadEntry(leadOrEntry)
  return lead?.crm || leadOrEntry?.crm || {}
}

function getLeadCity(lead) {
  const l = leadEntry(lead)
  const city = String(l?.city || '').trim()
  if (city) return city
  return String(l?.location || '').split(',')[0]?.trim() || ''
}

function getLeadState(lead) {
  return String(leadEntry(lead)?.state || '').trim()
}

function getLeadCountry(lead) {
  return String(leadEntry(lead)?.country || '').trim()
}

function getLeadIndustry(lead) {
  return String(leadEntry(lead)?.industry || leadEntry(lead)?.sector || '').trim()
}

function getLeadSource(lead) {
  return String(leadCrm(lead)?.source || leadEntry(lead)?.source || '').trim()
}

function leadMatchesAssignee(leadOrEntry, assigneeUserId) {
  if (!assigneeUserId) return true
  const id = String(assigneeUserId)
  const lead = leadEntry(leadOrEntry)
  return [lead?.assignedToUserId, lead?.savedByUserId, lead?.userId, leadOrEntry?.assignedToUserId]
    .filter(Boolean)
    .some((v) => String(v) === id)
}

function matchesTagFilter(leadOrEntry, tagIds, tagMode) {
  const ids = Array.isArray(tagIds) ? tagIds.filter(Boolean) : []
  if (!ids.length) return true
  const leadTags = leadCrm(leadOrEntry)?.tagIds || []
  if (tagMode === 'all') return ids.every((id) => leadTags.includes(id))
  return ids.some((id) => leadTags.includes(id))
}

function matchesDateRange(iso, after, before) {
  if (!iso) return true
  const t = new Date(iso).getTime()
  if (after && t < new Date(after).getTime()) return false
  if (before && t > new Date(before).getTime()) return false
  return true
}

function matchesLastActivity(leadOrEntry, days) {
  const n = Number(days)
  if (!n || Number.isNaN(n) || n <= 0) return true
  const cutoff = Date.now() - n * 86400000
  const crm = leadCrm(leadOrEntry)
  const last =
    crm.lastCommunicationAt || crm.lastEmailSentAt || leadOrEntry?.savedAt || leadEntry(leadOrEntry)?.savedAt
  if (!last) return false
  return new Date(last).getTime() >= cutoff
}

/**
 * Apply pipeline-style filters to saved lead entries.
 * @param {object[]} entries - pipeline savedLeads entries
 * @param {object} filters - segment filterJson
 * @param {object} engagement - { openedLeadIds, clickedLeadIds, notOpenedLeadIds } Sets
 */
export function applySegmentFilters(entries, filters = {}, engagement = {}) {
  const f = { ...SEGMENT_FILTER_DEFAULTS, ...filters }
  let list = entries || []

  if (f.status && f.status !== 'all') {
    list = list.filter((e) => (leadCrm(e)?.status || 'new') === f.status)
  }

  if (f.assigneeUserId) {
    list = list.filter((e) => leadMatchesAssignee(e, f.assigneeUserId))
  }

  if (f.cities?.length) {
    list = list.filter((e) => f.cities.some((c) => locationMatches(getLeadCity(e), c)))
  }

  if (f.states?.length) {
    list = list.filter((e) => f.states.some((s) => locationMatches(getLeadState(e), s)))
  }

  if (f.country) {
    list = list.filter((e) => locationMatches(getLeadCountry(e), f.country))
  }

  if (f.industry) {
    list = list.filter((e) => locationMatches(getLeadIndustry(e), f.industry))
  }

  if (f.source) {
    list = list.filter((e) => locationMatches(getLeadSource(e), f.source))
  }

  if (f.contact && f.contact !== 'any') {
    list = list.filter((e) => matchesContact(leadEntry(e), f.contact))
  }

  list = list.filter((e) => matchesTagFilter(e, f.tagIds, f.tagMode))

  if (f.createdAfter || f.createdBefore) {
    list = list.filter((e) => {
      const created = leadEntry(e)?.savedAt || e?.savedAt || e?.createdAt
      return matchesDateRange(created, f.createdAfter, f.createdBefore)
    })
  }

  if (f.lastActivityDays != null && f.lastActivityDays !== '') {
    list = list.filter((e) => matchesLastActivity(e, f.lastActivityDays))
  }

  const smartTags = Array.isArray(f.smartTags) ? f.smartTags.filter(Boolean) : []
  if (smartTags.includes('not_touched')) {
    const cutoff = Date.now() - 7 * 86400000
    list = list.filter((e) => {
      const crm = leadCrm(e)
      const last = crm.lastCommunicationAt || crm.lastEmailSentAt || e?.savedAt || leadEntry(e)?.savedAt
      if (!last) return true
      return new Date(last).getTime() < cutoff
    })
  }
  if (smartTags.includes('hot_score')) {
    list = list.filter((e) => (leadCrm(e)?.leadScore ?? 0) >= HOT_LEAD_SCORE_MIN)
  }

  if (f.minLeadScore != null && f.minLeadScore !== '') {
    const min = Number(f.minLeadScore)
    if (!Number.isNaN(min)) {
      list = list.filter((e) => (leadCrm(e)?.leadScore ?? 0) >= min)
    }
  }

  if (f.staleDays != null && f.staleDays !== '') {
    const days = Number(f.staleDays)
    if (!Number.isNaN(days) && days > 0) {
      const cutoff = Date.now() - days * 86400000
      list = list.filter((e) => {
        const crm = leadCrm(e)
        const last = crm.lastCommunicationAt || crm.lastEmailSentAt || e?.savedAt || leadEntry(e)?.savedAt
        if (!last) return true
        return new Date(last).getTime() < cutoff
      })
    }
  }

  if (f.overdueFollowUp) {
    const now = Date.now()
    list = list.filter((e) => {
      const at = leadCrm(e)?.nextFollowUpAt
      return at && new Date(at).getTime() < now
    })
  }

  if (f.followUpDue) {
    const endToday = new Date()
    endToday.setHours(23, 59, 59, 999)
    list = list.filter((e) => {
      const crm = leadCrm(e)
      if (crm.status !== 'follow_up') return false
      const at = crm.nextFollowUpAt
      if (!at) return true
      return new Date(at).getTime() <= endToday.getTime()
    })
  }

  if (f.engagement === 'opened_no_reply') {
    const lost = new Set(['lost', 'closed_lost', 'disqualified'])
    list = list.filter((e) => {
      const crm = leadCrm(e)
      const status = crm?.status || 'new'
      const opened = (crm?.emailOpens || 0) > 0 || crm?.lastEmailOpenedAt
      const replied = status === 'replied' || crm?.repliedAt
      return opened && !replied && !lost.has(status)
    })
  }

  const opened = engagement.openedLeadIds
  if (f.openedCampaignId && opened?.size) {
    list = list.filter((e) => {
      const id = e?.leadId || leadEntry(e)?.id
      return opened.has(id)
    })
  }

  const clicked = engagement.clickedLeadIds
  if (f.clickedCampaignId && clicked?.size) {
    list = list.filter((e) => {
      const id = e?.leadId || leadEntry(e)?.id
      return clicked.has(id)
    })
  }

  const notOpened = engagement.notOpenedLeadIds
  if (f.notOpenedCampaignId && notOpened?.size) {
    list = list.filter((e) => {
      const id = e?.leadId || leadEntry(e)?.id
      return notOpened.has(id)
    })
  }

  return list
}

export function segmentFilterSummary(filters = {}) {
  const parts = []
  const f = { ...SEGMENT_FILTER_DEFAULTS, ...filters }
  if (f.status && f.status !== 'all') parts.push(`Stage: ${f.status}`)
  if (f.cities?.length) parts.push(`${f.cities.length} cities`)
  if (f.states?.length) parts.push(`${f.states.length} states`)
  if (f.tagIds?.length) {
    parts.push(
      f.tagMode === 'all' ? `All ${f.tagIds.length} tags` : `Any of ${f.tagIds.length} tags`
    )
  }
  if (f.openedCampaignId) parts.push('Opened campaign')
  if (f.clickedCampaignId) parts.push('Clicked campaign')
  if (f.notOpenedCampaignId) parts.push('Did not open')
  if (f.assigneeUserId) parts.push('Assignee filter')
  if (f.minLeadScore != null && f.minLeadScore !== '') parts.push(`Score ${f.minLeadScore}+`)
  if (f.smartTags?.includes('hot_score')) parts.push('Hot (70+)')
  if (f.smartTags?.includes('not_touched')) parts.push('Not touched 7d')
  if (f.followUpDue) parts.push('Follow-up due')
  if (f.overdueFollowUp) parts.push('Overdue follow-up')
  if (f.staleDays) parts.push(`Stale ${f.staleDays}d`)
  if (f.contact && f.contact !== 'any') parts.push(f.contact.replace(/_/g, ' '))
  return parts.length ? parts.join(' · ') : 'All pipeline contacts'
}
