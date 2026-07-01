import { requireUser } from '../auth.js'
import { readStore, updateStore } from '../store.js'
import {
  importActiveTradingRows,
  listActiveTradingCustomers,
  listActiveTradingImportOverview,
} from '../activeTrading.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { getOrganization, resolveOrgRole } from '../organizations.js'
import { resolveOrgWorkspaceFeatures, workspaceFeatureEnabled } from '../workspaceFeatures.js'
import { loadMetaUserAndAssertEditLeads, permissionDeniedResponse } from '../permissionEnforce.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  const user = await requireUser(req, res)
  if (!user) return

  const store = await readStore()
  const { accountType } = resolveOrgRole(user, store)

  if (accountType !== 'company' || !user.organizationId) {
    return sendJson(res, 403, {
      error: 'Active customers is available for company workspaces only.',
    })
  }

  const organizationId = user.organizationId
  const org = getOrganization(store, organizationId)
  const workspace = resolveOrgWorkspaceFeatures(store, org)
  if (!workspaceFeatureEnabled(workspace, 'panelActiveCustomers')) {
    return sendJson(res, 403, {
      error: 'Active customers module is disabled for this workspace. Enable it under Team → Workspace modules.',
    })
  }

  if (req.method === 'GET') {
    const overview = listActiveTradingImportOverview(store, organizationId)
    const { customers, stats } = listActiveTradingCustomers(store, user)
    return sendJson(res, 200, { ...overview, customers, customerStats: stats })
  }

  if (req.method === 'POST') {
    try {
      await loadMetaUserAndAssertEditLeads(user, store)
    } catch (permError) {
      const denied = permissionDeniedResponse(permError)
      return sendJson(res, denied.status, denied.body)
    }

    const body = getBody(req)
    const rows = Array.isArray(body.rows) ? body.rows : []
    if (!rows.length) return sendJson(res, 400, { error: 'Upload rows are required' })

    const result = importActiveTradingRows(store, {
      organizationId,
      actor: user,
      rows,
      promoteToActive: body.promoteToActive !== false,
    })

    await updateStore(() => result.store)

    const overview = listActiveTradingImportOverview(await readStore(), organizationId)
    return sendJson(res, 200, {
      ...overview,
      stats: result.stats,
      unmatched: result.unmatched,
      matched: result.matched,
      import: result.importRecord,
      message: `Updated ${result.stats.updatedLeads} lead(s). ${result.stats.unmatched} row(s) could not be matched by mobile.`,
    })
  }

  return methodNotAllowed(res, ['GET', 'POST'])
}
