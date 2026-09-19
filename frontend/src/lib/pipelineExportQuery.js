/** Build query string for GET /api/reports/pipeline-export from pipeline server filters. */
export function buildPipelineExportQuery(serverFilters = {}, { reportId } = {}) {
  const params = new URLSearchParams()
  const status = String(serverFilters.status || '').trim()
  if (status && status !== 'all') params.set('status', status)
  const q = String(serverFilters.q || serverFilters.search || '').trim()
  if (q) params.set('q', q)
  for (const city of serverFilters.cities || []) {
    if (city) params.append('city', city)
  }
  for (const state of serverFilters.states || []) {
    if (state) params.append('state', state)
  }
  if (serverFilters.assigneeUserId) params.set('assigneeUserId', serverFilters.assigneeUserId)
  if (serverFilters.teamId) params.set('teamId', serverFilters.teamId)
  const tagIds = serverFilters.tagIds || []
  if (tagIds.length) params.set('tags', tagIds.join(','))
  if (serverFilters.tagMode && serverFilters.tagMode !== 'any') {
    params.set('tagMode', serverFilters.tagMode)
  }
  if (serverFilters.minLeadScore != null && serverFilters.minLeadScore !== '') {
    params.set('minLeadScore', String(serverFilters.minLeadScore))
  }
  if (serverFilters.maxLeadScore != null && serverFilters.maxLeadScore !== '') {
    params.set('maxLeadScore', String(serverFilters.maxLeadScore))
  }
  if (serverFilters.followUpDue) params.set('followUpDue', '1')
  if (serverFilters.overdueFollowUp) params.set('overdueFollowUp', '1')
  if (serverFilters.stuck) params.set('stuck', '1')
  if (reportId) params.set('reportId', reportId)
  return params
}

export function triggerCsvDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
