import { isSupabaseEnabled, supabaseRest } from './supabaseClient.js'
import { resolveOrgUuid, resolveProfileId } from './enterpriseLeadsTable.js'
import { AUTH_STORE_COLLECTIONS, readStore } from './store.js'

const cache = { orgs: new Map(), profiles: new Map() }

function orgCache() {
  return { orgs: cache.orgs, profiles: cache.profiles }
}

export function orgHierarchyActive() {
  return isSupabaseEnabled()
}

async function requireOrgUuid(legacyOrgId) {
  if (!legacyOrgId) throw new Error('Organization required')
  const orgUuid = await resolveOrgUuid(legacyOrgId, orgCache())
  if (!orgUuid) throw new Error('Organization not synced to SQL — run enterprise backfill')
  return orgUuid
}

export async function listOrgHierarchy(legacyOrgId, { skipLeadCounts = false } = {}) {
  if (!orgHierarchyActive()) return { departments: [], sql: false }

  const orgUuid = await requireOrgUuid(legacyOrgId)

  const [departments, teams, profiles] = await Promise.all([
    supabaseRest(
      `departments?organization_id=eq.${encodeURIComponent(orgUuid)}&select=id,name,created_at&order=name.asc`,
      {},
      { timeoutMs: 12_000 }
    ),
    supabaseRest(
      `teams?organization_id=eq.${encodeURIComponent(orgUuid)}&select=id,name,department_id,manager_legacy_user_id,manager_profile_id,created_at&order=name.asc`,
      {},
      { timeoutMs: 12_000 }
    ),
    supabaseRest(
      `profiles?organization_id=eq.${encodeURIComponent(orgUuid)}&select=id,legacy_user_id,full_name,email,role,team_id,department_id&order=full_name.asc`,
      {},
      { timeoutMs: 12_000 }
    ),
  ])

  const teamIds = (teams || []).map((t) => t.id)
  let leadCounts = {}
  if (!skipLeadCounts && teamIds.length) {
    const counts = await supabaseRest(
      'rpc/ci_count_pipeline_leads_by_teams',
      {
        method: 'POST',
        body: JSON.stringify({
          p_organization_id: legacyOrgId,
          p_team_ids: teamIds.map(String),
        }),
      },
      { timeoutMs: 12_000, attempts: 1 }
    ).catch(() => null)

    if (Array.isArray(counts)) {
      leadCounts = Object.fromEntries(counts.map((r) => [r.team_id, Number(r.cnt) || 0]))
    }
  }

  const profilesByTeam = {}
  const assigned = new Set()
  for (const p of profiles || []) {
    if (p.team_id) {
      const tid = String(p.team_id)
      if (!profilesByTeam[tid]) profilesByTeam[tid] = []
      profilesByTeam[tid].push(mapProfileRow(p))
      assigned.add(p.legacy_user_id)
    }
  }

  const teamsByDept = {}
  for (const t of teams || []) {
    const deptId = String(t.department_id)
    if (!teamsByDept[deptId]) teamsByDept[deptId] = []
    teamsByDept[deptId].push({
      id: t.id,
      name: t.name,
      departmentId: t.department_id,
      managerLegacyUserId: t.manager_legacy_user_id || null,
      managerUserId: t.manager_legacy_user_id || null,
      memberCount: (profilesByTeam[String(t.id)] || []).length,
      openLeadCount: leadCounts[String(t.id)] || 0,
      members: profilesByTeam[String(t.id)] || [],
    })
  }

  const unassignedMembers = (profiles || [])
    .filter((p) => !p.team_id && p.legacy_user_id)
    .map(mapProfileRow)

  return {
    sql: true,
    organizationId: legacyOrgId,
    departments: (departments || []).map((d) => ({
      id: d.id,
      name: d.name,
      teams: teamsByDept[String(d.id)] || [],
    })),
    unassignedMembers,
  }
}

function mapProfileRow(p) {
  return {
    profileId: p.id,
    userId: p.legacy_user_id,
    name: p.full_name || p.email,
    email: p.email,
    role: p.role || 'rep',
    teamId: p.team_id || null,
    departmentId: p.department_id || null,
  }
}

export async function createDepartment(legacyOrgId, { name }) {
  const orgUuid = await requireOrgUuid(legacyOrgId)
  const label = String(name || '').trim()
  if (!label) throw new Error('Department name is required')

  const rows = await supabaseRest(
    'departments',
    {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        organization_id: orgUuid,
        name: label,
        legacy_id: `${legacyOrgId}:${label.toLowerCase().replace(/\s+/g, '-')}`,
      }),
    },
    { timeoutMs: 12_000 }
  )
  return Array.isArray(rows) ? rows[0] : rows
}

export async function updateDepartment(legacyOrgId, departmentId, { name }) {
  const orgUuid = await requireOrgUuid(legacyOrgId)
  const label = String(name || '').trim()
  if (!label) throw new Error('Department name is required')

  await supabaseRest(
    `departments?id=eq.${encodeURIComponent(departmentId)}&organization_id=eq.${encodeURIComponent(orgUuid)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ name: label, updated_at: new Date().toISOString() }),
    },
    { timeoutMs: 12_000 }
  )
  return { id: departmentId, name: label }
}

export async function deleteDepartment(legacyOrgId, departmentId) {
  const orgUuid = await requireOrgUuid(legacyOrgId)

  const teams = await supabaseRest(
    `teams?department_id=eq.${encodeURIComponent(departmentId)}&select=id&limit=1`,
    {},
    { timeoutMs: 8_000 }
  )
  if (Array.isArray(teams) && teams.length) {
    throw new Error('Reassign or delete teams in this department first')
  }

  const members = await supabaseRest(
    `profiles?department_id=eq.${encodeURIComponent(departmentId)}&select=id&limit=1`,
    {},
    { timeoutMs: 8_000 }
  )
  if (Array.isArray(members) && members.length) {
    throw new Error('Reassign members out of this department first')
  }

  await supabaseRest(
    `departments?id=eq.${encodeURIComponent(departmentId)}&organization_id=eq.${encodeURIComponent(orgUuid)}`,
    { method: 'DELETE' },
    { timeoutMs: 12_000 }
  )
  return { deleted: true }
}

export async function createTeam(legacyOrgId, { departmentId, name, managerLegacyUserId }) {
  const orgUuid = await requireOrgUuid(legacyOrgId)
  const label = String(name || '').trim()
  if (!departmentId) throw new Error('departmentId is required')
  if (!label) throw new Error('Team name is required')

  let managerProfileId = null
  if (managerLegacyUserId) {
    managerProfileId = await resolveProfileId(managerLegacyUserId, orgCache())
  }

  const rows = await supabaseRest(
    'teams',
    {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        organization_id: orgUuid,
        department_id: departmentId,
        name: label,
        manager_legacy_user_id: managerLegacyUserId || null,
        manager_profile_id: managerProfileId,
      }),
    },
    { timeoutMs: 12_000 }
  )
  return Array.isArray(rows) ? rows[0] : rows
}

export async function updateTeam(legacyOrgId, teamId, patch = {}) {
  const orgUuid = await requireOrgUuid(legacyOrgId)
  const body = { updated_at: new Date().toISOString() }
  if (patch.name != null) body.name = String(patch.name).trim()
  if (patch.departmentId != null) body.department_id = patch.departmentId
  if (patch.managerLegacyUserId !== undefined) {
    body.manager_legacy_user_id = patch.managerLegacyUserId || null
    body.manager_profile_id = patch.managerLegacyUserId
      ? await resolveProfileId(patch.managerLegacyUserId, orgCache())
      : null
  }

  await supabaseRest(
    `teams?id=eq.${encodeURIComponent(teamId)}&organization_id=eq.${encodeURIComponent(orgUuid)}`,
    { method: 'PATCH', body: JSON.stringify(body) },
    { timeoutMs: 12_000 }
  )
  return { id: teamId, ...body }
}

export async function deleteTeam(legacyOrgId, teamId) {
  const orgUuid = await requireOrgUuid(legacyOrgId)

  const members = await supabaseRest(
    `profiles?team_id=eq.${encodeURIComponent(teamId)}&select=id&limit=1`,
    {},
    { timeoutMs: 8_000 }
  )
  if (Array.isArray(members) && members.length) {
    throw new Error('Reassign all team members before deleting this team')
  }

  await supabaseRest(
    `teams?id=eq.${encodeURIComponent(teamId)}&organization_id=eq.${encodeURIComponent(orgUuid)}`,
    { method: 'DELETE' },
    { timeoutMs: 12_000 }
  )
  return { deleted: true }
}

/** Map legacy_user_id → SQL profile row (role, team, department). */
export async function loadMemberProfilesMap(legacyOrgId) {
  if (!orgHierarchyActive() || !legacyOrgId) return {}
  try {
    const orgUuid = await requireOrgUuid(legacyOrgId)
    const profiles = await supabaseRest(
      `profiles?organization_id=eq.${encodeURIComponent(orgUuid)}&select=legacy_user_id,role,team_id,department_id&limit=500`,
      {},
      { timeoutMs: 10_000 }
    )
    return Object.fromEntries(
      (profiles || [])
        .filter((p) => p.legacy_user_id)
        .map((p) => [
          p.legacy_user_id,
          {
            sqlRole: p.role || 'rep',
            teamId: p.team_id || null,
            departmentId: p.department_id || null,
          },
        ])
    )
  } catch {
    return {}
  }
}

function mapMembershipRole(membership) {
  if (membership?.role === 'org_admin') return 'admin'
  if (membership?.pipelineRole === 'manager') return 'manager'
  return 'rep'
}

/** Create SQL profile on demand when backfill missed a member. */
export async function ensureMemberProfile(legacyOrgId, userId) {
  const orgUuid = await requireOrgUuid(legacyOrgId)
  const existing = await supabaseRest(
    `profiles?legacy_user_id=eq.${encodeURIComponent(userId)}&organization_id=eq.${encodeURIComponent(orgUuid)}&select=id&limit=1`,
    {},
    { timeoutMs: 8_000 }
  )
  if (Array.isArray(existing) && existing[0]?.id) return existing[0]

  const store = await readStore({ only: AUTH_STORE_COLLECTIONS })
  const user = (store.users || []).find((u) => u.id === userId)
  if (!user) {
    throw new Error('Member profile missing in SQL. Ask your admin to run enterprise backfill.')
  }
  const membership = (store.organizationMemberships || []).find(
    (m) => m.userId === userId && m.organizationId === legacyOrgId
  )

  const rows = await supabaseRest('profiles?on_conflict=legacy_user_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify([
      {
        legacy_user_id: userId,
        organization_id: orgUuid,
        email: String(user.email || '').toLowerCase(),
        full_name: user.name || user.email || null,
        role: mapMembershipRole(membership),
        pipeline_role: membership?.pipelineRole || null,
        can_search: Boolean(membership?.canSearch),
        updated_at: new Date().toISOString(),
      },
    ]),
  }, { timeoutMs: 12_000 })

  return Array.isArray(rows) ? rows[0] : rows
}

export async function assignMemberHierarchy(legacyOrgId, { userId, teamId, departmentId, role }) {
  const orgUuid = await requireOrgUuid(legacyOrgId)
  if (!userId) throw new Error('userId is required')

  await ensureMemberProfile(legacyOrgId, userId)

  const body = { updated_at: new Date().toISOString() }
  if (teamId !== undefined) body.team_id = teamId || null
  if (departmentId !== undefined) body.department_id = departmentId || null
  if (role) body.role = role

  if (teamId && !departmentId) {
    const teams = await supabaseRest(
      `teams?id=eq.${encodeURIComponent(teamId)}&select=department_id&limit=1`,
      {},
      { timeoutMs: 8_000 }
    )
    if (teams?.[0]?.department_id) body.department_id = teams[0].department_id
  }

  await supabaseRest(
    `profiles?legacy_user_id=eq.${encodeURIComponent(userId)}&organization_id=eq.${encodeURIComponent(orgUuid)}`,
    { method: 'PATCH', body: JSON.stringify(body) },
    { timeoutMs: 12_000 }
  )

  return { userId, ...body }
}
