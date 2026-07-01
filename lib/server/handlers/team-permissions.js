import { requireUser } from '../auth.js'
import { listTeamMembers, updateMemberPermissions, updateMemberStatus } from '../organizations.js'
import { readStore } from '../store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { syncMemberSqlProfile } from '../memberHierarchySync.js'
import { recordAuditEvent } from '../auditEvents.js'
import { unassignOrgMemberPipelineLeads } from '../tenantPipelineCleanup.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)
  if (req.method !== 'PATCH') return methodNotAllowed(res, ['PATCH'])

  const user = await requireUser(req, res)
  if (!user) return

  if (!user.isOrgAdmin || !user.organizationId) {
    return sendJson(res, 403, { error: 'Only your company admin can change permissions' })
  }

  const body = getBody(req)
  if (!body.userId) {
    return sendJson(res, 400, { error: 'userId is required' })
  }

  try {
    if (body.status !== undefined) {
      await updateMemberStatus(user.organizationId, body.userId, body.status)
      if (body.status === 'inactive') {
        await syncMemberSqlProfile(user.organizationId, body.userId, { clearTeam: true })
        await unassignOrgMemberPipelineLeads(user.organizationId, body.userId)
      }
    }

    if (
      body.canSearch !== undefined ||
      body.pipelineRole !== undefined ||
      body.marketingRole !== undefined
    ) {
      await updateMemberPermissions(user.organizationId, body.userId, {
        canSearch: body.canSearch,
        pipelineRole: body.pipelineRole,
        marketingRole: body.marketingRole,
      })
    }

    await syncMemberSqlProfile(user.organizationId, body.userId, {
      pipelineRole: body.pipelineRole,
      sqlRole: body.sqlRole,
      teamId: body.teamId,
      departmentId: body.departmentId,
      clearTeam: body.status === 'inactive',
    })

    void recordAuditEvent({
      organizationId: user.organizationId,
      actorUserId: user.id,
      action: 'team.member_updated',
      resourceType: 'user',
      resourceId: body.userId,
      outcome: 'success',
      metadata: {
        status: body.status,
        pipelineRole: body.pipelineRole,
        marketingRole: body.marketingRole,
      },
    }).catch(() => {})

    const store = await readStore()
    return sendJson(res, 200, { members: listTeamMembers(store, user.organizationId) })
  } catch (error) {
    return sendJson(res, 400, { error: error.message || 'Update failed' })
  }
}
