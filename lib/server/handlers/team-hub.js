import { requireUser } from '../auth.js'
import { readStore, updateStore } from '../store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { requireTeamWorkspace } from '../teamCollaboration.js'
import { countChithiUnread } from '../chithiUnread.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  const sessionUser = await requireUser(req, res)
  if (!sessionUser) return

  const check = requireTeamWorkspace(sessionUser)
  if (!check.ok) return sendJson(res, 403, { error: check.error })

  if (req.method === 'GET') {
    const store = await readStore()
    const user = store.users.find((u) => u.id === sessionUser.id) || sessionUser
    const unread = countChithiUnread(store, user)
    return sendJson(res, 200, {
      unread,
      lastSeenAt: user.chithiLastSeenAt || user.teamHubLastSeenAt || null,
    })
  }

  if (req.method === 'POST') {
    const { action } = getBody(req)
    if (action !== 'seen') return sendJson(res, 400, { error: 'Unknown action' })

    const now = new Date().toISOString()
    await updateStore((draft) => {
      const row = draft.users.find((u) => u.id === sessionUser.id)
      if (row) {
        row.chithiLastSeenAt = now
        row.teamHubLastSeenAt = now
      }
      return draft
    })

    const store = await readStore()
    const user = store.users.find((u) => u.id === sessionUser.id) || sessionUser
    return sendJson(res, 200, {
      unread: countChithiUnread(store, user),
      lastSeenAt: user.chithiLastSeenAt || user.teamHubLastSeenAt || now,
      user,
    })
  }

  return methodNotAllowed(res, ['GET', 'POST'])
}
