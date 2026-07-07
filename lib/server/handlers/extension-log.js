import { requireUser } from '../auth.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { recordAuditEvent } from '../auditEvents.js'
import { recordWorkspacePulse } from '../teamWorkspaceUsage.js'
import { assertOrgPermission, permissionDeniedResponse } from '../permissionEnforce.js'
import { readStore } from '../store.js'

const ALLOWED_ACTIONS = new Set([
  'extension.gmail_opened',
  'extension.lead_matched',
  'extension.trail_sync_requested',
  'extension.trail_sync_completed',
  'extension.open_in_app',
  'extension.capture_opened',
  'extension.lead_capture_requested',
  'extension.lead_captured',
  'extension.lead_capture_existing',
])

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])

  const user = await requireUser(req, res)
  if (!user) return

  const metaStore = await readStore({ only: ['users', 'organizations', 'organizationMemberships'] })
  try {
    await assertOrgPermission(user, 'edit_leads', metaStore)
  } catch (permError) {
    const denied = permissionDeniedResponse(permError)
    return sendJson(res, denied.status, denied.body)
  }

  const body = getBody(req) || {}
  const action = String(body.action || '').trim()
  if (!ALLOWED_ACTIONS.has(action)) {
    return sendJson(res, 400, { error: 'Invalid extension action' })
  }

  const leadId = body.leadId ? String(body.leadId).slice(0, 128) : null
  const metadata = body.metadata && typeof body.metadata === 'object' ? body.metadata : {}

  void recordAuditEvent({
    organizationId: user.organizationId,
    actorUserId: user.id,
    action,
    resourceType: leadId ? 'lead' : 'extension',
    resourceId: leadId || 'gmail',
    outcome: 'success',
    metadata: {
      ...metadata,
      source: 'chrome_extension',
    },
  }).catch(() => {})

  if (leadId) {
    void recordWorkspacePulse(user.id, { panel: 'extension', leadId }).catch(() => {})
  }

  return sendJson(res, 200, { ok: true, action })
}
