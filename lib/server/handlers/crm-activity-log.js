import { requireUser } from '../auth.js'
import { buildActivityFeed } from '../crmWorkflow.js'
import { listPipelineSavedEntries } from '../organizations.js'
import { sanitizeCrmForTenant } from '../tenantIsolation.js'
import { readStore } from '../store.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const user = await requireUser(req, res)
  if (!user) return

  const store = await readStore()
  const entries = listPipelineSavedEntries(store, user).map((entry) => ({
    ...entry,
    crm: sanitizeCrmForTenant(store, user, entry.crm),
  }))

  return sendJson(res, 200, {
    activities: buildActivityFeed(entries, { limit: 80 }),
  })
}
