import { SESSION_STORE_COLLECTIONS, readStore } from './store.js'
import { listTeamMembers } from './organizations.js'

const TEAM_READ = { only: SESSION_STORE_COLLECTIONS, timeoutMs: 8_000, attempts: 2 }

/** Active org members from the slim session slice — never download store_collections twice. */
export async function loadOrgTeamMembers(
  organizationId,
  { includeInactive = false, store: storeHint } = {}
) {
  if (!organizationId) return []

  const store = storeHint || (await readStore(TEAM_READ))
  const members = listTeamMembers(store, organizationId)
  if (includeInactive) return members
  return members.filter((m) => (m.status || 'active') === 'active')
}

export function memberOptionsFromTeam(members = []) {
  return members.map((m) => ({ userId: m.userId, name: m.name }))
}

/** Overlay live org roster onto an in-memory store without a 90s users-blob fetch. */
export async function patchStoreWithFreshOrgRoster(store = {}) {
  try {
    const fresh = await readStore(TEAM_READ)
    return {
      ...store,
      ...(fresh.users?.length ? { users: fresh.users } : {}),
      ...(fresh.organizationMemberships?.length
        ? { organizationMemberships: fresh.organizationMemberships }
        : {}),
      ...(fresh.organizations?.length ? { organizations: fresh.organizations } : {}),
    }
  } catch {
    return store
  }
}
