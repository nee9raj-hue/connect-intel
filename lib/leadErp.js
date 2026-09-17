/** ERP overlay on a CRM lead — filled by import later; UI reads this shape today. */

import { erpFromXindusCustomerRow } from './xindusCustomerErp.js'
import { mergeErpOwnership, normalizeErpOwnership } from './erpOwner.js'

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
    lastTransactedDate: null,
    shipmentMethod: null,
    shipType: null,
    countries: null,
    shipmentTypes: null,
    taxTypes: null,
    incoTerm: null,
    totalSavings: null,
    dailyAverageLoadMoq: null,
    volumeFirst7Days: null,
    volume7To15Days: null,
    volume15To30Days: null,
    xindusId: null,
    crn: null,
    currency: 'INR',
    periods: [],
    firstShipmentAt: null,
    customerCreatedAt: null,
    onboardedAt: null,
  }
}

export function emptyErpFinance() {
  return {
    invoiceStatus: null,
    lastPaymentDate: null,
    lastPaymentAmount: null,
    pendingPayments: null,
    lastInvoiceDate: null,
    lastDutyInvoiceDate: null,
    overdue: null,
    shouldBlock: null,
    creditLimit: null,
    creditPeriod: null,
    dutyCreditPeriod: null,
    billingDays: null,
    dutyBillingDays: null,
    paymentMethod: null,
    taxFilingMethod: null,
    eInvoicing: null,
    bankName: null,
    bankAccountMasked: null,
    ifsc: null,
    zohoBooksId: null,
    currency: 'INR',
    ledger: [],
  }
}

export function normalizeErpRevenue(raw) {
  const src = raw && typeof raw === 'object' ? raw : {}
  const empty = emptyErpRevenue()
  const periods = Array.isArray(src.periods) ? src.periods.map(normalizePeriod).filter(Boolean) : []
  const lastShip = textOrNull(src.lastShipmentDate ?? src.last_shipment_date ?? src.lastTransactedDate)
  return {
    ...empty,
    revenue: numOrNull(src.revenue),
    shipmentCount: numOrNull(src.shipmentCount ?? src.shipments ?? src.numberOfShipments),
    lastShipmentDate: lastShip,
    lastTransactedDate: textOrNull(src.lastTransactedDate) || lastShip,
    shipmentMethod: textOrNull(src.shipmentMethod),
    shipType: textOrNull(src.shipType),
    countries: textOrNull(src.countries),
    shipmentTypes: textOrNull(src.shipmentTypes),
    taxTypes: textOrNull(src.taxTypes),
    incoTerm: textOrNull(src.incoTerm),
    totalSavings: numOrNull(src.totalSavings),
    dailyAverageLoadMoq: numOrNull(src.dailyAverageLoadMoq),
    volumeFirst7Days: numOrNull(src.volumeFirst7Days),
    volume7To15Days: numOrNull(src.volume7To15Days),
    volume15To30Days: numOrNull(src.volume15To30Days),
    xindusId: textOrNull(src.xindusId),
    crn: textOrNull(src.crn),
    currency: textOrNull(src.currency) || 'INR',
    periods,
    firstShipmentAt: textOrNull(src.firstShipmentAt),
    customerCreatedAt: textOrNull(src.customerCreatedAt),
    onboardedAt:
      textOrNull(src.onboardedAt) ||
      textOrNull(src.firstShipmentAt) ||
      textOrNull(src.customerCreatedAt),
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
  const empty = emptyErpFinance()
  const ledger = Array.isArray(src.ledger) ? src.ledger.map(normalizeLedgerRow).filter(Boolean) : []
  return {
    ...empty,
    invoiceStatus: textOrNull(src.invoiceStatus ?? src.invoice_status),
    lastPaymentDate: textOrNull(src.lastPaymentDate ?? src.last_payment_date ?? src.lastPayment),
    lastPaymentAmount: numOrNull(src.lastPaymentAmount ?? src.last_payment_amount),
    pendingPayments: numOrNull(src.pendingPayments ?? src.pending_payments),
    lastInvoiceDate: textOrNull(src.lastInvoiceDate),
    lastDutyInvoiceDate: textOrNull(src.lastDutyInvoiceDate),
    overdue: src.overdue === true || src.overdue === false ? src.overdue : null,
    shouldBlock: src.shouldBlock === true || src.shouldBlock === false ? src.shouldBlock : null,
    creditLimit: numOrNull(src.creditLimit),
    creditPeriod: textOrNull(src.creditPeriod),
    dutyCreditPeriod: textOrNull(src.dutyCreditPeriod),
    billingDays: textOrNull(src.billingDays),
    dutyBillingDays: textOrNull(src.dutyBillingDays),
    paymentMethod: textOrNull(src.paymentMethod),
    taxFilingMethod: textOrNull(src.taxFilingMethod),
    eInvoicing: src.eInvoicing === true || src.eInvoicing === false ? src.eInvoicing : null,
    bankName: textOrNull(src.bankName),
    bankAccountMasked: textOrNull(src.bankAccountMasked),
    ifsc: textOrNull(src.ifsc),
    zohoBooksId: textOrNull(src.zohoBooksId),
    currency: textOrNull(src.currency) || 'INR',
    ledger,
  }
}

export function normalizeLeadErp(raw) {
  const src = raw && typeof raw === 'object' ? raw : {}
  return {
    revenue: normalizeErpRevenue(src.revenue),
    finance: normalizeErpFinance(src.finance),
    ownership: normalizeErpOwnership(src.ownership),
  }
}

export function resolveLeadTradingProfile(leadOrEntry) {
  const entry = leadOrEntry && typeof leadOrEntry === 'object' ? leadOrEntry : {}
  const nested = entry.lead && typeof entry.lead === 'object' ? entry.lead : null
  return entry.tradingProfile || nested?.tradingProfile || null
}

export function getLeadErp(leadOrEntry) {
  const entry = leadOrEntry && typeof leadOrEntry === 'object' ? leadOrEntry : {}
  const nested = entry.lead && typeof entry.lead === 'object' ? entry.lead : null
  const deals = entry.crm?.deals || nested?.crm?.deals || []
  return buildErpFromFacts({
    stored: entry.erp || nested?.erp || null,
    trading: resolveLeadTradingProfile(entry),
    deals,
  })
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
    ownership: mergeErpOwnership(prev.ownership, next.ownership),
  }
}

/** Flat ERP/import columns → lead.erp (empty cells ignored). */
export function erpFromImportRow(row = {}) {
  const overlay = erpFromXindusCustomerRow(row)
  if (!overlay && !row.erp) return null
  return mergeLeadErp(row.erp || null, overlay || {})
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

export function hasLeadErpDisplayData(raw) {
  const erp = normalizeLeadErp(raw)
  const rev = erp.revenue
  const fin = erp.finance
  return Boolean(
    rev.revenue != null ||
      rev.shipmentCount != null ||
      rev.lastShipmentDate ||
      rev.lastTransactedDate ||
      rev.shipmentMethod ||
      rev.shipType ||
      rev.countries ||
      rev.totalSavings != null ||
      rev.periods.length ||
      fin.invoiceStatus ||
      fin.lastPaymentDate ||
      fin.lastPaymentAmount != null ||
      fin.pendingPayments != null ||
      fin.lastInvoiceDate ||
      fin.overdue != null ||
      fin.creditLimit != null ||
      fin.paymentMethod ||
      fin.ledger.length ||
      erp.ownership?.salesOwner ||
      erp.ownership?.accountOwner ||
      erp.ownership?.leadOwner ||
      rev.onboardedAt ||
      rev.customerCreatedAt ||
      rev.firstShipmentAt
  )
}

/** Collapse company names so ERP rows can match CRM leads. */
export function normalizeCompanyMatchKey(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(
      /\b(private|limited|pvt|ltd|llp|inc|llc|co|company|opc|india)\b/g,
      ' '
    )
    .replace(/\s+/g, ' ')
    .trim()
}

function isoDateOnly(value) {
  const raw = String(value || '').trim()
  if (!raw) return null
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10)
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

function periodFromIsoDate(iso) {
  const day = isoDateOnly(iso)
  if (!day) return null
  const [year, month] = day.split('-').map(Number)
  const utc = new Date(`${day}T12:00:00.000Z`)
  const target = new Date(utc)
  target.setUTCDate(target.getUTCDate() + 4 - (target.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((target - yearStart) / 86400000 + 1) / 7)
  return {
    year: Number.isFinite(year) ? year : target.getUTCFullYear(),
    month: Number.isFinite(month) ? month : utc.getUTCMonth() + 1,
    week,
  }
}

function addPeriod(map, iso, revenue, shipments = 1) {
  const parts = periodFromIsoDate(iso)
  if (!parts) return
  const key = `${parts.year}-${parts.month}-${parts.week}`
  const prev = map.get(key) || { ...parts, revenue: 0, shipmentCount: 0 }
  prev.revenue += Number(revenue) || 0
  prev.shipmentCount += Number(shipments) || 0
  map.set(key, prev)
}

function dealAmount(deal) {
  if (!deal || typeof deal !== 'object') return null
  const freight = deal.freight && typeof deal.freight === 'object' ? deal.freight : {}
  return numOrNull(deal.value ?? deal.amount ?? deal.dealValue ?? freight.invoiceAmount)
}

function dealStage(deal) {
  return String(deal?.stage || '').trim().toLowerCase()
}

function isWonDeal(stage) {
  return stage === 'won' || stage === 'booked'
}

function isOpenDeal(stage) {
  return stage && stage !== 'lost' && stage !== 'won' && stage !== 'booked'
}

/**
 * Build ERP overlay from stored import, trading profile, shipment rows, and CRM deals.
 * Stored non-empty fields win; operational sources fill the rest.
 */
export function buildErpFromFacts({ stored = null, trading = null, shipments = [], deals = [] } = {}) {
  const periodMap = new Map()
  const ledger = []
  let revenue = 0
  let shipmentCount = 0
  let lastShipmentDate = null

  for (const row of shipments || []) {
    const date = isoDateOnly(row?.date || row?.shipment_date)
    if (!date) continue
    const amount = numOrNull(row.amount ?? row.revenue ?? row.final_amount) || 0
    revenue += amount
    shipmentCount += 1
    if (!lastShipmentDate || date > lastShipmentDate) lastShipmentDate = date
    addPeriod(periodMap, date, amount, 1)
    ledger.push({
      date,
      description: textOrNull(row.description) || 'Shipment',
      credit: amount || null,
      debit: null,
      balance: null,
    })
  }

  const profile = trading && typeof trading === 'object' ? trading : null
  if (profile) {
    const profileCount = numOrNull(profile.shipmentCount)
    if (shipmentCount === 0 && profileCount != null) shipmentCount = profileCount
    const last = isoDateOnly(profile.lastShipmentAt || profile.lastShipmentDate)
    if (last && (!lastShipmentDate || last > lastShipmentDate)) lastShipmentDate = last
    const profileRevenue = numOrNull(profile.revenue)
    if (!revenue && profileRevenue != null) revenue = profileRevenue
    if (!(shipments || []).length && Array.isArray(profile.shipments)) {
      for (const s of profile.shipments) {
        const date = isoDateOnly(s?.date)
        if (!date) continue
        addPeriod(periodMap, date, 0, 1)
        if (!lastShipmentDate || date > lastShipmentDate) lastShipmentDate = date
      }
      if (!shipmentCount) shipmentCount = profile.shipments.filter((s) => isoDateOnly(s?.date)).length
    }
  }

  let pendingPayments = 0
  let lastPaymentDate = null
  let lastPaymentAmount = null
  for (const deal of deals || []) {
    const stage = dealStage(deal)
    const amount = dealAmount(deal)
    const when = isoDateOnly(deal.closedAt || deal.updatedAt || deal.createdAt)
    if (isWonDeal(stage) && amount != null) {
      if (!lastPaymentDate || (when && when >= lastPaymentDate)) {
        lastPaymentDate = when || lastPaymentDate
        lastPaymentAmount = amount
      }
      ledger.push({
        date: when,
        description: textOrNull(deal.name) || 'Payment',
        credit: amount,
        debit: null,
        balance: null,
      })
    } else if (isOpenDeal(stage) && amount != null) {
      pendingPayments += amount
      ledger.push({
        date: when,
        description: textOrNull(deal.name) || `Open deal (${stage})`,
        debit: amount,
        credit: null,
        balance: null,
      })
    }
  }

  let invoiceStatus = null
  if (pendingPayments > 0 && lastPaymentAmount != null) invoiceStatus = 'partial'
  else if (pendingPayments > 0) invoiceStatus = 'open'
  else if (lastPaymentAmount != null) invoiceStatus = 'paid'

  ledger.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))

  const operational = {
    revenue: {
      revenue: revenue > 0 ? revenue : null,
      shipmentCount: shipmentCount > 0 ? shipmentCount : null,
      lastShipmentDate,
      currency: 'INR',
      periods: [...periodMap.values()].sort((a, b) =>
        `${a.year}-${a.month}-${a.week}`.localeCompare(`${b.year}-${b.month}-${b.week}`)
      ),
    },
    finance: {
      invoiceStatus,
      lastPaymentDate,
      lastPaymentAmount,
      pendingPayments: pendingPayments || null,
      currency: 'INR',
      ledger: ledger.slice(0, 50),
    },
  }

  return mergeLeadErp(stored, operational)
}
