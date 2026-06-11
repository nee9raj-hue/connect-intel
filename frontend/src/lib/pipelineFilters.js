import { leadHasCallablePhone } from './phoneUtils'
import { leadHasSendableEmail, leadDisplayName, leadEmailBounced } from './emailUtils'

export const CONTACT_FILTER_OPTIONS = [
  { id: 'any', label: 'All contacts' },
  { id: 'has_email', label: 'Has email' },
  { id: 'no_email', label: 'No email' },
  { id: 'has_phone', label: 'Has phone' },
  { id: 'no_phone', label: 'No phone' },
  { id: 'has_both', label: 'Email & phone' },
  { id: 'missing_both', label: 'Missing both' },
  { id: 'bounced_email', label: 'Bounced email' },
]

export const HOT_LEAD_SCORE_MIN = 70

/** Map smart tags / advanced filters to API query params (large pipelines filter server-side). */
export function pipelineServerFilterExtras(adv = {}, smartView = {}) {
  const smartTags = adv.smartTags || []
  let minLeadScore = smartView.minLeadScore ?? null
  if (smartTags.includes('hot_score')) {
    minLeadScore =
      minLeadScore != null && minLeadScore !== ''
        ? Math.max(Number(minLeadScore) || 0, HOT_LEAD_SCORE_MIN)
        : HOT_LEAD_SCORE_MIN
  }
  const min =
    minLeadScore != null && minLeadScore !== '' && !Number.isNaN(Number(minLeadScore))
      ? Number(minLeadScore)
      : undefined
  const max =
    adv.maxLeadScore != null && adv.maxLeadScore !== '' && !Number.isNaN(Number(adv.maxLeadScore))
      ? Number(adv.maxLeadScore)
      : undefined
  return {
    minLeadScore: min,
    maxLeadScore: max,
    followUpDue: adv.followUpDue ? '1' : undefined,
    overdueFollowUp: adv.overdueFollowUp ? '1' : undefined,
    stuck: adv.stuckLeads ? '1' : undefined,
  }
}

export const DEFAULT_PIPELINE_FILTERS = {
  cities: [],
  states: [],
  contact: 'any',
  tagIds: [],
  tagMode: 'any',
  smartTags: [],
  overdueFollowUp: false,
  followUpDue: false,
  closingThisWeek: false,
  minLeadScore: null,
  maxLeadScore: null,
  addedFrom: '',
  addedTo: '',
  lastActivityFrom: '',
  lastActivityTo: '',
  sourceFilter: '',
  stuckLeads: false,
}

/** @deprecated use cities[] — kept for saved views migration */
export function normalizeLocationFilterList(filters, keyPlural, keySingular) {
  const plural = filters?.[keyPlural]
  if (Array.isArray(plural) && plural.length) return plural.filter(Boolean)
  const single = String(filters?.[keySingular] || '').trim()
  return single ? [single] : []
}

export function getFilterCities(filters) {
  return normalizeLocationFilterList(filters, 'cities', 'city')
}

export function getFilterStates(filters) {
  return normalizeLocationFilterList(filters, 'states', 'state')
}

/**
 * Match a lead to a team member for assignee-scoped views (Team Intelligence drill-down, etc.).
 * Uses assigned owner when set; unassigned rows fall back to who saved the lead.
 */
export function leadMatchesAssignee(lead, assigneeUserId) {
  if (!assigneeUserId) return true
  if (assigneeUserId === '__unassigned__') return !lead?.assignedToUserId
  const id = String(assigneeUserId)
  const owner = lead?.assignedToUserId
  if (owner) return String(owner) === id
  return [lead?.savedByUserId, lead?.userId].filter(Boolean).some((v) => String(v) === id)
}

function matchesAnyLocationField(value, filterList) {
  const list = Array.isArray(filterList) ? filterList.filter(Boolean) : []
  if (!list.length) return true
  return list.some((f) => locationMatchesField(value, f))
}

export function getLeadCity(lead) {
  const city = String(lead?.city || '').trim()
  if (city) return city
  const loc = String(lead?.location || '').split(',')[0]?.trim()
  return loc || ''
}

export function getLeadState(lead) {
  return String(lead?.state || '').trim()
}

export function normalizeLocationKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

/** Case-insensitive; treats MUMBAI and Mumbai as the same when matching. */
export function locationMatchesField(value, filter) {
  const v = normalizeLocationKey(value)
  const f = normalizeLocationKey(filter)
  if (!f) return true
  if (!v) return false
  if (v === f) return true
  return v.includes(f) || f.includes(v)
}

function matchesContactFilter(lead, contact) {
  const hasEmail = leadHasSendableEmail(lead)
  const hasPhone = leadHasCallablePhone(lead)
  switch (contact) {
    case 'has_email':
      return hasEmail
    case 'no_email':
      return !hasEmail
    case 'has_phone':
      return hasPhone
    case 'no_phone':
      return !hasPhone
    case 'has_both':
      return hasEmail && hasPhone
    case 'missing_both':
      return !hasEmail && !hasPhone
    case 'bounced_email':
      return leadEmailBounced(lead)
    default:
      return true
  }
}

export function leadMatchesSearch(lead, query) {
  const raw = String(query || '').trim()
  if (!raw) return true

  const q = raw.toLowerCase()
  const qDigits = raw.replace(/\D/g, '')

  const name = leadDisplayName(lead).toLowerCase()
  const company = String(lead.company || '').toLowerCase()
  const email = String(lead.email || '').toLowerCase()
  const city = getLeadCity(lead).toLowerCase()
  const state = getLeadState(lead).toLowerCase()
  const title = String(lead.title || '').toLowerCase()
  const phoneDigits = String(lead.phone || '').replace(/\D/g, '')

  if (name.includes(q) || company.includes(q) || email.includes(q)) return true
  if (city.includes(q) || state.includes(q) || title.includes(q)) return true
  if (qDigits.length >= 4 && phoneDigits.includes(qDigits)) return true
  return false
}

const MS_DAY = 86400000

function matchesAssignedAfter(lead, assignedAfter) {
  if (!assignedAfter) return true
  const savedAt = lead.savedAt || lead.crm?.savedAt
  if (!savedAt) return false
  const savedMs = new Date(savedAt).getTime()
  if (assignedAfter === 'yesterday') {
    return savedMs >= Date.now() - MS_DAY
  }
  const afterMs = new Date(assignedAfter).getTime()
  return Number.isFinite(afterMs) ? savedMs >= afterMs : true
}

function leadLastActivityMs(lead) {
  const at =
    lead.crm?.lastCommunicationAt ||
    lead.crm?.lastEmailSentAt ||
    lead.crm?.lastCallAt ||
    null
  return at ? new Date(at).getTime() : null
}

function matchesLastActivity(lead, lastActivity) {
  if (!lastActivity) return true
  if (lastActivity === 'never') {
    return leadLastActivityMs(lead) == null
  }
  return true
}

function matchesDateRange(iso, from, to) {
  if (!iso) return false
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return false
  if (from) {
    const f = new Date(`${from}T00:00:00`).getTime()
    if (Number.isFinite(f) && t < f) return false
  }
  if (to) {
    const end = new Date(`${to}T23:59:59`).getTime()
    if (Number.isFinite(end) && t > end) return false
  }
  return true
}

function matchesWonThisMonth(lead) {
  const crm = lead.crm || {}
  if (crm.status !== 'won') return false
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)
  const wonAt = crm.updatedAt || crm.lastCommunicationAt || crm.wonAt
  return wonAt ? new Date(wonAt) >= monthStart : true
}

function matchesTasksDueToday(lead) {
  const endToday = new Date()
  endToday.setHours(23, 59, 59, 999)
  for (const task of lead.crm?.tasks || []) {
    if (task.status === 'done') continue
    const due = task.dueAt ? new Date(task.dueAt).getTime() : null
    if (due && due <= endToday.getTime()) return true
  }
  return false
}

export function applyPipelineFilters(
  leads,
  {
    status = 'all',
    city = '',
    state = '',
    cities = null,
    states = null,
    contact = 'any',
    search = '',
    minLeadScore = null,
    maxLeadScore = null,
    minDealValue = null,
    staleDays = null,
    addedFrom = '',
    addedTo = '',
    lastActivityFrom = '',
    lastActivityTo = '',
    sourceFilter = '',
    stuckLeads = false,
    overdueFollowUp = false,
    followUpDue = false,
    closingThisWeek = false,
    closingThisMonth = false,
    tagIds = [],
    tagMode = 'any',
    smartTags = [],
    assignedAfter = null,
    lastActivity = null,
    wonThisMonth = false,
    tasksDueToday = false,
    leadIds = null,
    teamMemberIds = null,
  } = {}
) {
  let list = leads || []

  const activeSmartTags = Array.isArray(smartTags) ? smartTags.filter(Boolean) : []
  if (activeSmartTags.includes('not_touched')) {
    const cutoff = Date.now() - 7 * MS_DAY
    list = list.filter((l) => {
      const last = l.crm?.lastCommunicationAt || l.crm?.lastEmailSentAt || l.savedAt
      if (!last) return true
      return new Date(last).getTime() < cutoff
    })
  }
  if (activeSmartTags.includes('hot_score')) {
    list = list.filter((l) => (l.crm?.leadScore ?? 0) >= HOT_LEAD_SCORE_MIN)
  }

  const filterTagIds = Array.isArray(tagIds) ? tagIds.filter(Boolean) : []
  if (filterTagIds.length > 0) {
    const modeAll = tagMode === 'all'
    list = list.filter((l) => {
      const leadTags = l.crm?.tagIds || []
      if (modeAll) return filterTagIds.every((id) => leadTags.includes(id))
      return filterTagIds.some((id) => leadTags.includes(id))
    })
  }

  if (status && status !== 'all') {
    list = list.filter((l) => (l.crm?.status || 'new') === status)
  }

  if (minLeadScore != null && minLeadScore !== '') {
    const min = Number(minLeadScore)
    if (!Number.isNaN(min)) {
      list = list.filter((l) => (l.crm?.leadScore ?? 0) >= min)
    }
  }

  if (maxLeadScore != null && maxLeadScore !== '') {
    const max = Number(maxLeadScore)
    if (!Number.isNaN(max)) {
      list = list.filter((l) => (l.crm?.leadScore ?? 0) <= max)
    }
  }

  if (stuckLeads) {
    const cutoff = Date.now() - 7 * MS_DAY
    list = list.filter((l) => {
      const last = leadLastActivityMs(l) ?? (l.savedAt ? new Date(l.savedAt).getTime() : null)
      if (!last) return true
      const st = l.crm?.status || 'new'
      if (st === 'won' || st === 'lost') return false
      return last < cutoff
    })
  }

  if (addedFrom || addedTo) {
    list = list.filter((l) => matchesDateRange(l.savedAt || l.createdAt, addedFrom, addedTo))
  }

  if (lastActivityFrom || lastActivityTo) {
    list = list.filter((l) => {
      const at =
        l.crm?.lastCommunicationAt || l.crm?.lastEmailSentAt || l.crm?.lastCallAt || null
      return matchesDateRange(at, lastActivityFrom, lastActivityTo)
    })
  }

  if (sourceFilter) {
    const src = String(sourceFilter).toLowerCase()
    list = list.filter((l) => String(l.crm?.source || l.source || '').toLowerCase() === src)
  }

  if (minDealValue != null && minDealValue !== '') {
    const min = Number(minDealValue)
    if (!Number.isNaN(min)) {
      list = list.filter((l) => (Number(l.crm?.dealValue) || 0) >= min)
    }
  }

  if (overdueFollowUp) {
    const now = Date.now()
    list = list.filter((l) => {
      const at = l.crm?.nextFollowUpAt
      return at && new Date(at).getTime() < now
    })
  }

  if (followUpDue) {
    const endToday = new Date()
    endToday.setHours(23, 59, 59, 999)
    list = list.filter((l) => {
      const crm = l.crm || {}
      if (crm.status !== 'follow_up') return false
      const at = crm.nextFollowUpAt
      if (!at) return true
      return new Date(at).getTime() <= endToday.getTime()
    })
  }

  if (closingThisWeek || closingThisMonth) {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const endMs = closingThisMonth
      ? new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999).getTime()
      : Date.now() + 7 * MS_DAY
    list = list.filter((l) => {
      const crm = l.crm || {}
      for (const deal of crm.deals || []) {
        if (deal.wonAt || deal.lostAt || deal.stage === 'won' || deal.stage === 'lost') continue
        const close = deal.expectedCloseDate || deal.expectedCloseAt
        if (!close) continue
        const t = new Date(close).getTime()
        if (t >= start.getTime() && t <= endMs) return true
      }
      const legacyClose = crm.expectedCloseDate || crm.expectedCloseAt
      if (legacyClose) {
        const t = new Date(legacyClose).getTime()
        if (t >= start.getTime() && t <= endMs) return true
      }
      return false
    })
  }

  if (assignedAfter) {
    list = list.filter((l) => matchesAssignedAfter(l, assignedAfter))
  }

  if (lastActivity) {
    list = list.filter((l) => matchesLastActivity(l, lastActivity))
  }

  if (wonThisMonth) {
    list = list.filter((l) => matchesWonThisMonth(l))
  }

  if (tasksDueToday) {
    list = list.filter((l) => matchesTasksDueToday(l))
  }

  const idFilter = Array.isArray(leadIds) ? leadIds.map(String).filter(Boolean) : []
  if (idFilter.length) {
    const allowed = new Set(idFilter)
    list = list.filter((l) => allowed.has(String(l.id)))
  }

  const teamIds = Array.isArray(teamMemberIds) ? teamMemberIds.map(String).filter(Boolean) : []
  if (teamIds.length) {
    const allowed = new Set(teamIds)
    list = list.filter((l) => {
      const owner = l.assignedToUserId || l.savedByUserId || l.userId
      return owner != null && allowed.has(String(owner))
    })
  }

  if (staleDays != null && staleDays !== '') {
    const days = Number(staleDays)
    if (!Number.isNaN(days) && days > 0) {
      const cutoff = Date.now() - days * MS_DAY
      list = list.filter((l) => {
        const last = l.crm?.lastCommunicationAt || l.crm?.lastEmailSentAt || l.savedAt
        if (!last) return true
        return new Date(last).getTime() < cutoff
      })
    }
  }

  const cityFilters = Array.isArray(cities) ? cities : getFilterCities({ city })
  if (cityFilters.length) {
    list = list.filter((l) => matchesAnyLocationField(getLeadCity(l), cityFilters))
  }

  const stateFilters = Array.isArray(states) ? states : getFilterStates({ state })
  if (stateFilters.length) {
    list = list.filter((l) => matchesAnyLocationField(getLeadState(l), stateFilters))
  }

  if (contact && contact !== 'any') {
    list = list.filter((l) => matchesContactFilter(l, contact))
  }

  if (search?.trim()) {
    list = list.filter((l) => leadMatchesSearch(l, search))
  }

  return list
}

export function collectLocationOptions(leads) {
  const cityByKey = new Map()
  const stateByKey = new Map()
  for (const lead of leads || []) {
    const c = getLeadCity(lead)
    const s = getLeadState(lead)
    if (c) {
      const key = normalizeLocationKey(c)
      if (!cityByKey.has(key)) cityByKey.set(key, c)
    }
    if (s) {
      const key = normalizeLocationKey(s)
      if (!stateByKey.has(key)) stateByKey.set(key, s)
    }
  }
  const sortNames = (a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })
  return {
    cities: [...cityByKey.values()].sort(sortNames),
    states: [...stateByKey.values()].sort(sortNames),
  }
}

export function countActiveFilters(filters, search) {
  let n = 0
  if (getFilterCities(filters).length) n += 1
  if (getFilterStates(filters).length) n += 1
  if (filters.contact && filters.contact !== 'any') n += 1
  if (filters.tagIds?.length) n += 1
  if (filters.smartTags?.length) n += 1
  if (filters.overdueFollowUp) n += 1
  if (filters.followUpDue) n += 1
  if (filters.closingThisWeek) n += 1
  if (filters.minLeadScore != null && filters.minLeadScore !== '') n += 1
  if (filters.maxLeadScore != null && filters.maxLeadScore !== '') n += 1
  if (filters.addedFrom || filters.addedTo) n += 1
  if (filters.lastActivityFrom || filters.lastActivityTo) n += 1
  if (filters.sourceFilter) n += 1
  if (filters.stuckLeads) n += 1
  if (search?.trim()) n += 1
  return n
}
