import { listPipelineSavedEntries, resolveOrgRole } from './organizations.js'

/** PostgREST scope for pipeline_leads reads (org, user, assignee). */
export function resolvePipelineTableScope(user, metaStore, filters = {}) {
  const { orgRole, accountType } = resolveOrgRole(user, metaStore)
  const scope = {}

  if (accountType === 'individual' || !user.organizationId) {
    scope.userId = user.id
    return scope
  }

  scope.organizationId = user.organizationId

  if (orgRole === 'org_admin') {
    const assignee = String(filters.assigneeUserId || '').trim()
    if (assignee === '__unassigned__') scope.unassigned = true
    else if (assignee) scope.assigneeUserId = assignee
    return scope
  }

  scope.assigneeUserId = user.id
  return scope
}

/** Visible rows after loading a raw entry batch from the table. */
export function visiblePipelineFromEntries(metaStore, user, entries) {
  const store = { ...metaStore, savedLeads: entries || [] }
  return listPipelineSavedEntries(store, user)
}
