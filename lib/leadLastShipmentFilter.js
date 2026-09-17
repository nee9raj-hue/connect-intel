import { DEFAULT_TIME_ZONE } from './calendarLocale.js'
import { resolveLeadLastOrderCreatedAt } from './leadLastOrder.js'
import { dealPeriodWindows, formatDealPeriodLabel } from './pipelineDealsFilter.js'

export function lastShipmentYearValue(filters = {}) {
  const y = Number(filters.lastShipmentYear)
  return Number.isInteger(y) && y >= 2000 && y <= 2100 ? y : 0
}

export function lastShipmentMonthValue(filters = {}) {
  const m = Number(filters.lastShipmentMonth)
  return Number.isInteger(m) && m >= 1 && m <= 12 ? m : 0
}

export function lastShipmentFilterActive(filters = {}) {
  return lastShipmentYearValue(filters) > 0
}

export function lastShipmentPeriodWindows(filters = {}, timeZone = DEFAULT_TIME_ZONE) {
  const year = lastShipmentYearValue(filters)
  if (!year) return []
  const month = lastShipmentMonthValue(filters) || undefined
  return dealPeriodWindows({ year, month }, timeZone)
}

export function lastShipmentPeriodLabel(filters = {}) {
  const year = lastShipmentYearValue(filters)
  if (!year) return ''
  const month = lastShipmentMonthValue(filters) || ''
  const label = formatDealPeriodLabel({ year, month })
  return label ? `Last shipment: ${label}` : ''
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
  const windows = lastShipmentPeriodWindows(filters, timeZone)
  if (!windows.length) return parts || []
  const start = new Date(Math.min(...windows.map((w) => w.start))).toISOString()
  const end = new Date(Math.max(...windows.map((w) => w.end))).toISOString()
  const next = [...(parts || [])]
  next.push(`entry->crm->>lastOrderCreatedAt=gte.${encodeURIComponent(start)}`)
  next.push(`entry->crm->>lastOrderCreatedAt=lt.${encodeURIComponent(end)}`)
  return next
}
