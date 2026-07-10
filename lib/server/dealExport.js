import {
  formatFreightMeasure,
  getFreightCustomerTypeMeta,
  getFreightDealStageMeta,
} from '../freightDeal.js'
import { filterPipelineDealRows, parseDealFilterDate } from '../pipelineDealsFilter.js'
import { roleLimitsFor } from '../resourceProtection.js'
import { listCrmDeals } from './dealsApi.js'
import { policiesForUser } from './resourceProtectionEnforce.js'

export const DEFAULT_DEAL_EXPORT_COLUMNS = [
  'dealName',
  'leadName',
  'company',
  'stage',
  'amount',
  'currency',
  'customerType',
  'transportMode',
  'route',
  'grossWeight',
  'invoiceAmount',
  'leadId',
  'dealId',
  'expectedCloseDate',
  'updatedAt',
]

const COLUMN_HEADERS = {
  dealName: 'Deal',
  leadName: 'Lead',
  company: 'Company',
  stage: 'Stage',
  amount: 'Freight value',
  currency: 'Currency',
  customerType: 'Type',
  transportMode: 'Mode',
  route: 'Route / lanes',
  grossWeight: 'Gross',
  invoiceAmount: 'Invoice',
  leadId: 'Lead ID',
  dealId: 'Deal ID',
  expectedCloseDate: 'Expected close',
  updatedAt: 'Updated',
}

function escapeCsv(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

function transportModeLabel(mode) {
  if (mode === 'air') return 'Air'
  if (mode === 'ocean') return 'Ocean'
  if (mode === 'air_ocean') return 'Air + Ocean'
  return mode ? String(mode) : ''
}

function freightRouteLabel(freight) {
  if (!freight) return ''
  const from = [freight.pickupCity, freight.pickupZip].filter(Boolean).join(' ')
  const to = [freight.deliveryCity, freight.deliveryZip].filter(Boolean).join(' ')
  if (from || to) return `${from || '—'} → ${to || '—'}`
  const countries = freight.courier?.destinationCountries
  if (Array.isArray(countries) && countries.length) {
    const labels = {
      usa: 'USA',
      uk: 'UK',
      canada: 'Canada',
      australia: 'AU',
      uae: 'UAE',
      eu: 'EU',
      singapore: 'SG',
      other: 'Other',
    }
    return countries.map((id) => labels[id] || id).join(', ')
  }
  return ''
}

function formatDealAmount(value, currency = 'INR') {
  if (value == null || value === '') return ''
  const n = Number(value)
  if (!Number.isFinite(n)) return ''
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency || 'INR',
      maximumFractionDigits: 0,
    }).format(n)
  } catch {
    return String(n)
  }
}

function formatIsoDate(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

export function dealExportCell(row, column) {
  const deal = row?.deal || {}
  const freight = deal.freight
  switch (column) {
    case 'dealName':
      return deal.name || ''
    case 'leadName':
      return row.leadName || row.company || ''
    case 'company':
      return row.company || ''
    case 'stage':
      return getFreightDealStageMeta(deal.stage).label
    case 'amount':
      return deal.amount ?? ''
    case 'currency':
      return deal.currency || 'INR'
    case 'customerType':
      return getFreightCustomerTypeMeta(freight?.customerType).shortLabel
    case 'transportMode':
      return transportModeLabel(freight?.transportMode)
    case 'route':
      return freightRouteLabel(freight)
    case 'grossWeight':
      if (!freight || freight.grossWeightKg == null || freight.grossWeightKg === '') return ''
      return formatFreightMeasure(freight.grossWeightKg, freight.transportMode)
    case 'invoiceAmount':
      return freight?.invoiceAmount ?? ''
    case 'leadId':
      return row.leadId || ''
    case 'dealId':
      return deal.id || ''
    case 'expectedCloseDate':
      return formatIsoDate(deal.expectedCloseDate)
    case 'updatedAt':
      return formatIsoDate(deal.updatedAt || deal.createdAt)
    default:
      return ''
  }
}

export function dealsToCsv(rows, columns = DEFAULT_DEAL_EXPORT_COLUMNS) {
  const cols = columns?.length ? columns : DEFAULT_DEAL_EXPORT_COLUMNS
  const headers = cols.map((c) => COLUMN_HEADERS[c] || c)
  const lines = [
    headers.join(','),
    ...rows.map((row) => cols.map((col) => escapeCsv(dealExportCell(row, col))).join(',')),
  ]
  return lines.join('\n')
}

export function resolveExportMaxRows(user, store) {
  const policies = policiesForUser(store, user)
  return roleLimitsFor(user, policies).exportMax
}

/**
 * Load all deal rows matching filters for CSV export (paginated server-side).
 */
export async function loadAllDealsForExport(
  user,
  metaStore,
  filters,
  { maxRows = 10_000, pageSize = 500 } = {}
) {
  const cap = Math.max(1, Math.floor(Number(maxRows) || 10_000))
  const lim = Math.min(500, Math.max(50, Math.floor(Number(pageSize) || 500)))
  const all = []
  let offset = 0
  let total = null

  const baseFilters = {
    search: filters.q || '',
    dealStage: filters.dealStage || 'all',
    assigneeUserId: filters.assigneeUserId || null,
    leadId: filters.leadId || null,
  }

  while (all.length < cap) {
    const page = await listCrmDeals(user, metaStore, {
      ...baseFilters,
      offset,
      limit: lim,
    })
    const rows = page.deals || []
    if (total == null) total = page.total ?? rows.length
    if (!rows.length) break
    all.push(...rows)
    if (!page.hasMore || offset + rows.length >= (page.total ?? all.length)) break
    offset += rows.length
  }

  let deals = all.slice(0, cap)
  const dateFrom = normalizeDealDateFilter(filters.dateFrom, filters.timeZone)
  const dateTo = normalizeDealDateFilter(filters.dateTo, filters.timeZone)
  const hasClientFilters =
    dateFrom || dateTo || (filters.transportMode && filters.transportMode !== 'all')
  if (hasClientFilters) {
    deals = filterPipelineDealRows(deals, {
      dateFrom,
      dateTo,
      transportMode: filters.transportMode || 'all',
      timeZone: filters.timeZone,
    })
  }

  const exportTotal = hasClientFilters ? deals.length : (total ?? deals.length)
  return {
    deals,
    total: exportTotal,
    truncated: !hasClientFilters && (total ?? deals.length) > cap,
  }
}

function normalizeDealDateFilter(value, timeZone) {
  if (!value) return null
  if (value instanceof Date) return value
  return parseDealFilterDate(String(value), timeZone)
}
