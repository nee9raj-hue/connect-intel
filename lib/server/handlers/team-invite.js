import { requireUser, refreshSessionCookie } from '../auth.js'
import { buildOrgUserResponse, inviteTeamMember } from '../organizations.js'
import { readStore } from '../store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])

  const user = await requireUser(req, res)
  if (!user) return

  if (!user.isOrgAdmin || !user.organizationId) {
    return sendJson(res, 403, { error: 'Only your company admin can invite team members' })
  }

  const body = getBody(req)
  try {
    const outcome = await inviteTeamMember(user.organizationId, user.id, {
      email: body.email,
      name: body.name,
      canSearch: Boolean(body.canSearch),
      pipelineRole: body.pipelineRole,
    })

    const store = await readStore()
    const refreshed = buildOrgUserResponse(
      store.users.find((u) => u.id === user.id),
      store
    )
    await refreshSessionCookie(res, refreshed)

    return sendJson(res, 200, {
      ok: true,
      user: refreshed,
      inviteUrl: outcome.inviteUrl,
      emailSent: Boolean(outcome.email?.sent),
      emailProvider: outcome.email?.provider || null,
      emailError: outcome.email?.error || outcome.email?.reason || null,
      emailHint: outcome.email?.hint || null,
      emailFrom: outcome.email?.from || null,
      emailTo: outcome.email?.to || null,
      messageId: outcome.email?.id || null,
      resendId: outcome.email?.provider === 'resend' ? outcome.email?.id : null,
      deliveryStatus: outcome.email?.deliveryStatus || null,
      resendDomainStatus: outcome.email?.resendDomainStatus || null,
      gmailSetup: outcome.email?.gmailSetup || null,
      joinedImmediately: Boolean(outcome.joinedImmediately),
    })
  } catch (error) {
    return sendJson(res, 400, { error: error.message || 'Invite failed' })
  }
}
