import { requireUser } from '../auth.js'
import { readStore } from '../store.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { requireMarketingUser } from '../marketingAccess.js'
import { buildOrgUserResponse } from '../organizations.js'
import { buildMarketingHub } from '../marketingHub.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  const sessionUser = await requireUser(req, res)
  if (!sessionUser) return

  const check = requireMarketingUser(sessionUser)
  if (!check.ok) return sendJson(res, 401, { error: check.error })

  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const store = await readStore({
    only: [
      'marketingCampaigns',
      'marketingLists',
      'marketingSegments',
      'marketingEvents',
      'marketingAutomations',
      'marketingAutomationRuns',
      'marketingForms',
      'users',
      'organizations',
      'organizationMemberships',
    ],
  })
  const user = buildOrgUserResponse(store.users.find((u) => u.id === sessionUser.id) || sessionUser, store)
  const period = String(req.query?.period || '30d').trim()
  const hub = await buildMarketingHub(store, user, { period })

  return sendJson(res, 200, {
    stats: hub.kpis,
    recent_campaigns: hub.topCampaigns,
    upcoming_sends: hub.scheduledSends,
    form_summary: (store.marketingForms || [])
      .filter((f) => f.organizationId === user.organizationId || f.createdByUserId === user.id)
      .slice(0, 8)
      .map((f) => ({ id: f.id, name: f.name, submissions: f.submissions || 0, leads_created: f.leadsCreated || 0 })),
    hub,
  })
}
