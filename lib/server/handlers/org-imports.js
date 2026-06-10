import { requireUser } from '../auth.js'
import { ensureBuiltInDatabase } from '../seed.js'
import { readStore, updateStore } from '../store.js'
import { importOrgPipeline, listOrgImportOverview } from '../orgPipelineImport.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { resolveOrgRole } from '../organizations.js'
import { formatImportSuccessMessage } from '../../importMessages.js'
import { completeLeadImportJob, createLeadImportJob } from '../leadImportJobs.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  const user = await requireUser(req, res)
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

    const isAdmin = user.isOrgAdmin || user.orgRole === 'org_admin'
    const job = await createLeadImportJob(organizationId, user, {
      filename: body.filename || 'pipeline-import.csv',
      totalRows: rows.length,
    })

    const result = importOrgPipeline(store, {
      rows,
      datasetType,
      actor: user,
      organizationId,
      addToPipeline,
      assignToActor: !isAdmin,
      tagIds: Array.isArray(body.tagIds) ? body.tagIds : [],
    })

    await updateStore(() => result.store)

    if (job?.id) {
      await completeLeadImportJob(job.id, organizationId, {
        created: result.stats?.pipelineAdded,
        updated: result.stats?.pipelineUpdated,
        skipped: result.stats?.pipelineSkipped,
        errors: result.stats?.rejectedRows,
      })
    }

    const overview = listOrgImportOverview(result.store, organizationId)
    return sendJson(res, 200, {
      ...overview,
      stats: result.stats,
      jobId: job?.id || null,
      message: formatImportSuccessMessage(result.stats, { addToPipeline }),
    })
  }

  return methodNotAllowed(res, ['GET', 'POST'])
}
