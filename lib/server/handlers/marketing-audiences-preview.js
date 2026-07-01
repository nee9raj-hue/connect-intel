import { requireUser } from '../auth.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { loadMarketingGateContext, requireMarketingHubAccess, requireMarketingSendAccess, MARKETING_SEND_ACTIONS, requireMarketingUser } from '../marketingAccess.js'
import { buildOrgUserResponse } from '../organizations.js'
import { readStore } from '../store.js'
import { previewSegmentCount } from '../marketingSegments.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  const sessionUser = await requireUser(req, res)
  if (!sessionUser) return

  const { user: gateUser, store: gateStore } = await loadMarketingGateContext(sessionUser)
  const hubCheck = await requireMarketingHubAccess(gateUser, gateStore)
  if (!hubCheck.ok) return sendJson(res, hubCheck.status || 403, { error: hubCheck.error, code: hubCheck.code })

  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])

  const store = await readStore({ only: ['users', 'organizations', 'organizationMemberships'] })
  const user = buildOrgUserResponse(store.users.find((u) => u.id === sessionUser.id) || sessionUser, store)
  const body = getBody(req)
  let filterJson = body.filterJson
  if (!filterJson && Array.isArray(body.filters)) {
    filterJson = {
      match: body.match || 'all',
      conditions: body.filters.map((f) => ({
        field: f.field,
        operator: f.op || f.operator || 'is',
        value: f.value,
      })),
    }
  }
  if (!filterJson) filterJson = {}

  try {
    const count = await previewSegmentCount(user, filterJson, { channel: body.channel })
    return sendJson(res, 200, { count: count.count ?? count })
  } catch (e) {
    return sendJson(res, 400, { error: e.message || 'Could not preview audience' })
  }
}
