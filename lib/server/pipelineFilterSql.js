/**
 * PostgREST filter fragments for denormalized pipeline_leads columns.
 */

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

  return appendPipelineTagSqlParts(next, filters)
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
    filtersUseEntryLocationFilter(filters) ||
    Boolean(filters.followUpDue || filters.overdueFollowUp)
  )
}
