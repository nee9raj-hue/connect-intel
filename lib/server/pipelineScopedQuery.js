import { crmStatusSqlAliases } from '../crmLeadStatuses.js'
import { loadHierarchyProfile } from './pipelineHierarchyProfile.js'
import { isPipelineHierarchyRbacEnabled } from './infra/config.js'
import { pipelineShardNameForUser } from './pipelineShard.js'
import { postgrestOrgScopeFilter, resolvePipelineOrgIdentity, looksLikeUuid } from './pipelineOrgIdentity.js'
import { resolveOrgRole } from './organizations.js'
import { resolveManagerVisibleOwnerIds } from './pipelineManagerScope.js'
import { decodePipelineCursor, postgrestKeysetFilter } from './pipelineKeyset.js'
import { appendPipelineFilterSqlParts } from './pipelineFilterSql.js'
import { collectPipelineTeamIds } from './pipelineQueryParams.js'
import {
  pipelineCrmStatusPostgrestFilter,
  pipelineManagerVisibilityPostgrestFilter,
  pipelineMemberBookPostgrestFilter,
  pipelineRepVisibilityPostgrestFilter,
  pipelineUnassignedPostgrestFilter,
} from './pipelineQuery.js'
import { listPipelineActorIds, listPipelineActorIdsForMember } from '../pipelineActorIds.js'
import { listOrgLeadTagDefinitions } from './orgLeadTags.js'
import { listLeadTagMaster } from './leadTagMaster.js'
import { loadHierarchyTeams, memberUserIdsForTeams, attachTeamMemberUserIdsToFilters } from './orgTeamLeadTags.js'
import {
  allowedTagIdsForMember,
  allowedTeamIdsForMember,
  mergeTeamScopedTagFilters,
} from '../pipelineMemberVisibility.js'

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
export async function getScopedLeadsQuery(currentUser, rawFilters = {}, metaStore = null) {
  let filters = { ...rawFilters }
  const shardName = pipelineShardNameForUser(currentUser)
  const { orgRole, accountType } = resolveOrgRole(currentUser, metaStore || {})
  const organizationId = currentUser.organizationId || null
  const orgIdentity =
    organizationId && accountType === 'company'
      ? await resolvePipelineOrgIdentity(organizationId)
      : { ids: organizationId ? [organizationId] : [], shardNames: shardName ? [shardName] : [] }
  const organizationIds = orgIdentity.ids.length ? orgIdentity.ids : organizationId ? [organizationId] : []
  const shardNames = orgIdentity.shardNames.length
    ? orgIdentity.shardNames
    : shardName
      ? [shardName]
      : []
  const orgFilter = postgrestOrgScopeFilter({ organizationIds, shardNames })

  if (organizationId && collectPipelineTeamIds(filters).length) {
    filters = await attachTeamMemberUserIdsToFilters(organizationId, filters)
    if (metaStore) {
      const expanded = new Set((filters.teamMemberUserIds || []).map(String).filter(Boolean))
      for (const uid of [...expanded]) {
        for (const id of listPipelineActorIdsForMember(metaStore, organizationId, uid)) {
          expanded.add(String(id))
        }
      }
      filters = { ...filters, teamMemberUserIds: [...expanded] }
    }
  }

  const base = {
    shardName,
    organizationId,
    table: 'pipeline_leads',
    role: 'rep',
    enforced: true,
    postgrestParts: orgFilter ? [orgFilter] : [],
    scope: {
      organizationId,
      organizationIds,
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
      p_organization_id: organizationIds.find((id) => !looksLikeUuid(id)) || organizationId,
      p_owner_id: null,
      p_team_id: null,
      p_department_id: null,
    },
  }

  if (accountType === 'individual' || !organizationId) {
    base.role = 'individual'
    base.scope.ownerId = currentUser.id
    base.postgrestParts.push(`owner_id=eq.${encodeURIComponent(currentUser.id)}`)
    base.rpc.p_owner_id = currentUser.id
    return finalizeStatusFilter(base, filters)
  }

  if (!isPipelineHierarchyRbacEnabled()) {
    if (orgRole === 'org_admin') {
      return legacyOrgScope(base, currentUser, filters, orgRole, metaStore)
    }
    const actorIds = listPipelineActorIds(metaStore, organizationId, currentUser)
    const shared = await resolveRepSharedPipelineScope({
      currentUser,
      filters,
      actorIds,
      profile: { teamId: currentUser.teamId },
      metaStore,
      organizationId,
    })
    return applyRepPipelineScope(base, currentUser, shared.filters, actorIds, shared)
  }

  const profile = await loadHierarchyProfile(currentUser, metaStore)
  const role = normalizeRole(profile, orgRole)

  base.role = role

  const actorIds = listPipelineActorIds(metaStore, organizationId, currentUser)
  if (profile?.legacyUserId) actorIds.push(String(profile.legacyUserId))
  for (const extra of profile?.aliasLegacyUserIds || []) actorIds.push(String(extra))
  for (const extra of currentUser?.pipelineActorIds || []) actorIds.push(String(extra))
  const uniqueActorIds = [...new Set(actorIds.map(String).filter(Boolean))]

  if (role === 'admin') {
    const assignee = String(filters.assigneeUserId || '').trim()
    if (assignee === '__unassigned__') {
      base.postgrestParts.push(pipelineUnassignedPostgrestFilter())
      base.scope.unassigned = true
    } else if (assignee) {
      const ownerFilter = memberBookFilter(assignee, metaStore, organizationId)
      if (ownerFilter) base.postgrestParts.push(ownerFilter)
      base.scope.ownerId = assignee
      base.rpc.p_owner_id = assignee
    }
    return finalizeStatusFilter(base, filters)
  }

  if (role === 'manager') {
    const shared = await resolveRepSharedPipelineScope({
      currentUser,
      filters,
      actorIds: uniqueActorIds,
      profile,
      metaStore,
      organizationId,
    })
    if (shared.mode === 'team' || shared.mode === 'tags') {
      return applyRepPipelineScope(base, currentUser, shared.filters, uniqueActorIds, shared)
    }

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
      const ownerFilter = memberBookFilter(assignee, metaStore, organizationId)
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

  // rep — own book unless they apply their team or an allowed tag
  const shared = await resolveRepSharedPipelineScope({
    currentUser,
    filters,
    actorIds: uniqueActorIds,
    profile,
    metaStore,
    organizationId,
  })
  return applyRepPipelineScope(base, currentUser, shared.filters, uniqueActorIds, shared)
}

function applyRepPipelineScope(base, currentUser, filters, actorIds, shared = {}) {
  const assignee = String(filters.assigneeUserId || '').trim()
  if (assignee === '__unassigned__') {
    base.postgrestParts.push(pipelineUnassignedPostgrestFilter())
    base.scope.unassigned = true
    return finalizeStatusFilter(base, filters)
  }

  const mode = shared.mode || 'own'
  base.scope.repSharedMode = mode
  base.scope.listFilters = filters

  if (mode === 'tags') {
    return finalizeStatusFilter(base, filters)
  }

  if (mode === 'team') {
    const ownerIds = [...new Set([...(shared.ownerIds || []), ...(actorIds || [])].map(String).filter(Boolean))]
    const teamIds = shared.teamIds || []
    base.postgrestParts.push(pipelineRepVisibilityPostgrestFilter(ownerIds, { includeCollaborators: false }))
    base.scope.ownerId = ownerIds[0] || currentUser.id
    base.scope.filterTeamIds = teamIds
    return finalizeStatusFilter(base, {
      ...filters,
      teamIds: [],
      tagIds: filters.tagIds,
    })
  }

  const ids = (actorIds && actorIds.length ? actorIds : [currentUser.id]).map(String)
  base.role = 'rep'
  base.scope.ownerId = ids[0]
  base.rpc.p_owner_id = ids.length === 1 ? ids[0] : null
  base.postgrestParts.push(pipelineRepVisibilityPostgrestFilter(ids))
  return finalizeStatusFilter(base, filters)
}

async function resolveRepSharedPipelineScope({
  currentUser,
  filters,
  actorIds,
  profile,
  metaStore,
  organizationId,
}) {
  const isOrgAdmin = false
  let teams = []
  try {
    teams = await loadHierarchyTeams(organizationId)
  } catch {
    teams = []
  }
  let memberTeamIds = [profile?.teamId, currentUser?.teamId].map(String).filter((id) => id && id !== 'undefined')
  const selfIds = new Set(
    [
      currentUser?.id,
      profile?.legacyUserId,
      currentUser?.legacyUserId,
      ...(profile?.aliasLegacyUserIds || []),
      ...(currentUser?.pipelineActorIds || []),
    ]
      .map(String)
      .filter((id) => id && id !== 'undefined')
  )
  for (const team of teams) {
    if (
      (team.members || []).some(
        (m) =>
          selfIds.has(String(m.userId || '')) ||
          selfIds.has(String(m.legacyUserId || '')) ||
          selfIds.has(String(m.profileId || ''))
      )
    ) {
      memberTeamIds.push(String(team.id))
    }
  }
  memberTeamIds = [...new Set(memberTeamIds)]

  let tags = listOrgLeadTagDefinitions(metaStore || {}, organizationId)
  try {
    const sqlTags = await listLeadTagMaster(organizationId)
    if (sqlTags.length) {
      const byId = new Map(tags.map((tag) => [String(tag.id), tag]))
      for (const tag of sqlTags) byId.set(String(tag.id), tag)
      tags = [...byId.values()]
    }
  } catch {
    /* blob tags are enough */
  }
  const merged = mergeTeamScopedTagFilters(filters, tags, memberTeamIds, { isOrgAdmin, teams })
  const allowedTeams = allowedTeamIdsForMember(collectPipelineTeamIds(merged), memberTeamIds, {
    isOrgAdmin,
  })
  const allowedTags = allowedTagIdsForMember(merged.tagIds, tags, memberTeamIds, {
    isOrgAdmin,
    actorIds,
  })
  const nextFilters = { ...merged, teamIds: allowedTeams, tagIds: allowedTags }

  if (allowedTags.length && !allowedTeams.length) {
    return { mode: 'tags', filters: nextFilters, teamIds: [], ownerIds: actorIds }
  }

  if (allowedTeams.length) {
    let memberIds = memberUserIdsForTeams(teams, allowedTeams)
    for (const id of filters.teamMemberUserIds || []) {
      if (id) memberIds.push(String(id))
    }
    memberIds = [...new Set(memberIds)]
    const ownerIds = [...new Set([...actorIds, ...memberIds].map(String).filter(Boolean))]
    for (const uid of memberIds) {
      for (const id of listPipelineActorIdsForMember(metaStore, organizationId, uid)) {
        ownerIds.push(id)
      }
    }
    nextFilters.teamMemberUserIds = [...new Set(memberIds)]
    return {
      mode: 'team',
      filters: nextFilters,
      teamIds: allowedTeams,
      ownerIds: [...new Set(ownerIds)],
    }
  }
  return { mode: 'own', filters: nextFilters, teamIds: [], ownerIds: actorIds }
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
      const ownerFilter = memberBookFilter(assignee, metaStore, user.organizationId)
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

function memberBookFilter(assignee, metaStore, organizationId) {
  const member = (metaStore?.users || []).find((row) => String(row.id) === String(assignee)) || {
    id: assignee,
  }
  const actorIds = listPipelineActorIdsForMember(metaStore, organizationId, assignee)
  return pipelineMemberBookPostgrestFilter(actorIds, member)
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
  base.scope.filterTeamIds = ids
  if (ids.length === 1) base.scope.filterTeamId = ids[0]
}

function finalizeStatusFilter(base, filters) {
  const status = String(filters.status || 'all').trim()
  const statusFilter = pipelineCrmStatusPostgrestFilter(status, {
    pipelineTrack: filters.pipelineTrack,
    crmStageIds: filters.crmStageIds,
    crmStages: filters.crmStages,
    statusIds: filters.statusIds,
  })
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
