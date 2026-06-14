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

/** Append city/state/score/deal filters to PostgREST query parts. */
export function appendPipelineFilterSqlParts(parts, filters = {}) {
  const next = [...(parts || [])]

  const cities = cityFiltersFrom(filters)
  const cityClause = orEqualsClause('city', cities)
  if (cityClause) next.push(cityClause)

  const states = stateFiltersFrom(filters)
  const stateClause = orEqualsClause('state', states)
  if (stateClause) next.push(stateClause)

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

  return next
}

export function filtersUseDenormalizedSql(filters = {}) {
  return Boolean(
    cityFiltersFrom(filters).length ||
      stateFiltersFrom(filters).length ||
      (filters.minLeadScore != null && filters.minLeadScore !== '') ||
      (filters.maxLeadScore != null && filters.maxLeadScore !== '') ||
      filters.hasDeals === true ||
      filters.hasDeals === '1'
  )
}

export function filtersNeedExactPostgrestCount(filters = {}) {
  return (
    filtersUseDenormalizedSql(filters) ||
    Boolean(filters.followUpDue || filters.overdueFollowUp)
  )
}
