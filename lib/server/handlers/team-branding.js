import { requireUser, refreshSessionCookie } from '../auth.js'
import { buildOrgUserResponse, updateOrganizationBranding } from '../organizations.js'
import { readStore } from '../store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)
  if (req.method !== 'PATCH') return methodNotAllowed(res, ['PATCH'])

  const user = await requireUser(req, res)
  if (!user) return

  if (!user.isOrgAdmin || !user.organizationId) {
    return sendJson(res, 403, { error: 'Only your company admin can update branding' })
  }

  const body = getBody(req)
  try {
    await updateOrganizationBranding(user.organizationId, {
      name: body.name,
      logoUrl: body.logoUrl,
    })
    const store = await readStore()
    const refreshed = buildOrgUserResponse(
      store.users.find((u) => u.id === user.id),
      store
    )
    await refreshSessionCookie(res, refreshed)
    return sendJson(res, 200, { user: refreshed })
  } catch (error) {
    return sendJson(res, 400, { error: error.message || 'Update failed' })
  }
}
