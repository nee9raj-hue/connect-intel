import { requireUser } from '../auth.js'
import { updateMemberPermissions, updateMemberStatus } from '../organizations.js'
import { readStore, SESSION_STORE_COLLECTIONS } from '../store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { syncMemberSqlProfile } from '../memberHierarchySync.js'
import { recordAuditEvent } from '../auditEvents.js'
import { unassignOrgMemberPipelineLeads } from '../tenantPipelineCleanup.js'
import { loadMemberProfilesMap } from '../orgHierarchy.js'
import { loadOrgTeamMembers } from '../teamMembersFresh.js'

function canManageTeam(user) {
  return Boolean(
    user?.organizationId &&
      (user.isOrgAdmin || user.orgRole === 'org_admin' || user.isPlatformAdmin)
  )
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)
  if (req.method !== 'PATCH') return methodNotAllowed(res, ['PATCH'])

  const user = await requireUser(req, res)
  if (!user) return

  if (!canManageTeam(user)) {
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
        sqlRole: body.sqlRole,
      },
    }).catch(() => {})

    const meta = await readStore({
      only: SESSION_STORE_COLLECTIONS,
      timeoutMs: 8_000,
      attempts: 1,
    })
    const [members, profileMap] = await Promise.all([
      loadOrgTeamMembers(user.organizationId, { store: meta, includeInactive: true }),
      loadMemberProfilesMap(user.organizationId),
    ])
    const enriched = members.map((m) => ({
      ...m,
      sqlRole: profileMap[m.userId]?.sqlRole || null,
      teamId: profileMap[m.userId]?.teamId || m.teamId || null,
      departmentId: profileMap[m.userId]?.departmentId || m.departmentId || null,
    }))

    return sendJson(res, 200, { members: enriched })
  } catch (error) {
    return sendJson(res, 400, { error: error.message || 'Update failed' })
  }
}
