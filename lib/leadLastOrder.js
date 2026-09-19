import { resolveTimeZone, DEFAULT_TIME_ZONE } from './calendarLocale.js'
import { normalizeErpTags, readErpTagsFromLead } from './erpTags.js'

export function toIsoTimestamp(value) {
  if (value == null || value === '') return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString()
  const raw = String(value).trim()
  if (!raw) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const d = new Date(`${raw}T00:00:00.000Z`)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export function laterIsoTimestamp(a, b) {
  const left = toIsoTimestamp(a)
  const right = toIsoTimestamp(b)
  if (!left) return right
  if (!right) return left
  return left >= right ? left : right
}

/** Prefer last transacted / last shipment — invoice-only is not an order. */
export function lastOrderCreatedAtFromErp(erp) {
  const rev = erp?.revenue || {}
  return (
    laterIsoTimestamp(rev.lastTransactedDate, rev.lastShipmentDate) ||
    toIsoTimestamp(rev.firstShipmentAt)
  )
}

/** CRM payload first, then ERP last transacted / last shipment. */
export function resolveLeadLastOrderCreatedAt(lead) {
  if (!lead) return null
  return laterIsoTimestamp(
    lead.crm?.lastOrderCreatedAt,
    laterIsoTimestamp(
      lead.crm_payload?.lastOrderCreatedAt,
      laterIsoTimestamp(
        lastOrderCreatedAtFromErp(lead.erp || lead.lead?.erp),
        lead.tradingProfile?.lastShipmentAt ||
          lead.tradingProfile?.lastShipmentDate ||
          lead.lead?.tradingProfile?.lastShipmentAt ||
          lead.lead?.tradingProfile?.lastShipmentDate
      )
    )
  )
}

export function lastOrderRecencyLabel(iso, now = Date.now()) {
  const ts = toIsoTimestamp(iso)
  if (!ts) return 'No last order on file'
  const days = Math.floor((now - new Date(ts).getTime()) / 86_400_000)
  if (days < 0) return 'Last shipment / trade date'
  if (days === 0) return 'Shipped today'
  if (days === 1) return '1 day ago'
  if (days < 365) return `${days} days ago`
  return 'Last shipment / trade date'
}

export function formatLastShipmentMonthYear(iso, timeZone = DEFAULT_TIME_ZONE) {
  const ts = toIsoTimestamp(iso)
  if (!ts) return ''
  const tz = resolveTimeZone({}, timeZone)
  return new Intl.DateTimeFormat('en-IN', {
    month: 'long',
    year: 'numeric',
    timeZone: tz,
  }).format(new Date(ts))
}

export function stampLastOrderCreatedAt(entry, candidate) {
  if (!entry || typeof entry !== 'object') return entry
  const crm = entry.crm && typeof entry.crm === 'object' ? entry.crm : {}
  const next = laterIsoTimestamp(
    crm.lastOrderCreatedAt,
    laterIsoTimestamp(
      candidate,
      laterIsoTimestamp(
        lastOrderCreatedAtFromErp(entry.erp || entry.lead?.erp),
        entry.tradingProfile?.lastShipmentAt ||
          entry.tradingProfile?.lastShipmentDate ||
          entry.lead?.tradingProfile?.lastShipmentAt ||
          entry.lead?.tradingProfile?.lastShipmentDate
      )
    )
  )
  if (!next) return entry
  entry.crm = { ...crm, lastOrderCreatedAt: next }
  return entry
}

const CRM_PAYLOAD_OMIT = new Set([
  'deals',
  'activities',
  'tasks',
  'meetings',
  'emails',
  'notes',
  'status',
  'leadScore',
])

/** Merge lastOrderCreatedAt into crm_payload without dropping other keys. */
export function buildCrmPayload(entry) {
  const crm = entry?.crm && typeof entry.crm === 'object' ? entry.crm : {}
  const previous =
    entry?.crm_payload && typeof entry.crm_payload === 'object' ? { ...entry.crm_payload } : {}
  const fromCrm = {}
  for (const [key, value] of Object.entries(crm)) {
    if (CRM_PAYLOAD_OMIT.has(key) || value === undefined) continue
    fromCrm[key] = value
  }
  const deals = Array.isArray(crm.deals) ? crm.deals : []
  const lastOrderCreatedAt = laterIsoTimestamp(
    crm.lastOrderCreatedAt,
    laterIsoTimestamp(previous.lastOrderCreatedAt, lastOrderCreatedAtFromErp(entry?.erp || entry?.lead?.erp))
  )
  const erpTags = readErpTagsFromLead(entry)
  const erp_tags = erpTags.length
    ? erpTags
    : Array.isArray(previous.erp_tags)
      ? normalizeErpTags(previous.erp_tags)
      : undefined

  return {
    ...previous,
    ...fromCrm,
    tagIds: Array.isArray(crm.tagIds) ? crm.tagIds : previous.tagIds || [],
    nextFollowUpAt: crm.nextFollowUpAt ?? previous.nextFollowUpAt ?? null,
    dealCount: deals.length || Number(previous.dealCount) || 0,
    lastOrderCreatedAt: lastOrderCreatedAt || previous.lastOrderCreatedAt || null,
    ...(Array.isArray(erp_tags) ? { erp_tags } : {}),
  }
}
