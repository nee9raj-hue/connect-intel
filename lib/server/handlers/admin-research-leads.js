import { requireAdmin } from '../auth.js'
import { persistDiscoveredLeads } from '../leadPersistence.js'
import { discoverLeadsWithPerplexity, isPerplexityConfigured } from '../perplexity.js'
import { updateStore } from '../store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])

  const user = await requireAdmin(req, res)
  if (!user) return

  if (!isPerplexityConfigured()) {
    return sendJson(res, 400, {
      error: 'PERPLEXITY_API_KEY is not set on the server',
    })
  }

  const { filters = {}, count = 10 } = getBody(req)
  const discovery = await discoverLeadsWithPerplexity(filters, Math.min(count, 15))

  let persisted = { contactsCreated: 0, companiesCreated: 0 }
  const toPersist = discovery.allParsed?.length ? discovery.allParsed : discovery.leads
  if (toPersist?.length) {
    await updateStore((draft) => {
      const result = persistDiscoveredLeads(draft, toPersist, {
        source: 'perplexity',
        actor: user,
        filters,
      })
      persisted = {
        contactsCreated: result.contactsCreated,
        companiesCreated: result.companiesCreated,
      }
      return result.store
    })
  }

  return sendJson(res, 200, {
    leads: discovery.leads || [],
    notice: discovery.notice,
    error: discovery.error || null,
    persisted,
    importHint:
      persisted.contactsCreated > 0
        ? `${persisted.contactsCreated} contact(s) saved to the database — future searches will reuse them.`
        : 'Review rows, then paste into Excel template or run research again.',
  })
}
