import { requireUser } from '../auth.js'
import { readStore } from '../store.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { buildOrgUserResponse } from '../organizations.js'
import { loadPipelineStoreContext } from '../pipelineShard.js'
import { searchPlatform } from '../platformSearch.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const sessionUser = await requireUser(req, res)
  if (!sessionUser) return

  const q = String(req.query?.q || '').trim()
  const limit = Number(req.query?.limit) || 20

  const { pipelineStore } = await loadPipelineStoreContext(sessionUser)
  const store = {
    ...(await readStore({
      only: [
        'contacts',
        'companies',
        'marketingCampaigns',
        'users',
        'organizations',
        'organizationMemberships',
      ],
    })),
    savedLeads: pipelineStore.savedLeads,
  }

  const dbUser = store.users.find((u) => u.id === sessionUser.id)
  const user = buildOrgUserResponse(dbUser || sessionUser, store)
  const payload = searchPlatform(store, user, { q, limit })

  return sendJson(res, 200, payload)
}
