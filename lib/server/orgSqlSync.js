/**
 * Sync JSON organizations / memberships → Supabase public.organizations + profiles.
 * Phase 3: SQL is source of truth for new company signups when Supabase is configured.
 */

import { readStore, updateStorePartial } from './store.js'
import { isSupabaseEnabled, supabaseRest } from './supabaseClient.js'

function findOrg(store, organizationId) {
  return store.organizations?.find((o) => o.id === organizationId) || null
}

function findMembership(store, userId, organizationId) {
  return store.organizationMemberships?.find(
    (m) => m.userId === userId && m.organizationId === organizationId
  )
}

function flag(name) {
  const v = String(process.env[name] || '')
    .trim()
    .toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
}

export function isOrgSqlSyncEnabled() {
  if (flag('ORG_SQL_SYNC_OFF') || flag('DISABLE_ORG_SQL_SYNC')) return false
  if (flag('USE_ORG_SQL_SYNC') || flag('ORG_SQL_SYNC')) return true
  return isSupabaseEnabled()
}

export function mapMembershipRole(membership) {
  const role = String(membership?.role || 'member').toLowerCase()
  const pipelineRole = String(membership?.pipelineRole || 'member').toLowerCase()
  if (role === 'org_admin' || role === 'admin') return 'admin'
  if (pipelineRole === 'manager') return 'manager'
  return 'rep'
}

export function buildOrganizationSqlPayload(org) {
  return {
    legacy_id: org.id,
    company_name: org.name || 'Company',
    domain: org.domain || org.emailDomain?.name || null,
    account_type: org.accountType || 'company',
    owner_legacy_user_id: org.ownerUserId || null,
    metadata: {
      workspacePreset: org.workspacePreset || null,
      logoUrl: org.logoUrl || null,
      planTier: org.planTier || null,
    },
    updated_at: new Date().toISOString(),
  }
}

export function buildProfileSqlPayload(user, orgUuid, membership) {
  return {
    legacy_user_id: user.id,
    organization_id: orgUuid,
    email: String(user.email || '').toLowerCase(),
    full_name: user.name || user.email || null,
    role: mapMembershipRole(membership),
    pipeline_role: membership?.pipelineRole || null,
    can_search: Boolean(membership?.canSearch),
    metadata: { accountType: user.accountType || null },
    updated_at: new Date().toISOString(),
  }
}

export async function upsertOrganizationRow(org) {
  if (!org?.id) return null
  const payload = buildOrganizationSqlPayload(org)
  await supabaseRest('organizations?on_conflict=legacy_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify([payload]),
  })
  const rows = await supabaseRest(
    `organizations?legacy_id=eq.${encodeURIComponent(org.id)}&select=id,legacy_id`,
    {},
    { timeoutMs: 15_000 }
  )
  return rows?.[0] || null
}

export async function upsertProfileRow(user, orgUuid, membership) {
  if (!user?.id || !orgUuid) return null
  const payload = buildProfileSqlPayload(user, orgUuid, membership)
  await supabaseRest('profiles?on_conflict=legacy_user_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify([payload]),
  })
  const rows = await supabaseRest(
    `profiles?legacy_user_id=eq.${encodeURIComponent(user.id)}&select=id,legacy_user_id`,
    {},
    { timeoutMs: 15_000 }
  )
  return rows?.[0] || null
}

async function persistSqlOrganizationId(organizationId, sqlOrganizationId) {
  if (!organizationId || !sqlOrganizationId) return
  await updateStorePartial(['organizations'], (draft) => {
    const org = findOrg(draft, organizationId)
    if (org && org.sqlOrganizationId !== sqlOrganizationId) {
      org.sqlOrganizationId = sqlOrganizationId
    }
    return draft
  })
}

/**
 * Upsert org + one member profile to SQL (onboarding, invite accept, immediate join).
 */
export async function syncOrgMembershipToSql({
  organizationId,
  userId,
  store: preloadedStore,
  persistOrgUuid = true,
}) {
  if (!isOrgSqlSyncEnabled()) return { skipped: true, reason: 'org_sql_sync_disabled' }
  if (!organizationId || !userId) return { skipped: true, reason: 'missing_ids' }

  const store =
    preloadedStore ||
    (await readStore({ only: ['users', 'organizations', 'organizationMemberships'] }))

  const org = findOrg(store, organizationId)
  if (!org) return { skipped: true, reason: 'org_not_found' }

  const orgRow = await upsertOrganizationRow(org)
  const orgUuid = orgRow?.id
  if (!orgUuid) return { ok: false, error: 'organization_upsert_failed' }

  const user = store.users?.find((u) => u.id === userId)
  const membership = findMembership(store, userId, organizationId)
  let profileRow = null
  if (user) {
    profileRow = await upsertProfileRow(user, orgUuid, membership)
  }

  if (persistOrgUuid) {
    await persistSqlOrganizationId(organizationId, orgUuid)
  }

  return {
    ok: true,
    organizationUuid: orgUuid,
    profileUuid: profileRow?.id || null,
    profileSynced: Boolean(profileRow),
  }
}

/** Sync all active members for an org (backfill / repair). */
export async function syncOrganizationMembersToSql(organizationId, { store: preloadedStore } = {}) {
  if (!isOrgSqlSyncEnabled()) {
    throw new Error('Organization SQL sync is not enabled')
  }

  const store =
    preloadedStore ||
    (await readStore({
      only: ['users', 'organizations', 'organizationMemberships', 'savedLeads'],
    }))

  const org = findOrg(store, organizationId)
  if (!org) throw new Error('Organization not found')

  const orgRow = await upsertOrganizationRow(org)
  const orgUuid = orgRow?.id
  if (!orgUuid) throw new Error('Organization SQL upsert failed')

  await persistSqlOrganizationId(organizationId, orgUuid)

  const memberIds = [
    ...new Set(
      (store.organizationMemberships || [])
        .filter((m) => m.organizationId === organizationId && m.status !== 'inactive')
        .map((m) => m.userId)
    ),
  ]

  let profiles = 0
  for (const userId of memberIds) {
    const user = store.users?.find((u) => u.id === userId)
    if (!user) continue
    const membership = findMembership(store, userId, organizationId)
    const row = await upsertProfileRow(user, orgUuid, membership)
    if (row?.id) profiles += 1
  }

  return { organizationUuid: orgUuid, profiles, members: memberIds.length }
}
