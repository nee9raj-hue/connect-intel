import { requireOrgAdmin } from '../auth.js'
import { ensureBuiltInDatabase } from '../seed.js'
import { readStore, updateStore } from '../store.js'
import { importOrgPipeline, listOrgImportOverview } from '../orgPipelineImport.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { resolveOrgRole } from '../organizations.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  const user = await requireOrgAdmin(req, res)
  if (!user) return

  await ensureBuiltInDatabase()
  let store = await readStore()
  const { accountType } = resolveOrgRole(user, store)

  if (accountType !== 'company' || !user.organizationId) {
    return sendJson(res, 403, {
      error: 'Pipeline import is available for company accounts only. Complete onboarding as a company.',
    })
  }

  const organizationId = user.organizationId

  if (req.method === 'GET') {
    return sendJson(res, 200, listOrgImportOverview(store, organizationId))
  }

  if (req.method === 'POST') {
    const body = getBody(req)
    const rows = Array.isArray(body.rows) ? body.rows : []
    const datasetType = body.datasetType || 'general'
    const addToPipeline = body.addToPipeline !== false

    if (!rows.length) {
      return sendJson(res, 400, { error: 'Upload rows are required' })
    }

    const result = importOrgPipeline(store, {
      rows,
      datasetType,
      actor: user,
      organizationId,
      addToPipeline,
    })

    await updateStore(() => result.store)

    const overview = listOrgImportOverview(result.store, organizationId)
    return sendJson(res, 200, {
      ...overview,
      stats: result.stats,
      message: `Imported ${result.stats.contactsCreated} contact(s) into master data. ${result.stats.pipelineAdded} added to your CRM pipeline.`,
    })
  }

  return methodNotAllowed(res, ['GET', 'POST'])
}
