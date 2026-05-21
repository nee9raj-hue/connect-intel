import { findInviteByToken, getOrganization } from '../../lib/server/organizations.js'
import { readStore } from '../../lib/server/store.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../../lib/server/http.js'
import { TEAM_PIPELINE_ROLES } from '../../lib/server/pipelineRoles.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const token = new URL(req.url || '', 'http://localhost').searchParams.get('token')
  if (!token) {
    return sendJson(res, 400, { error: 'token is required' })
  }

  const store = await readStore()
  const invite = findInviteByToken(store, token)
  if (!invite) {
    return sendJson(res, 404, { error: 'Invite not found or already used' })
  }

  if (invite.expiresAt && new Date(invite.expiresAt).getTime() < Date.now()) {
    return sendJson(res, 410, { error: 'Invite has expired' })
  }

  const org = getOrganization(store, invite.organizationId)
  const roleMeta = TEAM_PIPELINE_ROLES.find((r) => r.id === invite.pipelineRole)

  return sendJson(res, 200, {
    invite: {
      email: invite.email,
      organizationName: org?.name || 'Company',
      organizationLogoUrl: org?.logoUrl || null,
      pipelineRole: invite.pipelineRole || 'member',
      pipelineRoleLabel: roleMeta?.label || 'Team member',
      canSearch: Boolean(invite.canSearch),
      expiresAt: invite.expiresAt,
    },
  })
}
