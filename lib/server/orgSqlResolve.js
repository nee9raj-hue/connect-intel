/**
 * Resolve legacy org/user IDs → Supabase UUIDs (JSON sql*Id first, then SQL lookup).
 */

import { isSupabaseEnabled, supabaseRest } from './supabaseClient.js'
import { isOrgSqlSyncEnabled, syncOrganizationMembersToSql } from './orgSqlSync.js'

export function orgUuidFromStore(store, legacyOrgId) {
  if (!store || !legacyOrgId) return null
  const org = store.organizations?.find((o) => o.id === legacyOrgId)
  return org?.sqlOrganizationId || null
}

export function profileUuidFromStore(store, legacyUserId) {
  if (!store || !legacyUserId) return null
  const user = store.users?.find((u) => u.id === legacyUserId)
  return user?.sqlProfileId || null
}

function normalizeCache(cache) {
  if (cache?.orgs instanceof Map) return cache
  return { orgs: new Map(), profiles: new Map() }
}

/**
 * @param {object} [options]
 * @param {object} [options.store] — JSON store slice with organizations
 * @param {boolean} [options.autoSync] — backfill org+profiles when SQL row missing
 */
export async function resolveOrganizationUuid(legacyOrgId, cache, options = {}) {
  if (!legacyOrgId || !isSupabaseEnabled()) return null

  const c = normalizeCache(cache)
  if (c.orgs.has(legacyOrgId)) return c.orgs.get(legacyOrgId)

  const fromJson = orgUuidFromStore(options.store, legacyOrgId)
  if (fromJson) {
    c.orgs.set(legacyOrgId, fromJson)
    return fromJson
  }

  const rows = await supabaseRest(
    `organizations?legacy_id=eq.${encodeURIComponent(legacyOrgId)}&select=id`,
    {},
    { timeoutMs: 15_000, attempts: 2 }
  )
  let id = rows?.[0]?.id || null

  if (!id && options.autoSync && isOrgSqlSyncEnabled()) {
    try {
      const sync = await syncOrganizationMembersToSql(legacyOrgId, { store: options.store })
      id = sync.organizationUuid || null
    } catch (error) {
      console.warn('org SQL auto-sync:', error?.message || error)
    }
  }

  c.orgs.set(legacyOrgId, id)
  return id
}

/** @param {object} [options] — store, autoSync (syncs parent org then retries) */
export async function resolveProfileUuid(legacyUserId, cache, options = {}) {
  if (!legacyUserId || !isSupabaseEnabled()) return null

  const c = normalizeCache(cache)
  if (c.profiles.has(legacyUserId)) return c.profiles.get(legacyUserId)

  const fromJson = profileUuidFromStore(options.store, legacyUserId)
  if (fromJson) {
    c.profiles.set(legacyUserId, fromJson)
    return fromJson
  }

  const rows = await supabaseRest(
    `profiles?legacy_user_id=eq.${encodeURIComponent(legacyUserId)}&select=id`,
    {},
    { timeoutMs: 15_000, attempts: 2 }
  )
  let id = rows?.[0]?.id || null

  if (!id && options.autoSync && isOrgSqlSyncEnabled() && options.store) {
    const user = options.store.users?.find((u) => u.id === legacyUserId)
    const orgId = user?.organizationId
    if (orgId) {
      try {
        await syncOrganizationMembersToSql(orgId, { store: options.store })
        const retry = await supabaseRest(
          `profiles?legacy_user_id=eq.${encodeURIComponent(legacyUserId)}&select=id`,
          {},
          { timeoutMs: 15_000, attempts: 1 }
        )
        id = retry?.[0]?.id || null
      } catch (error) {
        console.warn('profile SQL auto-sync:', error?.message || error)
      }
    }
  }

  c.profiles.set(legacyUserId, id)
  return id
}

/** Orgs in JSON missing sqlOrganizationId (legacy workspaces). */
export function listOrganizationsNeedingSqlSync(store) {
  return (store.organizations || []).filter(
    (org) => org?.id && org.accountType === 'company' && !org.sqlOrganizationId
  )
}
