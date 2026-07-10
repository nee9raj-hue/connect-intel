import { requireUser } from '../auth.js'
import { applyCors, handleOptions, sendJson } from '../http.js'
import { assertOrgPermission, permissionDeniedResponse } from '../permissionEnforce.js'
import {
  DEFAULT_DEAL_EXPORT_COLUMNS,
  dealsToCsv,
  loadAllDealsForExport,
  resolveExportMaxRows,
} from '../dealExport.js'
import { parseDealQueryParams } from '../dealQueryParams.js'
import { getReportDefinition } from '../reportDefinitions.js'
import { readStore } from '../store.js'
import { buildOrgUserResponse } from '../organizations.js'

function sanitizeFilename(name) {
  const base = String(name || 'deals-export')
    .trim()
    .slice(0, 80)
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return base || 'deals-export'
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return sendJson(res, 405, { error: 'Method not allowed' })
  }

  const sessionUser = await requireUser(req, res)
  if (!sessionUser) return

  const store = await readStore({
    only: ['reportDefinitions', 'organizations', 'organizationMemberships', 'users'],
  })
  const user = buildOrgUserResponse(
    store.users?.find((u) => u.id === sessionUser.id) || sessionUser,
    store
  )

  try {
    await assertOrgPermission(user, 'export_leads', store)
  } catch (permError) {
    const denied = permissionDeniedResponse(permError)
    return sendJson(res, denied.status, denied.body)
  }

  try {
    const url = new URL(req.url || '', 'http://local')
    const reportId = String(url.searchParams.get('reportId') || '').trim()
    let columns = DEFAULT_DEAL_EXPORT_COLUMNS
    let filename = 'pipeline-deals.csv'

    let filters = parseDealQueryParams(url)
    if (reportId) {
      const report = getReportDefinition(store, user, reportId)
      if (!report || report.module !== 'deals') {
        return sendJson(res, 404, { error: 'Report not found' })
      }
      filters = { ...filters, ...(report.serverFilters || {}) }
      if (report.columns?.length) columns = report.columns
      filename = `${sanitizeFilename(report.name)}.csv`
    }

    const maxRows = resolveExportMaxRows(user, store)
    const { deals, total, truncated } = await loadAllDealsForExport(user, store, filters, {
      maxRows,
    })

    if (truncated || total > maxRows) {
      return sendJson(res, 400, {
        code: 'EXPORT_LIMIT',
        error: `Export limited to ${maxRows.toLocaleString()} rows. Narrow your filters and try again.`,
        total,
        maxRows,
      })
    }

    const csv = dealsToCsv(deals, columns)
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('X-Export-Row-Count', String(deals.length))
    res.status(200).send(csv)
  } catch (error) {
    console.error('deals export:', error?.message || error)
    return sendJson(res, 500, { error: error.message || 'Export failed' })
  }
}
