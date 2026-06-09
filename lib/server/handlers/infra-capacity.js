import { requireAdmin } from '../auth.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { buildCapacityReport } from '../infra/capacityReport.js'

/** Platform admin — database size / shard breakdown (run before Supabase tier decisions). */
export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const actor = await requireAdmin(req, res)
  if (!actor) return

  try {
    const report = await buildCapacityReport()
    return sendJson(res, report.ok ? 200 : 503, report)
  } catch (error) {
    console.error('infra/capacity failed:', error)
    return sendJson(res, 500, { ok: false, error: error.message || 'Capacity report failed' })
  }
}
