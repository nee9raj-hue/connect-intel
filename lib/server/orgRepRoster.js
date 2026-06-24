import { readStore } from './store.js'
import { fetchStoreCollectionJson, isSupabaseEnabled } from './supabaseClient.js'
import { loadOrgTeamMembers, memberOptionsFromTeam } from './teamMembersFresh.js'
import { loadMemberProfilesMap } from './orgHierarchy.js'
import { readPipelineIndexDoc } from './pipelineIndex.js'
import { pipelineShardNameForUser } from './pipelineShard.js'

async function loadUsersMap() {
  let users = []
  if (isSupabaseEnabled()) {
    users = await fetchStoreCollectionJson('users')
  } else {
    const store = await readStore({ only: ['users'] })
    users = store.users || []
  }
  return new Map((users || []).map((u) => [String(u.id), u]))
}

function resolveName(usersById, userId, hints = {}) {
  const u = usersById.get(String(userId))
  return hints.name || u?.name || u?.email || hints.email || 'Member'
}

/**
 * Complete sales rep roster for an org:
 * memberships + pipeline assignees (index) + hierarchy profiles.
 * Ensures reps with assigned leads appear even if membership sync lags.
 */
export async function loadOrgRepRoster(organizationId, { userForIndex = null } = {}) {
  if (!organizationId) return []

  const [allMembers, usersById, profileMap] = await Promise.all([
    loadOrgTeamMembers(organizationId, { includeInactive: true }),
    loadUsersMap(),
    loadMemberProfilesMap(organizationId).catch(() => ({})),
  ])

  const byId = new Map()

  const upsert = (userId, hints = {}) => {
    const id = String(userId || '')
    if (!id) return
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
      hasMembership: Boolean(member),
      hasPipelineLeads: Boolean(hints.hasPipelineLeads || prev.hasPipelineLeads),
    })
  }

  for (const m of allMembers) {
    upsert(m.userId, m)
  }

  for (const uid of Object.keys(profileMap || {})) {
    const profile = profileMap[uid]
    upsert(uid, {
      pipelineRole: profile?.sqlRole === 'manager' ? 'manager' : undefined,
    })
  }

  try {
    const shardUser = userForIndex || { organizationId, accountType: 'company' }
    const shardName = pipelineShardNameForUser(shardUser)
    const doc = await readPipelineIndexDoc(shardName)
    for (const uid of Object.keys(doc?.byAssignee || {})) {
      upsert(uid, { hasPipelineLeads: true })
    }
  } catch {
    // index optional
  }

  return [...byId.values()]
    .filter((m) => {
      if (m.role === 'org_admin' && m.pipelineRole !== 'manager') return false
      if ((m.status || 'active') === 'active') return true
      return m.hasPipelineLeads
    })
    .sort((a, b) => String(a.name).localeCompare(String(b.name)))
}

export function memberOptionsFromRepRoster(roster = []) {
  return memberOptionsFromTeam(roster)
}
