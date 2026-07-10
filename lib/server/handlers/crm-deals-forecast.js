import { requireUser } from '../auth.js'
import { readStore } from '../store.js'
import { applyCors, handleOptions, sendJson } from '../http.js'
import { buildOrgUserResponse, getOrganization } from '../organizations.js'
import { assertPipelineHubAccess, permissionDeniedResponse } from '../permissionEnforce.js'
import { buildDealsForecast } from '../../dealPipeline.js'
import { isFreightDealOrg } from '../../freightDeal.js'
import { loadAllDealsForExport, resolveExportMaxRows } from '../dealExport.js'
import { parseDealQueryParams } from '../dealQueryParams.js'

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
    only: ['organizations', 'organizationMemberships', 'users'],
  })
  const user = buildOrgUserResponse(
    store.users?.find((row) => row.id === sessionUser.id) || sessionUser,
    store
  )

  try {
    await assertPipelineHubAccess(user, store)
  } catch (permError) {
    const denied = permissionDeniedResponse(permError)
    return sendJson(res, denied.status, denied.body)
  }

  try {
    const url = new URL(req.url || '', 'http://local')
    const filters = parseDealQueryParams(url)
    const maxRows = resolveExportMaxRows(user, store)
    const org = user.organizationId ? getOrganization(store, user.organizationId) : null
    const freightOrg = isFreightDealOrg(org, user)

    const { deals, total, truncated } = await loadAllDealsForExport(user, store, filters, {
      maxRows,
    })

    if (truncated || total > maxRows) {
      return sendJson(res, 400, {
        code: 'FORECAST_LIMIT',
        error: `Forecast limited to ${maxRows.toLocaleString()} deals. Narrow your filters and try again.`,
        total,
        maxRows,
      })
    }

    const forecast = buildDealsForecast(deals, { freightOrg })
    return sendJson(res, 200, {
      forecast,
      total: deals.length,
      filters,
    })
  } catch (error) {
    console.error('deals forecast:', error?.message || error)
    return sendJson(res, 500, { error: error.message || 'Forecast failed' })
  }
}
