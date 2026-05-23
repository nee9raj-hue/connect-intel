import { requireUser } from '../auth.js'
import { getUserCrmGmail } from '../crmUserGmail.js'
import { readStore } from '../store.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { isGmailOAuthConfigured } from '../gmailOAuth.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const user = await requireUser(req, res)
  if (!user) return

  const store = await readStore()
  const freshUser = store.users.find((u) => u.id === user.id) || user
  const oauth = getUserCrmGmail(freshUser)

  return sendJson(res, 200, {
    configured: isGmailOAuthConfigured(),
    connected: Boolean(oauth),
    mailbox: oauth?.email || null,
    connectedAt: oauth?.connectedAt || null,
  })
}
