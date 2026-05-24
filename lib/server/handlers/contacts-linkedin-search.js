import { requireUser } from '../auth.js'
import { readStore } from '../store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { userCanAccessContact } from '../pipelineContact.js'
import { discoverLinkedinForContact, isPerplexityConfigured } from '../perplexity.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'POST') {
    return methodNotAllowed(res, ['POST'])
  }

  const user = await requireUser(req, res)
  if (!user) return

  if (!isPerplexityConfigured()) {
    return sendJson(res, 503, {
      error: 'AI search is not configured. Ask your admin to set PERPLEXITY_API_KEY.',
      matches: [],
    })
  }

  const body = getBody(req)
  const contactId = String(body.contactId || '').trim()
  const contact = body.contact && typeof body.contact === 'object' ? body.contact : {}

  if (contactId) {
    const store = await readStore()
    if (!userCanAccessContact(store, user, contactId)) {
      return sendJson(res, 404, { error: 'Contact not found', matches: [] })
    }
  }

  const result = await discoverLinkedinForContact(contact)
  const status = result.error && !result.matches?.length ? 422 : 200
  return sendJson(res, status, result)
}
