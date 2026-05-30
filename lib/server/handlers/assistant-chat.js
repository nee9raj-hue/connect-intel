import { requireUser } from '../auth.js'
import {
  getAssistantHistory,
  processAssistantMessage,
} from '../assistantChat.js'
import { readStore, updateStore } from '../store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  const user = await requireUser(req, res)
  if (!user) return

  if (req.method === 'GET') {
    const store = await readStore()
    return sendJson(res, 200, getAssistantHistory(store, user.id))
  }

  if (req.method === 'POST') {
    const body = getBody(req) || {}

    if (body.action === 'escalate') {
      return sendJson(res, 403, {
        error: 'Support tickets from the assistant are disabled. Email invite@connectintel.net for account issues.',
      })
    }

    const message = body.message
    let out
    await updateStore(async (draft) => {
      out = await processAssistantMessage(draft, user, message)
      return draft
    })
    if (out.error) return sendJson(res, 429, { error: out.error })
    return sendJson(res, 200, out)
  }

  return methodNotAllowed(res, ['GET', 'POST'])
}
