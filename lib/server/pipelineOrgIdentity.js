import { isSupabaseEnabled, supabaseRest } from './supabaseClient.js'

const cache = new Map()
const CACHE_MS = 5 * 60_000

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function pipelineOrgShardName(organizationId) {
  return `pipeline_org_${organizationId}`
}

export function looksLikeUuid(value) {
  return UUID_RE.test(String(value || '').trim())
}

/** Session + SQL org keys that may appear on pipeline_leads.organization_id. */
export function collectPipelineOrganizationIds(user, store = null) {
  const ids = new Set()
  const org = store?.organizations?.find((row) => row?.id && row.id === user?.organizationId) || null
  for (const value of [
    user?.organizationId,
    user?.organizationUuid,
    user?.sqlOrganizationId,
    org?.id,
    org?.sqlOrganizationId,
    org?.sqlId,
  ]) {
    const id = String(value || '').trim()
    if (id) ids.add(id)
  }
  return [...ids]
}

export function postgrestOrgScopeFilter({ organizationIds = [], shardNames = [] } = {}) {
  const clauses = []
  for (const id of organizationIds) {
    const value = String(id || '').trim()
    if (value) clauses.push(`organization_id.eq.${encodeURIComponent(value)}`)
  }
  for (const name of shardNames) {
    const value = String(name || '').trim()
    if (value) clauses.push(`shard_name.eq.${encodeURIComponent(value)}`)
  }
  const unique = [...new Set(clauses)]
  if (!unique.length) return null
  if (unique.length === 1) {
    const [column, value] = unique[0].split('.eq.')
    return `${column}=eq.${value}`
  }
  return `or=(${unique.join(',')})`
}

export function pipelineEntryInOrganization(entry, organizationIds) {
  const wanted = organizationIds instanceof Set ? organizationIds : new Set(organizationIds || [])
  if (!wanted.size) return false
  const id = String(entry?.organizationId || '').trim()
  if (!id) return true
  return wanted.has(id)
}

/**
 * Map JWT/session org id (legacy or UUID) to every id/shard used after SQL org remaps.
 */
export async function resolvePipelineOrgIdentity(organizationId) {
  const seed = String(organizationId || '').trim()
  if (!seed) return { ids: [], shardNames: [] }

  const hit = cache.get(seed)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value

  const ids = new Set([seed])
  if (isSupabaseEnabled()) {
    try {
      const rows = await supabaseRest(
        `organizations?or=(legacy_id.eq.${encodeURIComponent(seed)},id.eq.${encodeURIComponent(seed)})&select=id,legacy_id&limit=1`,
        {},
        { timeoutMs: 4_000, attempts: 1, bypassCircuit: true }
      )
      const row = Array.isArray(rows) ? rows[0] : null
      if (row?.id) ids.add(String(row.id))
      if (row?.legacy_id) ids.add(String(row.legacy_id))
    } catch (error) {
      console.warn('pipeline org identity:', error?.message || error)
    }
  }

  const list = [...ids]
  const value = {
    ids: list,
    shardNames: list.map((id) => pipelineOrgShardName(id)),
  }
  cache.set(seed, { value, at: Date.now() })
  return value
}
