/** Date-only YYYY-MM-DD so PostgREST string compare does not break Sep vs Oct ISO timestamps. */
export function isoToDateOnly(iso) {
  const raw = String(iso || '').trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10)
  return ''
}

function andRange(path, start, end) {
  const enc = encodeURIComponent
  return `and(${path}.gte.${enc(start)},${path}.lt.${enc(end)})`
}

/**
 * Load pipeline rows whose last order / shipment falls in [sinceIso, untilIso).
 * Includes CRM ISO timestamps and ERP date-only shipment fields.
 */
export function pipelineLastOrderPeriodOr(sinceIso, untilIso) {
  if (!sinceIso || !untilIso) return null
  const sinceD = isoToDateOnly(sinceIso)
  const untilD = isoToDateOnly(untilIso)
  if (!sinceD || !untilD) return null
  const parts = [
    andRange('entry->crm->>lastOrderCreatedAt', sinceIso, untilIso),
    andRange('entry->crm_payload->>lastOrderCreatedAt', sinceIso, untilIso),
    andRange('entry->erp->revenue->>lastShipmentDate', sinceD, untilD),
    andRange('entry->erp->revenue->>lastTransactedDate', sinceD, untilD),
    andRange('entry->erp->revenue->>firstShipmentAt', sinceD, untilD),
  ]
  return `or=(${parts.join(',')})`
}

/** Onboarding / first shipment / customer-created in [sinceIso, untilIso). */
export function pipelineOnboardedPeriodOr(sinceIso, untilIso) {
  if (!sinceIso || !untilIso) return null
  const sinceD = isoToDateOnly(sinceIso)
  const untilD = isoToDateOnly(untilIso)
  if (!sinceD || !untilD) return null
  const parts = [
    andRange('entry->erp->revenue->>onboardedAt', sinceD, untilD),
    andRange('entry->erp->revenue->>firstShipmentAt', sinceD, untilD),
    andRange('entry->erp->revenue->>customerCreatedAt', sinceD, untilD),
  ]
  return `or=(${parts.join(',')})`
}
