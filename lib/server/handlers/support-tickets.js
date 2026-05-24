import { requireUser } from '../auth.js'
import { readStore, updateStore } from '../store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import {
  analyzeCustomerConcern,
  createSupportTicket,
  customerTicketConfirmation,
  listTicketsForUser,
  notifyCustomerTicketCreated,
  notifySupportTeamNewTicket,
} from '../supportTickets.js'
import { buildAssistantUserContext } from '../assistantContext.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  const user = await requireUser(req, res)
  if (!user) return

  if (req.method === 'GET') {
    const store = await readStore()
    return sendJson(res, 200, { tickets: listTicketsForUser(store, user.id) })
  }

  if (req.method === 'POST') {
    const body = getBody(req) || {}
    const description = String(body.message || body.description || '').trim()
    if (!description) return sendJson(res, 400, { error: 'Please describe your concern' })

    const concern = analyzeCustomerConcern(description)
    let ticket
    let ctx

    await updateStore((draft) => {
      ctx = buildAssistantUserContext(draft, user)
      ticket = createSupportTicket(draft, user, {
        subject: body.subject || concern.suggestedSubject,
        description,
        category: body.category || concern.category,
        priority: concern.score >= 5 ? 'high' : 'normal',
        source: 'customer_portal',
      })
      return draft
    })

    await Promise.all([
      notifySupportTeamNewTicket({ ticket, user, ctx, recent: [{ role: 'customer', content: description }] }),
      notifyCustomerTicketCreated({ ticket, user }),
    ])

    return sendJson(res, 200, {
      ok: true,
      ticket: listTicketsForUser(await readStore(), user.id, { limit: 1 })[0],
      ticketNumber: ticket.ticketNumber,
      message: customerTicketConfirmation(ticket, user.email),
    })
  }

  return methodNotAllowed(res, ['GET', 'POST'])
}
