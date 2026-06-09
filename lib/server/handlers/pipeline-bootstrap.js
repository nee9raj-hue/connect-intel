import { requireUser } from '../auth.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { buildPipelineBootstrap } from '../pipelineBootstrap.js'
import { timeAsync } from '../infra/metrics.js'

function parseBootstrapQuery(url) {
  const status = String(url.searchParams.get('status') || 'all').trim()
  const q = String(url.searchParams.get('q') || '').trim()
  const cities = url.searchParams.getAll('city').map((c) => String(c).trim()).filter(Boolean)
  const states = url.searchParams.getAll('state').map((s) => String(s).trim()).filter(Boolean)
  const assigneeUserId = String(url.searchParams.get('assigneeUserId') || '').trim() || null
  const tagIds = url.searchParams.getAll('tagId').filter(Boolean)
  const minLeadScore = url.searchParams.has('minLeadScore')
    ? Number(url.searchParams.get('minLeadScore'))
    : null
  const limit = url.searchParams.get('limit')
  const offset = url.searchParams.get('offset')

  return {
    status,
    q,
    cities,
    states,
    assigneeUserId,
    tagIds,
    minLeadScore: Number.isFinite(minLeadScore) ? minLeadScore : null,
    followUpDue: url.searchParams.get('followUpDue') === '1',
    overdueFollowUp: url.searchParams.get('overdueFollowUp') === '1',
    limit,
    offset,
  }
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const user = await requireUser(req, res)
  if (!user) return

  try {
    const url = new URL(req.url || '', 'http://local')
    const payload = await timeAsync('connectintel_pipeline_bootstrap', {}, () =>
      buildPipelineBootstrap(user, parseBootstrapQuery(url))
    )
    return sendJson(res, 200, payload)
  } catch (error) {
    console.error('pipeline/bootstrap failed:', error)
    return sendJson(res, 500, {
      error: error.message || 'Could not load pipeline workspace',
    })
  }
}
