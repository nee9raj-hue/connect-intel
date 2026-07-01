import { requireUser } from '../auth.js'
import { readStore, updateStore } from '../store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import {
  enrichMarketingRows,
  requireMarketingUser,
} from '../marketingAccess.js'
import { buildOrgUserResponse } from '../organizations.js'
import { resolveMarketingPermissions } from '../marketingRoles.js'
import {
  createMarketingAutomation,
  getMarketingAutomation,
  listMarketingAutomations,
  updateMarketingAutomation,
} from '../marketingAutomations.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  const sessionUser = await requireUser(req, res)
  if (!sessionUser) return

  const { user: gateUser, store: gateStore } = await loadMarketingGateContext(sessionUser)
  const hubCheck = await requireMarketingHubAccess(gateUser, gateStore)
  if (!hubCheck.ok) return sendJson(res, hubCheck.status || 403, { error: hubCheck.error, code: hubCheck.code })

  const store = await readStore({
    only: ['marketingAutomations', 'marketingAutomationRuns', 'users', 'organizations', 'organizationMemberships'],
  })
  const dbUser = store.users.find((u) => u.id === sessionUser.id)
  const user = buildOrgUserResponse(dbUser || sessionUser, store)
  const perms = resolveMarketingPermissions(user, store)

  if (req.method === 'GET') {
    const automations = enrichMarketingRows(store, user, listMarketingAutomations(store, user))
    const runs = (store.marketingAutomationRuns || []).filter(
      (r) => r.organizationId === user.organizationId || r.createdByUserId === user.id
    )
    return sendJson(res, 200, { automations, runs: runs.slice(0, 50), permissions: perms })
  }

  if (req.method === 'POST') {
    if (!perms.canManageAutomations && !perms.canCreate) {
      return sendJson(res, 403, { error: 'You do not have permission to create automations' })
    }
    try {
      const automation = await createMarketingAutomation(user, getBody(req))
      return sendJson(res, 201, { automation })
    } catch (e) {
      return sendJson(res, 400, { error: e.message || 'Could not create automation' })
    }
  }

  if (req.method === 'PATCH') {
    const body = getBody(req)
    if (!body.id) return sendJson(res, 400, { error: 'Automation id is required' })
    if (!perms.canManageAutomations && !perms.canCreate) {
      return sendJson(res, 403, { error: 'You do not have permission to update automations' })
    }
    try {
      const automation = await updateMarketingAutomation(user, body.id, body)
      return sendJson(res, 200, { automation })
    } catch (e) {
      const code = e.message === 'Automation not found' ? 404 : 400
      return sendJson(res, code, { error: e.message || 'Could not update automation' })
    }
  }

  if (req.method === 'DELETE') {
    const body = getBody(req)
    if (!body.id) return sendJson(res, 400, { error: 'Automation id is required' })
    const existing = getMarketingAutomation(store, user, body.id)
    if (!existing) return sendJson(res, 404, { error: 'Automation not found' })

    await updateStore((draft) => {
      draft.marketingAutomations = (draft.marketingAutomations || []).filter((a) => a.id !== body.id)
      draft.marketingAutomationRuns = (draft.marketingAutomationRuns || []).filter(
        (r) => r.automationId !== body.id
      )
      return draft
    })
    return sendJson(res, 200, { ok: true })
  }

  return methodNotAllowed(res, ['GET', 'POST', 'PATCH', 'DELETE'])
}
