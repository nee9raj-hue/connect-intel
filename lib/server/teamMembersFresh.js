import { readStore } from './store.js'
import { fetchStoreCollectionJson, isSupabaseEnabled } from './supabaseClient.js'
import { listTeamMembers } from './organizations.js'

/** Active org members — always read memberships from Supabase when enabled (avoids stale SQLite cache). */
export async function loadOrgTeamMembers(organizationId, { includeInactive = false } = {}) {
  if (!organizationId) return []

  let store
  if (isSupabaseEnabled()) {
    const [users, organizations, organizationMemberships] = await Promise.all([
      fetchStoreCollectionJson('users'),
      fetchStoreCollectionJson('organizations'),
      fetchStoreCollectionJson('organizationMemberships'),
    ])
    store = { users, organizations, organizationMemberships }
  } else {
    store = await readStore({ only: ['users', 'organizations', 'organizationMemberships'] })
  }

  const members = listTeamMembers(store, organizationId)
  if (includeInactive) return members
  return members.filter((m) => (m.status || 'active') === 'active')
}

export function memberOptionsFromTeam(members = []) {
  return members.map((m) => ({ userId: m.userId, name: m.name }))
}

/** Patch SQLite-cached store with live Supabase org roster (users + memberships). */
export async function patchStoreWithFreshOrgRoster(store = {}) {
  if (!isSupabaseEnabled()) return store
  const [users, organizationMemberships] = await Promise.all([
    fetchStoreCollectionJson('users'),
    fetchStoreCollectionJson('organizationMemberships'),
  ])
  return {
    ...store,
    ...(users?.length ? { users } : {}),
    ...(organizationMemberships?.length ? { organizationMemberships } : {}),
  }
}
