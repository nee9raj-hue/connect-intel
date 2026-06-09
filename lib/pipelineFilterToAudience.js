import { SEGMENT_FILTER_DEFAULTS } from './marketingSegmentFilters.js'

/** Map pipeline server filter params + advanced UI filters to segment filterJson. */
export function serverFiltersToSegmentFilterJson(serverFilters = {}, advancedFilters = {}) {
  const followUpDue =
    serverFilters.followUpDue === '1' ||
    serverFilters.followUpDue === true ||
    Boolean(advancedFilters.followUpDue)
  const overdueFollowUp =
    serverFilters.overdueFollowUp === '1' ||
    serverFilters.overdueFollowUp === true ||
    Boolean(advancedFilters.overdueFollowUp)

  return {
    ...SEGMENT_FILTER_DEFAULTS,
    status: serverFilters.status || 'all',
    cities: serverFilters.cities || [],
    states: serverFilters.states || [],
    tagIds: serverFilters.tagIds || [],
    tagMode: advancedFilters.tagMode || 'any',
    assigneeUserId: serverFilters.assigneeUserId || '',
    contact: advancedFilters.contact || 'any',
    smartTags: advancedFilters.smartTags || [],
    followUpDue,
    overdueFollowUp,
    minLeadScore: serverFilters.minLeadScore ?? null,
    logic: 'and',
  }
}

/** True when segment filterJson has at least one meaningful criterion. */
export function hasSavableSegmentFilterJson(filterJson = {}) {
  if (filterJson.status && filterJson.status !== 'all') return true
  if (filterJson.cities?.length) return true
  if (filterJson.states?.length) return true
  if (filterJson.tagIds?.length) return true
  if (filterJson.assigneeUserId) return true
  if (filterJson.minLeadScore != null && filterJson.minLeadScore !== '') return true
  if (filterJson.followUpDue || filterJson.overdueFollowUp) return true
  if (filterJson.contact && filterJson.contact !== 'any') return true
  if (filterJson.smartTags?.length) return true
  if (filterJson.country) return true
  if (filterJson.industry) return true
  return false
}

/** True when pipeline filters can be saved (search-only is excluded). */
export function hasSavablePipelineAudienceFilter(serverFilters = {}, advancedFilters = {}) {
  const merged = serverFiltersToSegmentFilterJson(serverFilters, advancedFilters)
  return hasSavableSegmentFilterJson(merged)
}
