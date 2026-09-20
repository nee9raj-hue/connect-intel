import { DEFAULT_TIME_ZONE } from './calendarLocale.js'
import { resolveLeadLastOrderCreatedAt } from './leadLastOrder.js'
import { dealPeriodWindows, formatDealPeriodLabel, normalizeDealPeriodMonths } from './pipelineDealsFilter.js'

export function lastShipmentYearValue(filters = {}) {
  const y = Number(filters.lastShipmentYear)
  return Number.isInteger(y) && y >= 2000 && y <= 2100 ? y : 0
}

export function lastShipmentMonthValues(filters = {}) {
  return normalizeDealPeriodMonths({
    month: filters.lastShipmentMonth,
    months: filters.lastShipmentMonths,
  })
}

export function lastShipmentMonthValue(filters = {}) {
  const months = lastShipmentMonthValues(filters)
  return months.length === 1 ? months[0] : 0
}

export function lastShipmentPeriodTokens(filters = {}) {
  const fromList = Array.isArray(filters.lastShipmentPeriods) ? filters.lastShipmentPeriods : []
  const tokens = fromList
    .map((token) => String(token || '').trim())
    .filter((token) => /^\d{4}(-\d{1,2})?$/.test(token))
  if (tokens.length) return [...new Set(tokens)]
  const year = lastShipmentYearValue(filters)
  if (!year) return []
  const months = lastShipmentMonthValues(filters)
  if (!months.length) return [String(year)]
  return months.map((month) => `${year}-${month}`)
}

export function parseLastShipmentPeriodToken(token) {
  const raw = String(token || '').trim()
  const full = raw.match(/^(\d{4})-(\d{1,2})$/)
  if (full) {
    const year = Number(full[1])
    const month = Number(full[2])
    if (year >= 2000 && year <= 2100 && month >= 1 && month <= 12) return { year, month }
    return null
  }
  const yearOnly = raw.match(/^(\d{4})$/)
  if (!yearOnly) return null
  const year = Number(yearOnly[1])
  return year >= 2000 && year <= 2100 ? { year, month: 0 } : null
}

export function lastShipmentFilterActive(filters = {}) {
  return lastShipmentPeriodTokens(filters).length > 0
}

export function lastShipmentPeriodWindows(filters = {}, timeZone = DEFAULT_TIME_ZONE) {
  const tokens = lastShipmentPeriodTokens(filters)
  if (!tokens.length) return []
  return tokens.flatMap((token) => {
    const parsed = parseLastShipmentPeriodToken(token)
    if (!parsed) return []
    return dealPeriodWindows(
      parsed.month ? { year: parsed.year, month: parsed.month } : { year: parsed.year },
      timeZone
    )
  })
}

export function lastShipmentPeriodLabel(filters = {}) {
  const tokens = lastShipmentPeriodTokens(filters)
  if (!tokens.length) return ''
  const parsed = tokens.map(parseLastShipmentPeriodToken).filter(Boolean)
  if (!parsed.length) return ''
  const years = [...new Set(parsed.map((row) => row.year))]
  if (years.length === 1) {
    const months = parsed.map((row) => row.month).filter(Boolean)
    const label = formatDealPeriodLabel({
      year: years[0],
      months: months.length ? months : undefined,
    })
    return label ? `Last shipment: ${label}` : ''
  }
  if (parsed.length <= 2) {
    const bits = parsed.map((row) =>
      formatDealPeriodLabel({ year: row.year, month: row.month || '' })
    )
    return `Last shipment: ${bits.join('; ')}`
  }
  return `Last shipment: ${parsed.length} months`
}

function mergeAdjacentWindows(windows = []) {
  const sorted = [...windows].sort((a, b) => a.start - b.start)
  const out = []
  for (const window of sorted) {
    const last = out[out.length - 1]
    if (last && window.start <= last.end) {
      last.end = Math.max(last.end, window.end)
    } else {
      out.push({ start: window.start, end: window.end })
    }
  }
  return out
}

function lastOrderWindowPredicates(window) {
  const start = encodeURIComponent(new Date(window.start).toISOString())
  const end = encodeURIComponent(new Date(window.end).toISOString())
  return [
    `entry->crm->>lastOrderCreatedAt.gte.${start}`,
    `entry->crm->>lastOrderCreatedAt.lt.${end}`,
  ]
}

/** Inclusive start / exclusive end for last shipment (ERP last transacted / shipment). */
export function leadMatchesLastShipmentPeriod(lead, filters = {}, timeZone = DEFAULT_TIME_ZONE) {
  const windows = lastShipmentPeriodWindows(filters, timeZone)
  if (!windows.length) return true
  const iso = resolveLeadLastOrderCreatedAt(lead)
  if (!iso) return false
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return false
  return windows.some((w) => ms >= w.start && ms < w.end)
}

export function appendLastShipmentSqlParts(parts, filters = {}, timeZone = DEFAULT_TIME_ZONE) {
  const windows = mergeAdjacentWindows(lastShipmentPeriodWindows(filters, timeZone))
  if (!windows.length) return parts || []
  const next = [...(parts || [])]
  if (windows.length === 1) {
    const [gte, lt] = lastOrderWindowPredicates(windows[0])
    next.push(gte.replace('.gte.', '=gte.'))
    next.push(lt.replace('.lt.', '=lt.'))
    return next
  }
  next.push(`or=(${windows.map((w) => `and(${lastOrderWindowPredicates(w).join(',')})`).join(',')})`)
  return next
}
