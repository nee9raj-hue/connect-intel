import { requireUser } from '../auth.js'
import { readStore } from '../store.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { requireMarketingUser } from '../marketingAccess.js'
import { buildOrgUserResponse } from '../organizations.js'
import { loadPipelineStoreContext } from '../pipelineShard.js'
import { buildMarketingDashboard } from '../marketingDashboard.js'
import { resolveMarketingPermissions } from '../marketingRoles.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const sessionUser = await requireUser(req, res)
  if (!sessionUser) return

  const check = requireMarketingUser(sessionUser)
  if (!check.ok) return sendJson(res, 401, { error: check.error })

  const SLICES = [
    'marketingCampaigns',
    'marketingLists',
    'marketingSegments',
    'marketingSuppressions',
    'marketingEvents',
    'users',
    'organizations',
    'organizationMemberships',
  ]

  const { pipelineStore } = await loadPipelineStoreContext(sessionUser)
  const store = {
    ...(await readStore({ only: SLICES })),
    savedLeads: pipelineStore.savedLeads,
  }
  const dbUser = store.users.find((u) => u.id === sessionUser.id)
  const user = buildOrgUserResponse(dbUser || sessionUser, store)
  const perms = resolveMarketingPermissions(user, store)

  if (perms.isReadOnly === false && !perms.canView) {
    return sendJson(res, 403, { error: 'You do not have permission to view marketing' })
  }

  const period = String(req.query?.period || '30d').trim()
  const dashboard = await buildMarketingDashboard(store, user, { period })

  return sendJson(res, 200, { ...dashboard, permissions: perms })
}
