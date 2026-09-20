import { collectCrmStageFilterIds, normalizePipelineTrack } from '../crmPipelineFlow.js'
import { lastShipmentMonthValues, lastShipmentPeriodTokens } from '../leadLastShipmentFilter.js'
import { collectStatusFilterIds, normalizeNotesPresence } from '../pipelineColumnFilters.js'

export function collectPipelineTeamIds(filters = {}) {
  return [
    ...new Set(
      [...(filters.teamIds || []), filters.teamId]
        .map((id) => String(id || '').trim())
        .filter(Boolean)
    ),
  ]
}

function parseTeamIdsFromUrl(url) {
  return [
    ...new Set(
      [
        ...url.searchParams.getAll('teamId'),
        ...url.searchParams.getAll('team_id'),
        ...String(url.searchParams.get('teamIds') || '').split(','),
        ...String(url.searchParams.get('team_ids') || '').split(','),
      ]
        .map((id) => String(id || '').trim())
        .filter(Boolean)
    ),
  ]
}

/** Shared pipeline list / export query param parsing. */
export function parsePipelineQueryParams(url) {
  const statusRaw = String(url.searchParams.get('status') || 'all').trim()
  const status = statusRaw.includes(',') ? statusRaw.split(',')[0].trim() : statusRaw
  const q = String(
    url.searchParams.get('search') || url.searchParams.get('q') || ''
  ).trim()
  const cities = url.searchParams.getAll('city').map((c) => String(c).trim()).filter(Boolean)
  const states = url.searchParams.getAll('state').map((s) => String(s).trim()).filter(Boolean)
  const assigneeUserId =
    String(
      url.searchParams.get('owner_id') ||
        url.searchParams.get('assigneeUserId') ||
        ''
    ).trim() || null
  const tagsParam = String(url.searchParams.get('tags') || '').trim()
  const tagIds = tagsParam
    ? tagsParam.split(',').map((t) => t.trim()).filter(Boolean)
    : url.searchParams.getAll('tagId').filter(Boolean)
  const minLeadScore = url.searchParams.has('score_min')
    ? Number(url.searchParams.get('score_min'))
    : url.searchParams.has('minLeadScore')
      ? Number(url.searchParams.get('minLeadScore'))
      : null
  const maxLeadScore = url.searchParams.has('score_max')
    ? Number(url.searchParams.get('score_max'))
    : url.searchParams.has('maxLeadScore')
      ? Number(url.searchParams.get('maxLeadScore'))
      : null
  const followUpDue = url.searchParams.get('followUpDue') === '1'
  const overdueFollowUp = url.searchParams.get('overdueFollowUp') === '1'
  const stuck =
    url.searchParams.get('stuck') === 'true' || url.searchParams.get('stuck') === '1'
  const cursor =
    String(url.searchParams.get('page_cursor') || url.searchParams.get('cursor') || '').trim() ||
    null
  const teamIds = parseTeamIdsFromUrl(url)
  const teamId = teamIds[0] || null
  const sortBy = String(url.searchParams.get('sort_by') || '').trim() || null
  const sortDir = String(url.searchParams.get('sort_dir') || 'desc').trim()
  const lastShipmentYear = String(url.searchParams.get('lastShipmentYear') || '').trim() || null
  const lastShipmentMonths = [
    ...new Set(
      [
        ...url.searchParams.getAll('lastShipmentMonth'),
        ...String(url.searchParams.get('lastShipmentMonths') || '').split(','),
      ]
        .flatMap((value) => String(value || '').split(','))
        .map((value) => value.trim())
        .filter(Boolean)
    ),
  ]
  const lastShipmentMonth = lastShipmentMonths.join(',') || null
  const lastShipmentPeriods = [
    ...new Set(
      [
        ...url.searchParams.getAll('lastShipmentPeriod'),
        ...String(url.searchParams.get('lastShipmentPeriods') || '').split(','),
      ]
        .map((token) => String(token || '').trim())
        .filter(Boolean)
    ),
  ]
  const statusIds = collectStatusFilterIds({
    statusIds: [
      ...url.searchParams.getAll('statusId'),
      ...String(url.searchParams.get('statusIds') || '').split(','),
    ],
  })
  const notesPresence = url.searchParams.getAll('notesPresence')
  const crmStageIds = collectCrmStageFilterIds({
    crmStageIds: [
      ...url.searchParams.getAll('crmStage'),
      ...url.searchParams.getAll('crm_stage'),
      ...String(url.searchParams.get('crmStages') || '').split(','),
      ...String(url.searchParams.get('crmStageIds') || '').split(','),
    ],
  })
  const pipelineTrack = normalizePipelineTrack(
    url.searchParams.get('pipelineTrack') || url.searchParams.get('pipeline_track') || ''
  )
  const erpTagNames = [
    ...new Set(
      [
        ...url.searchParams.getAll('erpTag'),
        ...url.searchParams.getAll('erp_tag'),
        ...String(url.searchParams.get('erpTags') || '').split(','),
      ]
        .map((name) => String(name || '').trim())
        .filter(Boolean)
    ),
  ]
  return {
    status,
    q,
    city: cities[0] || '',
    state: states[0] || '',
    cities,
    states,
    assigneeUserId,
    tagIds,
    tagMode: String(url.searchParams.get('tagMode') || 'any').trim() || 'any',
    minLeadScore: Number.isFinite(minLeadScore) ? minLeadScore : null,
    maxLeadScore: Number.isFinite(maxLeadScore) ? maxLeadScore : null,
    followUpDue,
    overdueFollowUp,
    stuck,
    cursor,
    teamId,
    teamIds,
    sortBy,
    sortDir,
    lastShipmentYear,
    lastShipmentMonth,
    lastShipmentPeriods: lastShipmentPeriods.length ? lastShipmentPeriods : undefined,
    statusIds: statusIds.length ? statusIds : undefined,
    notesPresence: notesPresence.length ? notesPresence : undefined,
    crmStageIds: crmStageIds.length ? crmStageIds : undefined,
    pipelineTrack: pipelineTrack || undefined,
    erpTagNames: erpTagNames.length ? erpTagNames : undefined,
    erpTagMode: String(url.searchParams.get('erpTagMode') || 'any').trim() || 'any',
  }
}

/** Serialize pipeline filters for export / report URLs. */
export function serializePipelineFilters(filters = {}) {
  const params = new URLSearchParams()
  const status = String(filters.status || '').trim()
  if (status && status !== 'all') params.set('status', status)
  const q = String(filters.q || filters.search || '').trim()
  if (q) params.set('q', q)
  for (const city of filters.cities || []) {
    if (city) params.append('city', city)
  }
  for (const state of filters.states || []) {
    if (state) params.append('state', state)
  }
  if (filters.assigneeUserId) params.set('assigneeUserId', filters.assigneeUserId)
  for (const id of collectPipelineTeamIds(filters)) {
    params.append('teamId', id)
  }
  const tagIds = filters.tagIds || []
  if (tagIds.length) params.set('tags', tagIds.join(','))
  if (filters.tagMode && filters.tagMode !== 'any') params.set('tagMode', filters.tagMode)
  if (filters.minLeadScore != null && filters.minLeadScore !== '') {
    params.set('minLeadScore', String(filters.minLeadScore))
  }
  if (filters.maxLeadScore != null && filters.maxLeadScore !== '') {
    params.set('maxLeadScore', String(filters.maxLeadScore))
  }
  if (filters.followUpDue) params.set('followUpDue', '1')
  if (filters.overdueFollowUp) params.set('overdueFollowUp', '1')
  if (filters.stuck) params.set('stuck', '1')
  const lastShipmentYear = String(filters.lastShipmentYear || '').trim()
  if (lastShipmentYear) params.set('lastShipmentYear', lastShipmentYear)
  const lastShipmentMonth = lastShipmentMonthValues(filters).join(',')
  if (lastShipmentYear && lastShipmentMonth) params.set('lastShipmentMonth', lastShipmentMonth)
  for (const token of lastShipmentPeriodTokens(filters)) {
    if (token.includes('-')) params.append('lastShipmentPeriod', token)
  }
  for (const id of collectStatusFilterIds(filters)) {
    params.append('statusId', id)
  }
  const notesMode = normalizeNotesPresence(filters)
  if (notesMode) params.set('notesPresence', notesMode)
  const pipelineTrack = String(filters.pipelineTrack || '').trim()
  if (pipelineTrack) params.set('pipelineTrack', pipelineTrack)
  for (const name of filters.erpTagNames || filters.erpTags || []) {
    if (name) params.append('erpTag', String(name))
  }
  if (filters.erpTagMode && filters.erpTagMode !== 'any') params.set('erpTagMode', String(filters.erpTagMode))
  for (const id of collectCrmStageFilterIds(filters)) {
    params.append('crmStage', id)
  }
  return params
}
