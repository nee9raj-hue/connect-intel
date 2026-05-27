import { requireUser } from '../auth.js'
import { buildActivityFeed } from '../crmWorkflow.js'
import { listPipelineSavedEntries } from '../organizations.js'
import { sanitizeCrmForTenant } from '../tenantIsolation.js'
import { readStore } from '../store.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { PIPELINE_STORE_COLLECTIONS } from '../pipelineStore.js'

const ACTIVITY_FEED_MAX_LEADS = 600

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const user = await requireUser(req, res)
  if (!user) return

  const store = await readStore({ only: PIPELINE_STORE_COLLECTIONS })
  const rows = listPipelineSavedEntries(store, user)
    .slice()
    .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime())
    .slice(0, ACTIVITY_FEED_MAX_LEADS)

  const entries = rows.map((entry) => ({
    ...entry,
    crm: sanitizeCrmForTenant(store, user, entry.crm),
  }))

  return sendJson(res, 200, {
    activities: buildActivityFeed(entries, { limit: 80 }),
  })
}
