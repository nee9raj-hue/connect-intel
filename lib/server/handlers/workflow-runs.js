import { requireOrgAdmin } from '../auth.js'
import { listWorkflowRunsForOrg } from '../workflowRuns.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const user = await requireOrgAdmin(req, res)
  if (!user) return

  const params = new URL(req.url || '', 'http://localhost').searchParams
  const limit = Number(params.get('limit')) || 50
  const triggerType = params.get('trigger') || null
  const leadId = params.get('leadId') || null

  try {
    const runs = await listWorkflowRunsForOrg(user.organizationId, { limit, triggerType, leadId })
    return sendJson(res, 200, { runs, organizationId: user.organizationId })
  } catch (error) {
    return sendJson(res, 503, {
      runs: [],
      warning: error?.message || 'Workflow runs unavailable',
    })
  }
}
