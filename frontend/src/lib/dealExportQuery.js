/** Build query string for GET /api/reports/deals-export from deal server filters. */
export function buildDealExportQuery(serverFilters = {}, { reportId, timeZone } = {}) {
  const params = new URLSearchParams()
  const dealStage = String(serverFilters.dealStage || '').trim()
  if (dealStage && dealStage !== 'all') params.set('dealStage', dealStage)
  const q = String(serverFilters.q || serverFilters.search || '').trim()
  if (q) params.set('q', q)
  if (serverFilters.assigneeUserId) params.set('assigneeUserId', serverFilters.assigneeUserId)
  if (serverFilters.leadId) params.set('leadId', serverFilters.leadId)
  if (serverFilters.transportMode && serverFilters.transportMode !== 'all') {
    params.set('transportMode', serverFilters.transportMode)
  }
  if (serverFilters.dateFrom) params.set('dateFrom', serverFilters.dateFrom)
  if (serverFilters.dateTo) params.set('dateTo', serverFilters.dateTo)
  if (timeZone) params.set('timeZone', timeZone)
  if (reportId) params.set('reportId', reportId)
  return params
}
