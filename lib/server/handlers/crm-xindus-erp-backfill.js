import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { isSupabaseEnabled } from '../supabaseClient.js'
import { applyOverlaysToLeadPage, resolveXindusOrgId } from '../xindusErpOverlayApply.js'

function isCronAuthorized(req, body) {
  if (req.headers['x-vercel-cron'] === '1') return true
  const secret = process.env.CRON_SECRET || process.env.MARKETING_CRON_SECRET
  if (!secret) return false
  const authHeader = req.headers?.authorization || ''
  const provided = authHeader.replace(/^Bearer\s+/i, '') || req.query?.secret || body?.secret
  return provided === secret
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])

  const body = getBody(req)
  if (!isCronAuthorized(req, body)) {
    return sendJson(res, 401, { error: 'Unauthorized' })
  }
  if (!isSupabaseEnabled()) {
    return sendJson(res, 503, { error: 'Supabase not configured' })
  }

  const overlays = Array.isArray(body.overlays) ? body.overlays : []
  const classifyOnly = Boolean(body.classifyOnly)
  const fetchFromErp = Boolean(body.fetchFromErp || body.fromErp)
  if (!overlays.length && !classifyOnly && !fetchFromErp) {
    return sendJson(res, 400, { error: 'overlays required' })
  }
  if (overlays.length > 8000) return sendJson(res, 400, { error: 'too many overlays' })

  const offset = Math.max(0, Number(body.offset) || 0)
  const limit = Math.min(400, Math.max(50, Number(body.limit) || 250))
  const dryRun = Boolean(body.dryRun)
  const nameQuery = String(body.nameQuery || 'Xindus').trim() || 'Xindus'

  try {
    const organizationId = body.orgId || (await resolveXindusOrgId(nameQuery))
    if (classifyOnly) {
      const { applyErpAccountStagesToLeadPage } = await import('../erpAccountStageApply.js')
      const result = await applyErpAccountStagesToLeadPage({
        organizationId,
        offset,
        limit,
        dryRun,
      })
      return sendJson(res, 200, { ok: true, organizationId, dryRun, classifyOnly: true, ...result })
    }
    if (fetchFromErp && !overlays.length) {
      const { runXindusErpCustomerSync } = await import('../xindusErpCustomerSync.js')
      const result = await runXindusErpCustomerSync({
        mode: body.mode || req.query?.mode || 'full',
        updatedSince: body.updatedSince || null,
        offset,
        dryRun,
        nameQuery,
        organizationId,
      })
      return sendJson(res, 200, { ok: result.ok !== false, organizationId, dryRun, fetchFromErp: true, ...result })
    }
    const result = await applyOverlaysToLeadPage({
      organizationId,
      overlays,
      offset,
      limit,
      dryRun,
    })
    return sendJson(res, 200, { ok: true, organizationId, dryRun, ...result })
  } catch (err) {
    console.error('xindus erp backfill failed:', err?.message || err)
    return sendJson(res, 500, { error: err.message || 'ERP backfill failed' })
  }
}
