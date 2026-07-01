import { requireUser, refreshSessionCookie } from '../auth.js'
import { getInviteEmailDiagnostics, sendInviteTestToSelf } from '../email.js'
import { resolveOAuthOrganizationId } from '../inviteEmailAccess.js'
import { buildOrgUserResponse } from '../organizations.js'
import { readStore } from '../store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { assertOrgPermission, permissionDeniedResponse } from '../permissionEnforce.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  const user = await requireUser(req, res)
  if (!user) return

  if (!user.organizationId) {
    return sendJson(res, 403, { error: 'Company workspace required' })
  }

  const gateStore = await readStore({
    only: ['users', 'organizations', 'organizationMemberships'],
  })
  try {
    await assertOrgPermission(user, 'manage_team', gateStore)
  } catch (permError) {
    const denied = permissionDeniedResponse(permError)
    return sendJson(res, denied.status, denied.body)
  }

  if (req.method === 'GET') {
    return sendJson(res, 200, await getInviteEmailDiagnostics(user.organizationId || null))
  }

  if (req.method === 'POST') {
    const store = await readStore()
    const organizationId = user.organizationId || resolveOAuthOrganizationId(user, store)
    const org = organizationId
      ? store.organizations.find((o) => o.id === organizationId)
      : null

    const result = await sendInviteTestToSelf({
      inviterName: user.name,
      inviterEmail: user.email,
      organizationName: org?.name || user.organizationName,
      organizationId,
    })

    const refreshed = buildOrgUserResponse(
      store.users.find((u) => u.id === user.id),
      store
    )
    await refreshSessionCookie(res, refreshed)

    return sendJson(res, 200, {
      ok: Boolean(result.sent),
      emailSent: Boolean(result.sent),
      emailProvider: result.provider || null,
      emailError: result.error || result.reason || null,
      emailHint: result.hint || null,
      messageId: result.id || null,
      resendId: result.provider === 'resend' ? result.id : null,
      deliveryStatus: result.deliveryStatus || null,
      resendDomainStatus: result.resendDomainStatus || null,
      to: result.to,
      from: result.from,
      message: result.sent
        ? `Test queued via Resend (id: ${result.id}). Check inbox and spam in 1–2 minutes.`
        : result.error || result.reason || 'Test email failed',
    })
  }

  return methodNotAllowed(res, ['GET', 'POST'])
}
