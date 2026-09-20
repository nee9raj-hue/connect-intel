import { normalizeFreightDealStage } from './freightDeal.js'
import { dealDatesForRangeFilter } from './dealMilestones.js'
import {
  DEFAULT_TIME_ZONE,
  formatLocalDateLabel,
  isoWeeksOverlappingMonth,
  localDateKey,
  nextLocalDayMs,
  resolveTimeZone,
  startOfLocalDayMs,
  startOfLocalDayMsForKey,
} from './calendarLocale.js'

export const DEAL_TRANSPORT_FILTERS = [
  { id: 'all', label: 'All modes' },
  { id: 'air', label: 'Air' },
  { id: 'ocean', label: 'Ocean' },
]

export const DEAL_MONTH_OPTIONS = [
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
]

function padMonth(n) {
  return String(n).padStart(2, '0')
}

export function dealYearsFromRows(rows, timeZone = DEFAULT_TIME_ZONE) {
  const tz = resolveTimeZone({}, timeZone)
  const years = new Set()
  for (const row of rows || []) {
    const deal = row?.deal || row
    const dates = dealDatesForRangeFilter(deal, [])
    const keys = dates.length
      ? dates
      : [dealFilterDateInputValue(deal?.updatedAt || deal?.createdAt, tz)].filter(Boolean)
    for (const key of keys) {
      const y = Number(String(key).slice(0, 4))
      if (y >= 2000 && y <= 2100) years.add(y)
    }
  }
  return [...years]
}

export function dealYearOptions(now = new Date(), extraYears = [], timeZone = DEFAULT_TIME_ZONE) {
  const tz = resolveTimeZone({}, timeZone)
  const current = Number(localDateKey(now, tz)?.slice(0, 4)) || new Date().getFullYear()
  const years = new Set()
  for (let y = current - 8; y <= current; y += 1) years.add(y)
  for (const y of extraYears) {
    const n = Number(y)
    if (n >= 2000 && n <= 2100) years.add(n)
  }
  return [...years]
    .sort((a, b) => b - a)
    .map((y) => ({ value: String(y), label: String(y) }))
}

export function normalizeDealPeriodMonths({ month, months } = {}) {
  const raw = Array.isArray(months) && months.length ? months : month != null && month !== '' ? [month] : []
  return [
    ...new Set(
      raw
        .flatMap((value) => String(value || '').split(','))
        .map((value) => Number(String(value).trim()))
        .filter((n) => Number.isInteger(n) && n >= 1 && n <= 12)
    ),
  ].sort((a, b) => a - b)
}

function monthWindow(y, m, tz) {
  const start = startOfLocalDayMsForKey(tz, `${y}-${padMonth(m)}-01`)
  const nextKey = m === 12 ? `${y + 1}-01-01` : `${y}-${padMonth(m + 1)}-01`
  return { start, end: startOfLocalDayMsForKey(tz, nextKey) }
}

/** Exclusive-end windows for Year → Month → Week Number. Multiple months/weeks stay disjoint. */
export function dealPeriodWindows({ year, month, months, weeks } = {}, timeZone = DEFAULT_TIME_ZONE) {
  const tz = resolveTimeZone({}, timeZone)
  const y = Number(year)
  if (!y) return []
  const monthNums = normalizeDealPeriodMonths({ month, months })
  const weekIds = (weeks || []).map(String).filter(Boolean)
  if (!monthNums.length) {
    return [
      {
        start: startOfLocalDayMsForKey(tz, `${y}-01-01`),
        end: startOfLocalDayMsForKey(tz, `${y + 1}-01-01`),
      },
    ]
  }
  if (weekIds.length && monthNums.length === 1) {
    const m = monthNums[0]
    return isoWeeksOverlappingMonth(y, m, tz)
      .filter((w) => weekIds.includes(String(w.week)))
      .map((w) => ({ start: w.startMs, end: w.endMs }))
  }
  return monthNums.map((m) => monthWindow(y, m, tz))
}

export function formatDealPeriodLabel({ year, month, months, weeks } = {}) {
  const y = String(year || '').trim()
  if (!y) return ''
  const monthNums = normalizeDealPeriodMonths({ month, months })
  const monthLabels = monthNums
    .map((n) => DEAL_MONTH_OPTIONS.find((opt) => opt.value === String(n))?.label)
    .filter(Boolean)
  const weekIds = (weeks || []).map(String).filter(Boolean)
  const weekLabel = weekIds.map((w) => `week${w}`).join(', ')
  if (!monthLabels.length) return y
  const monthPart = monthLabels.join(', ')
  if (!weekLabel || monthNums.length > 1) return `${monthPart} ${y}`
  return `${monthPart} ${y} · ${weekLabel}`
}

export { isoWeeksOverlappingMonth }

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

function timestampInWindows(t, windows) {
  if (t == null || !Number.isFinite(t) || !windows?.length) return false
  return windows.some((w) => {
    if (w.start != null && t < w.start) return false
    if (w.end != null && t >= w.end) return false
    return true
  })
}

export function dealRowInWindows(row, windows, timeZone = DEFAULT_TIME_ZONE, { dateStages = [] } = {}) {
  if (!windows?.length) return true
  const deal = row?.deal || row
  const customDates = dealDatesForRangeFilter(deal, dateStages)
  if (customDates.length) {
    return customDates.some((iso) => {
      const day = parseDealFilterDate(iso, timeZone)
      return day ? timestampInWindows(day.getTime(), windows) : false
    })
  }
  return timestampInWindows(dealRowActivityMs(row), windows)
}

export function dealRowInDateRange(row, fromDate, toDate, timeZone = DEFAULT_TIME_ZONE, { dateStages = [] } = {}) {
  if (!fromDate && !toDate) return true
  const { start, end } = localDateRangeMs(fromDate, toDate, timeZone)
  if (start == null && end == null) return true
  return dealRowInWindows(row, [{ start, end }], timeZone, { dateStages })
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
  {
    dateFrom = null,
    dateTo = null,
    year = null,
    month = null,
    weeks = [],
    transportMode = 'all',
    stages = [],
    dateStages = null,
    timeZone = DEFAULT_TIME_ZONE,
  } = {}
) {
  let out = rows || []
  const rangeStages = dateStages == null ? stages : dateStages
  if (year) {
    const periodWindows = dealPeriodWindows({ year, month, weeks }, timeZone)
    out = periodWindows.length
      ? out.filter((row) => dealRowInWindows(row, periodWindows, timeZone, { dateStages: rangeStages }))
      : []
  } else if (dateFrom || dateTo) {
    out = out.filter((row) => dealRowInDateRange(row, dateFrom, dateTo, timeZone, { dateStages: rangeStages }))
  }
  if (transportMode && transportMode !== 'all') {
    out = out.filter((row) => dealMatchesTransportMode(row.deal?.freight, transportMode))
  }
  const wanted = (stages || [])
    .map((s) => normalizeFreightDealStage(s))
    .filter(Boolean)
  if (wanted.length) {
    const set = new Set(wanted)
    out = out.filter((row) => set.has(normalizeFreightDealStage(row.deal?.stage)))
  }
  return out
}
