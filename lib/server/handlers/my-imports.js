import { requireUser } from '../auth.js'
import { ensureBuiltInDatabase } from '../seed.js'
import { readStore, updateStore } from '../store.js'
import { importUserPipeline, listUserImportOverview } from '../userPipelineImport.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { formatImportSuccessMessage } from '../../importMessages.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  const user = await requireUser(req, res)
  if (!user) return

  await ensureBuiltInDatabase()

  if (req.method === 'GET') {
    const store = await readStore()
    return sendJson(res, 200, listUserImportOverview(store, user.id))
  }

  if (req.method === 'POST') {
    const body = getBody(req)
    const rows = Array.isArray(body.rows) ? body.rows : []
    const datasetType = body.datasetType || 'general'
    const addToPipeline = body.addToPipeline !== false

    if (!rows.length) {
      return sendJson(res, 400, { error: 'Upload rows are required' })
    }

    const store = await readStore()
    const result = importUserPipeline(store, {
      rows,
      datasetType,
      actor: user,
      addToPipeline,
    })

    await updateStore(() => result.store)

    const overview = listUserImportOverview(result.store, user.id)
    return sendJson(res, 200, {
      ...overview,
      stats: result.stats,
      message: formatImportSuccessMessage(result.stats, { addToPipeline }),
    })
  }

  return methodNotAllowed(res, ['GET', 'POST'])
}
