import { normalizeCrmLeadStatus } from './crmLeadStatuses.js'
import { lastOrderCreatedAtFromErp } from './leadLastOrder.js'

export const NEW_ACCOUNT_WINDOW_DAYS = 90
const MS_DAY = 86_400_000

function parseMs(value) {
  if (!value) return null
  const ms = Date.parse(String(value))
  return Number.isFinite(ms) ? ms : null
}

export function hasErpTraded(entryOrErp) {
  const entry = entryOrErp && typeof entryOrErp === 'object' ? entryOrErp : {}
  const erp = entry.erp || entry.lead?.erp || (entry.revenue ? entry : null) || {}
  const rev = erp.revenue || {}
  if (Number(rev.shipmentCount) > 0) return true
  if (rev.lastShipmentDate || rev.lastTransactedDate) return true
  if (rev.firstShipmentAt) return true
  if (lastOrderCreatedAtFromErp(erp)) return true
  if (entry.crm?.lastOrderCreatedAt) return true
  return false
}

const PROTECTED = new Set(['active_trading', 'at_risk', 'churned', 'lost'])

/**
 * Recently onboarded in ERP (Created On) with no shipments yet → new_account.
 * Does not demote active / at-risk / churned / lost accounts.
 */
export function suggestCrmStatusFromErp(entry, now = Date.now()) {
  if (hasErpTraded(entry)) return null
  const createdMs = parseMs(entry?.erp?.revenue?.customerCreatedAt || entry?.revenue?.customerCreatedAt)
  if (createdMs == null) return null
  if (createdMs > now) return null
  if (now - createdMs > NEW_ACCOUNT_WINDOW_DAYS * MS_DAY) return null
  return 'new_account'
}

export function applyErpAccountStage(entry, now = Date.now()) {
  if (!entry || typeof entry !== 'object') return entry
  const suggested = suggestCrmStatusFromErp(entry, now)
  if (suggested !== 'new_account') return entry
  const current = normalizeCrmLeadStatus(entry.crm?.status)
  if (PROTECTED.has(current)) return entry
  entry.crm = { ...(entry.crm && typeof entry.crm === 'object' ? entry.crm : {}), status: 'new_account' }
  return entry
}
