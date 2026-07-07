import { requireUser } from '../auth.js'
import { readStore } from '../store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { buildOrgUserResponse } from '../organizations.js'
import { getCrmDeal, listCrmDeals, patchCrmDeal } from '../dealsApi.js'
import {
  assertPipelineHubAccess,
  assertOrgPermission,
  permissionDeniedResponse,
} from '../permissionEnforce.js'
import { recordPipelineAudit } from '../auditPipeline.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

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

  if (req.method === 'GET') {
    const dealId = String(req.query?.dealId || '').trim()
    if (dealId) {
      const deal = await getCrmDeal(user, dealId, metaStore)
      if (!deal) return sendJson(res, 404, { error: 'Deal not found' })
      return sendJson(res, 200, { deal })
    }

    const search = String(req.query?.q || '').trim()
    const dealStage = String(req.query?.dealStage || 'all').trim() || 'all'
    const limit = Math.min(100, Math.max(1, Number(req.query?.limit) || 50))
    const offset = Math.max(0, Number(req.query?.offset) || 0)
    const payload = await listCrmDeals(user, metaStore, { search, dealStage, limit, offset })
    return sendJson(res, 200, payload)
  }

  if (req.method === 'PATCH') {
    try {
      await assertOrgPermission(user, 'edit_leads', metaStore)
    } catch (permError) {
      const denied = permissionDeniedResponse(permError)
      return sendJson(res, denied.status, denied.body)
    }

    const body = getBody(req) || {}
    const dealId = String(body.dealId || body.id || '').trim()
    if (!dealId) return sendJson(res, 400, { error: 'dealId is required' })

    const result = await patchCrmDeal(user, dealId, body, metaStore)
    if (result.error) return sendJson(res, result.status || 400, { error: result.error })

    recordPipelineAudit({
      organizationId: user.organizationId,
      actorUserId: user.id,
      action: body.action === 'won' || body.action === 'lost' ? 'pipeline.deal_closed' : 'pipeline.deal_updated',
      resourceType: 'deal',
      resourceId: dealId,
      metadata: { action: body.action || 'update', leadId: result.deal?.leadId },
    })

    return sendJson(res, 200, { deal: result.deal })
  }

  return methodNotAllowed(res, ['GET', 'PATCH'])
}
