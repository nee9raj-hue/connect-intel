import { requireUser } from '../auth.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { getLeadImportJob } from '../leadImportJobs.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const user = await requireUser(req, res)
  if (!user) return

  if (user.accountType !== 'company' || !user.organizationId) {
    return sendJson(res, 403, { error: 'Company workspace required' })
  }

  const url = new URL(req.url || '', 'http://local')
  const jobId = String(url.searchParams.get('id') || url.searchParams.get('jobId') || '').trim()
  if (!jobId) return sendJson(res, 400, { error: 'id query parameter is required' })

  const job = await getLeadImportJob(jobId, user.organizationId)
  if (!job) return sendJson(res, 404, { error: 'Import job not found' })

  return sendJson(res, 200, { job })
}
