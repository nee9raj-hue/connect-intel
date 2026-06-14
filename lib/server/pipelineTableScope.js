import { listPipelineSavedEntries, resolveOrgRole } from './organizations.js'
import { getScopedLeadsQuery } from './pipelineScopedQuery.js'
import { isPipelineHierarchyRbacEnabled } from './infra/config.js'

/** PostgREST scope for pipeline_leads reads (org, user, assignee). */
export function resolvePipelineTableScope(user, metaStore, filters = {}) {
  const { orgRole, accountType } = resolveOrgRole(user, metaStore)
  const scope = {}

  if (accountType === 'individual' || !user.organizationId) {
    scope.userId = user.id
    scope.ownerId = user.id
    return scope
  }

  scope.organizationId = user.organizationId

  if (orgRole === 'org_admin') {
    const assignee = String(filters.assigneeUserId || '').trim()
    if (assignee === '__unassigned__') scope.unassigned = true
    else if (assignee) scope.ownerId = assignee
    return scope
  }

  const assignee = String(filters.assigneeUserId || '').trim()
  if (assignee === '__unassigned__') {
    scope.unassigned = true
    return scope
  }
  if (assignee) {
    if (orgRole !== 'org_admin' && assignee !== String(user.id)) {
      scope.ownerId = user.id
      scope.includeUnassigned = true
      return scope
    }
    scope.ownerId = assignee
    return scope
  }
  scope.ownerId = user.id
  scope.includeUnassigned = true
  return scope
}

/** Async scope with HubSpot-style RBAC (preferred when hierarchy columns exist). */
export async function resolvePipelineTableScopeAsync(user, metaStore, filters = {}) {
  if (!isPipelineHierarchyRbacEnabled()) {
    return resolvePipelineTableScope(user, metaStore, filters)
  }
  const scoped = await getScopedLeadsQuery(user, filters, metaStore)
  return {
    organizationId: scoped.organizationId,
    ownerId: scoped.scope.ownerId,
    teamId: scoped.scope.teamId,
    departmentId: scoped.scope.departmentId,
    unassigned: scoped.scope.unassigned,
    role: scoped.role,
    scoped,
  }
}

/** Visible rows after loading a raw entry batch from the table. */
export function visiblePipelineFromEntries(metaStore, user, entries) {
  const store = { ...metaStore, savedLeads: entries || [] }
  return listPipelineSavedEntries(store, user)
}
