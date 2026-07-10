import { requireUser } from '../auth.js'
import { readStore } from '../store.js'
import { applyCors, handleOptions, sendJson } from '../http.js'
import { buildOrgUserResponse } from '../organizations.js'
import { assertPipelineHubAccess, permissionDeniedResponse } from '../permissionEnforce.js'
import { parseDealQueryParams } from '../dealQueryParams.js'
import { loadDealsForecastForUser } from '../dealForecastLoad.js'

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
    const payload = await loadDealsForecastForUser(user, store, filters)

    if (payload.error === 'FORECAST_LIMIT') {
      return sendJson(res, 400, {
        code: 'FORECAST_LIMIT',
        error: `Forecast limited to ${payload.maxRows.toLocaleString()} deals. Narrow your filters and try again.`,
        total: payload.total,
        maxRows: payload.maxRows,
      })
    }

    return sendJson(res, 200, {
      forecast: payload.forecast,
      total: payload.total,
      filters,
    })
  } catch (error) {
    console.error('deals forecast:', error?.message || error)
    return sendJson(res, 500, { error: error.message || 'Forecast failed' })
  }
}
