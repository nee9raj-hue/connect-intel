import { requireUser } from '../auth.js'
import { resolveOrgRole } from '../organizations.js'
import { readStore } from '../store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { workspaceFeatureEnabled } from '../workspaceFeatures.js'
import { suggestDrivingDistance, isFieldVisitDistanceConfigured } from '../fieldVisitDistance.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  const user = await requireUser(req, res)
  if (!user) return

  if (req.method === 'GET') {
    return sendJson(res, 200, { configured: isFieldVisitDistanceConfigured() })
  }

  if (req.method !== 'POST') return methodNotAllowed(res, ['GET', 'POST'])

  const store = await readStore()
  const { accountType } = resolveOrgRole(user, store)
  if (accountType !== 'company' || !user.organizationId) {
    return sendJson(res, 403, { error: 'Company workspace required' })
  }

  const org = store.organizations.find((o) => o.id === user.organizationId)
  if (!workspaceFeatureEnabled(org, 'fieldVisitExpenses')) {
    return sendJson(res, 403, { error: 'Field visit expenses are not enabled' })
  }

  const body = getBody(req) || {}
  const result = await suggestDrivingDistance({
    startLabel: body.startLabel,
    endLabel: body.endLabel,
    travelMode: body.travelMode || 'car',
  })

  if (!result.ok) {
    return sendJson(res, 400, { error: result.error })
  }

  return sendJson(res, 200, {
    distanceKm: result.distanceKm,
    durationMinutes: result.durationMinutes,
    distanceSource: result.distanceSource,
    startResolved: result.startResolved,
    endResolved: result.endResolved,
    cached: Boolean(result.cached),
  })
}
