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

export function lastShipmentFilterActive(filters = {}) {
  return lastShipmentYearValue(filters) > 0
}

export function lastShipmentPeriodWindows(filters = {}, timeZone = DEFAULT_TIME_ZONE) {
  const year = lastShipmentYearValue(filters)
  if (!year) return []
  return dealPeriodWindows({ year, months: lastShipmentMonthValues(filters) }, timeZone)
}

export function lastShipmentPeriodLabel(filters = {}) {
  const year = lastShipmentYearValue(filters)
  if (!year) return ''
  const label = formatDealPeriodLabel({ year, months: lastShipmentMonthValues(filters) })
  return label ? `Last shipment: ${label}` : ''
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
