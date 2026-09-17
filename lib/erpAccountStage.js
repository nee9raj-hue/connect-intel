import { normalizeCrmLeadStatus } from './crmLeadStatuses.js'
import { lastOrderCreatedAtFromErp } from './leadLastOrder.js'

export const NEW_ACCOUNT_WINDOW_DAYS = 90
export const ACTIVE_TRADER_DAYS = 60
export const SALES_OPPORTUNITY_IDLE_DAYS = 30
export const CHURNED_IDLE_DAYS = 60
export const LOST_IDLE_YEARS = 2
export const NEGATIVE_BALANCE_YEARS = 1
const MS_DAY = 86_400_000

function parseMs(value) {
  if (!value) return null
  const ms = Date.parse(String(value))
  return Number.isFinite(ms) ? ms : null
}

function erpBlob(entryOrErp) {
  const entry = entryOrErp && typeof entryOrErp === 'object' ? entryOrErp : {}
  return entry.erp || entry.lead?.erp || (entry.revenue || entry.finance ? entry : null) || {}
}

/** True when this pipeline row came from ERP import / overlay / pulled finance facts. */
export function isErpImportedLead(entry) {
  const erp = erpBlob(entry)
  if (!erp || typeof erp !== 'object') return false
  const rev = erp.revenue || {}
  const fin = erp.finance || {}
  const own = erp.ownership || {}
  return Boolean(
    rev.lastShipmentDate ||
      rev.lastTransactedDate ||
      rev.firstShipmentAt ||
      rev.customerCreatedAt ||
      rev.onboardedAt ||
      (rev.shipmentCount != null && rev.shipmentCount !== '') ||
      lastOrderCreatedAtFromErp(erp) ||
      fin.pendingPayments != null ||
      fin.overdue != null ||
      fin.lastInvoiceDate ||
      fin.lastPaymentDate ||
      own.salesOwner ||
      own.accountOwner ||
      own.leadOwner
  )
}

export function hasErpTraded(entryOrErp) {
  const entry = entryOrErp && typeof entryOrErp === 'object' ? entryOrErp : {}
  const erp = erpBlob(entry)
  const rev = erp.revenue || {}
  if (Number(rev.shipmentCount) > 0) return true
  if (rev.lastShipmentDate || rev.lastTransactedDate) return true
  if (rev.firstShipmentAt) return true
  if (lastOrderCreatedAtFromErp(erp)) return true
  if (entry.crm?.lastOrderCreatedAt) return true
  return false
}

export function lastShipmentMsFromErp(entry, now = Date.now()) {
  const erp = erpBlob(entry)
  const rev = erp.revenue || {}
  const profile = entry?.tradingProfile || {}
  const candidates = [
    rev.lastShipmentDate,
    rev.lastTransactedDate,
    lastOrderCreatedAtFromErp(erp),
    profile.lastShipmentAt,
    entry?.crm?.lastOrderCreatedAt,
  ]
  let latest = null
  for (const value of candidates) {
    const ms = parseMs(value)
    if (ms == null || ms > now) continue
    if (latest == null || ms > latest) latest = ms
  }
  return latest
}

function shippedRegularly(entry, lastMs) {
  const erp = erpBlob(entry)
  const rev = erp.revenue || {}
  const count = Number(rev.shipmentCount)
  if (Number.isFinite(count) && count >= 2) return true
  const firstMs = parseMs(rev.firstShipmentAt)
  if (firstMs != null && lastMs != null && lastMs - firstMs >= 30 * MS_DAY) return true
  const shipments = entry?.tradingProfile?.shipments
  if (Array.isArray(shipments) && shipments.length >= 2) return true
  return false
}

function hasLongNegativeBalance(entry, now) {
  const fin = erpBlob(entry).finance || {}
  const pending = Number(fin.pendingPayments)
  const owes =
    (Number.isFinite(pending) && pending > 0) ||
    fin.overdue === true ||
    ['overdue', 'blocked'].includes(String(fin.invoiceStatus || '').toLowerCase())
  if (!owes) return false
  const since = parseMs(fin.lastPaymentDate) || parseMs(fin.lastInvoiceDate)
  if (since == null) return false
  return now - since >= NEGATIVE_BALANCE_YEARS * 365 * MS_DAY
}

export function isCrmStatusManuallySet(crm) {
  return Boolean(crm?.pipelineStatusManual)
}

export function markCrmStatusManual(crm, { at, userId } = {}) {
  const next = crm && typeof crm === 'object' ? { ...crm } : {}
  next.pipelineStatusManual = true
  next.pipelineStatusManualAt = at || new Date().toISOString()
  if (userId) next.pipelineStatusManualBy = userId
  return next
}

/**
 * ERP-only stage suggestion.
 * Priority: no shipment → new_account; lost (2y idle or 1y negative balance);
 * regular shipper idle 30–60d → opportunity; shipment in 60d → active_trading;
 * idle > 60d → churned.
 */
export function suggestCrmStatusFromErp(entry, now = Date.now()) {
  if (!isErpImportedLead(entry)) return null
  const lastMs = lastShipmentMsFromErp(entry, now)
  if (lastMs == null) return 'new_account'

  const idleDays = (now - lastMs) / MS_DAY
  if (idleDays >= LOST_IDLE_YEARS * 365) return 'lost'
  if (hasLongNegativeBalance(entry, now)) return 'lost'

  const regular = shippedRegularly(entry, lastMs)
  if (regular && idleDays >= SALES_OPPORTUNITY_IDLE_DAYS && idleDays < CHURNED_IDLE_DAYS) {
    return 'opportunity'
  }
  if (idleDays < ACTIVE_TRADER_DAYS) return 'active_trading'
  return 'churned'
}

export function applyErpAccountStage(entry, now = Date.now()) {
  if (!entry || typeof entry !== 'object') return entry
  if (!isErpImportedLead(entry)) return entry
  if (isCrmStatusManuallySet(entry.crm)) return entry

  const suggested = suggestCrmStatusFromErp(entry, now)
  if (!suggested) return entry
  const current = normalizeCrmLeadStatus(entry.crm?.status)
  if (current === suggested) return entry

  entry.crm = {
    ...(entry.crm && typeof entry.crm === 'object' ? entry.crm : {}),
    status: suggested,
    erpStageAppliedAt: new Date(now).toISOString(),
    erpStageApplied: suggested,
  }
  return entry
}
