import { parseDealFilterDate } from '../pipelineDealsFilter.js'

/** Parse GET query params for deal list / export. */
export function parseDealQueryParams(url) {
  const dealStage = String(url.searchParams.get('dealStage') || 'all').trim() || 'all'
  const q = String(url.searchParams.get('q') || url.searchParams.get('search') || '').trim()
  const assigneeUserId =
    String(url.searchParams.get('assigneeUserId') || url.searchParams.get('owner_id') || '').trim() ||
    null
  const leadId = String(url.searchParams.get('leadId') || '').trim() || null
  const transportMode = String(url.searchParams.get('transportMode') || 'all').trim() || 'all'
  const timeZone = String(url.searchParams.get('timeZone') || '').trim() || null

  const dateFromRaw = String(url.searchParams.get('dateFrom') || '').trim()
  const dateToRaw = String(url.searchParams.get('dateTo') || '').trim()
  const dateFrom = dateFromRaw ? parseDealFilterDate(dateFromRaw, timeZone) : null
  const dateTo = dateToRaw ? parseDealFilterDate(dateToRaw, timeZone) : null

  return {
    dealStage,
    q,
    assigneeUserId,
    leadId,
    transportMode,
    timeZone,
    dateFrom,
    dateTo,
  }
}
