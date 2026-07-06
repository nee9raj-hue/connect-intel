import { requireUser } from '../auth.js'
import { deletePipelineView, listSavedViews, savePipelineView } from '../crmSavedViews.js'
import { readStore, updateStore } from '../store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { loadMetaUserAndAssertEditLeads, permissionDeniedResponse } from '../permissionEnforce.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  const user = await requireUser(req, res)
  if (!user) return

  if (req.method === 'GET') {
    const store = await readStore()
    return sendJson(res, 200, { views: listSavedViews(store, user) })
  }

  if (req.method === 'POST') {
    const body = getBody(req) || {}
    let view
    try {
      await loadMetaUserAndAssertEditLeads(user)
    } catch (permError) {
      const denied = permissionDeniedResponse(permError)
      return sendJson(res, denied.status, denied.body)
    }
    try {
      await updateStore((draft) => {
        view = savePipelineView(draft, user, {
          name: body.name,
          filters: body.filters,
          scope: body.scope,
        })
        return draft
      })
    } catch (error) {
      return sendJson(res, 400, { error: error.message || 'Could not save view' })
    }
    return sendJson(res, 200, { view })
  }

  if (req.method === 'DELETE') {
    const viewId = req.query?.viewId || getBody(req)?.viewId
    if (!viewId) return sendJson(res, 400, { error: 'viewId required' })
    try {
      await loadMetaUserAndAssertEditLeads(user)
    } catch (permError) {
      const denied = permissionDeniedResponse(permError)
      return sendJson(res, denied.status, denied.body)
    }
    await updateStore((draft) => {
      deletePipelineView(draft, user, viewId)
      return draft
    })
    return sendJson(res, 200, { ok: true })
  }

  return methodNotAllowed(res, ['GET', 'POST', 'DELETE'])
}
