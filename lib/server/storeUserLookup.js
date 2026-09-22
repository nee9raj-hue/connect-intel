/** Point-lookup auth records without downloading store_collections JSON blobs. */

import { isSupabaseEnabled, supabaseRest } from './supabaseClient.js'

const PG_LOOKUP_MS = 15_000
const SQL_LOOKUP_MS = 5_000

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null
}

function withTimeout(promise, ms, label) {
  let timer
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms)
    }),
  ])
}

async function findUserViaPostgres(email) {
  try {
    const { queryPg } = await import('./pgPool.js')
    const { rows } = await withTimeout(
      queryPg(
        `SELECT elem AS user
         FROM store_collections,
              jsonb_array_elements(json) elem
         WHERE collection = 'users'
           AND lower(elem->>'email') = $1
         LIMIT 1`,
        [email]
      ),
      PG_LOOKUP_MS,
      'user pg lookup'
    )
    const user = asObject(rows[0]?.user)
    if (!user?.id) return null

    let organization = null
    let memberships = []
    const orgId = String(user.organizationId || '').trim()
    if (orgId) {
      const orgRows = await withTimeout(
        queryPg(
          `SELECT elem AS org
           FROM store_collections,
                jsonb_array_elements(json) elem
           WHERE collection = 'organizations'
             AND elem->>'id' = $1
           LIMIT 1`,
          [orgId]
        ),
        PG_LOOKUP_MS,
        'org pg lookup'
      )
      organization = asObject(orgRows.rows[0]?.org)
      const memRows = await withTimeout(
        queryPg(
          `SELECT elem AS membership
           FROM store_collections,
                jsonb_array_elements(json) elem
           WHERE collection = 'organizationMemberships'
             AND elem->>'userId' = $1
             AND elem->>'organizationId' = $2`,
          [String(user.id), orgId]
        ),
        PG_LOOKUP_MS,
        'membership pg lookup'
      )
      memberships = (memRows.rows || []).map((row) => asObject(row.membership)).filter(Boolean)
    }
    return { user, organization, memberships }
  } catch (error) {
    console.warn('findUserViaPostgres:', error?.message || error)
    return null
  }
}

/** Same-email profile duplicates (login vs CRM book) — prefer the teamed CRM identity. */
export function pickCanonicalAuthProfile(profiles) {
  const rows = (Array.isArray(profiles) ? profiles : []).filter((p) => p?.legacy_user_id)
  if (!rows.length) return null
  const rank = (p) => {
    let score = 0
    if (p.team_id) score += 100
    const pipelineRole = String(p.pipeline_role || '').trim()
    if (pipelineRole && !/\s/.test(pipelineRole)) score += 10
    if (String(p.full_name || '').trim().split(/\s+/).filter(Boolean).length >= 2) score += 5
    return score
  }
  return [...rows].sort((a, b) => {
    const delta = rank(b) - rank(a)
    if (delta) return delta
    return String(a.legacy_user_id).localeCompare(String(b.legacy_user_id))
  })[0]
}

export function siblingProfileActorIds(profiles) {
  return [
    ...new Set(
      (Array.isArray(profiles) ? profiles : [])
        .map((p) => String(p?.legacy_user_id || '').trim())
        .filter(Boolean)
    ),
  ]
}

export function userRecordFromProfileRow(profile, organization, extras = {}) {
  const p = asObject(profile)
  if (!p?.legacy_user_id && !p?.email) return null
  const meta = asObject(p.metadata) || {}
  const orgAdmin = String(p.role || '').toLowerCase() === 'admin'
  const pipelineActorIds = siblingProfileActorIds(extras.siblingProfiles)
  return {
    id: p.legacy_user_id,
    email: String(p.email || '').toLowerCase(),
    name: p.full_name || String(p.email || '').split('@')[0],
    organizationId: organization?.id || null,
    organizationUuid: organization?.sqlId || p.organization_id || null,
    accountType: meta.accountType || (organization ? 'company' : 'individual'),
    onboardingComplete: true,
    pipelineRole: String(p.pipeline_role || '').trim() || (orgAdmin ? 'org_admin' : 'member'),
    role: orgAdmin ? 'admin' : 'member',
    canSearch: p.can_search !== false,
    company: organization?.name || null,
    organizationName: organization?.name || null,
    organizationLogoUrl: organization?.logoUrl || null,
    authProvider: meta.authProvider || 'google',
    ...(pipelineActorIds.length ? { pipelineActorIds } : {}),
  }
}

export function organizationRecordFromSqlRow(row) {
  const o = asObject(row)
  if (!o?.legacy_id) return null
  const meta = asObject(o.metadata) || {}
  return {
    id: o.legacy_id,
    sqlId: o.id,
    name: o.company_name || 'Company',
    domain: o.domain || null,
    accountType: o.account_type || 'company',
    workspacePreset: meta.workspacePreset || null,
    logoUrl: meta.logoUrl || null,
    workspaceFeatures: meta.workspaceFeatures || {},
  }
}

async function findUserViaProfiles(email) {
  if (!isSupabaseEnabled()) return null
  try {
    const profiles = await supabaseRest(
      `profiles?email=eq.${encodeURIComponent(email)}&select=legacy_user_id,organization_id,email,full_name,role,pipeline_role,can_search,metadata,team_id&limit=20`,
      {},
      { timeoutMs: SQL_LOOKUP_MS, attempts: 1, bypassCircuit: true }
    )
    const matches = Array.isArray(profiles) ? profiles : []
    const profile = pickCanonicalAuthProfile(matches)
    if (!profile?.legacy_user_id) return null

    let organization = null
    if (profile.organization_id) {
      const orgs = await supabaseRest(
        `organizations?id=eq.${encodeURIComponent(profile.organization_id)}&select=legacy_id,company_name,domain,metadata,account_type&limit=1`,
        {},
        { timeoutMs: SQL_LOOKUP_MS, attempts: 1, bypassCircuit: true }
      )
      organization = organizationRecordFromSqlRow(Array.isArray(orgs) ? orgs[0] : null)
    }

    const user = userRecordFromProfileRow(profile, organization, { siblingProfiles: matches })
    const memberships = organization
      ? [
          {
            userId: user.id,
            organizationId: organization.id,
            role: String(profile.role || '').toLowerCase() === 'admin' ? 'org_admin' : 'member',
            pipelineRole: user.pipelineRole,
            status: 'active',
            canSearch: user.canSearch,
          },
        ]
      : []
    return { user, organization, memberships }
  } catch (error) {
    console.warn('findUserViaProfiles:', error?.message || error)
    return null
  }
}

/** Existing user + org + memberships for sign-in. Never loads the full users JSON blob. */
export async function findAuthUserByEmail(email) {
  const normalized = String(email || '').trim().toLowerCase()
  if (!normalized) return null
  const sql = await findUserViaProfiles(normalized)
  if (sql?.user?.id && sql.user.organizationId) return sql
  return (await findUserViaPostgres(normalized)) || sql
}

/** Do not rewrite the users JSON blob on login — that lock stalls Pipeline. */
export async function persistLastLoginFast() {
  return
}
