import { requireAdmin } from '../../lib/server/auth.js'
import { listAdminOverview, importRowsIntoStore } from '../../lib/server/imports.js'
import { ensureBuiltInDatabase } from '../../lib/server/seed.js'
import { readStore, updateStore } from '../../lib/server/store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../../lib/server/http.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  const user = await requireAdmin(req, res)
  if (!user) return

  if (req.method === 'GET') {
    await ensureBuiltInDatabase()
    const store = await readStore()
    return sendJson(res, 200, listAdminOverview(store))
  }

  if (req.method === 'POST') {
    const body = getBody(req)
    const rows = Array.isArray(body.rows) ? body.rows : []
    const datasetType = body.datasetType || 'general'

    if (!rows.length) {
      return sendJson(res, 400, { error: 'Upload rows are required' })
    }

    const store = await updateStore((draft) => importRowsIntoStore(draft, datasetType, rows, user).store)
    const overview = listAdminOverview(store)
    return sendJson(res, 200, overview)
  }

  return methodNotAllowed(res, ['GET', 'POST'])
}

