import {
  DEFAULT_TIME_ZONE,
  formatLocalDateLabel,
  nextLocalDayMs,
  resolveTimeZone,
  startOfLocalDayMs,
} from './calendarLocale.js'

export const DEAL_TRANSPORT_FILTERS = [
  { id: 'all', label: 'All modes' },
  { id: 'air', label: 'Air' },
  { id: 'ocean', label: 'Ocean' },
]

export function parseDealFilterDate(dateKey, timeZone = DEFAULT_TIME_ZONE) {
  const raw = String(dateKey || '').trim()
  if (!raw) return null
  const tz = resolveTimeZone({}, timeZone)
  const [y, m, d] = raw.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(startOfLocalDayMs(tz, new Date(Date.UTC(y, m - 1, d, 12, 0, 0))))
}

export function dealFilterDateInputValue(date, timeZone = DEFAULT_TIME_ZONE) {
  if (!date) return ''
  const tz = resolveTimeZone({}, timeZone)
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(d)
}

/** Inclusive local date range — `to` includes the full calendar day. */
export function localDateRangeMs(fromDate, toDate, timeZone = DEFAULT_TIME_ZONE) {
  const tz = resolveTimeZone({}, timeZone)
  if (!fromDate && !toDate) return { start: null, end: null, timeZone: tz }

  let from = fromDate ? parseDealFilterDate(dealFilterDateInputValue(fromDate, tz), tz) : null
  let to = toDate ? parseDealFilterDate(dealFilterDateInputValue(toDate, tz), tz) : null

  if (from && to && from.getTime() > to.getTime()) {
    const swap = from
    from = to
    to = swap
  }

  const start = from ? startOfLocalDayMs(tz, from) : null
  const end = to ? nextLocalDayMs(tz, startOfLocalDayMs(tz, to)) : null
  return { start, end, timeZone: tz }
}

export function formatLocalDateRangeLabel(fromDate, toDate, timeZone = DEFAULT_TIME_ZONE) {
  if (!fromDate && !toDate) return ''
  const tz = resolveTimeZone({}, timeZone)
  if (fromDate && toDate) {
    const fromLabel = formatLocalDateLabel(fromDate, tz, { weekday: false })
    const toLabel = formatLocalDateLabel(toDate, tz, { weekday: false })
    return `${fromLabel} – ${toLabel}`
  }
  if (fromDate) return `From ${formatLocalDateLabel(fromDate, tz, { weekday: false })}`
  return `Through ${formatLocalDateLabel(toDate, tz, { weekday: false })}`
}

export function dealRowActivityMs(row) {
  const deal = row?.deal || row
  const at = deal?.updatedAt || deal?.createdAt
  if (!at) return null
  const t = new Date(at).getTime()
  return Number.isFinite(t) ? t : null
}

export function dealRowInDateRange(row, fromDate, toDate, timeZone = DEFAULT_TIME_ZONE) {
  if (!fromDate && !toDate) return true
  const t = dealRowActivityMs(row)
  if (t == null) return false
  const { start, end } = localDateRangeMs(fromDate, toDate, timeZone)
  if (start != null && t < start) return false
  if (end != null && t >= end) return false
  return true
}

export function dealMatchesTransportMode(freight, mode) {
  const filter = String(mode || 'all').trim() || 'all'
  if (filter === 'all') return true
  const tm = String(freight?.transportMode || '').trim()
  if (!tm) return false
  if (filter === 'air') return tm === 'air' || tm === 'air_ocean'
  if (filter === 'ocean') return tm === 'ocean' || tm === 'air_ocean'
  return tm === filter
}

export function filterPipelineDealRows(
  rows,
  { dateFrom = null, dateTo = null, transportMode = 'all', timeZone = DEFAULT_TIME_ZONE } = {}
) {
  let out = rows || []
  if (dateFrom || dateTo) {
    out = out.filter((row) => dealRowInDateRange(row, dateFrom, dateTo, timeZone))
  }
  if (transportMode && transportMode !== 'all') {
    out = out.filter((row) => dealMatchesTransportMode(row.deal?.freight, transportMode))
  }
  return out
}
