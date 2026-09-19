import { SESSION_STORE_COLLECTIONS, readStore } from './store.js'
import { loadOrgTeamMembers, memberOptionsFromTeam } from './teamMembersFresh.js'
import { loadMemberProfilesMap } from './orgHierarchy.js'
import { orgMemberUserIdSet } from './orgMemberSet.js'
import { loadOrgRosterFromSql, metaStoreFromSqlRoster } from './orgRosterSql.js'

async function loadOrgUsersMap(organizationId, memberIds, storeHint = null) {
  if (storeHint?.users?.length) {
    const allowed = memberIds || new Set()
    return new Map(
      storeHint.users.filter((u) => allowed.has(String(u.id))).map((u) => [String(u.id), u])
    )
  }
  const users = (await readStore({ only: ['users'], timeoutMs: 8_000, attempts: 1 })).users || []
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

async function loadMetaForMembers() {
  return readStore({
    only: SESSION_STORE_COLLECTIONS,
    timeoutMs: 8_000,
    attempts: 2,
  })
}

/**
 * Sales rep roster for an org — org members only (no cross-tenant user ids from pipeline).
 */
export async function loadOrgRepRoster(
  organizationId,
  { userForIndex: _userForIndex = null } = {}
) {
  if (!organizationId) return []

  let metaStore = null
  try {
    const roster = await loadOrgRosterFromSql(organizationId)
    if (roster.users.length) metaStore = metaStoreFromSqlRoster(roster)
  } catch (error) {
    console.warn('loadOrgRepRoster sql:', error?.message || error)
  }
  if (!metaStore) {
    try {
      metaStore = await loadMetaForMembers()
    } catch (error) {
      console.warn('loadOrgRepRoster blob:', error?.message || error)
      return []
    }
  }
  const memberIds = orgMemberUserIdSet(metaStore, organizationId)

  const [allMembers, usersById, profileMap] = await Promise.all([
    loadOrgTeamMembers(organizationId, { includeInactive: true, store: metaStore }),
    loadOrgUsersMap(organizationId, memberIds, metaStore),
    loadMemberProfilesMap(organizationId).catch(() => ({})),
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
