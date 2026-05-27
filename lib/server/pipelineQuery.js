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

export function filterPipelineEntries(
  entries,
  { status, q, assigneeUserId, tagIds, city, state } = {}
) {
  let list = entries

  if (assigneeUserId) {
    list = list.filter(
      (e) => (e.assignedToUserId || e.savedByUserId || e.userId) === assigneeUserId
    )
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

  const cityFilter = String(city || '').trim()
  if (cityFilter) {
    list = list.filter((e) => locationMatchesField(entryLeadCity(e), cityFilter))
  }

  const stateFilter = String(state || '').trim()
  if (stateFilter) {
    list = list.filter((e) => locationMatchesField(entryLeadState(e), stateFilter))
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

export function boardPipelineSlice(entries, perColumn = 40) {
  const byStatus = Object.fromEntries(CRM_STATUSES.map((s) => [s, []]))
  const sorted = entries
    .slice()
    .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime())

  for (const entry of sorted) {
    const st = entry.crm?.status || 'new'
    const bucket = byStatus[st] || byStatus.new
    if (bucket.length < perColumn) bucket.push(entry)
  }

  return byStatus
}
