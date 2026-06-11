import {
  getLeadCityFromFields,
  getLeadStateFromFields,
  locationMatchesField,
  normalizeLocationKey,
} from '../pipelineLeadLocation.js'
import { CRM_STATUSES } from './crm.js'
import { listPipelineSavedEntries } from './organizations.js'

function norm(s) {
  return normalizeLocationKey(s)
}

export function entryLeadCity(entry) {
  return getLeadCityFromFields(entry?.lead || {})
}

export function entryLeadState(entry) {
  return getLeadStateFromFields(entry?.lead || {})
}

export { locationMatchesField }

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

/** PostgREST filter for a pipeline owner (indexed owner_id + JSON assignee/saved-by). */
export function pipelineAssigneePostgrestFilter(assigneeUserId) {
  const id = String(assigneeUserId || '').trim()
  if (!id || id === '__unassigned__') return null
  const enc = encodeURIComponent(id)
  return `or=(owner_id.eq.${enc},entry->>assignedToUserId.eq.${enc},entry->>savedByUserId.eq.${enc})`
}

/** Leads with no explicit assignee (saved-by fallback may still be set). */
export function pipelineUnassignedPostgrestFilter() {
  return 'entry->>assignedToUserId=is.null'
}

export function isPipelineLeadUnassigned(entry) {
  return !entry?.assignedToUserId
}

/** Rep view: leads assigned to me + org unassigned pool. */
export function pipelineRepVisibilityPostgrestFilter(userId) {
  const id = encodeURIComponent(String(userId || '').trim())
  if (!id) return pipelineUnassignedPostgrestFilter()
  return `or=(entry->>assignedToUserId.eq.${id},entry->>assignedToUserId.is.null)`
}

/** Manager team/dept scope plus org-wide unassigned pool. */
export function pipelineScopeOrUnassignedPostgrestFilter(scopePart) {
  const part = String(scopePart || '').trim()
  if (!part) return pipelineUnassignedPostgrestFilter()
  return `or=(${part},entry->>assignedToUserId.is.null)`
}

/** Assignee match (owner / assignee / saved-by) plus unassigned pool. */
export function pipelineAssigneeOrUnassignedPostgrestFilter(assigneeUserId) {
  const id = encodeURIComponent(String(assigneeUserId || '').trim())
  if (!id) return pipelineUnassignedPostgrestFilter()
  return `or=(owner_id.eq.${id},entry->>assignedToUserId.eq.${id},entry->>savedByUserId.eq.${id},entry->>assignedToUserId.is.null)`
}

/** Match pipeline entry to owner filter — same fields as PostgREST assignee filters. */
export function pipelineEntryMatchesAssignee(entry, assigneeUserId) {
  if (!assigneeUserId) return true
  const id = String(assigneeUserId)
  if (id === '__unassigned__') return !entry?.assignedToUserId
  const owners = [entry?.assignedToUserId, entry?.savedByUserId, entry?.userId].filter(Boolean)
  return owners.some((v) => String(v) === id)
}

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
    maxLeadScore = null,
    followUpDue = false,
    overdueFollowUp = false,
    stuck = false,
  } = {}
) {
  let list = entries

  if (assigneeUserId) {
    list = list.filter((e) => pipelineEntryMatchesAssignee(e, assigneeUserId))
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

  if (maxLeadScore != null && maxLeadScore !== '') {
    const max = Number(maxLeadScore)
    if (!Number.isNaN(max)) {
      list = list.filter((e) => (Number(e.crm?.leadScore) || 0) <= max)
    }
  }

  if (stuck) {
    const cutoff = Date.now() - 7 * MS_DAY
    list = list.filter((e) => {
      const crm = e.crm || {}
      const st = crm.status || 'new'
      if (st === 'won' || st === 'lost') return false
      const last =
        crm.lastCommunicationAt || crm.lastEmailSentAt || crm.lastCallAt || e.savedAt || null
      if (!last) return true
      return new Date(last).getTime() < cutoff
    })
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

  const rawQ = String(q || '').trim()
  if (rawQ) {
    const terms = rawQ.includes(',')
      ? rawQ.split(',').map((t) => t.trim()).filter(Boolean)
      : [rawQ]
    const useOr = terms.length > 1

    list = list.filter((e) => {
      const matchesTerm = (term) => {
        const query = norm(term)
        if (!query) return true
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
        const qDigits = String(term || '').replace(/\D/g, '')
        const phoneDigits = String(l.phone || '').replace(/\D/g, '')
        if (qDigits.length >= 4 && phoneDigits.includes(qDigits)) return true
        return (
          locationMatchesField(entryLeadCity(e), query) ||
          locationMatchesField(entryLeadState(e), query)
        )
      }
      return useOr ? terms.some(matchesTerm) : matchesTerm(terms[0])
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
