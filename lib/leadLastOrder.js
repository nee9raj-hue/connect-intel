/** Last order recency for CRM (`crm.lastOrderCreatedAt` / `crm_payload.lastOrderCreatedAt`). */

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
  return laterIsoTimestamp(rev.lastTransactedDate, rev.lastShipmentDate)
}

export function stampLastOrderCreatedAt(entry, candidate) {
  if (!entry || typeof entry !== 'object') return entry
  const crm = entry.crm && typeof entry.crm === 'object' ? entry.crm : {}
  const next = laterIsoTimestamp(
    crm.lastOrderCreatedAt,
    laterIsoTimestamp(candidate, lastOrderCreatedAtFromErp(entry.erp || entry.lead?.erp))
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
  return {
    ...previous,
    ...fromCrm,
    tagIds: Array.isArray(crm.tagIds) ? crm.tagIds : previous.tagIds || [],
    nextFollowUpAt: crm.nextFollowUpAt ?? previous.nextFollowUpAt ?? null,
    dealCount: deals.length || Number(previous.dealCount) || 0,
    lastOrderCreatedAt: lastOrderCreatedAt || previous.lastOrderCreatedAt || null,
  }
}
