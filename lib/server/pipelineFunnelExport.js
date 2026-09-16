import { CRM_STATUS_IDS, crmLeadStatusLabel, foldCrmStatusCounts, normalizeCrmLeadStatus } from '../crmLeadStatuses.js'
import { loadPipelineListPage } from './pipelineListLoad.js'
import { summarizePipelineEntries } from './pipelineQuery.js'
import { roleLimitsFor } from '../resourceProtection.js'
import { policiesForUser } from './resourceProtectionEnforce.js'

function escapeCsv(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

function dealValueByStatus(entries) {
  const totals = Object.fromEntries(CRM_STATUS_IDS.map((s) => [s, 0]))
  for (const entry of entries) {
    const st = normalizeCrmLeadStatus(entry?.crm?.status)
    totals[st] = (totals[st] || 0) + (Number(entry?.crm?.dealValue) || 0)
  }
  return totals
}

export function funnelSummaryToCsv({ byStatus, dealValues, total }) {
  const lines = ['Stage,Label,Count,Deal value']
  let valueSum = 0
  const folded = foldCrmStatusCounts(byStatus)
  for (const status of CRM_STATUS_IDS) {
    const count = folded.find((row) => row.status === status)?.count ?? 0
    const value = Math.round(dealValues[status] || 0)
    valueSum += value
    lines.push(
      [status, crmLeadStatusLabel(status), count, value]
        .map(escapeCsv)
        .join(',')
    )
  }
  lines.push(['total', 'All leads', total, valueSum].map(escapeCsv).join(','))
  return lines.join('\n')
}

export function resolveExportMaxRows(user, store) {
  const policies = policiesForUser(store, user)
  return roleLimitsFor(user, policies).exportMax
}

/** Load pipeline rows (light) and aggregate funnel counts for CSV export. */
export async function loadPipelineFunnelForExport(
  user,
  filters,
  { maxRows = 10_000, pageSize = 500 } = {}
) {
  const cap = Math.max(1, Math.floor(Number(maxRows) || 10_000))
  const lim = Math.min(500, Math.max(50, Math.floor(Number(pageSize) || 500)))
  const all = []
  let offset = 0

  while (all.length < cap) {
    const page = await loadPipelineListPage(user, {
      offset,
      limit: lim,
      filters,
      light: true,
    })
    const rows = page.leads || []
    if (!rows.length) break
    all.push(...rows)
    if (!page.hasMore || offset + rows.length >= (page.total ?? all.length)) break
    offset += rows.length
  }

  const entries = all.slice(0, cap)
  const summary = summarizePipelineEntries(entries)
  const dealValues = dealValueByStatus(entries)
  const exportTotal = summary.total ?? entries.length

  return {
    byStatus: summary.byStatus,
    dealValues,
    total: exportTotal,
    truncated: exportTotal > cap,
  }
}
