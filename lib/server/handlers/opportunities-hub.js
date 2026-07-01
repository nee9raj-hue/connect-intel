import { requireUser } from '../auth.js'
import { readStore } from '../store.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { buildOrgUserResponse } from '../organizations.js'
import { loadPipelineStoreContext } from '../pipelineShard.js'
import { buildOpportunitiesHub } from '../opportunitiesHub.js'
import {
  assertPipelineHubAccess,
  permissionDeniedResponse,
} from '../permissionEnforce.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const sessionUser = await requireUser(req, res)
  if (!sessionUser) return

  const metaStore = await readStore({ only: ['users', 'organizations', 'organizationMemberships'] })
  const user = buildOrgUserResponse(metaStore.users.find((u) => u.id === sessionUser.id) || sessionUser, metaStore)

  try {
    await assertPipelineHubAccess(user, metaStore)
  } catch (permError) {
    const denied = permissionDeniedResponse(permError)
    return sendJson(res, denied.status, denied.body)
  }

  const { pipelineStore } = await loadPipelineStoreContext(sessionUser)
  const store = { ...metaStore, savedLeads: pipelineStore.savedLeads }

  const search = String(req.query?.q || '').trim()
  const dealStage = String(req.query?.dealStage || 'all').trim() || 'all'
  const limit = Math.min(100, Math.max(1, Number(req.query?.limit) || 50))
  const offset = Math.max(0, Number(req.query?.offset) || 0)

  const payload = await buildOpportunitiesHub(user, store, { search, dealStage, limit, offset })
  return sendJson(res, 200, payload)
}
