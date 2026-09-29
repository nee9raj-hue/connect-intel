import { getLeadCityFromFields, getLeadStateFromFields } from '../pipelineLeadLocation.js'
import { readDisplayErpTagsFromLead } from '../erpTags.js'
import { estimatedFreightRevenueInr } from '../freightDeal.js'
import { FALLBACK_USD_INR } from '../usdInr.js'
import { dealExportCell } from './dealExport.js'
import { roleLimitsFor } from '../resourceProtection.js'
import { loadPipelineListPage } from './pipelineListLoad.js'
import { policiesForUser } from './resourceProtectionEnforce.js'

export const DEFAULT_PIPELINE_EXPORT_COLUMNS = [
  'name',
  'email',
  'phone',
  'company',
  'status',
  'city',
  'state',
  'title',
  'owner',
  'score',
]

const COLUMN_HEADERS = {
  name: 'Name',
  email: 'Email',
  phone: 'Phone',
  company: 'Company',
  status: 'Status',
  city: 'City',
  state: 'State',
  title: 'Title',
  owner: 'Owner',
  score: 'Score',
}

function escapeCsv(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

function leadDisplayName(lead) {
  const parts = [lead?.firstName, lead?.lastName].filter(Boolean)
  if (parts.length) return parts.join(' ')
  return String(lead?.name || lead?.company || lead?.email || '').trim()
}

function exportDate(value) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString().slice(0, 10)
}

function leadLastShipmentDate(lead) {
  return (
    lead?.erp?.revenue?.lastShipmentDate ||
    lead?.erp?.revenue?.lastTransactedDate ||
    lead?.tradingProfile?.lastShipmentAt ||
    lead?.tradeProfile?.lastShipmentAt ||
    ''
  )
}

function tagNames(lead, tagNamesById) {
  const crmTags = (lead?.crm?.tagIds || [])
    .map((id) => tagNamesById.get(String(id)))
    .filter(Boolean)
  const erpTags = readDisplayErpTagsFromLead(lead).map((tag) => tag.name).filter(Boolean)
  return [...new Set([...crmTags, ...erpTags])].join(', ')
}

/**
 * Workbook rows intentionally expose the same summary data people see in Pipeline,
 * plus complete deal rows, without returning raw CRM activity/email history.
 */
export function pipelineWorkbookRows(leads, { users = [], organization = null } = {}) {
  const userNamesById = new Map(
    (users || []).map((user) => [String(user.id), user.name || user.email || ''])
  )
  const tagNamesById = new Map(
    (organization?.leadTags || []).map((tag) => [String(tag.id), String(tag.name || '').trim()])
  )
  const leadRows = []
  const dealRows = []

  for (const lead of leads || []) {
    const name = leadDisplayName(lead)
    const owner =
      lead?.assignedToName ||
      lead?.crm?.assignedToName ||
      userNamesById.get(String(lead?.assignedToUserId || '')) ||
      lead?.savedByName ||
      ''
    const deals = Array.isArray(lead?.crm?.deals) ? lead.crm.deals : []

    leadRows.push({
      Name: name,
      Company: lead?.company || '',
      Phone: lead?.phone || lead?.mobile || '',
      Email: lead?.email || '',
      'Lead owner': owner,
      Status: lead?.crm?.status || lead?.status || '',
      'Last shipment date': exportDate(leadLastShipmentDate(lead)),
      Tags: tagNames(lead, tagNamesById),
      Deals: deals.length,
      'Last touch date': exportDate(
        lead?.crm?.lastCommunicationAt || lead?.crm?.lastResponseAt || lead?.crm?.lastEmailSentAt || lead?.updatedAt
      ),
      Notes: lead?.crm?.notes || '',
    })

    for (const deal of deals) {
      const row = { deal, leadId: lead?.id || lead?.contactId || '', leadName: name, company: lead?.company || '' }
      const revenue = estimatedFreightRevenueInr(deal, FALLBACK_USD_INR)
      dealRows.push({
        'Lead name': name,
        Company: lead?.company || '',
        'Lead owner': owner,
        Deal: dealExportCell(row, 'dealName'),
        Stage: dealExportCell(row, 'stage'),
        Freight: deal?.amount ?? '',
        Revenue: revenue ?? '',
        Currency: dealExportCell(row, 'currency'),
        Type: dealExportCell(row, 'customerType'),
        Mode: dealExportCell(row, 'transportMode'),
        'Route / lane': dealExportCell(row, 'route'),
        'Gross weight': dealExportCell(row, 'grossWeight'),
        'Invoice amount': dealExportCell(row, 'invoiceAmount'),
        'Expected close': dealExportCell(row, 'expectedCloseDate'),
        'Query received': dealExportCell(row, 'queryReceivedOn'),
        'Rates quoted': dealExportCell(row, 'ratesQuotedOn'),
        Booked: dealExportCell(row, 'bookedOn'),
        Won: dealExportCell(row, 'wonOn'),
        Lost: dealExportCell(row, 'lostOn'),
        Updated: dealExportCell(row, 'updatedAt'),
        Notes: deal?.notes || '',
      })
    }
  }

  return { leadRows, dealRows }
}

export function leadExportCell(lead, column) {
  switch (column) {
    case 'name':
      return leadDisplayName(lead)
    case 'email':
      return lead?.email || ''
    case 'phone':
      return lead?.phone || lead?.mobile || ''
    case 'company':
      return lead?.company || ''
    case 'status':
      return lead?.crm?.status || lead?.status || ''
    case 'city':
      return getLeadCityFromFields(lead)
    case 'state':
      return getLeadStateFromFields(lead)
    case 'title':
      return lead?.title || lead?.jobTitle || ''
    case 'owner':
      return (
        lead?.assignedToName ||
        lead?.crm?.assignedToName ||
        lead?.assignedToUserId ||
        lead?.savedByName ||
        ''
      )
    case 'score':
      return lead?.leadScore ?? lead?.crm?.leadScore ?? lead?.score ?? ''
    default:
      return ''
  }
}

export function leadsToCsv(leads, columns = DEFAULT_PIPELINE_EXPORT_COLUMNS) {
  const cols = columns?.length ? columns : DEFAULT_PIPELINE_EXPORT_COLUMNS
  const headers = cols.map((c) => COLUMN_HEADERS[c] || c)
  const lines = [
    headers.join(','),
    ...leads.map((lead) => cols.map((col) => escapeCsv(leadExportCell(lead, col))).join(',')),
  ]
  return lines.join('\n')
}

export function resolveExportMaxRows(user, store) {
  const policies = policiesForUser(store, user)
  return roleLimitsFor(user, policies).exportMax
}

/**
 * Load all pipeline rows matching filters for CSV export (paginated server-side).
 */
export async function loadAllPipelineLeadsForExport(
  user,
  filters,
  { maxRows = 10_000, pageSize = 500 } = {}
) {
  const cap = Math.max(1, Math.floor(Number(maxRows) || 10_000))
  const lim = Math.min(500, Math.max(50, Math.floor(Number(pageSize) || 500)))
  const all = []
  let offset = 0
  let total = null

  while (all.length < cap) {
    const page = await loadPipelineListPage(user, {
      offset,
      limit: lim,
      filters,
      light: false,
    })
    const rows = page.leads || []
    if (total == null) total = page.total ?? rows.length
    if (!rows.length) break
    all.push(...rows)
    if (!page.hasMore || offset + rows.length >= (page.total ?? all.length)) break
    offset += rows.length
  }

  const exportTotal = total ?? all.length
  return {
    leads: all.slice(0, cap),
    total: exportTotal,
    truncated: exportTotal > cap,
  }
}
