import {
  DEFAULT_TIME_ZONE,
  formatLocalDateLabel,
  resolveTimeZone,
  startOfLocalDayMs,
  startOfLocalWeekMs,
} from './calendarLocale.js'

const MS_DAY = 86400000

export const DEAL_TRANSPORT_FILTERS = [
  { id: 'all', label: 'All modes' },
  { id: 'air', label: 'Air' },
  { id: 'ocean', label: 'Ocean' },
]

/** Monday 00:00 through Sunday end for the week containing `anchorDate`. */
export function localWeekRangeMs(anchorDate, timeZone = DEFAULT_TIME_ZONE) {
  const tz = resolveTimeZone({}, timeZone)
  const anchor = anchorDate instanceof Date ? anchorDate : new Date(anchorDate)
  const start = startOfLocalWeekMs(tz, anchor)
  const end = startOfLocalWeekMs(tz, new Date(start + 8 * MS_DAY))
  return { start, end, timeZone: tz }
}

export function formatLocalWeekRangeLabel(anchorDate, timeZone = DEFAULT_TIME_ZONE) {
  if (!anchorDate) return ''
  const { start, end, timeZone: tz } = localWeekRangeMs(anchorDate, timeZone)
  const lastDay = end - 1
  const startLabel = formatLocalDateLabel(new Date(start), tz, { weekday: true })
  const endLabel = formatLocalDateLabel(new Date(lastDay), tz, { weekday: true })
  const year = new Intl.DateTimeFormat('en-IN', { timeZone: tz, year: 'numeric' }).format(new Date(start))
  return `${startLabel} – ${endLabel} ${year}`
}

export function dealRowActivityMs(row) {
  const deal = row?.deal || row
  const at = deal?.updatedAt || deal?.createdAt
  if (!at) return null
  const t = new Date(at).getTime()
  return Number.isFinite(t) ? t : null
}

export function dealRowInWeek(row, weekAnchorDate, timeZone = DEFAULT_TIME_ZONE) {
  if (!weekAnchorDate) return true
  const t = dealRowActivityMs(row)
  if (t == null) return false
  const { start, end } = localWeekRangeMs(weekAnchorDate, timeZone)
  return t >= start && t < end
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
  { weekAnchorDate = null, transportMode = 'all', timeZone = DEFAULT_TIME_ZONE } = {}
) {
  let out = rows || []
  if (weekAnchorDate) {
    out = out.filter((row) => dealRowInWeek(row, weekAnchorDate, timeZone))
  }
  if (transportMode && transportMode !== 'all') {
    out = out.filter((row) => dealMatchesTransportMode(row.deal?.freight, transportMode))
  }
  return out
}

/** `YYYY-MM-DD` for date input defaulting to the Monday of the week containing `anchor`. */
export function weekAnchorInputValue(anchorDate, timeZone = DEFAULT_TIME_ZONE) {
  if (!anchorDate) return ''
  const { start, timeZone: tz } = localWeekRangeMs(anchorDate, timeZone)
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(start))
}

export function parseWeekAnchorFromInput(dateKey, timeZone = DEFAULT_TIME_ZONE) {
  const raw = String(dateKey || '').trim()
  if (!raw) return null
  const tz = resolveTimeZone({}, timeZone)
  const [y, m, d] = raw.split('-').map(Number)
  if (!y || !m || !d) return null
  const noon = startOfLocalDayMs(tz, new Date(Date.UTC(y, m - 1, d, 12, 0, 0)))
  return new Date(noon)
}
