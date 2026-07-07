import { requireUser } from '../auth.js'
import {
  getAssistantHistory,
  processAssistantMessage,
  recordAssistantEscalation,
  sendAssistantEscalationEmail,
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
      let escalation
      await updateStore((draft) => {
        escalation = recordAssistantEscalation(draft, user, {
          message: body.message,
          threadId: body.threadId,
        })
        return draft
      })
      const resolved = await sendAssistantEscalationEmail(escalation)
      return sendJson(res, 200, {
        ok: true,
        ticketId: resolved.ticketId,
        ticketNumber: resolved.ticketNumber,
        message: resolved.message,
        myTickets: getAssistantHistory(await readStore(), user.id).myTickets,
      })
    }

    const message = body.message
    const uiContext = {
      panel: body.panel || body.uiContext?.panel || null,
      tab: body.tab || body.uiContext?.tab || null,
      leadId: body.leadId || body.uiContext?.leadId || null,
      copilotTab: body.copilotTab || body.uiContext?.copilotTab || 'copilot',
      mode: body.mode || body.uiContext?.mode || null,
      editFromMessageId: body.editFromMessageId || body.uiContext?.editFromMessageId || null,
    }
    let out
    await updateStore(async (draft) => {
      out = await processAssistantMessage(draft, user, message, uiContext)
      return draft
    })
    if (out.error) return sendJson(res, 429, { error: out.error })
    return sendJson(res, 200, out)
  }

  return methodNotAllowed(res, ['GET', 'POST'])
}
