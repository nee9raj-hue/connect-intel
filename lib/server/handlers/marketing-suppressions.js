import { requireUser } from '../auth.js'
import { readStore, updateStore } from '../store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import {
  enrichMarketingRows,
  filterMarketingRows,
  isOrgMarketingAdmin,
  requireMarketingUser,
} from '../marketingAccess.js'
import { buildOrgUserResponse } from '../organizations.js'
import { recordSuppression } from '../marketingUnsubscribe.js'
import { resolveMarketingPermissions } from '../marketingRoles.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  const sessionUser = await requireUser(req, res)
  if (!sessionUser) return

  const check = requireMarketingUser(sessionUser)
  if (!check.ok) return sendJson(res, 401, { error: check.error })

  const store = await readStore({
    only: ['marketingSuppressions', 'users', 'organizations', 'organizationMemberships'],
  })
  const dbUser = store.users.find((u) => u.id === sessionUser.id)
  const user = buildOrgUserResponse(dbUser || sessionUser, store)
  const perms = resolveMarketingPermissions(user, store)

  if (req.method === 'GET') {
    let rows = filterMarketingRows(store.marketingSuppressions || [], user)
    const reason = String(req.query?.reason || '').trim()
    if (reason) rows = rows.filter((r) => r.reason === reason)
    const search = String(req.query?.search || '').trim().toLowerCase()
    if (search) rows = rows.filter((r) => r.email.includes(search))

    rows = rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 500)

    const byReason = {}
    for (const r of filterMarketingRows(store.marketingSuppressions || [], user)) {
      byReason[r.reason || 'unsubscribe'] = (byReason[r.reason || 'unsubscribe'] || 0) + 1
    }

    return sendJson(res, 200, {
      suppressions: enrichMarketingRows(store, user, rows),
      summary: byReason,
      total: filterMarketingRows(store.marketingSuppressions || [], user).length,
      permissions: perms,
    })
  }

  if (req.method === 'POST') {
    if (!perms.canManageSuppressions && !isOrgMarketingAdmin(user)) {
      return sendJson(res, 403, { error: 'Only admins can manage suppressions' })
    }
    const body = getBody(req)
    const email = String(body.email || '').trim()
    if (!email) return sendJson(res, 400, { error: 'Email is required' })

    const scope = user.organizationId
      ? { organizationId: user.organizationId, createdByUserId: null }
      : { organizationId: null, createdByUserId: user.id }

    const result = await recordSuppression({
      ...scope,
      email,
      reason: body.reason || 'manual',
    })
    if (!result.ok) return sendJson(res, 400, { error: result.error })
    return sendJson(res, 201, { ok: true })
  }

  if (req.method === 'DELETE') {
    if (!isOrgMarketingAdmin(user)) {
      return sendJson(res, 403, { error: 'Only admins can remove suppressions' })
    }
    const body = getBody(req)
    const email = String(body.email || '').trim().toLowerCase()
    if (!email) return sendJson(res, 400, { error: 'Email is required' })

    await updateStore((draft) => {
      draft.marketingSuppressions = (draft.marketingSuppressions || []).filter((row) => {
        if (row.email !== email) return true
        if (user.organizationId) return row.organizationId !== user.organizationId
        return row.createdByUserId !== user.id
      })
      return draft
    })
    return sendJson(res, 200, { ok: true })
  }

  return methodNotAllowed(res, ['GET', 'POST', 'DELETE'])
}
