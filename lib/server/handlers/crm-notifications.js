import { requireUser } from '../auth.js'
import { buildCrmNotifications } from '../crmNotifications.js'
import { readStore } from '../store.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { PIPELINE_STORE_COLLECTIONS } from '../pipelineStore.js'

const NOTIFICATION_STORE_COLLECTIONS = [...PIPELINE_STORE_COLLECTIONS, 'teamNotes', 'teamTasks']

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const user = await requireUser(req, res)
  if (!user) return

  const params = new URL(req.url || '', 'http://localhost').searchParams
  const since = params.get('since') || null

  try {
    const store = await readStore({ only: NOTIFICATION_STORE_COLLECTIONS })
    const data = buildCrmNotifications(store, user, { since })
    return sendJson(res, 200, data)
  } catch (error) {
    return sendJson(res, 200, {
      items: [],
      serverTime: new Date().toISOString(),
      warning: error.message || 'Notifications temporarily unavailable',
    })
  }
}
