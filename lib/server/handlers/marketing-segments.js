import { requireUser } from '../auth.js'
import { readStore, updateStore } from '../store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import {
  enrichMarketingRows,
  requireMarketingUser,
} from '../marketingAccess.js'
import { buildOrgUserResponse } from '../organizations.js'
import { loadPipelineStoreContext } from '../pipelineShard.js'
import { resolveMarketingPermissions } from '../marketingRoles.js'
import {
  createMarketingSegment,
  getMarketingSegment,
  listMarketingSegments,
  previewSegmentCount,
  updateMarketingSegment,
} from '../marketingSegments.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  const sessionUser = await requireUser(req, res)
  if (!sessionUser) return

  const check = requireMarketingUser(sessionUser)
  if (!check.ok) return sendJson(res, 401, { error: check.error })

  const SLICES = [
    'marketingSegments',
    'marketingEvents',
    'marketingCampaigns',
    'users',
    'organizations',
    'organizationMemberships',
    'savedLeads',
  ]

  const { pipelineStore } = await loadPipelineStoreContext(sessionUser)
  const store = {
    ...(await readStore({ only: SLICES })),
    savedLeads: pipelineStore.savedLeads,
  }
  const dbUser = store.users.find((u) => u.id === sessionUser.id)
  const user = buildOrgUserResponse(dbUser || sessionUser, store)
  const perms = resolveMarketingPermissions(user, store)

  if (req.method === 'GET') {
    const segments = enrichMarketingRows(store, user, listMarketingSegments(store, user))
    return sendJson(res, 200, { segments, permissions: perms })
  }

  if (req.method === 'POST') {
    const body = getBody(req)
    if (!perms.canManageSegments && !perms.canCreate) {
      return sendJson(res, 403, { error: 'You do not have permission to manage segments' })
    }

    if (body.action === 'preview') {
      const count = await previewSegmentCount(user, body.filterJson || body.filters || {}, {
        channel: body.channel,
      })
      return sendJson(res, 200, count)
    }

    try {
      const segment = await createMarketingSegment(user, body)
      return sendJson(res, 201, { segment })
    } catch (e) {
      return sendJson(res, 400, { error: e.message || 'Could not create segment' })
    }
  }

  if (req.method === 'PATCH') {
    const body = getBody(req)
    if (!body.id) return sendJson(res, 400, { error: 'Segment id is required' })
    if (!perms.canManageSegments && !perms.canCreate) {
      return sendJson(res, 403, { error: 'You do not have permission to manage segments' })
    }

    if (body.action === 'preview') {
      const existing = getMarketingSegment(store, user, body.id)
      if (!existing) return sendJson(res, 404, { error: 'Segment not found' })
      const merged = { ...existing, filterJson: body.filterJson || existing.filterJson }
      const count = await previewSegmentCount(user, merged)
      return sendJson(res, 200, count)
    }

    if (body.action === 'refresh') {
      try {
        const segment = await updateMarketingSegment(user, body.id, {})
        return sendJson(res, 200, { segment })
      } catch (e) {
        return sendJson(res, 400, { error: e.message || 'Could not refresh segment' })
      }
    }

    try {
      const segment = await updateMarketingSegment(user, body.id, body)
      return sendJson(res, 200, { segment })
    } catch (e) {
      const code = e.message === 'Segment not found' ? 404 : 400
      return sendJson(res, code, { error: e.message || 'Could not update segment' })
    }
  }

  if (req.method === 'DELETE') {
    const body = getBody(req)
    if (!body.id) return sendJson(res, 400, { error: 'Segment id is required' })
    const existing = getMarketingSegment(store, user, body.id)
    if (!existing) return sendJson(res, 404, { error: 'Segment not found' })

    await updateStore((draft) => {
      draft.marketingSegments = (draft.marketingSegments || []).filter((s) => s.id !== body.id)
      return draft
    })
    return sendJson(res, 200, { ok: true })
  }

  return methodNotAllowed(res, ['GET', 'POST', 'PATCH', 'DELETE'])
}
