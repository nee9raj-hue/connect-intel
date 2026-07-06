import { requireUser } from '../auth.js'
import { readStore } from '../store.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { loadMarketingGateContext, requireMarketingHubAccess } from '../marketingAccess.js'
import { buildOrgUserResponse } from '../organizations.js'
import { buildSitePixelSnippet, createSiteKey } from '../marketingSiteTracking.js'
import { queryMarketingRollups } from '../marketingAnalyticsRollups.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  const sessionUser = await requireUser(req, res)
  if (!sessionUser) return

  const { user: gateUser, store: gateStore } = await loadMarketingGateContext(sessionUser)
  const hubCheck = await requireMarketingHubAccess(gateUser, gateStore)
  if (!hubCheck.ok) return sendJson(res, hubCheck.status || 403, { error: hubCheck.error, code: hubCheck.code })

  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const store = await readStore({ only: ['marketingAnalyticsRollups', 'users', 'organizations'] })
  const user = buildOrgUserResponse(store.users.find((u) => u.id === sessionUser.id) || sessionUser, store)
  const orgId = user.organizationId

  if (!orgId) {
    return sendJson(res, 400, { error: 'Website tracking requires a company workspace' })
  }

  const siteKey = createSiteKey(orgId)
  const snippet = buildSitePixelSnippet(orgId)
  const from = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  const rollups = queryMarketingRollups(store, user, { metric: 'site_pageviews', from })
  const pageviews30d = rollups.reduce((sum, row) => sum + (row.value || 0), 0)

  return sendJson(res, 200, {
    siteKey,
    snippet,
    pageviews30d,
    utmFields: ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'],
    installHint: 'Paste the snippet before </head> on your marketing site. UTM params are captured automatically and attached to form leads.',
  })
}
