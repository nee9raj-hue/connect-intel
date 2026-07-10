import { requireUser } from '../auth.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { buildWorkspaceLookupForUser } from '../orgWorkspaceAccess.js'
import { readStore, ONBOARDING_STORE_COLLECTIONS } from '../store.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const user = await requireUser(req, res)
  if (!user) return

  const store = await readStore({ only: ONBOARDING_STORE_COLLECTIONS })
  const lookup = buildWorkspaceLookupForUser(store, user)
  return sendJson(res, 200, lookup)
}
