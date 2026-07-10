import { requireUser, requireOrgAdmin } from '../auth.js'
import { resolveOrgRole } from '../organizations.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { recomputeOrgLeadScores } from '../leadScoreRecompute.js'
import { recordAuditEvent } from '../auditEvents.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])

  const user = await requireUser(req, res)
  if (!user) return

  const admin = await requireOrgAdmin(req, res)
  if (!admin) return

  const store = await import('../store.js').then((m) => m.readStore())
  const { accountType } = resolveOrgRole(admin, store)
  const organizationId =
    accountType === 'company' && admin.organizationId ? admin.organizationId : null

  if (!organizationId) {
    return sendJson(res, 400, { error: 'CRM workspace scoring requires a company account' })
  }

  const result = await recomputeOrgLeadScores(admin, organizationId)

  void recordAuditEvent({
    organizationId,
    actorUserId: admin.id,
    action: 'crm.lead_scores_recomputed',
    resourceType: 'organization',
    resourceId: organizationId,
    outcome: 'success',
    metadata: result,
  }).catch(() => {})

  return sendJson(res, 200, {
    ok: true,
    ...result,
    message: `Recalculated ${result.updated} lead score(s) (${result.scanned} scanned).`,
  })
}
