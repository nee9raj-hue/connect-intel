import { readStore } from './store.js'
import { fetchStoreCollectionJson, isSupabaseEnabled } from './supabaseClient.js'
import { loadOrgTeamMembers, memberOptionsFromTeam } from './teamMembersFresh.js'
import { loadMemberProfilesMap } from './orgHierarchy.js'
import { readPipelineIndexDoc } from './pipelineIndex.js'
import { pipelineShardNameForUser } from './pipelineShard.js'
import { listDistinctActivityActorIds } from './pipelineActivitiesTable.js'
import { orgMemberUserIdSet } from './orgMemberSet.js'

async function loadOrgUsersMap(organizationId, memberIds) {
  let users = []
  if (isSupabaseEnabled()) {
    users = await fetchStoreCollectionJson('users')
  } else {
    const store = await readStore({ only: ['users'] })
    users = store.users || []
  }
  const allowed = memberIds || new Set()
  return new Map(
    (users || [])
      .filter((u) => allowed.has(String(u.id)))
      .map((u) => [String(u.id), u])
  )
}

function resolveName(usersById, userId, hints = {}) {
  const u = usersById.get(String(userId))
  return hints.name || u?.name || u?.email || hints.email || 'Member'
}

async function loadPipelineOwnerIds(organizationId, memberIds) {
  try {
    const { listDistinctOwnerIdsForOrg } = await import('./pipelineLeadsTable.js')
    const owners = await listDistinctOwnerIdsForOrg(organizationId)
    return owners.filter((id) => memberIds.has(String(id)))
  } catch {
    return []
  }
}

async function loadActivityActorIds(organizationId, memberIds, { since, until } = {}) {
  try {
    const actors = await listDistinctActivityActorIds(organizationId, { since, until })
    return actors.filter((id) => memberIds.has(String(id)))
  } catch {
    return []
  }
}

async function loadMetaForMembers(organizationId) {
  if (isSupabaseEnabled()) {
    const [users, organizations, organizationMemberships] = await Promise.all([
      fetchStoreCollectionJson('users'),
      fetchStoreCollectionJson('organizations'),
      fetchStoreCollectionJson('organizationMemberships'),
    ])
    return { users, organizations, organizationMemberships }
  }
  return readStore({ only: ['users', 'organizations', 'organizationMemberships'] })
}

/**
 * Sales rep roster for an org — org members only (no cross-tenant user ids from pipeline).
 */
export async function loadOrgRepRoster(
  organizationId,
  { userForIndex = null, activitySince = null, activityUntil = Infinity } = {}
) {
  if (!organizationId) return []

  const metaStore = await loadMetaForMembers(organizationId)
  const memberIds = orgMemberUserIdSet(metaStore, organizationId)

  const [allMembers, usersById, profileMap, pipelineOwners, activityActors] = await Promise.all([
    loadOrgTeamMembers(organizationId, { includeInactive: true }),
    loadOrgUsersMap(organizationId, memberIds),
    loadMemberProfilesMap(organizationId).catch(() => ({})),
    loadPipelineOwnerIds(organizationId, memberIds),
    activitySince != null
      ? loadActivityActorIds(organizationId, memberIds, { since: activitySince, until: activityUntil })
      : loadActivityActorIds(organizationId, memberIds, {}),
  ])

  const byId = new Map()

  const upsert = (userId, hints = {}) => {
    const id = String(userId || '')
    if (!id || !memberIds.has(id)) return
    const prev = byId.get(id) || {}
    const member = allMembers.find((m) => String(m.userId) === id)
    byId.set(id, {
      userId: id,
      name: resolveName(usersById, id, { name: hints.name || member?.name, email: member?.email }),
      email: hints.email || member?.email || usersById.get(id)?.email,
      role: hints.role || member?.role,
      pipelineRole: hints.pipelineRole || member?.pipelineRole,
      status: hints.status || member?.status || 'active',
      teamId: profileMap[id]?.teamId || member?.teamId || null,
      hasMembership: Boolean(member || prev.hasMembership),
      hasPipelineLeads: Boolean(hints.hasPipelineLeads || prev.hasPipelineLeads),
      hasActivity: Boolean(hints.hasActivity || prev.hasActivity),
    })
  }

  for (const m of allMembers) {
    upsert(m.userId, m)
  }

  for (const uid of Object.keys(profileMap || {})) {
    if (!memberIds.has(String(uid))) continue
    const profile = profileMap[uid]
    upsert(uid, {
      pipelineRole: profile?.sqlRole === 'manager' ? 'manager' : undefined,
    })
  }

  for (const uid of pipelineOwners) {
    upsert(uid, { hasPipelineLeads: true })
  }

  for (const uid of activityActors) {
    upsert(uid, { hasActivity: true })
  }

  try {
    const shardUser = userForIndex || { organizationId, accountType: 'company' }
    const shardName = pipelineShardNameForUser(shardUser)
    const doc = await readPipelineIndexDoc(shardName)
    for (const uid of Object.keys(doc?.byAssignee || {})) {
      if (memberIds.has(String(uid))) {
        upsert(uid, { hasPipelineLeads: true })
      }
    }
  } catch {
    // index optional
  }

  return [...byId.values()]
    .filter((m) => {
      if (!memberIds.has(String(m.userId))) return false
      if (m.role === 'org_admin' && m.pipelineRole !== 'manager') return false
      if ((m.status || 'active') === 'active') return true
      return m.hasPipelineLeads || m.hasActivity || m.hasMembership
    })
    .sort((a, b) => String(a.name).localeCompare(String(b.name)))
}

export function memberOptionsFromRepRoster(roster = []) {
  return memberOptionsFromTeam(roster)
}
