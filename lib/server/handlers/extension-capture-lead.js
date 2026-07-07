import { requireUser } from '../auth.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { captureLeadFromExtension } from '../extensionCaptureLead.js'
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

  try {
    const result = await captureLeadFromExtension(user, body)
    return sendJson(res, 200, {
      ok: true,
      lead: result.lead,
      duplicate: Boolean(result.duplicate),
      message: result.duplicate
        ? 'Lead already exists in your pipeline'
        : 'Lead added to pipeline',
    })
  } catch (error) {
    const status = /already in your pipeline|already exists/i.test(error.message) ? 409 : 400
    return sendJson(res, status, { error: error.message || 'Capture failed' })
  }
}
