import { getLeadCityFromFields, getLeadStateFromFields } from '../pipelineLeadLocation.js'
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
