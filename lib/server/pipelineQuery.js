import { CRM_STATUSES } from './crm.js'
import { listPipelineSavedEntries } from './organizations.js'

function norm(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

export function entryLeadCity(entry) {
  const l = entry?.lead || {}
  const city = String(l.city || '').trim()
  if (city) return city
  const loc = String(l.location || '').split(',')[0]?.trim()
  return loc || ''
}

export function entryLeadState(entry) {
  return String(entry?.lead?.state || '').trim()
}

/** Case-insensitive match; dropdown values match exactly, partial match allowed. */
export function locationMatchesField(value, filter) {
  const v = norm(value)
  const f = norm(filter)
  if (!f) return true
  if (!v) return false
  if (v === f) return true
  return v.includes(f) || f.includes(v)
}

export function collectPipelineLocationFacets(entries) {
  const cityByKey = new Map()
  const stateByKey = new Map()
  for (const entry of entries || []) {
    const city = entryLeadCity(entry)
    const state = entryLeadState(entry)
    if (city) {
      const key = norm(city)
      if (!cityByKey.has(key)) cityByKey.set(key, city)
    }
    if (state) {
      const key = norm(state)
      if (!stateByKey.has(key)) stateByKey.set(key, state)
    }
  }
  const sortNames = (a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })
  return {
    cities: [...cityByKey.values()].sort(sortNames),
    states: [...stateByKey.values()].sort(sortNames),
  }
}

export function visiblePipelineEntries(store, user, rawEntries) {
  const scoped = { ...store, savedLeads: rawEntries }
  return listPipelineSavedEntries(scoped, user)
}

const MS_DAY = 86400000

export function filterPipelineEntries(
  entries,
  {
    status,
    q,
    assigneeUserId,
    tagIds,
    city,
    state,
    cities,
    states,
    minLeadScore = null,
    followUpDue = false,
    overdueFollowUp = false,
  } = {}
) {
  let list = entries

  if (assigneeUserId) {
    const id = String(assigneeUserId)
    if (id === '__unassigned__') {
      list = list.filter((e) => !e.assignedToUserId)
    } else {
      list = list.filter((e) => {
        if (e.assignedToUserId) return String(e.assignedToUserId) === id
        const fallback = e.savedByUserId || e.userId
        return fallback != null && String(fallback) === id
      })
    }
  }

  if (status && status !== 'all' && CRM_STATUSES.includes(status)) {
    list = list.filter((e) => (e.crm?.status || 'new') === status)
  }

  const tagFilter = (tagIds || []).map(String).filter(Boolean)
  if (tagFilter.length) {
    list = list.filter((e) => {
      const ids = e.crm?.tagIds || []
      return tagFilter.every((id) => ids.includes(id))
    })
  }

  const cityFilters = Array.isArray(cities) && cities.length
    ? cities.map(String).filter(Boolean)
    : city
      ? [String(city).trim()].filter(Boolean)
      : []
  if (cityFilters.length) {
    list = list.filter((e) =>
      cityFilters.some((f) => locationMatchesField(entryLeadCity(e), f))
    )
  }

  const stateFilters = Array.isArray(states) && states.length
    ? states.map(String).filter(Boolean)
    : state
      ? [String(state).trim()].filter(Boolean)
      : []
  if (stateFilters.length) {
    list = list.filter((e) =>
      stateFilters.some((f) => locationMatchesField(entryLeadState(e), f))
    )
  }

  if (minLeadScore != null && minLeadScore !== '') {
    const min = Number(minLeadScore)
    if (!Number.isNaN(min)) {
      list = list.filter((e) => (Number(e.crm?.leadScore) || 0) >= min)
    }
  }

  if (overdueFollowUp) {
    const now = Date.now()
    list = list.filter((e) => {
      const at = e.crm?.nextFollowUpAt
      return at && new Date(at).getTime() < now
    })
  }

  if (followUpDue) {
    const endToday = new Date()
    endToday.setHours(23, 59, 59, 999)
    list = list.filter((e) => {
      const crm = e.crm || {}
      if (crm.status !== 'follow_up') return false
      const at = crm.nextFollowUpAt
      if (!at) return true
      return new Date(at).getTime() <= endToday.getTime()
    })
  }

  const query = norm(q)
  if (query) {
    list = list.filter((e) => {
      const l = e.lead || {}
      const parts = [
        l.company,
        l.firstName,
        l.lastName,
        l.email,
        l.phone,
        l.city,
        l.state,
        l.location,
        l.title,
        e.crm?.notes,
      ].map(norm)
      const hay = parts.join(' ')
      if (hay.includes(query)) return true
      const qDigits = String(q || '').replace(/\D/g, '')
      const phoneDigits = String(l.phone || '').replace(/\D/g, '')
      if (qDigits.length >= 4 && phoneDigits.includes(qDigits)) return true
      return locationMatchesField(entryLeadCity(e), query) ||
        locationMatchesField(entryLeadState(e), query)
    })
  }

  return list
}

export function summarizePipelineEntries(entries) {
  const byStatus = Object.fromEntries(CRM_STATUSES.map((s) => [s, 0]))
  for (const e of entries) {
    const st = e.crm?.status || 'new'
    if (byStatus[st] != null) byStatus[st] += 1
    else byStatus.new += 1
  }
  return {
    total: entries.length,
    byStatus: CRM_STATUSES.map((status) => ({ status, count: byStatus[status] || 0 })),
  }
}

export function boardPipelineSlice(entries, defaultPerColumn = 50, columnLimits = {}) {
  const columns = Object.fromEntries(CRM_STATUSES.map((s) => [s, []]))
  const totals = Object.fromEntries(CRM_STATUSES.map((s) => [s, 0]))
  const sorted = entries
    .slice()
    .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime())

  for (const entry of sorted) {
    const st = entry.crm?.status || 'new'
    const bucketKey = columns[st] != null ? st : 'new'
    totals[bucketKey] = (totals[bucketKey] || 0) + 1
    const bucket = columns[bucketKey]
    const max = Number(columnLimits[bucketKey]) > 0 ? Number(columnLimits[bucketKey]) : defaultPerColumn
    if (bucket.length < max) bucket.push(entry)
  }

  return { columns, totals }
}
