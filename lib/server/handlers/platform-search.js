import { requireUser } from '../auth.js'
import { readStore } from '../store.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { buildOrgUserResponse } from '../organizations.js'
import { loadPipelineStoreContext } from '../pipelineShard.js'
import { searchPlatformFast } from '../meilisearch/search.js'
import { timeAsync } from '../infra/metrics.js'
import { isMeilisearchEnabled } from '../infra/config.js'
import {
  assertPlatformSearchAccess,
  permissionDeniedResponse,
} from '../permissionEnforce.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const sessionUser = await requireUser(req, res)
  if (!sessionUser) return

  const q = String(req.query?.q || '').trim()
  const limit = Number(req.query?.limit) || 20

  const metaOnly = await readStore({
    only: [
      'contacts',
      'companies',
      'marketingCampaigns',
      'users',
      'organizations',
      'organizationMemberships',
      'teamNotes',
      'teamTasks',
      'chithiMessages',
    ],
  })
  const store = { ...metaOnly, savedLeads: [] }

  const meiliActive = isMeilisearchEnabled() && q.length >= 2
  if (!meiliActive) {
    const { pipelineStore } = await loadPipelineStoreContext(sessionUser)
    store.savedLeads = pipelineStore.savedLeads
  }

  const dbUser = store.users.find((u) => u.id === sessionUser.id)
  const user = buildOrgUserResponse(dbUser || sessionUser, store)

  try {
    await assertPlatformSearchAccess(user, metaOnly)
  } catch (permError) {
    const denied = permissionDeniedResponse(permError)
    return sendJson(res, denied.status, denied.body)
  }

  const payload = await timeAsync('connectintel_platform_search', { provider: meiliActive ? 'meili' : 'json' }, () =>
    searchPlatformFast(store, user, { q, limit })
  )

  return sendJson(res, 200, payload)
}
