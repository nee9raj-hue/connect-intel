import { requireUser, refreshSessionCookie } from '../../lib/server/auth.js'
import { acceptInviteForUser, buildOrgUserResponse } from '../../lib/server/organizations.js'
import { updateStore } from '../../lib/server/store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../../lib/server/http.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])

  const user = await requireUser(req, res)
  if (!user) return

  const body = getBody(req)
  const token = body.token || new URL(req.url || '', 'http://localhost').searchParams.get('token')
  if (!token) {
    return sendJson(res, 400, { error: 'token is required' })
  }

  let failReason = null
  const updated = await updateStore((store) => {
    const dbUser = store.users.find((u) => u.id === user.id)
    if (!dbUser) {
      failReason = 'User not found'
      return store
    }
    const result = acceptInviteForUser(store, dbUser, token)
    if (!result.accepted) {
      failReason = result.reason || 'Could not accept invite'
    }
    return store
  })

  if (failReason) {
    return sendJson(res, 400, { error: failReason })
  }

  const refreshed = buildOrgUserResponse(
    updated.users.find((u) => u.id === user.id),
    updated
  )
  await refreshSessionCookie(res, refreshed)

  return sendJson(res, 200, { user: refreshed, ok: true })
}
