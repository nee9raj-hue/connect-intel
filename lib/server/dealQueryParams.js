import { parseDealFilterDate } from '../pipelineDealsFilter.js'

function parseWeekList(url) {
  const raw = [
    String(url.searchParams.get('weeks') || '').trim(),
    ...url.searchParams.getAll('week').map((v) => String(v || '').trim()),
  ]
    .join(',')
    .split(/[,\s]+/)
    .map((v) => v.replace(/^week/i, '').trim())
    .filter(Boolean)
  return [...new Set(raw)].slice(0, 12)
}

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
  const year = String(url.searchParams.get('year') || '').trim() || null
  const month = String(url.searchParams.get('month') || '').trim() || null
  const weeks = parseWeekList(url)

  return {
    dealStage,
    q,
    assigneeUserId,
    leadId,
    transportMode,
    timeZone,
    dateFrom,
    dateTo,
    year,
    month,
    weeks,
  }
}
