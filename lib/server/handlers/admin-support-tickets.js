import { requireAdmin } from '../auth.js'
import { readStore, updateStore } from '../store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import {
  applyAdminTicketAction,
  getAdminTicketDetail,
  listTicketsForAdmin,
  notifyCustomerAdminReply,
  supportTicketMetrics,
} from '../supportTickets.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  const actor = await requireAdmin(req, res)
  if (!actor) return

  if (req.method === 'GET') {
    const store = await readStore()
    const ticketId = req.query?.ticketId
    if (ticketId) {
      const detail = getAdminTicketDetail(store, ticketId)
      if (!detail) return sendJson(res, 404, { error: 'Ticket not found' })
      return sendJson(res, 200, { ticket: detail })
    }

    const status = req.query?.status || 'active'
    const q = req.query?.q || ''
    const limit = Math.min(120, Math.max(1, Number(req.query?.limit) || 80))

    return sendJson(res, 200, {
      metrics: supportTicketMetrics(store),
      tickets: listTicketsForAdmin(store, { status, q, limit }),
    })
  }

  if (req.method === 'PATCH') {
    const body = getBody(req) || {}
    const { ticketId, action, status, message, internalNote } = body
    if (!ticketId || !action) {
      return sendJson(res, 400, { error: 'ticketId and action required' })
    }

    let ticket
    await updateStore((draft) => {
      ticket = applyAdminTicketAction(draft, actor, ticketId, {
        action,
        status,
        message,
        internalNote,
      })
      return draft
    })

    if (action === 'reply' && message) {
      await notifyCustomerAdminReply({ ticket, replyMessage: message })
    }

    const store = await readStore()
    return sendJson(res, 200, {
      ok: true,
      ticket: getAdminTicketDetail(store, ticket.id),
    })
  }

  return methodNotAllowed(res, ['GET', 'PATCH'])
}
