/**
 * PostgREST filter fragments for denormalized pipeline_leads columns.
 */

import { appendLastShipmentSqlParts, lastShipmentFilterActive } from '../leadLastShipmentFilter.js'
import { collectPipelineTeamIds } from './pipelineQueryParams.js'

function cityFiltersFrom(filters = {}) {
  if (Array.isArray(filters.cities) && filters.cities.length) {
    return filters.cities.map(String).map((c) => c.trim()).filter(Boolean)
  }
  const single = String(filters.city || '').trim()
  return single ? [single] : []
}

function stateFiltersFrom(filters = {}) {
  if (Array.isArray(filters.states) && filters.states.length) {
    return filters.states.map(String).map((s) => s.trim()).filter(Boolean)
  }
  const single = String(filters.state || '').trim()
  return single ? [single] : []
}

function orEqualsClause(field, values) {
  if (!values.length) return null
  if (values.length === 1) {
    return `${field}=eq.${encodeURIComponent(values[0])}`
  }
  return `or=(${values.map((v) => `${field}.eq.${encodeURIComponent(v)}`).join(',')})`
}

export function filtersUseEntryLocationFilter(filters = {}) {
  return Boolean(cityFiltersFrom(filters).length || stateFiltersFrom(filters).length)
}

/** Strip city/state — those are matched on entry JSON, not denormalized SQL columns. */
export function stripLocationSqlFilters(filters = {}) {
  return {
    ...filters,
    cities: [],
    states: [],
    city: '',
    state: '',
  }
}

/** Append score/deal filters to PostgREST query parts (city/state use entry JSON filtering). */
export function appendPipelineFilterSqlParts(parts, filters = {}) {
  const next = [...(parts || [])]

  if (filters.minLeadScore != null && filters.minLeadScore !== '') {
    const min = Number(filters.minLeadScore)
    if (!Number.isNaN(min)) next.push(`lead_score=gte.${min}`)
  }
  if (filters.maxLeadScore != null && filters.maxLeadScore !== '') {
    const max = Number(filters.maxLeadScore)
    if (!Number.isNaN(max)) next.push(`lead_score=lte.${max}`)
  }

  if (filters.hasDeals === true || filters.hasDeals === '1') {
    next.push('deal_count=gt.0')
  }

  return appendPipelineTeamSqlParts(
    appendPipelineTagSqlParts(
      appendPipelineErpTagSqlParts(appendLastShipmentSqlParts(next, filters), filters),
      filters
    ),
    filters
  )
}

/** Team chip: sales owners on the selected team(s), not stale pipeline_leads.team_id. */
export function pipelineTeamOwnerSqlPart(filters = {}) {
  const teamIds = collectPipelineTeamIds(filters)
  const memberIds = [...new Set((filters.teamMemberUserIds || []).map(String).filter(Boolean))]
  if (!teamIds.length && !memberIds.length) return null
  if (memberIds.length === 1) return `owner_id=eq.${encodeURIComponent(memberIds[0])}`
  if (memberIds.length > 1) {
    return `owner_id=in.(${memberIds.map((id) => encodeURIComponent(id)).join(',')})`
  }
  if (teamIds.length === 1) return `team_id=eq.${encodeURIComponent(teamIds[0])}`
  return `team_id=in.(${teamIds.map((id) => encodeURIComponent(id)).join(',')})`
}

export function appendPipelineTeamSqlParts(parts, filters = {}) {
  const part = pipelineTeamOwnerSqlPart(filters)
  if (!part) return parts || []
  return [...(parts || []), part]
}

export function filtersUseTeamSql(filters = {}) {
  return collectPipelineTeamIds(filters).length > 0
}

export function pipelineEntryTagContainsJson(tagIds = []) {
  return JSON.stringify({
    crm: { tagIds: tagIds.map(String).filter(Boolean) },
  })
}

/** PostgREST jsonb @> filter: entry.crm.tagIds includes the given tag id(s). */
export function appendPipelineTagSqlParts(parts, filters = {}) {
  const tagIds = (filters.tagIds || []).map(String).filter(Boolean)
  if (!tagIds.length) return parts

  const next = [...(parts || [])]
  const modeAll = String(filters.tagMode || 'any').toLowerCase() === 'all'

  if (modeAll) {
    next.push(`entry=cs.${encodeURIComponent(pipelineEntryTagContainsJson(tagIds))}`)
    return next
  }

  if (tagIds.length === 1) {
    next.push(`entry=cs.${encodeURIComponent(pipelineEntryTagContainsJson([tagIds[0]]))}`)
    return next
  }

  const orInner = tagIds
    .map((id) => `entry.cs.${encodeURIComponent(pipelineEntryTagContainsJson([id]))}`)
    .join(',')
  next.push(`or=(${orInner})`)
  return next
}

export function filtersUseTagSql(filters = {}) {
  return Array.isArray(filters.tagIds) && filters.tagIds.length > 0
}

export function collectErpTagFilterNames(filters = {}) {
  return [
    ...new Set(
      [...(filters.erpTagNames || []), ...(filters.erpTags || [])]
        .map((name) => String(name || '').trim())
        .filter(Boolean)
    ),
  ]
}

function erpTagContainsParts(name) {
  const byName = encodeURIComponent(JSON.stringify([{ name }]))
  const byTagName = encodeURIComponent(JSON.stringify([{ tagName: name }]))
  return [
    `entry->crm_payload->erp_tags.cs.${byName}`,
    `entry->erp->erpTags.cs.${byName}`,
    `entry->erp->revenue->tags.cs.${byTagName}`,
  ]
}

/** PostgREST jsonb contains on erp_tags / revenue.tags — not CRM tagIds. */
export function appendPipelineErpTagSqlParts(parts, filters = {}) {
  const names = collectErpTagFilterNames(filters)
  if (!names.length) return parts || []

  const next = [...(parts || [])]
  const modeAll = String(filters.erpTagMode || 'any').toLowerCase() === 'all'

  if (modeAll) {
    next.push(`and=(${names.map((name) => `or(${erpTagContainsParts(name).join(',')})`).join(',')})`)
    return next
  }

  const anyParts = names.flatMap((name) => erpTagContainsParts(name))
  if (anyParts.length === 1) {
    const [field, value] = anyParts[0].split('.cs.')
    next.push(`${field}=cs.${value}`)
    return next
  }
  next.push(`or=(${anyParts.join(',')})`)
  return next
}

export function filtersUseErpTagSql(filters = {}) {
  return collectErpTagFilterNames(filters).length > 0
}

export function filtersUseDenormalizedSql(filters = {}) {
  return Boolean(
    (filters.minLeadScore != null && filters.minLeadScore !== '') ||
      (filters.maxLeadScore != null && filters.maxLeadScore !== '') ||
      filters.hasDeals === true ||
      filters.hasDeals === '1'
  )
}

export function filtersNeedExactPostgrestCount(filters = {}) {
  return (
    filtersUseDenormalizedSql(filters) ||
    filtersUseTagSql(filters) ||
    filtersUseErpTagSql(filters) ||
    filtersUseEntryLocationFilter(filters) ||
    Boolean(filters.followUpDue || filters.overdueFollowUp) ||
    lastShipmentFilterActive(filters) ||
    filtersUseTeamSql(filters)
  )
}
