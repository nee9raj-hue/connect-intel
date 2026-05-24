import { requireAdmin } from '../auth.js'
import { readStore, updateStore } from '../store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import {
  applyCustomerSupportAction,
  applyOrganizationSupportAction,
  getCustomerDetail,
  getOrganizationDetail,
  searchCustomers,
  searchOrganizations,
} from '../platformSupport.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  const actor = await requireAdmin(req, res)
  if (!actor) return

  const store = await readStore()

  if (req.method === 'GET') {
    const userId = req.query?.userId
    const organizationId = req.query?.organizationId
    const view = req.query?.view || 'users'

    if (userId) {
      const detail = getCustomerDetail(store, userId)
      if (!detail) return sendJson(res, 404, { error: 'Customer not found' })
      return sendJson(res, 200, detail)
    }

    if (organizationId) {
      const detail = getOrganizationDetail(store, organizationId)
      if (!detail) return sendJson(res, 404, { error: 'Organization not found' })
      return sendJson(res, 200, detail)
    }

    const q = req.query?.q || ''
    const limit = Math.min(100, Math.max(1, Number(req.query?.limit) || 50))

    if (view === 'organizations') {
      return sendJson(res, 200, { organizations: searchOrganizations(store, { q, limit }) })
    }

    return sendJson(res, 200, { customers: searchCustomers(store, { q, limit }) })
  }

  if (req.method === 'PATCH') {
    const body = getBody(req)
    const { userId, organizationId, action, ...payload } = body

    try {
    if (userId) {
        await updateStore((draft) => {
          applyCustomerSupportAction(draft, { actor, userId, action, payload })
          return draft
        })
        return sendJson(res, 200, { ok: true, detail: getCustomerDetail(await readStore(), userId) })
      }

      if (organizationId) {
        await updateStore((draft) => {
          applyOrganizationSupportAction(draft, { actor, organizationId, action, payload })
          return draft
        })
        return sendJson(res, 200, {
          ok: true,
          detail: getOrganizationDetail(await readStore(), organizationId),
        })
      }

      return sendJson(res, 400, { error: 'userId or organizationId required' })
    } catch (error) {
      return sendJson(res, 400, { error: error.message || 'Action failed' })
    }
  }

  return methodNotAllowed(res, ['GET', 'PATCH'])
}
