import { requireUser } from '../auth.js'
import { buildActivityFeed } from '../crmWorkflow.js'
import { listPipelineEntries } from '../organizations.js'
import { readStore } from '../store.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const user = await requireUser(req, res)
  if (!user) return

  const store = await readStore()
  const visibleIds = new Set(listPipelineEntries(store, user).map((l) => l.id))
  const entries = store.savedLeads.filter((e) => visibleIds.has(e.lead?.id))

  return sendJson(res, 200, {
    activities: buildActivityFeed(entries, { limit: 80 }),
  })
}
