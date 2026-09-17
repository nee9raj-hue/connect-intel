import { crmStatusSqlAliases } from '../crmLeadStatuses.js'
import { loadHierarchyProfile } from './pipelineHierarchyProfile.js'
import { isPipelineHierarchyRbacEnabled } from './infra/config.js'
import { pipelineShardNameForUser } from './pipelineShard.js'
import { resolveOrgRole } from './organizations.js'
import { resolveManagerVisibleOwnerIds } from './pipelineManagerScope.js'
import { decodePipelineCursor, postgrestKeysetFilter } from './pipelineKeyset.js'
import { appendPipelineFilterSqlParts } from './pipelineFilterSql.js'
import { collectPipelineTeamIds } from './pipelineQueryParams.js'
import {
  pipelineAssigneePostgrestFilter,
  pipelineCrmStatusPostgrestFilter,
  pipelineManagerVisibilityPostgrestFilter,
  pipelineRepVisibilityPostgrestFilter,
  pipelineUnassignedPostgrestFilter,
} from './pipelineQuery.js'
import { listPipelineActorIds } from '../pipelineActorIds.js'

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
    return legacyOrgScope(base, currentUser, filters, orgRole, metaStore)
  }

  const profile = await loadHierarchyProfile(currentUser, metaStore)
  const role = normalizeRole(profile, orgRole)

  base.role = role

  const actorIds = listPipelineActorIds(metaStore, organizationId, currentUser)
  if (profile?.legacyUserId) actorIds.push(String(profile.legacyUserId))
  const uniqueActorIds = [...new Set(actorIds.map(String).filter(Boolean))]

  if (role === 'admin') {
    const assignee = String(filters.assigneeUserId || '').trim()
    if (assignee === '__unassigned__') {
      base.postgrestParts.push(pipelineUnassignedPostgrestFilter())
      base.scope.unassigned = true
    } else if (assignee) {
      const ownerFilter = pipelineAssigneePostgrestFilter(assignee)
      if (ownerFilter) base.postgrestParts.push(ownerFilter)
      base.scope.ownerId = assignee
      base.rpc.p_owner_id = assignee
    }
    return finalizeStatusFilter(base, filters)
  }

  if (role === 'manager') {
    const teamId = profile?.teamId || null
    const departmentId = profile?.departmentId || null
    const scopeMode = String(filters.scope || filters.hierarchyScope || '').trim()
    const ownerIds = [
      ...new Set([
        ...(await resolveManagerVisibleOwnerIds(currentUser, metaStore, profile) || []),
        ...uniqueActorIds,
      ]),
    ]

    const assignee = String(filters.assigneeUserId || '').trim()
    const allowedOwners = new Set(ownerIds.map(String))
    for (const id of uniqueActorIds) allowedOwners.add(String(id))

    if (assignee === '__unassigned__') {
      base.postgrestParts.push(pipelineUnassignedPostgrestFilter())
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

    const managerFilter = pipelineManagerVisibilityPostgrestFilter({
      teamId: scopeMode === 'all_departments' ? null : teamId,
      departmentId: scopeMode === 'all_departments' ? departmentId : null,
      ownerIds,
    })
    if (scopeMode === 'all_departments' && departmentId) {
      base.scope.departmentId = departmentId
    } else if (teamId) {
      base.scope.teamId = teamId
    }
    base.scope.ownerId = uniqueActorIds[0] || currentUser.id
    base.rpc.p_owner_id = uniqueActorIds.length === 1 ? uniqueActorIds[0] : null
    base.postgrestParts.push(managerFilter)
    return finalizeStatusFilter(base, filters)
  }

  // rep — assigned to this user (and identity aliases), not the org-wide unassigned pool
  return applyRepPipelineScope(base, currentUser, filters, uniqueActorIds)
}

function applyRepPipelineScope(base, currentUser, filters, actorIds) {
  const assignee = String(filters.assigneeUserId || '').trim()
  if (assignee === '__unassigned__') {
    base.postgrestParts.push(pipelineUnassignedPostgrestFilter())
    base.scope.unassigned = true
    return finalizeStatusFilter(base, filters)
  }
  const ids = (actorIds && actorIds.length ? actorIds : [currentUser.id]).map(String)
  base.role = 'rep'
  base.scope.ownerId = ids[0]
  base.rpc.p_owner_id = ids.length === 1 ? ids[0] : null
  base.postgrestParts.push(pipelineRepVisibilityPostgrestFilter(ids))
  return finalizeStatusFilter(base, filters)
}

function normalizeRole(profile, orgRole) {
  if (orgRole === 'org_admin') return 'admin'
  const r = String(profile?.role || 'rep').toLowerCase()
  if (r === 'admin') return 'admin'
  if (r === 'manager') return 'manager'
  return 'rep'
}

function legacyOrgScope(base, user, filters, orgRole, metaStore = null) {
  if (orgRole === 'org_admin') {
    base.role = 'admin'
    const assignee = String(filters.assigneeUserId || '').trim()
    if (assignee === '__unassigned__') {
      base.postgrestParts.push(pipelineUnassignedPostgrestFilter())
      base.scope.unassigned = true
    } else if (assignee) {
      const ownerFilter = pipelineAssigneePostgrestFilter(assignee)
      if (ownerFilter) base.postgrestParts.push(ownerFilter)
      base.scope.ownerId = assignee
      base.rpc.p_owner_id = assignee
    }
    return finalizeStatusFilter(base, filters)
  }

  base.role = 'rep'
  return applyRepPipelineScope(
    base,
    user,
    filters,
    listPipelineActorIds(metaStore, user.organizationId, user)
  )
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
    base.postgrestParts.push(`or=(next_followup_date.lte.${today},next_followup_date.is.null)`)
  }

  return base
}

function applyAudienceTeamFilter(base, filters = {}) {
  const ids = collectPipelineTeamIds(filters)
  if (!ids.length) return
  if (ids.length === 1) {
    base.postgrestParts.push(`team_id=eq.${encodeURIComponent(ids[0])}`)
    base.scope.filterTeamId = ids[0]
    if (!base.rpc.p_team_id) base.rpc.p_team_id = ids[0]
    return
  }
  base.postgrestParts.push(`team_id=in.(${ids.map((id) => encodeURIComponent(id)).join(',')})`)
  base.scope.filterTeamIds = ids
}

function finalizeStatusFilter(base, filters) {
  const status = String(filters.status || 'all').trim()
  const statusFilter = pipelineCrmStatusPostgrestFilter(status)
  if (statusFilter) {
    base.postgrestParts.push(statusFilter)
    const aliases = crmStatusSqlAliases(status)
    base.rpc.p_status = aliases.length === 1 ? aliases[0] : null
    base.status = status
  } else {
    base.status = 'all'
  }
  applyFollowUpSqlFilters(base, filters)
  applyAudienceTeamFilter(base, filters)
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
