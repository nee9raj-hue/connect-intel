/** ERP overlay on a CRM lead — filled by import later; UI reads this shape today. */

function numOrNull(value) {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function textOrNull(value) {
  const s = String(value || '').trim()
  return s || null
}

function normalizePeriod(raw) {
  if (!raw || typeof raw !== 'object') return null
  const year = numOrNull(raw.year)
  const month = numOrNull(raw.month)
  const week = numOrNull(raw.week)
  return {
    year,
    month,
    week,
    revenue: numOrNull(raw.revenue),
    shipmentCount: numOrNull(raw.shipmentCount ?? raw.shipments),
  }
}

export function emptyErpRevenue() {
  return {
    revenue: null,
    shipmentCount: null,
    lastShipmentDate: null,
    currency: 'INR',
    periods: [],
  }
}

export function emptyErpFinance() {
  return {
    invoiceStatus: null,
    lastPaymentDate: null,
    lastPaymentAmount: null,
    pendingPayments: null,
    currency: 'INR',
    ledger: [],
  }
}

export function normalizeErpRevenue(raw) {
  const src = raw && typeof raw === 'object' ? raw : {}
  const periods = Array.isArray(src.periods) ? src.periods.map(normalizePeriod).filter(Boolean) : []
  return {
    revenue: numOrNull(src.revenue),
    shipmentCount: numOrNull(src.shipmentCount ?? src.shipments ?? src.numberOfShipments),
    lastShipmentDate: textOrNull(src.lastShipmentDate ?? src.last_shipment_date),
    currency: textOrNull(src.currency) || 'INR',
    periods,
  }
}

function normalizeLedgerRow(raw) {
  if (!raw || typeof raw !== 'object') return null
  return {
    date: textOrNull(raw.date),
    description: textOrNull(raw.description) || '—',
    debit: numOrNull(raw.debit),
    credit: numOrNull(raw.credit),
    balance: numOrNull(raw.balance),
  }
}

export function normalizeErpFinance(raw) {
  const src = raw && typeof raw === 'object' ? raw : {}
  const ledger = Array.isArray(src.ledger) ? src.ledger.map(normalizeLedgerRow).filter(Boolean) : []
  return {
    invoiceStatus: textOrNull(src.invoiceStatus ?? src.invoice_status),
    lastPaymentDate: textOrNull(src.lastPaymentDate ?? src.last_payment_date ?? src.lastPayment),
    lastPaymentAmount: numOrNull(src.lastPaymentAmount ?? src.last_payment_amount),
    pendingPayments: numOrNull(src.pendingPayments ?? src.pending_payments),
    currency: textOrNull(src.currency) || 'INR',
    ledger,
  }
}

export function normalizeLeadErp(raw) {
  const src = raw && typeof raw === 'object' ? raw : {}
  return {
    revenue: normalizeErpRevenue(src.revenue),
    finance: normalizeErpFinance(src.finance),
  }
}

export function getLeadErp(leadOrEntry) {
  const entry = leadOrEntry && typeof leadOrEntry === 'object' ? leadOrEntry : {}
  const nested = entry.lead && typeof entry.lead === 'object' ? entry.lead : null
  return normalizeLeadErp(entry.erp || nested?.erp || null)
}

function definedNumbers(src) {
  const out = {}
  for (const [key, value] of Object.entries(src || {})) {
    if (value == null || value === '') continue
    out[key] = value
  }
  return out
}

export function mergeLeadErp(existing, incoming) {
  const prev = normalizeLeadErp(existing)
  const next = normalizeLeadErp(incoming)
  return {
    revenue: {
      ...prev.revenue,
      ...definedNumbers(next.revenue),
      periods: next.revenue.periods.length ? next.revenue.periods : prev.revenue.periods,
    },
    finance: {
      ...prev.finance,
      ...definedNumbers(next.finance),
      ledger: next.finance.ledger.length ? next.finance.ledger : prev.finance.ledger,
    },
  }
}

/** Flat ERP/import columns → lead.erp (empty cells ignored). */
export function erpFromImportRow(row = {}) {
  const revenue = {
    revenue: row.erp_revenue ?? row.revenue,
    shipmentCount: row.erp_shipment_count ?? row.shipment_count ?? row.shipments,
    lastShipmentDate: row.erp_last_shipment_date ?? row.last_shipment_date,
    currency: row.erp_currency ?? row.currency,
  }
  const finance = {
    invoiceStatus: row.erp_invoice_status ?? row.invoice_status,
    lastPaymentDate: row.erp_last_payment_date ?? row.last_payment_date ?? row.last_payment,
    lastPaymentAmount: row.erp_last_payment_amount ?? row.last_payment_amount,
    pendingPayments: row.erp_pending_payments ?? row.pending_payments,
    currency: row.erp_currency ?? row.currency,
  }
  const hasRevenue = [revenue.revenue, revenue.shipmentCount, revenue.lastShipmentDate].some(
    (v) => v != null && String(v).trim() !== ''
  )
  const hasFinance = [finance.invoiceStatus, finance.lastPaymentDate, finance.lastPaymentAmount, finance.pendingPayments].some(
    (v) => v != null && String(v).trim() !== ''
  )
  if (!hasRevenue && !hasFinance && !row.erp) return null
  return mergeLeadErp(row.erp || null, { revenue: hasRevenue ? revenue : {}, finance: hasFinance ? finance : {} })
}

export function filterErpRevenuePeriods(periods, { years = [], months = [], weeks = [] } = {}) {
  const y = (years || []).map(String).filter(Boolean)
  const m = (months || []).map(String).filter(Boolean)
  const w = (weeks || []).map(String).filter(Boolean)
  return (periods || []).filter((p) => {
    if (y.length && !y.includes(String(p.year))) return false
    if (m.length && !m.includes(String(p.month))) return false
    if (w.length && !w.includes(String(p.week))) return false
    return true
  })
}

export function sumErpPeriodMetrics(periods) {
  let revenue = 0
  let shipmentCount = 0
  for (const p of periods || []) {
    revenue += Number(p.revenue) || 0
    shipmentCount += Number(p.shipmentCount) || 0
  }
  return { revenue, shipmentCount }
}
