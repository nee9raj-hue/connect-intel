import { requireUser } from '../auth.js'
import { readStore } from '../store.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { requireTeamWorkspace, searchMentionLeads } from '../teamCollaboration.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  const sessionUser = await requireUser(req, res)
  if (!sessionUser) return

  const check = requireTeamWorkspace(sessionUser)
  if (!check.ok) return sendJson(res, 403, { error: check.error })

  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const store = await readStore()
  const user = store.users.find((u) => u.id === sessionUser.id) || sessionUser
  const q = req.query?.q || ''
  const limit = Math.min(20, Math.max(1, Number(req.query?.limit) || 12))
  const leads = searchMentionLeads(store, user, q, limit)
  return sendJson(res, 200, { leads })
}
