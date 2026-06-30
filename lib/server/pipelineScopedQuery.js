import { CRM_STATUSES } from './crm.js'
import { loadHierarchyProfile } from './pipelineHierarchyProfile.js'
import { isPipelineHierarchyRbacEnabled } from './infra/config.js'
import { pipelineShardNameForUser } from './pipelineShard.js'
import { resolveOrgRole } from './organizations.js'
import { resolveManagerVisibleOwnerIds } from './pipelineManagerScope.js'
import { decodePipelineCursor, postgrestKeysetFilter } from './pipelineKeyset.js'
import { appendPipelineFilterSqlParts } from './pipelineFilterSql.js'
import {
  pipelineAssigneePostgrestFilter,
  pipelineCrmStatusPostgrestFilter,
  pipelineExcludeUnassignedAssigneePostgrestFilter,
  pipelineRepMyAssignedPostgrestFilter,
  pipelineUnassignedAssigneePostgrestFilter,
} from './pipelineQuery.js'

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
      cursor: decodePipelineCursor(filters.cursor),
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
    const teamId = String(filters.teamId || '').trim()
    if (teamId) {
      base.scope.teamId = teamId
      base.postgrestParts.push(`team_id=eq.${encodeURIComponent(teamId)}`)
      base.rpc.p_team_id = teamId
    }
    const assignee = String(filters.assigneeUserId || '').trim()
    if (assignee === '__unassigned__') {
      base.postgrestParts.push(pipelineUnassignedAssigneePostgrestFilter())
      base.scope.unassigned = true
    } else if (assignee) {
      const ownerFilter = pipelineAssigneePostgrestFilter(assignee)
      if (ownerFilter) base.postgrestParts.push(ownerFilter)
      base.scope.ownerId = assignee
      base.rpc.p_owner_id = assignee
    } else {
      base.postgrestParts.push(pipelineExcludeUnassignedAssigneePostgrestFilter())
    }
    return finalizeStatusFilter(base, filters)
  }

  if (role === 'manager') {
    const teamId = profile?.teamId || null
    const departmentId = profile?.departmentId || null
    const scopeMode = String(filters.scope || filters.hierarchyScope || '').trim()
    const ownerIds = await resolveManagerVisibleOwnerIds(currentUser, metaStore, profile)

    const assignee = String(filters.assigneeUserId || '').trim()
    const allowedOwners = new Set((ownerIds || [currentUser.id]).map(String))

    if (assignee === '__unassigned__') {
      base.postgrestParts.push(pipelineUnassignedAssigneePostgrestFilter())
      base.scope.unassigned = true
      return finalizeStatusFilter(base, filters)
    }

    if (assignee && allowedOwners.has(assignee)) {
      const ownerFilter = pipelineAssigneePostgrestFilter(assignee)
      if (ownerFilter) base.postgrestParts.push(ownerFilter)
      base.scope.ownerId = assignee
      base.rpc.p_owner_id = assignee
      return finalizeStatusFilter(base, filters)
    }

    if (scopeMode === 'all_departments' && departmentId) {
      base.scope.departmentId = departmentId
      base.postgrestParts.push(`department_id=eq.${encodeURIComponent(departmentId)}`)
      base.postgrestParts.push(pipelineExcludeUnassignedAssigneePostgrestFilter())
    } else if (teamId) {
      base.scope.teamId = teamId
      base.postgrestParts.push(`team_id=eq.${encodeURIComponent(teamId)}`)
      base.postgrestParts.push(pipelineExcludeUnassignedAssigneePostgrestFilter())
    } else if (ownerIds?.length === 1) {
      base.scope.ownerId = ownerIds[0]
      const ownerFilter = pipelineAssigneePostgrestFilter(ownerIds[0])
      if (ownerFilter) base.postgrestParts.push(ownerFilter)
    } else {
      base.scope.ownerId = currentUser.id
      base.postgrestParts.push(pipelineRepMyAssignedPostgrestFilter(currentUser.id))
    }

    return finalizeStatusFilter(base, filters)
  }

  // rep — assigned leads only; unassigned pool is a separate nav folder
  return applyRepPipelineScope(base, currentUser, filters)
}

function applyRepPipelineScope(base, currentUser, filters) {
  const assignee = String(filters.assigneeUserId || '').trim()
  if (assignee === '__unassigned__') {
    base.postgrestParts.push(pipelineUnassignedAssigneePostgrestFilter())
    base.scope.unassigned = true
    return finalizeStatusFilter(base, filters)
  }
  if (assignee && assignee === String(currentUser.id)) {
    base.postgrestParts.push(pipelineRepMyAssignedPostgrestFilter(currentUser.id))
    base.scope.ownerId = currentUser.id
    base.rpc.p_owner_id = currentUser.id
    return finalizeStatusFilter(base, filters)
  }
  base.scope.ownerId = currentUser.id
  base.postgrestParts.push(pipelineRepMyAssignedPostgrestFilter(currentUser.id))
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
      base.postgrestParts.push(pipelineUnassignedAssigneePostgrestFilter())
      base.scope.unassigned = true
    } else if (assignee) {
      const ownerFilter = pipelineAssigneePostgrestFilter(assignee)
      if (ownerFilter) base.postgrestParts.push(ownerFilter)
      base.scope.ownerId = assignee
      base.rpc.p_owner_id = assignee
    } else {
      base.postgrestParts.push(pipelineExcludeUnassignedAssigneePostgrestFilter())
    }
    return finalizeStatusFilter(base, filters)
  }

  base.role = 'rep'
  return applyRepPipelineScope(base, user, filters)
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

function applyFollowUpSqlFilters(base, filters = {}) {
  const overdue = filters.overdueFollowUp === true || filters.overdueFollowUp === '1'
  const due = filters.followUpDue === true || filters.followUpDue === '1'
  if (!overdue && !due) return base

  const today = todayIsoDate()

  if (overdue) {
    base.postgrestParts.push(`next_followup_date=lt.${today}`)
  }

  if (due) {
    if (!base.status || base.status === 'all') {
      base.postgrestParts.push(`lead_status=eq.follow_up`)
      base.rpc.p_status = 'follow_up'
      base.status = 'follow_up'
    }
    base.postgrestParts.push(`or=(next_followup_date.lte.${today},next_followup_date.is.null)`)
  }

  return base
}

function finalizeStatusFilter(base, filters) {
  const status = String(filters.status || 'all').trim()
  const statusFilter = pipelineCrmStatusPostgrestFilter(status)
  if (statusFilter) {
    base.postgrestParts.push(statusFilter)
    base.rpc.p_status = status
    base.status = status
  } else {
    base.status = 'all'
  }
  applyFollowUpSqlFilters(base, filters)
  base.postgrestParts = appendPipelineFilterSqlParts(base.postgrestParts, filters)
  base.queryString = base.postgrestParts.join('&')
  return base
}

/** Build PostgREST list URL for pipeline_leads with scope + keyset or offset pagination. */
export function scopedLeadsListUrl(
  scoped,
  { select = 'entry,updated_at,lead_id', order = 'updated_at.desc,lead_id.desc' } = {}
) {
  const parts = [
    scoped.queryString,
    `select=${encodeURIComponent(select)}`,
    `order=${order}`,
    `limit=${scoped.pagination.limit}`,
  ]

  const keyset = scoped.pagination.cursor ? postgrestKeysetFilter(scoped.pagination.cursor) : null
  if (keyset) {
    parts.push(keyset)
  } else if (scoped.pagination.offset > 0) {
    parts.push(`offset=${scoped.pagination.offset}`)
  }

  return `pipeline_leads?${parts.join('&')}`
}
