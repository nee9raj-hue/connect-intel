import { requireUser } from '../auth.js'
import {
  deleteReportDefinition,
  listReportDefinitions,
  saveReportDefinition,
  updateReportSchedule,
} from '../reportDefinitions.js'
import { readStore, updateStorePartial } from '../store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { loadMetaUserAndAssertEditLeads, permissionDeniedResponse } from '../permissionEnforce.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  const user = await requireUser(req, res)
  if (!user) return

  if (req.method === 'GET') {
    const store = await readStore({ only: ['reportDefinitions'] })
    const module = String(req.query?.module || '').trim() || null
    return sendJson(res, 200, { reports: listReportDefinitions(store, user, { module }) })
  }

  if (req.method === 'POST') {
    const body = getBody(req) || {}
    let report
    try {
      await loadMetaUserAndAssertEditLeads(user)
    } catch (permError) {
      const denied = permissionDeniedResponse(permError)
      return sendJson(res, denied.status, denied.body)
    }
    try {
      await updateStorePartial(['reportDefinitions'], async (draft) => {
        report = saveReportDefinition(draft, user, {
          name: body.name,
          module: body.module,
          serverFilters: body.serverFilters || body.filters,
          advancedFilters: body.advancedFilters,
          columns: body.columns,
          scope: body.scope,
          schedule: body.schedule,
        })
        return draft
      })
    } catch (error) {
      return sendJson(res, 400, { error: error.message || 'Could not save report' })
    }
    return sendJson(res, 200, { report })
  }

  if (req.method === 'PATCH') {
    const body = getBody(req) || {}
    const reportId = body.reportId || req.query?.reportId
    if (!reportId) return sendJson(res, 400, { error: 'reportId required' })
    let report
    try {
      await loadMetaUserAndAssertEditLeads(user)
    } catch (permError) {
      const denied = permissionDeniedResponse(permError)
      return sendJson(res, denied.status, denied.body)
    }
    try {
      await updateStorePartial(['reportDefinitions'], async (draft) => {
        report = updateReportSchedule(draft, user, reportId, body.schedule)
        return draft
      })
    } catch (error) {
      return sendJson(res, 400, { error: error.message || 'Could not update schedule' })
    }
    return sendJson(res, 200, { report })
  }

  if (req.method === 'DELETE') {
    const reportId = req.query?.reportId || getBody(req)?.reportId
    if (!reportId) return sendJson(res, 400, { error: 'reportId required' })
    try {
      await loadMetaUserAndAssertEditLeads(user)
    } catch (permError) {
      const denied = permissionDeniedResponse(permError)
      return sendJson(res, denied.status, denied.body)
    }
    try {
      await updateStorePartial(['reportDefinitions'], async (draft) => {
        deleteReportDefinition(draft, user, reportId)
        return draft
      })
    } catch (error) {
      return sendJson(res, 400, { error: error.message || 'Could not delete report' })
    }
    return sendJson(res, 200, { ok: true })
  }

  return methodNotAllowed(res, ['GET', 'POST', 'PATCH', 'DELETE'])
}
