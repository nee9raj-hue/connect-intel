import { erpFromXindusCustomerRow, matchKeysFromXindusRow } from './xindusCustomerErp.js'
import { normalizeLeadErp } from './leadErp.js'

function compactOverlay(overlay) {
  const prune = (obj) => {
    const out = {}
    for (const [key, value] of Object.entries(obj || {})) {
      if (value == null || value === '') continue
      if (Array.isArray(value) && !value.length) continue
      out[key] = value
    }
    return out
  }
  const ownership = overlay?.ownership || {}
  const packedOwners = {}
  for (const key of ['salesOwner', 'accountOwner', 'leadOwner']) {
    if (ownership[key]) packedOwners[key] = ownership[key]
  }
  return {
    revenue: prune(overlay?.revenue),
    finance: prune(overlay?.finance),
    ownership: packedOwners,
  }
}

const DEFAULT_INCREMENTAL_OVERLAP_MS = 2 * 60 * 60 * 1000

export function getXindusErpFeedConfig() {
  const explicit = String(process.env.XINDUS_ERP_CUSTOMERS_URL || '').trim()
  const base = String(process.env.XINDUS_ERP_API_BASE || '').replace(/\/$/, '')
  const path = String(process.env.XINDUS_ERP_CUSTOMERS_PATH || '/crm/customers').trim() || '/crm/customers'
  const url = explicit || (base ? `${base}${path.startsWith('/') ? path : `/${path}`}` : '')
  const token = String(process.env.XINDUS_ERP_API_TOKEN || process.env.XINDUS_ERP_API_KEY || '').trim()
  return { url, token, configured: Boolean(url) }
}

function ownerFromRow(row = {}) {
  return (
    row.sales_owner ||
    row.salesOwner ||
    (row.sales_owner_email || row.sales_owner_name
      ? {
          name: row.sales_owner_name,
          email: row.sales_owner_email,
          phone: row.sales_owner_phone,
          erp_staff_id: row.sales_owner_user_id,
        }
      : null)
  )
}

/** Flatten customer-service JSON onto aliases erpFromXindusCustomerRow already understands. */
export function flattenXindusApiCustomer(row = {}) {
  const owner = ownerFromRow(row)
  return {
    ...row,
    ID: row.xindus_customer_id || row.xindusCustomerId || row.id,
    xindus_customer_id: row.xindus_customer_id || row.xindusCustomerId || row.id,
    Company: row.company_legal_name || row.companyLegalName || row.company || row.Company,
    Email: row.email || row.Email,
    Phone: row.phone || row.Phone,
    Gstn: row.gstin || row.gstn || row.Gstn,
    Pan: row.pan,
    'Crn Number': row.crn,
    Iec: row.iec,
    'Crm ID': row.crm_id || row.crmId,
    'Last shipment at': row.last_shipment_at || row.lastShipmentAt,
    'First shipment at': row.first_shipment_at || row.firstShipmentAt,
    'Shipment count': row.shipment_count ?? row.shipment_count_lifetime ?? row.shipmentCount,
    'Last invoice date': row.last_invoice_date || row.last_invoice_at || row.lastInvoiceDate,
    'Created On': row.customer_created_at || row.customerCreatedAt,
    'Sales Owner': owner,
    Overdues: row.overdue,
    'Should Block': row.should_block ?? row.shouldBlock,
    'Payment Method': row.payment_method || row.paymentMethod,
    'Credit Period': row.credit_period_days ?? row.credit_period ?? row.creditPeriod,
    'Credit Limit': row.credit_limit ?? row.creditLimit,
    'Pending Payment Limit': row.credit_limit ?? row.pending_payment_limit,
    'Bank Account Masked': row.bank_account_masked || row.bankAccountMasked,
    'Bank Name': row.bank_name || row.bankName,
    Channel: row.channel,
    'Business Type': row.business_type || row.businessType,
    Tags: row.tags,
    Currency: row.currency,
  }
}

/** Revenue / weight stay on Control Tower — never stamp them from this feed. */
export function stripControlTowerMetrics(overlay) {
  if (!overlay || typeof overlay !== 'object') return overlay
  const revenue = { ...(overlay.revenue || {}) }
  delete revenue.revenue
  delete revenue.periods
  delete revenue.totalSavings
  delete revenue.dailyAverageLoadMoq
  delete revenue.volumeFirst7Days
  delete revenue.volume7To15Days
  delete revenue.volume15To30Days
  delete revenue.avgShipmentValue
  delete revenue.avgShipmentChargeableWeightKg
  delete revenue.chargeableWeightKg
  delete revenue.monthlyAvgRevenue3m
  return { ...overlay, revenue }
}

export function overlayFromXindusApiCustomer(row = {}) {
  const flat = flattenXindusApiCustomer(row)
  const mapped = erpFromXindusCustomerRow(flat)
  if (!mapped) return null
  const erp = compactOverlay(normalizeLeadErp(stripControlTowerMetrics(mapped)))
  const keys = matchKeysFromXindusRow(flat)
  const company = String(flat.Company || flat.company || '').trim()
  return {
    xindusId: String(keys.xindusId || '').replace(/\.0$/, ''),
    crmId: keys.crmId,
    phone: keys.phone,
    email: keys.email,
    company,
    gst: keys.gst,
    pan: keys.pan,
    crn: keys.crn,
    iec: keys.iec,
    erp,
  }
}

export function overlaysFromXindusApiCustomers(rows = []) {
  const overlays = []
  for (const row of rows) {
    const overlay = overlayFromXindusApiCustomer(row)
    if (overlay) overlays.push(overlay)
  }
  return overlays
}

function extractCustomerRows(payload) {
  if (Array.isArray(payload)) return { rows: payload, nextCursor: null, nextPage: null }
  if (!payload || typeof payload !== 'object') return { rows: [], nextCursor: null, nextPage: null }
  const rows =
    payload.customers || payload.data || payload.results || payload.items || payload.records || []
  const nextCursor = payload.next_cursor || payload.nextCursor || payload.cursor || payload.next || null
  const nextPage =
    payload.next_page != null
      ? Number(payload.next_page)
      : payload.has_more === false
        ? null
        : null
  return { rows: Array.isArray(rows) ? rows : [], nextCursor: nextCursor || null, nextPage }
}

async function fetchJson(url, token) {
  const headers = { Accept: 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(45_000) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error || data.message || `ERP customer feed HTTP ${res.status}`)
  }
  return data
}

export function defaultIncrementalSince(now = Date.now()) {
  return new Date(now - DEFAULT_INCREMENTAL_OVERLAP_MS).toISOString()
}

/**
 * Pull customer-service rows. `mode=full` omits updated_since; incremental uses ISO `updatedSince`.
 */
export async function fetchXindusErpCustomers({
  mode = 'incremental',
  updatedSince = null,
  pageSize = 500,
  maxPages = 40,
} = {}) {
  const { url, token, configured } = getXindusErpFeedConfig()
  if (!configured) {
    throw new Error('XINDUS_ERP_CUSTOMERS_URL or XINDUS_ERP_API_BASE is not set')
  }
  const since =
    mode === 'full' ? null : updatedSince || defaultIncrementalSince()
  const rows = []
  let cursor = null
  let page = 1
  for (let i = 0; i < maxPages; i += 1) {
    const target = new URL(url)
    if (since) target.searchParams.set('updated_since', since)
    target.searchParams.set('limit', String(pageSize))
    if (cursor) target.searchParams.set('cursor', String(cursor))
    else target.searchParams.set('page', String(page))
    const payload = await fetchJson(target.toString(), token)
    const extracted = extractCustomerRows(payload)
    rows.push(...extracted.rows)
    if (extracted.nextCursor) {
      cursor = extracted.nextCursor
      continue
    }
    cursor = null
    if (extracted.rows.length !== pageSize) break
    page += 1
  }
  return { rows, updatedSince: since, mode }
}
