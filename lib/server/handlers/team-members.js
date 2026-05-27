import { requireUser } from '../auth.js'
import { listTeamMembers } from '../organizations.js'
import { AUTH_STORE_COLLECTIONS, readStore } from '../store.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const user = await requireUser(req, res)
  if (!user) return

  if (!user.organizationId || user.accountType !== 'company') {
    return sendJson(res, 200, { members: [] })
  }

  const store = await readStore({ only: AUTH_STORE_COLLECTIONS })
  const members = listTeamMembers(store, user.organizationId)
  return sendJson(res, 200, { members })
}
