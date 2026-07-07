import { requireUser } from '../auth.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { matchPipelineLeadsByEmails } from '../extensionLeadMatch.js'
import {
  assertPipelineHubAccess,
  permissionDeniedResponse,
} from '../permissionEnforce.js'
import { readStore } from '../store.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])

  const sessionUser = await requireUser(req, res)
  if (!sessionUser) return

  const metaStore = await readStore({ only: ['users', 'organizations', 'organizationMemberships'] })
  const user = metaStore.users.find((u) => u.id === sessionUser.id) || sessionUser

  try {
    await assertPipelineHubAccess(user, metaStore)
  } catch (permError) {
    const denied = permissionDeniedResponse(permError)
    return sendJson(res, denied.status, denied.body)
  }

  const body = getBody(req) || {}
  const emails = Array.isArray(body.emails) ? body.emails : body.email ? [body.email] : []

  try {
    const result = await matchPipelineLeadsByEmails(user, emails)
    return sendJson(res, 200, result)
  } catch (error) {
    return sendJson(res, 500, { error: error.message || 'Lead match failed', matches: [] })
  }
}
