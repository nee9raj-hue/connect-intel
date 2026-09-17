import { parseErpPerson } from './erpOwner.js'

function foldKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[→_\-./]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function foldedRow(row = {}) {
  const out = {}
  for (const [key, value] of Object.entries(row || {})) {
    const folded = foldKey(key)
    if (!folded) continue
    if (out[folded] == null || out[folded] === '') out[folded] = value
  }
  return out
}

function pick(row, aliases) {
  for (const alias of aliases) {
    const value = row[foldKey(alias)]
    if (value != null && String(value).trim() !== '') return value
  }
  return undefined
}

function num(value) {
  if (value == null || value === '') return null
  const n = Number(String(value).replace(/[,₹\s]/g, ''))
  return Number.isFinite(n) ? n : null
}

function text(value) {
  const s = String(value ?? '').trim()
  return s || null
}

function isoDate(value) {
  if (value == null || value === '') return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }
  const raw = String(value).trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10)
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}

function bool(value) {
  if (value === true || value === false) return value
  const s = String(value ?? '').trim().toLowerCase()
  if (['true', 'yes', '1', 'y'].includes(s)) return true
  if (['false', 'no', '0', 'n'].includes(s)) return false
  return null
}

function maskAccount(value) {
  const digits = String(value || '').replace(/\D/g, '')
  if (digits.length < 4) return null
  return `•••• ${digits.slice(-4)}`
}

function invoiceStatusFromRow({ overdue, shouldBlock, lastInvoiceDate }) {
  if (shouldBlock) return 'blocked'
  if (overdue) return 'overdue'
  if (lastInvoiceDate) return 'invoiced'
  return null
}

/** Map a Xindus customer Excel / import row onto a raw lead.erp overlay. */
export function erpFromXindusCustomerRow(row = {}) {
  const r = foldedRow(row)
  const lastTransacted = isoDate(
    pick(r, ['last transacted date', 'last_transacted_date', 'last shipment date', 'last_shipment_date'])
  )
  const lastInvoice = isoDate(pick(r, ['last invoice date', 'last_invoice_date']))
  const overdue = bool(pick(r, ['overdues', 'overdue']))
  const shouldBlock = bool(pick(r, ['should block', 'should_block']))
  const currency = text(pick(r, ['billing currency', 'currency', 'erp_currency'])) || 'INR'

  const revenue = {
    revenue: num(pick(r, ['erp revenue', 'erp_revenue', 'revenue', 'turnover'])),
    shipmentCount: num(pick(r, ['shipment count', 'shipment_count', 'shipments', 'erp_shipment_count'])),
    lastShipmentDate: lastTransacted,
    lastTransactedDate: lastTransacted,
    shipmentMethod: text(pick(r, ['shipment method', 'shipping method', 'ship method'])),
    shipType: text(pick(r, ['ship type', 'operation type'])),
    countries: text(pick(r, ['shipment info countries', 'countries'])),
    shipmentTypes: text(pick(r, ['shipment info shipmenttypes', 'shipment types'])),
    taxTypes: text(pick(r, ['shipment info taxtypes', 'tax types', 'tax type'])),
    incoTerm: text(pick(r, ['inco term', 'incoterm'])),
    totalSavings: num(pick(r, ['total savings', 'savings'])),
    dailyAverageLoadMoq: num(pick(r, ['daily average load moq'])),
    volumeFirst7Days: num(pick(r, ['daily average volume for the first 7 days'])),
    volume7To15Days: num(pick(r, ['daily average volume from 7 days to 15 days'])),
    volume15To30Days: num(pick(r, ['daily average volume from 15 days to 30 days'])),
    currency,
    xindusId: text(pick(r, ['id', 'xindus id', 'xindus_id'])),
    crn: text(pick(r, ['crn number', 'crn'])),
    firstShipmentAt: isoDate(
      pick(r, ['first shipment date', 'first_shipment_date', 'first shipment at', 'first_shipment_at'])
    ),
    customerCreatedAt: isoDate(
      pick(r, ['created on', 'date created', 'created at', 'customer since', 'onboarding date', 'onboarded at'])
    ),
  }
  revenue.onboardedAt = revenue.firstShipmentAt || revenue.customerCreatedAt

  const ownership = {
    salesOwner: parseErpPerson(pick(r, ['sales owner', 'sales_owner'])),
    accountOwner: parseErpPerson(pick(r, ['account owner', 'account_owner', 'account manager'])),
    leadOwner: parseErpPerson(pick(r, ['lead owner', 'lead_owner', 'assigned to', 'assigned_to'])),
  }

  const explicitInvoiceStatus = text(pick(r, ['invoice status', 'invoice_status', 'erp_invoice_status']))
  const finance = {
    lastInvoiceDate: lastInvoice,
    lastDutyInvoiceDate: isoDate(pick(r, ['last duty invoice date'])),
    overdue,
    shouldBlock,
    creditLimit: num(pick(r, ['pending payment limit', 'credit limit', 'pending_payment_limit'])),
    creditPeriod: text(pick(r, ['credit period'])),
    dutyCreditPeriod: text(pick(r, ['duty credit period'])),
    billingDays: text(pick(r, ['billing days'])),
    dutyBillingDays: text(pick(r, ['duty billing days'])),
    paymentMethod: text(pick(r, ['payment method'])),
    taxFilingMethod: text(pick(r, ['tax filing method'])),
    eInvoicing: bool(pick(r, ['e invoicing customer', 'e invoicing'])),
    bankName: text(pick(r, ['bank name'])),
    bankAccountMasked: maskAccount(pick(r, ['bank account number'])),
    ifsc: text(pick(r, ['ifsc'])),
    zohoBooksId: text(pick(r, ['zoho books id'])),
    lastPaymentDate: isoDate(pick(r, ['last payment date', 'last_payment_date', 'last payment'])),
    lastPaymentAmount: num(pick(r, ['last payment amount', 'last_payment_amount'])),
    pendingPayments: num(pick(r, ['pending payments', 'pending_payments', 'erp_pending_payments'])),
    invoiceStatus:
      explicitInvoiceStatus || invoiceStatusFromRow({ overdue, shouldBlock, lastInvoiceDate: lastInvoice }),
    currency,
  }

  const hasRevenue = Object.values(revenue).some((v) => v != null && v !== '')
  const hasFinance = Object.values(finance).some((v) => v != null && v !== '')
  const hasOwnership = Boolean(ownership.salesOwner || ownership.accountOwner || ownership.leadOwner)
  if (!hasRevenue && !hasFinance && !hasOwnership) return null
  return {
    revenue: hasRevenue ? revenue : {},
    finance: hasFinance ? finance : {},
    ownership: hasOwnership ? ownership : emptyOwnership(),
  }
}

function emptyOwnership() {
  return { salesOwner: null, accountOwner: null, leadOwner: null }
}

export function matchKeysFromXindusRow(row = {}) {
  const r = foldedRow(row)
  const phone = String(pick(r, ['phone', 'mobile']) || '').replace(/\D/g, '')
  const email = String(pick(r, ['email']) || '')
    .trim()
    .toLowerCase()
  const xindusId = String(pick(r, ['id', 'xindus id']) || '').replace(/\.0$/, '')
  return { phone, email, xindusId }
}

export function xindusIdFromLeadEntry(entry) {
  const blob = [
    entry?.lead?.remarks,
    entry?.lead?.notes,
    entry?.crm?.notes,
    entry?.erp?.revenue?.xindusId,
    entry?.lead?.erp?.revenue?.xindusId,
  ]
    .filter(Boolean)
    .join(' ')
  const match = blob.match(/xindusid\s*:?\s*([0-9]+(?:\.0)?)/i)
  if (match) return String(match[1]).replace(/\.0$/, '')
  return ''
}
