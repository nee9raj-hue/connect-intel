import { normalizeCrmLeadStatus } from './crmLeadStatuses.js'
import { isCrmOriginPipelineLead } from './crmPipelineFlow.js'
import { lastOrderCreatedAtFromErp, resolveLeadLastOrderCreatedAt } from './leadLastOrder.js'
import { xindusIdFromLeadEntry } from './xindusCustomerErp.js'

export const NEW_ACCOUNT_HOLD_DAYS = 60
export const NEW_ACCOUNT_WINDOW_DAYS = NEW_ACCOUNT_HOLD_DAYS
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

function erpTagNames(entry) {
  const tags = erpBlob(entry).revenue?.tags
  if (!Array.isArray(tags)) return []
  return tags.map((tag) => String(tag?.tagName || tag?.name || tag || '').trim().toLowerCase()).filter(Boolean)
}

function erpTagsIndicateChurn(entry) {
  return erpTagNames(entry).some((name) => name === 'churn' || name === 'churned')
}

function erpBlob(entryOrErp) {
  const entry = entryOrErp && typeof entryOrErp === 'object' ? entryOrErp : {}
  return entry.erp || entry.lead?.erp || (entry.revenue || entry.finance ? entry : null) || {}
}

/** True when this pipeline row came from ERP import / overlay / pulled finance facts. */
export function isErpImportedLead(entry) {
  if (!entry || typeof entry !== 'object') return false
  if (xindusIdFromLeadEntry(entry)) return true
  if (entry.crm?.lastOrderCreatedAt) return true
  const profile = entry.tradingProfile || {}
  if (profile.lastShipmentAt || profile.lastShipmentDate) return true
  if (Array.isArray(profile.shipments) && profile.shipments.length) return true
  const source = String(entry.source || entry.importSource || entry.lead?.source || '')
  if (/erp|xindus|overlay|metabase|pulled/i.test(source)) return true

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

function shipmentDatesFromProfile(entry) {
  const profile = entry?.tradingProfile || entry?.lead?.tradingProfile || {}
  const rows = Array.isArray(profile.shipments) ? profile.shipments : []
  const dates = []
  for (const row of rows) {
    const ms = parseMs(row?.date || row?.shippedAt || row?.lastShipmentAt || row)
    if (ms != null) dates.push(ms)
  }
  return dates
}

export function firstShipmentMsFromErp(entry) {
  const erp = erpBlob(entry)
  const rev = erp.revenue || {}
  const profile = entry?.tradingProfile || entry?.lead?.tradingProfile || {}
  const candidates = [rev.firstShipmentAt, profile.firstShipmentAt]
  let earliest = null
  for (const value of candidates) {
    const ms = parseMs(value)
    if (ms == null) continue
    if (earliest == null || ms < earliest) earliest = ms
  }
  for (const ms of shipmentDatesFromProfile(entry)) {
    if (earliest == null || ms < earliest) earliest = ms
  }
  return earliest
}

export function lastShipmentMsFromErp(entry, now = Date.now()) {
  const erp = erpBlob(entry)
  const rev = erp.revenue || {}
  const profile = entry?.tradingProfile || entry?.lead?.tradingProfile || {}
  const candidates = [
    resolveLeadLastOrderCreatedAt(entry),
    rev.lastShipmentDate,
    rev.lastTransactedDate,
    lastOrderCreatedAtFromErp(erp),
    profile.lastShipmentAt,
    profile.lastShipmentDate,
    entry?.crm?.lastOrderCreatedAt,
    entry?.crm_payload?.lastOrderCreatedAt,
  ]
  let latest = null
  for (const value of candidates) {
    const ms = parseMs(value)
    if (ms == null || ms > now) continue
    if (latest == null || ms > latest) latest = ms
  }
  for (const ms of shipmentDatesFromProfile(entry)) {
    if (ms > now) continue
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
 * ERP-only stage suggestion. Never assigns Qualified / Unqualified (those are manual CRM leads).
 * New Account: first shipment, held at least 60 days, then last-shipment rules apply.
 * Sales Opportunity: regular shipper idle 30–60d. Active Trader: last shipment < 60d.
 * Churned: idle > 60d. Lost: idle 2y or negative balance > 1y.
 */
export function suggestCrmStatusFromErp(entry, now = Date.now()) {
  if (!isErpImportedLead(entry)) return null
  const firstMs = firstShipmentMsFromErp(entry)
  const lastMs = lastShipmentMsFromErp(entry, now)
  const traded = hasErpTraded(entry)
  if (!traded && lastMs == null && firstMs == null) {
    return erpTagsIndicateChurn(entry) ? 'churned' : null
  }

  const shipmentCount = Number(erpBlob(entry).revenue?.shipmentCount)
  const inNewAccountHold =
    (firstMs != null && (now - firstMs) / MS_DAY < NEW_ACCOUNT_HOLD_DAYS) ||
    (firstMs == null &&
      lastMs != null &&
      Number.isFinite(shipmentCount) &&
      shipmentCount <= 1 &&
      (now - lastMs) / MS_DAY < NEW_ACCOUNT_HOLD_DAYS)
  if (inNewAccountHold) return 'new_account'

  const effectiveLast = lastMs != null ? lastMs : firstMs
  if (effectiveLast == null) return null

  const idleDays = (now - effectiveLast) / MS_DAY
  if (idleDays >= LOST_IDLE_YEARS * 365) return 'lost'
  if (hasLongNegativeBalance(entry, now)) return 'lost'

  const regular = shippedRegularly(entry, effectiveLast)
  if (regular && idleDays >= SALES_OPPORTUNITY_IDLE_DAYS && idleDays < CHURNED_IDLE_DAYS) {
    return 'opportunity'
  }
  if (idleDays < ACTIVE_TRADER_DAYS) return 'active_trading'
  return 'churned'
}

const MANUAL_CRM_ONLY_STATUSES = new Set(['qualified', 'unqualified'])

function stampErpStage(entry, suggested, now) {
  entry.crm = {
    ...(entry.crm && typeof entry.crm === 'object' ? entry.crm : {}),
    status: suggested,
    erpStageAppliedAt: new Date(now).toISOString(),
    erpStageApplied: suggested,
  }
  return entry
}

export function applyErpAccountStage(entry, now = Date.now()) {
  if (!entry || typeof entry !== 'object') return entry
  if (!isErpImportedLead(entry)) return entry
  if (isCrmStatusManuallySet(entry.crm)) return entry
  if (isCrmOriginPipelineLead(entry)) return entry

  const suggested = suggestCrmStatusFromErp(entry, now)
  const current = normalizeCrmLeadStatus(entry.crm?.status)
  if (!suggested || MANUAL_CRM_ONLY_STATUSES.has(suggested)) {
    if (
      !suggested &&
      (current === 'new_account' || current === 'active_trading') &&
      lastShipmentMsFromErp(entry, now) == null &&
      firstShipmentMsFromErp(entry) == null
    ) {
      return stampErpStage(entry, 'onboarding', now)
    }
    return entry
  }
  if (current === suggested) return entry
  if (MANUAL_CRM_ONLY_STATUSES.has(current) && !hasErpTraded(entry) && lastShipmentMsFromErp(entry, now) == null) {
    return entry
  }

  return stampErpStage(entry, suggested, now)
}
