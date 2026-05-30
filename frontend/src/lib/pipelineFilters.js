import { leadHasCallablePhone } from './phoneUtils'
import { leadHasSendableEmail, leadDisplayName } from './emailUtils'

export const CONTACT_FILTER_OPTIONS = [
  { id: 'any', label: 'All contacts' },
  { id: 'has_email', label: 'Has email' },
  { id: 'no_email', label: 'No email' },
  { id: 'has_phone', label: 'Has phone' },
  { id: 'no_phone', label: 'No phone' },
  { id: 'has_both', label: 'Email & phone' },
  { id: 'missing_both', label: 'Missing both' },
]

export const DEFAULT_PIPELINE_FILTERS = {
  cities: [],
  states: [],
  contact: 'any',
  tagIds: [],
  tagMode: 'any',
  smartTags: [],
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
    minDealValue = null,
    staleDays = null,
    overdueFollowUp = false,
    tagIds = [],
    tagMode = 'any',
    smartTags = [],
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
    list = list.filter((l) => (l.crm?.leadScore ?? 0) >= 70)
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
  if (search?.trim()) n += 1
  return n
}
