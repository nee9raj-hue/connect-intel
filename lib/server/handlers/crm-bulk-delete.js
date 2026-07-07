import { assertPipelineDeleteAccess, permissionDeniedResponse } from '../permissionEnforce.js'
import { requireUser } from '../auth.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { buildOrgUserResponse } from '../organizations.js'
import { bulkDeletePipelineEntries } from '../pipelineLeadMutations.js'
import { readStore } from '../store.js'
import { bulkAssignGuard, policiesForUser } from '../resourceProtectionEnforce.js'
import { roleLimitsFor } from '../../resourceProtection.js'

function maxBulkDeleteForUser(user, store) {
  const policies = policiesForUser(store, user)
  return Math.max(100, roleLimitsFor(user, policies).bulkAssignMax)
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])

  const sessionUser = await requireUser(req, res)
  if (!sessionUser) return

  const body = getBody(req)
  const leadIds = Array.isArray(body.leadIds)
    ? [...new Set(body.leadIds.map(String).filter(Boolean))]
    : []

  if (!leadIds.length) {
    return sendJson(res, 400, { error: 'leadIds array is required' })
  }

  const storeBefore = await readStore({
    only: ['users', 'organizations', 'organizationMemberships'],
  })
  const user = buildOrgUserResponse(
    storeBefore.users.find((u) => u.id === sessionUser.id) || sessionUser,
    storeBefore
  )

  const maxBulk = maxBulkDeleteForUser(user, storeBefore)
  if (leadIds.length > maxBulk) {
    return sendJson(res, 400, {
      code: 'NARROW_SELECTION',
      message: `Delete at most ${maxBulk.toLocaleString()} leads per batch. Filter, select, and repeat.`,
    })
  }

  const guard = bulkAssignGuard(leadIds.length, user, storeBefore)
  if (guard) return sendJson(res, guard.status, guard.body)

  try {
    await assertPipelineDeleteAccess(user, storeBefore)
  } catch (permError) {
    const denied = permissionDeniedResponse(permError)
    return sendJson(res, denied.status, denied.body)
  }

  try {
    const result = await bulkDeletePipelineEntries(user, leadIds)
    if (result.deleted === 0 && leadIds.length > 0) {
      return sendJson(res, 403, {
        error: 'You do not have permission to delete the selected leads',
        code: 'permission_denied',
        skipped: result.skipped,
        deleted: 0,
      })
    }
    return sendJson(res, 200, {
      deleted: result.deleted,
      skipped: result.skipped,
      deletedIds: result.deletedIds,
    })
  } catch (error) {
    console.error('crm/bulk-delete failed:', error)
    return sendJson(res, 500, { error: error.message || 'Bulk delete failed' })
  }
}
