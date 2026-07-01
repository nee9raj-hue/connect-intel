import { requireUser, refreshSessionCookie } from '../auth.js'
import { buildOrgUserResponse, inviteTeamMember } from '../organizations.js'
import { deliverTeamInviteEmail } from '../email.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { assertOrgPermission, permissionDeniedResponse } from '../permissionEnforce.js'
import { readStore } from '../store.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])

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

  const body = getBody(req)
  try {
    const outcome = await inviteTeamMember(user.organizationId, user.id, {
      email: body.email,
      name: body.name,
      canSearch: Boolean(body.canSearch),
      pipelineRole: body.pipelineRole,
      skipEmail: true,
    })

    const emailDelivery = await deliverTeamInviteEmail(outcome.emailParams)
    const email = emailDelivery.deferred ? null : emailDelivery

    const refreshed = buildOrgUserResponse(
      outcome.store.users.find((u) => u.id === user.id),
      outcome.store
    )
    await refreshSessionCookie(res, refreshed)

    return sendJson(res, 200, {
      ok: true,
      user: refreshed,
      inviteUrl: outcome.inviteUrl,
      emailPending: Boolean(emailDelivery.deferred),
      emailSent: Boolean(email?.sent),
      emailProvider: email?.provider || null,
      emailError: email?.error || email?.reason || null,
      emailHint: email?.hint || null,
      emailFrom: email?.from || null,
      emailTo: email?.to || null,
      messageId: email?.id || null,
      resendId: email?.provider === 'resend' ? email?.id : null,
      deliveryStatus: email?.deliveryStatus || null,
      resendDomainStatus: email?.resendDomainStatus || null,
      gmailSetup: email?.gmailSetup || null,
      joinedImmediately: Boolean(outcome.joinedImmediately),
    })
  } catch (error) {
    return sendJson(res, 400, { error: error.message || 'Invite failed' })
  }
}
