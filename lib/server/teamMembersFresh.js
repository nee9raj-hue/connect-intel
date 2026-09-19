import { SESSION_STORE_COLLECTIONS, readStore } from './store.js'
import { listTeamMembers } from './organizations.js'
import { loadOrgRosterFromSql } from './orgRosterSql.js'

const TEAM_READ = { only: SESSION_STORE_COLLECTIONS, timeoutMs: 8_000, attempts: 1 }

/** Active org members from SQL profiles — never download the users blob on the hot path. */
export async function loadOrgTeamMembers(
  organizationId,
  { includeInactive = false, store: storeHint } = {}
) {
  if (!organizationId) return []

  try {
    const roster = await loadOrgRosterFromSql(organizationId)
    if (roster.members.length) {
      return includeInactive
        ? roster.members
        : roster.members.filter((m) => (m.status || 'active') === 'active')
    }
  } catch (error) {
    console.warn('loadOrgTeamMembers sql:', error?.message || error)
  }

  try {
    const store = storeHint || (await readStore(TEAM_READ))
    const members = listTeamMembers(store, organizationId)
    if (includeInactive) return members
    return members.filter((m) => (m.status || 'active') === 'active')
  } catch (error) {
    console.warn('loadOrgTeamMembers blob:', error?.message || error)
    return []
  }
}

export function memberOptionsFromTeam(members = []) {
  return members.map((m) => ({ userId: m.userId, name: m.name }))
}

/** Overlay live org roster onto an in-memory store without a 90s users-blob fetch. */
export async function patchStoreWithFreshOrgRoster(store = {}) {
  try {
    const orgId = store.organizations?.[0]?.id
    if (!orgId) return store
    const roster = await loadOrgRosterFromSql(orgId)
    if (!roster.users.length) return store
    return {
      ...store,
      users: roster.users,
      organizationMemberships: roster.organizationMemberships,
      ...(roster.organizations.length ? { organizations: roster.organizations } : {}),
    }
  } catch {
    return store
  }
}
