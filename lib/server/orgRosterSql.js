/**
 * Company roster from SQL profiles — never download the users JSON blob.
 * ERP overlay, Team settings, and hierarchy reads share this path.
 */

import { isSupabaseEnabled, supabaseRest } from './supabaseClient.js'
import { resolveOrganizationUuid } from './orgSqlResolve.js'
import { organizationRecordFromSqlRow, userRecordFromProfileRow } from './storeUserLookup.js'

export const CRM_SQL_READ = { timeoutMs: 8_000, attempts: 1, bypassCircuit: true }

const orgUuidCache = new Map()

export async function resolveOrgUuidFast(legacyOrgId) {
  if (!legacyOrgId || !isSupabaseEnabled()) return null
  if (orgUuidCache.has(legacyOrgId)) return orgUuidCache.get(legacyOrgId)
  const uuid = await resolveOrganizationUuid(legacyOrgId, { orgs: new Map(), profiles: new Map() }, {
    store: { organizations: [] },
    autoSync: false,
  })
  if (uuid) orgUuidCache.set(legacyOrgId, uuid)
  return uuid
}

export function membershipFromSqlProfile(profile, organizationId) {
  const orgAdmin = String(profile?.role || '').toLowerCase() === 'admin'
  return {
    id: `sql_${profile.legacy_user_id}`,
    userId: profile.legacy_user_id,
    organizationId,
    role: orgAdmin ? 'org_admin' : 'member',
    pipelineRole: profile.pipeline_role || (orgAdmin ? 'org_admin' : 'member'),
    canSearch: profile.can_search !== false,
    status: 'active',
    source: 'sql-profile',
  }
}

export function teamMemberFromSqlProfile(profile) {
  const orgAdmin = String(profile?.role || '').toLowerCase() === 'admin'
  return {
    id: `sql_${profile.legacy_user_id}`,
    userId: profile.legacy_user_id,
    name: profile.full_name || String(profile.email || '').split('@')[0] || 'Member',
    email: profile.email,
    role: orgAdmin ? 'org_admin' : 'member',
    pipelineRole: profile.pipeline_role || (orgAdmin ? 'org_admin' : 'member'),
    marketingRole: null,
    canSearch: profile.can_search !== false,
    status: 'active',
    sqlRole: profile.role || 'rep',
    teamId: profile.team_id || null,
    departmentId: profile.department_id || null,
  }
}

export async function loadOrgRosterFromSql(organizationId) {
  const empty = {
    orgUuid: null,
    users: [],
    organizations: [],
    organizationMemberships: [],
    members: [],
  }
  if (!organizationId || !isSupabaseEnabled()) return empty

  const orgUuid = await resolveOrgUuidFast(organizationId)
  if (!orgUuid) return empty

  const [orgRows, profiles] = await Promise.all([
    supabaseRest(
      `organizations?id=eq.${encodeURIComponent(orgUuid)}&select=legacy_id,company_name,domain,metadata,account_type,owner_legacy_user_id&limit=1`,
      {},
      CRM_SQL_READ
    ),
    supabaseRest(
      `profiles?organization_id=eq.${encodeURIComponent(orgUuid)}&select=id,legacy_user_id,full_name,email,role,pipeline_role,can_search,team_id,department_id,metadata&order=full_name.asc&limit=500`,
      {},
      CRM_SQL_READ
    ),
  ])

  const orgRow = Array.isArray(orgRows) ? orgRows[0] : null
  const organization = organizationRecordFromSqlRow(orgRow)
  if (organization && orgRow?.owner_legacy_user_id) {
    organization.ownerUserId = orgRow.owner_legacy_user_id
  }

  const profileList = (Array.isArray(profiles) ? profiles : []).filter((p) => p?.legacy_user_id)
  const users = profileList.map((p) => userRecordFromProfileRow(p, organization)).filter(Boolean)
  const organizationMemberships = profileList.map((p) => membershipFromSqlProfile(p, organizationId))
  const members = profileList.map((p) => teamMemberFromSqlProfile(p))

  return {
    orgUuid,
    users,
    organizations: organization ? [organization] : [],
    organizationMemberships,
    members,
  }
}

export function metaStoreFromSqlRoster(roster, fallbackUser = null) {
  const users = roster?.users?.length
    ? roster.users
    : fallbackUser?.id
      ? [fallbackUser]
      : []
  return {
    users,
    organizations: roster?.organizations || [],
    organizationMemberships: roster?.organizationMemberships || [],
  }
}
