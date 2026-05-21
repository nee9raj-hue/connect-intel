import { requireUser } from '../../lib/server/auth.js'
import { discoverLeadsWithPerplexity, isPerplexityConfigured } from '../../lib/server/perplexity.js'
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

  return sendJson(res, 200, {
    leads: discovery.leads || [],
    notice: discovery.notice,
    error: discovery.error || null,
    importHint: 'Review rows, then paste into Excel template or use a future one-click import.',
  })
}
