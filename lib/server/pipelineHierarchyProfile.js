import { isSupabaseEnabled, supabaseRest } from './supabaseClient.js'
import { isPipelineHierarchyRbacEnabled } from './infra/config.js'
import { resolveOrgRole } from './organizations.js'

const profileCache = new Map()
const CACHE_MS = 60_000

function mapProfileRow(row) {
  if (!row) return null
  return {
    profileId: row.id,
    legacyUserId: row.legacy_user_id,
    organizationId: row.organization_id,
    email: row.email,
    name: row.full_name,
    role: row.role || 'rep',
    teamId: row.team_id ? String(row.team_id) : null,
    departmentId: row.department_id ? String(row.department_id) : null,
    pipelineRole: row.pipeline_role,
  }
}

/** Load relational hierarchy row for an app user (profiles.legacy_user_id). */
export async function loadHierarchyProfile(user, metaStore = null) {
  if (!user?.id || !isSupabaseEnabled()) return null

  const cacheKey = user.id
  const cached = profileCache.get(cacheKey)
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.profile

  try {
    const rows = await supabaseRest(
      `profiles?legacy_user_id=eq.${encodeURIComponent(user.id)}&select=id,legacy_user_id,organization_id,email,full_name,role,team_id,department_id,pipeline_role&limit=1`,
      {},
      { timeoutMs: 8_000, attempts: 2 }
    )
    const profile = mapProfileRow(Array.isArray(rows) ? rows[0] : null)
    if (profile) {
      profileCache.set(cacheKey, { profile, at: Date.now() })
      return profile
    }
  } catch (err) {
    console.warn('loadHierarchyProfile:', err?.message || err)
  }

  if (!metaStore) return null
  const { orgRole, accountType } = resolveOrgRole(user, metaStore)
  if (accountType !== 'company' || !user.organizationId) return null

  const fallbackRole =
    orgRole === 'org_admin' ? 'admin' : user.pipelineRole === 'manager' ? 'manager' : 'rep'

  return {
    profileId: null,
    legacyUserId: user.id,
    organizationId: user.organizationId,
    email: user.email,
    name: user.name,
    role: fallbackRole,
    teamId: user.teamId ? String(user.teamId) : null,
    departmentId: user.departmentId ? String(user.departmentId) : null,
    pipelineRole: user.pipelineRole,
    fallback: true,
  }
}

export function clearHierarchyProfileCache(userId) {
  if (userId) profileCache.delete(userId)
  else profileCache.clear()
}
