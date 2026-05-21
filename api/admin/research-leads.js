import { requireUser } from '../../lib/server/auth.js'
import { persistDiscoveredLeads } from '../../lib/server/leadPersistence.js'
import { discoverLeadsWithPerplexity, isPerplexityConfigured } from '../../lib/server/perplexity.js'
import { updateStore } from '../../lib/server/store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../../lib/server/http.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])

  const user = await requireUser(req, res)
  if (!user) return

  if (user.role !== 'admin') {
    return sendJson(res, 403, { error: 'Admin access required' })
  }

  if (!isPerplexityConfigured()) {
    return sendJson(res, 400, {
      error: 'PERPLEXITY_API_KEY is not set on the server',
    })
  }

  const { filters = {}, count = 10 } = getBody(req)
  const discovery = await discoverLeadsWithPerplexity(filters, Math.min(count, 15))

  let persisted = { contactsCreated: 0, companiesCreated: 0 }
  if (discovery.leads?.length) {
    await updateStore((draft) => {
      const result = persistDiscoveredLeads(draft, discovery.leads, {
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
