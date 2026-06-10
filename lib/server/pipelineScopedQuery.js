import { CRM_STATUSES } from './crm.js'
import { loadHierarchyProfile } from './pipelineHierarchyProfile.js'
import { isPipelineHierarchyRbacEnabled } from './infra/config.js'
import { pipelineShardNameForUser } from './pipelineShard.js'
import { resolveOrgRole } from './organizations.js'

const ADMIN_DEFAULT_LIMIT = 100
const ADMIN_MAX_LIMIT = 500

/**
 * HubSpot-style data scoping for pipeline_leads (indexed columns + PostgREST filters).
 *
 * Roles (profiles.role):
 *   rep     → owner_id = current user (cannot bypass)
 *   manager → team_id = user's team; scope=all_departments → department_id
 *   admin   → org-wide; pagination enforced (LIMIT 100 default)
 */
export async function getScopedLeadsQuery(currentUser, filters = {}, metaStore = null) {
  const shardName = pipelineShardNameForUser(currentUser)
  const { orgRole, accountType } = resolveOrgRole(currentUser, metaStore || {})
  const organizationId = currentUser.organizationId || null

  const base = {
    shardName,
    organizationId,
    table: 'pipeline_leads',
    role: 'rep',
    enforced: true,
    postgrestParts: [`shard_name=eq.${encodeURIComponent(shardName)}`],
    scope: {
      organizationId,
      ownerId: null,
      teamId: null,
      departmentId: null,
    },
    pagination: {
      limit: Math.min(
        ADMIN_MAX_LIMIT,
        Math.max(1, Math.floor(Number(filters.limit) || ADMIN_DEFAULT_LIMIT))
      ),
      offset: Math.max(0, Math.floor(Number(filters.offset) || 0)),
    },
    rpc: {
      p_shard_name: shardName,
      p_organization_id: organizationId,
      p_owner_id: null,
      p_team_id: null,
      p_department_id: null,
    },
  }

  if (organizationId) {
    base.postgrestParts.push(`organization_id=eq.${encodeURIComponent(organizationId)}`)
  }

  if (accountType === 'individual' || !organizationId) {
    base.role = 'individual'
    base.scope.ownerId = currentUser.id
    base.postgrestParts.push(`owner_id=eq.${encodeURIComponent(currentUser.id)}`)
    base.rpc.p_owner_id = currentUser.id
    return finalizeStatusFilter(base, filters)
  }

  if (!isPipelineHierarchyRbacEnabled()) {
    return legacyOrgScope(base, currentUser, filters, orgRole)
  }

  const profile = await loadHierarchyProfile(currentUser, metaStore)
  const role = normalizeRole(profile, orgRole)

  base.role = role

  if (role === 'admin') {
    const assignee = String(filters.assigneeUserId || '').trim()
    if (assignee === '__unassigned__') {
      base.postgrestParts.push('owner_id=is.null')
      base.scope.unassigned = true
    } else if (assignee) {
      base.postgrestParts.push(`owner_id=eq.${encodeURIComponent(assignee)}`)
      base.scope.ownerId = assignee
      base.rpc.p_owner_id = assignee
    }
    return finalizeStatusFilter(base, filters)
  }

  if (role === 'manager') {
    const teamId = profile?.teamId || null
    const departmentId = profile?.departmentId || null
    const scopeMode = String(filters.scope || filters.hierarchyScope || '').trim()

    if (scopeMode === 'all_departments' && departmentId) {
      base.scope.departmentId = departmentId
      base.postgrestParts.push(`department_id=eq.${encodeURIComponent(departmentId)}`)
      base.rpc.p_department_id = departmentId
    } else if (teamId) {
      base.scope.teamId = teamId
      base.postgrestParts.push(`team_id=eq.${encodeURIComponent(teamId)}`)
      base.rpc.p_team_id = teamId
    } else if (departmentId) {
      base.scope.departmentId = departmentId
      base.postgrestParts.push(`department_id=eq.${encodeURIComponent(departmentId)}`)
      base.rpc.p_department_id = departmentId
    }

    const assignee = String(filters.assigneeUserId || '').trim()
    if (assignee && assignee !== '__unassigned__') {
      base.postgrestParts.push(`owner_id=eq.${encodeURIComponent(assignee)}`)
      base.scope.ownerId = assignee
      base.rpc.p_owner_id = assignee
    } else if (assignee === '__unassigned__') {
      base.postgrestParts.push('owner_id=is.null')
      base.scope.unassigned = true
    }

    return finalizeStatusFilter(base, filters)
  }

  // rep — hard lock to own leads; ignore assigneeUserId bypass attempts
  base.scope.ownerId = currentUser.id
  base.postgrestParts.push(`owner_id=eq.${encodeURIComponent(currentUser.id)}`)
  base.rpc.p_owner_id = currentUser.id
  return finalizeStatusFilter(base, filters)
}

function normalizeRole(profile, orgRole) {
  if (orgRole === 'org_admin') return 'admin'
  const r = String(profile?.role || 'rep').toLowerCase()
  if (r === 'admin') return 'admin'
  if (r === 'manager') return 'manager'
  return 'rep'
}

function legacyOrgScope(base, user, filters, orgRole) {
  if (orgRole === 'org_admin') {
    base.role = 'admin'
    const assignee = String(filters.assigneeUserId || '').trim()
    if (assignee === '__unassigned__') {
      base.postgrestParts.push('entry->>assignedToUserId=is.null')
      base.scope.unassigned = true
    } else if (assignee) {
      base.postgrestParts.push(`owner_id=eq.${encodeURIComponent(assignee)}`)
      base.scope.ownerId = assignee
      base.rpc.p_owner_id = assignee
    }
    return finalizeStatusFilter(base, filters)
  }

  base.role = 'rep'
  base.scope.ownerId = user.id
  base.postgrestParts.push(`owner_id=eq.${encodeURIComponent(user.id)}`)
  base.rpc.p_owner_id = user.id
  return finalizeStatusFilter(base, filters)
}

function finalizeStatusFilter(base, filters) {
  const status = String(filters.status || 'all').trim()
  if (status && status !== 'all' && CRM_STATUSES.includes(status)) {
    base.postgrestParts.push(`lead_status=eq.${encodeURIComponent(status)}`)
    base.rpc.p_status = status
    base.status = status
  } else {
    base.status = 'all'
  }
  base.queryString = base.postgrestParts.join('&')
  return base
}

/** Build PostgREST list URL for pipeline_leads with scope + pagination. */
export function scopedLeadsListUrl(scoped, { select = 'entry', order = 'updated_at.desc' } = {}) {
  const parts = [
    scoped.queryString,
    `select=${encodeURIComponent(select)}`,
    `order=${order}`,
    `limit=${scoped.pagination.limit}`,
    `offset=${scoped.pagination.offset}`,
  ]
  return `pipeline_leads?${parts.join('&')}`
}
