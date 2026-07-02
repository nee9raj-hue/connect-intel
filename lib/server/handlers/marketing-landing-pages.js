import { requireUser } from '../auth.js'
import { readStore, updateStore } from '../store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { enrichMarketingRows, loadMarketingGateContext, requireMarketingHubAccess, requireMarketingUser } from '../marketingAccess.js'
import { buildOrgUserResponse } from '../organizations.js'
import {
  createMarketingLandingPage,
  getMarketingLandingPage,
  listMarketingLandingPages,
  updateMarketingLandingPage,
} from '../marketingLandingPages.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  const sessionUser = await requireUser(req, res)
  if (!sessionUser) return

  const { user: gateUser, store: gateStore } = await loadMarketingGateContext(sessionUser)
  const hubCheck = await requireMarketingHubAccess(gateUser, gateStore)
  if (!hubCheck.ok) return sendJson(res, hubCheck.status || 403, { error: hubCheck.error, code: hubCheck.code })

  const store = await readStore({
    only: ['marketingLandingPages', 'users', 'organizations', 'organizationMemberships'],
  })
  const user = buildOrgUserResponse(store.users.find((u) => u.id === sessionUser.id) || sessionUser, store)

  if (req.method === 'GET') {
    const pages = enrichMarketingRows(store, user, listMarketingLandingPages(store, user))
    return sendJson(res, 200, { pages })
  }

  if (req.method === 'POST') {
    try {
      const page = await createMarketingLandingPage(user, getBody(req))
      return sendJson(res, 201, { page })
    } catch (e) {
      return sendJson(res, 400, { error: e.message })
    }
  }

  if (req.method === 'PATCH') {
    const body = getBody(req)
    if (!body.id) return sendJson(res, 400, { error: 'Page id required' })
    try {
      const page = await updateMarketingLandingPage(user, body.id, body)
      return sendJson(res, 200, { page })
    } catch (e) {
      return sendJson(res, 404, { error: e.message })
    }
  }

  if (req.method === 'DELETE') {
    const body = getBody(req)
    if (!body.id) return sendJson(res, 400, { error: 'Page id required' })
    const existing = getMarketingLandingPage(store, user, body.id)
    if (!existing) return sendJson(res, 404, { error: 'Not found' })
    await updateStore((draft) => {
      draft.marketingLandingPages = (draft.marketingLandingPages || []).filter((p) => p.id !== body.id)
      return draft
    })
    return sendJson(res, 200, { ok: true })
  }

  return methodNotAllowed(res, ['GET', 'POST', 'PATCH', 'DELETE'])
}
