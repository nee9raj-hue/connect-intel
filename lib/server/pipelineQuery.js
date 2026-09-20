import {
  getLeadCityFromFields,
  getLeadStateFromFields,
  leadMatchesStateFilters,
  locationMatchesField,
  normalizeLocationKey,
} from '../pipelineLeadLocation.js'
import {
  isPipelineLeadUnassigned,
  pipelineEntryMatchesOwnerFilter,
  pipelineOwnerUserId,
} from '../pipelineOwner.js'
import { CRM_STATUSES, foldCrmStatusCounts, isCrmLeadStatusFilter, normalizeCrmLeadStatus } from './crm.js'
import { canonicalErpOwner, erpOwnerIdentityPostgrestParts, erpPersonMatchesUser } from '../erpOwner.js'
import {
  collectStatusFilterIds,
  leadMatchesNotesPresence,
  leadMatchesStatusIds,
  statusFilterSqlAliases,
} from '../pipelineColumnFilters.js'
import { crmLeadStatusPostgrestIn } from '../crmLeadStatuses.js'
import { collectCrmStageFilterIds, pipelineTrackSqlAliases } from '../crmPipelineFlow.js'
import { leadMatchesCrmErpUnion } from '../pipelineCrmErpUnion.js'
import { listPipelineSavedEntries } from './organizations.js'

/** PostgREST filter on authoritative CRM status inside entry JSON (not lead_status column). */
export function pipelineCrmStatusPostgrestFilter(
  status,
  { pipelineTrack, crmStageIds, crmStages, statusIds } = {}
) {
  const selected = collectStatusFilterIds({ statusIds })
  if (selected.length) {
    const aliases = statusFilterSqlAliases(selected)
    if (aliases.length) return `entry->crm->>status=in.(${aliases.join(',')})`
  }
  if (collectCrmStageFilterIds({ crmStageIds, crmStages }).length) return null
  const st = String(status || 'all').trim()
  if (st && st !== 'all' && isCrmLeadStatusFilter(st)) {
    const inn = crmLeadStatusPostgrestIn(st)
    if (inn) return `entry->crm->>status=${inn}`
  }
  const trackIds = pipelineTrackSqlAliases(pipelineTrack)
  if (trackIds.length) {
    return `entry->crm->>status=in.(${trackIds.join(',')})`
  }
  return null
}

export function pipelineLeadStatusColumnFilter(
  status,
  { pipelineTrack, crmStageIds, crmStages, statusIds } = {}
) {
  const selected = collectStatusFilterIds({ statusIds })
  if (selected.length) {
    const aliases = statusFilterSqlAliases(selected)
    if (aliases.length) return `lead_status=in.(${aliases.join(',')})`
  }
  if (collectCrmStageFilterIds({ crmStageIds, crmStages }).length) return null
  const st = String(status || 'all').trim()
  if (st && st !== 'all' && isCrmLeadStatusFilter(st)) {
    const inn = crmLeadStatusPostgrestIn(st)
    if (inn) return `lead_status=${inn}`
  }
  const trackIds = pipelineTrackSqlAliases(pipelineTrack)
  if (trackIds.length) {
    return `lead_status=in.(${trackIds.join(',')})`
  }
  return null
}

function norm(s) {
  return normalizeLocationKey(s)
}

/** Searchable text for a pipeline lead — keep in sync with platform top search. */
export function pipelineLeadSearchHaystack(lead = {}, crm = {}) {
  const l = lead || {}
  return [
    l.name,
    l.company,
    l.companyName,
    l.firstName,
    l.lastName,
    l.email,
    l.phone,
    l.city,
    l.state,
    l.location,
    l.title,
    l.linkedin,
    crm?.notes,
  ]
    .filter(Boolean)
    .map(norm)
    .join(' ')
}

export function pipelineEntryMatchesSearch(entry, rawQ) {
  const raw = String(rawQ || '').trim()
  if (!raw) return true

  const terms = raw.includes(',')
    ? raw.split(',').map((t) => t.trim()).filter(Boolean)
    : [raw]
  const useOr = terms.length > 1
  const l = entry?.lead || {}
  const crm = entry?.crm || {}

  const matchesTerm = (term) => {
    const query = norm(term)
    if (!query) return true
    const hay = pipelineLeadSearchHaystack(l, crm)
    if (hay.includes(query)) return true
    const qDigits = String(term || '').replace(/\D/g, '')
    const phoneDigits = String(l.phone || '').replace(/\D/g, '')
    if (qDigits.length >= 4 && phoneDigits.includes(qDigits)) return true
    return (
      locationMatchesField(entryLeadCity(entry), query) ||
      locationMatchesField(entryLeadState(entry), query)
    )
  }

  return useOr ? terms.some(matchesTerm) : matchesTerm(terms[0])
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

/** PostgREST owner filter — indexed owner_id + JSON assignee (same as DB trigger). */
export function pipelineAssigneePostgrestFilter(assigneeUserId) {
  const ids = [...new Set(
    (Array.isArray(assigneeUserId) ? assigneeUserId : [assigneeUserId])
      .map((id) => String(id || '').trim())
      .filter((id) => id && id !== '__unassigned__')
  )]
  if (!ids.length) return null
  return pipelineRepVisibilityPostgrestFilter(ids, { includeCollaborators: false })
}

/** Owner picker: identity aliases plus ERP sales-owner name/email (does not steal other books in JS). */
export function pipelineMemberBookPostgrestFilter(actorIds, memberUser) {
  const ids = [...new Set((actorIds || []).map((id) => String(id || '').trim()).filter(Boolean))]
  const parts = []
  if (ids.length === 1) {
    const id = encodeURIComponent(ids[0])
    parts.push(`owner_id.eq.${id}`)
    parts.push(`entry->>assignedToUserId.eq.${id}`)
  } else if (ids.length > 1) {
    parts.push(`owner_id.in.(${ids.map((id) => encodeURIComponent(id)).join(',')})`)
    parts.push(`entry->>assignedToUserId.in.(${ids.map((id) => encodeURIComponent(id)).join(',')})`)
  }
  parts.push(...erpOwnerIdentityPostgrestParts(memberUser || { id: ids[0] }))
  if (!parts.length) return null
  if (parts.length === 1) return parts[0]
  return `or=(${parts.join(',')})`
}

/** Leads with no indexed owner (open pool). */
export function pipelineUnassignedPostgrestFilter() {
  return 'owner_id=is.null'
}

export function isPipelineLeadUnassignedEntry(entry) {
  return isPipelineLeadUnassigned(entry)
}

/** Rep view: assigned / collaborator rows for one or more identity ids. */
export function pipelineRepVisibilityPostgrestFilter(userId, { includeCollaborators = true } = {}) {
  const ids = [...new Set((Array.isArray(userId) ? userId : [userId]).map((id) => String(id || '').trim()).filter(Boolean))]
  if (!ids.length) return pipelineUnassignedPostgrestFilter()
  if (ids.length === 1) {
    const id = encodeURIComponent(ids[0])
    const assigneeJson = `entry->>assignedToUserId.eq.${id}`
    if (includeCollaborators) {
      return `or=(owner_id.eq.${id},${assigneeJson},collaborator_ids.cs.{${id}})`
    }
    return `or=(owner_id.eq.${id},${assigneeJson})`
  }
  const inList = ids.map((id) => encodeURIComponent(id)).join(',')
  const jsonOr = ids.map((id) => `entry->>assignedToUserId.eq.${encodeURIComponent(id)}`).join(',')
  if (includeCollaborators) {
    const collab = ids.map((id) => `collaborator_ids.cs.{${encodeURIComponent(id)}}`).join(',')
    return `or=(owner_id.in.(${inList}),${jsonOr},${collab})`
  }
  return `or=(owner_id.in.(${inList}),${jsonOr})`
}

/** Manager: own book (any identity id) plus team/department rows. */
export function pipelineManagerVisibilityPostgrestFilter({ teamId, departmentId, ownerIds } = {}) {
  const parts = []
  if (teamId) parts.push(`team_id.eq.${encodeURIComponent(String(teamId))}`)
  if (departmentId) parts.push(`department_id.eq.${encodeURIComponent(String(departmentId))}`)
  const ids = [...new Set((ownerIds || []).map((id) => String(id || '').trim()).filter(Boolean))]
  if (ids.length === 1) {
    const id = encodeURIComponent(ids[0])
    parts.push(`owner_id.eq.${id}`)
    parts.push(`entry->>assignedToUserId.eq.${id}`)
  } else if (ids.length > 1) {
    parts.push(`owner_id.in.(${ids.map((id) => encodeURIComponent(id)).join(',')})`)
    parts.push(
      `entry->>assignedToUserId.in.(${ids.map((id) => encodeURIComponent(id)).join(',')})`
    )
  }
  if (!parts.length) return pipelineUnassignedPostgrestFilter()
  if (parts.length === 1) return parts[0]
  return `or=(${parts.join(',')})`
}

/** Manager team/dept scope plus open (no owner) pool. */
export function pipelineScopeOrUnassignedPostgrestFilter(scopePart) {
  const part = String(scopePart || '').trim()
  if (!part) return pipelineUnassignedPostgrestFilter()
  return `or=(${part},owner_id.is.null)`
}

/** Owner match plus open pool (manager single-rep scope). */
export function pipelineAssigneeOrUnassignedPostgrestFilter(assigneeUserId) {
  const id = encodeURIComponent(String(assigneeUserId || '').trim())
  if (!id) return pipelineUnassignedPostgrestFilter()
  return `or=(owner_id.eq.${id},owner_id.is.null)`
}

/** Match pipeline entry to Owner filter — assignee when set, else saver (see pipelineOwner.js). */
export function pipelineEntryMatchesAssignee(entry, assigneeUserId, extraIds = [], memberUser = null) {
  if (pipelineEntryMatchesOwnerFilter(entry, assigneeUserId, extraIds)) return true
  if (memberUser && erpPersonMatchesUser(canonicalErpOwner(entry?.erp || entry?.lead?.erp), memberUser)) {
    return true
  }
  return false
}

export { pipelineOwnerUserId } from '../pipelineOwner.js'

export function filterPipelineEntries(
  entries,
  {
    status,
    q,
    assigneeUserId,
    assigneeActorIds,
    assigneeMember,
    teamIds,
    teamMemberUserIds,
    tagIds,
    tagMode = 'any',
    city,
    state,
    cities,
    states,
    minLeadScore = null,
    maxLeadScore = null,
    followUpDue = false,
    overdueFollowUp = false,
    stuck = false,
    lastShipmentYear,
    lastShipmentMonth,
    lastShipmentPeriods,
    pipelineTrack,
    erpTagNames,
    erpTagMode = 'any',
    crmStageIds,
    crmStages,
    statusIds,
    notesPresence,
  } = {}
) {
  let list = entries

  if (assigneeUserId) {
    list = list.filter((e) =>
      pipelineEntryMatchesAssignee(e, assigneeUserId, assigneeActorIds, assigneeMember)
    )
  }

  const teamFilterIds = (teamIds || []).map(String).filter(Boolean)
  if (teamFilterIds.length) {
    const teamSet = new Set(teamFilterIds)
    const memberSet = new Set((teamMemberUserIds || []).map(String).filter(Boolean))
    list = list.filter((e) => {
      if (memberSet.size) {
        const owner = pipelineOwnerUserId(e)
        return Boolean(owner && memberSet.has(String(owner)))
      }
      return Boolean(e.teamId && teamSet.has(String(e.teamId)))
    })
  }

  const selectedStatusIds = collectStatusFilterIds({ statusIds })
  list = list.filter((e) =>
    leadMatchesCrmErpUnion(e, {
      status: selectedStatusIds.length ? 'all' : status,
      pipelineTrack: selectedStatusIds.length ? '' : pipelineTrack,
      erpTagNames,
      erpTagMode,
      lastShipmentYear,
      lastShipmentMonth,
      lastShipmentPeriods,
      crmStageIds,
      crmStages,
    })
  )
  if (selectedStatusIds.length) {
    list = list.filter((e) => leadMatchesStatusIds(e, selectedStatusIds))
  }
  list = list.filter((e) => leadMatchesNotesPresence(e, { notesPresence }))

  const tagFilter = (tagIds || []).map(String).filter(Boolean)
  if (tagFilter.length) {
    const modeAll = String(tagMode || 'any').toLowerCase() === 'all'
    list = list.filter((e) => {
      const ids = e.crm?.tagIds || []
      if (modeAll) return tagFilter.every((id) => ids.includes(id))
      return tagFilter.some((id) => ids.includes(id))
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
    list = list.filter((e) => leadMatchesStateFilters(e?.lead || {}, stateFilters))
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
      const st = normalizeCrmLeadStatus(crm.status)
      if (st === 'lost' || st === 'churned') return false
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
      const at = e.crm?.nextFollowUpAt
      if (!at) return true
      return new Date(at).getTime() <= endToday.getTime()
    })
  }

  const rawQ = String(q || '').trim()
  if (rawQ) {
    list = list.filter((e) => pipelineEntryMatchesSearch(e, rawQ))
  }

  return list
}

export function summarizePipelineEntries(entries) {
  const rows = (entries || []).map((e) => ({ status: e.crm?.status, count: 1 }))
  return {
    total: entries.length,
    byStatus: foldCrmStatusCounts(rows),
  }
}

export function boardPipelineSlice(entries, defaultPerColumn = 50, columnLimits = {}) {
  const columns = Object.fromEntries(CRM_STATUSES.map((s) => [s, []]))
  const totals = Object.fromEntries(CRM_STATUSES.map((s) => [s, 0]))
  const sorted = entries
    .slice()
    .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime())

  for (const entry of sorted) {
    const st = normalizeCrmLeadStatus(entry.crm?.status)
    const bucketKey = columns[st] != null ? st : 'unqualified'
    totals[bucketKey] = (totals[bucketKey] || 0) + 1
    const bucket = columns[bucketKey]
    const max = Number(columnLimits[bucketKey]) > 0 ? Number(columnLimits[bucketKey]) : defaultPerColumn
    if (bucket.length < max) bucket.push(entry)
  }

  return { columns, totals }
}
