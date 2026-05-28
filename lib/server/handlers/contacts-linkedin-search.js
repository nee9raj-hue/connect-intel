import { requireUser } from '../auth.js'
import { readStore } from '../store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { shapeContactRecord, userCanAccessContact } from '../pipelineContact.js'
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

  const store = contactId ? await readStore() : null
  if (contactId && !userCanAccessContact(store, user, contactId)) {
    return sendJson(res, 404, { error: 'Contact not found', matches: [] })
  }

  let mergedContact = { ...contact }
  if (contactId && store) {
    const row = store.contacts.find((c) => c.id === contactId)
    const company = row ? store.companies.find((c) => c.id === row.companyId) || null : null
    if (row) {
      const stored = shapeContactRecord(row, company)
      for (const key of [
        'firstName',
        'lastName',
        'title',
        'company',
        'email',
        'phone',
        'city',
        'state',
        'industry',
        'website',
      ]) {
        if (!String(mergedContact[key] || '').trim() && stored[key]) {
          mergedContact[key] = stored[key]
        }
      }
    }
  }

  const result = await discoverLinkedinForContact(mergedContact)
  const status = result.error && !result.matches?.length ? 422 : 200
  return sendJson(res, status, result)
}
