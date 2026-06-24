import { requireAdmin } from '../auth.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import {
  auditAllOrganizationsTenantIsolation,
  findForeignPipelineOwnersForOrg,
  repairForeignPipelineOwnersForOrg,
} from '../tenantPipelineCleanup.js'
import { isSupabaseEnabled } from '../supabaseClient.js'

/** Platform admin — audit/repair cross-tenant pipeline assignees (uses production Supabase env). */
export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  const actor = await requireAdmin(req, res)
  if (!actor) return

  if (req.method !== 'GET' && req.method !== 'POST') {
    return methodNotAllowed(res, ['GET', 'POST'])
  }

  if (!isSupabaseEnabled()) {
    return sendJson(res, 503, { error: 'Supabase not configured on this deployment' })
  }

  const body = req.method === 'POST' ? getBody(req) : {}
  const params = new URL(req.url || '', 'http://localhost').searchParams
  const organizationId = body.organizationId || params.get('org') || null
  const fix = body.fix === true || params.get('fix') === '1'

  try {
    if (organizationId) {
      const audit = await findForeignPipelineOwnersForOrg(organizationId)
      if (!fix) {
        return sendJson(res, 200, {
          ok: audit.foreignOwnerIds.length === 0,
          organizationId,
          foreignOwnerIds: audit.foreignOwnerIds,
          contaminatedLeadCount: audit.rows?.length ?? 0,
          dryRun: true,
        })
      }
      const repaired = await repairForeignPipelineOwnersForOrg(organizationId, { dryRun: false })
      return sendJson(res, 200, { ok: true, ...repaired })
    }

    if (!fix) {
      const report = await auditAllOrganizationsTenantIsolation({ dryRun: true })
      return sendJson(res, 200, { ok: report.issueCount === 0, dryRun: true, ...report })
    }

    const report = await auditAllOrganizationsTenantIsolation({ dryRun: false })
    return sendJson(res, 200, { ok: true, dryRun: false, ...report })
  } catch (error) {
    return sendJson(res, 500, { error: error.message || 'Tenant audit failed' })
  }
}
