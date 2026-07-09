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
  const teamId = String(url.searchParams.get('team_id') || url.searchParams.get('teamId') || '').trim() || null
  const sortBy = String(url.searchParams.get('sort_by') || '').trim() || null
  const sortDir = String(url.searchParams.get('sort_dir') || 'desc').trim()
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
    sortBy,
    sortDir,
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
  if (filters.teamId) params.set('teamId', filters.teamId)
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
  return params
}
