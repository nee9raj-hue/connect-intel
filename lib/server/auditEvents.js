import { isSupabaseEnabled, supabaseRest } from './supabaseClient.js'
import { resolveOrganizationUuid } from './orgSqlResolve.js'

function flag(name) {
  const v = String(process.env[name] || '')
    .trim()
    .toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
}

export function isAuditEventsEnabled() {
  if (flag('AUDIT_EVENTS_OFF') || flag('DISABLE_AUDIT_EVENTS')) return false
  return isSupabaseEnabled()
}

const orgUuidCache = { orgs: new Map() }

async function resolveOrgUuid(legacyOrgId, store) {
  if (!legacyOrgId) return null
  return resolveOrganizationUuid(legacyOrgId, orgUuidCache, { store, autoSync: false })
}

/**
 * Append-only audit row (service role). No-op when Supabase/audit disabled.
 */
export async function recordAuditEvent({
  organizationId,
  actorUserId,
  action,
  resourceType = null,
  resourceId = null,
  outcome = 'success',
  metadata = {},
  store = null,
}) {
  if (!isAuditEventsEnabled() || !action) return { skipped: true }

  const orgUuid = await resolveOrgUuid(organizationId, store)

  const row = {
    legacy_org_id: organizationId || null,
    organization_id: orgUuid,
    actor_legacy_user_id: actorUserId || null,
    action: String(action).slice(0, 120),
    resource_type: resourceType ? String(resourceType).slice(0, 64) : null,
    resource_id: resourceId ? String(resourceId).slice(0, 128) : null,
    outcome: outcome === 'denied' ? 'denied' : outcome === 'failure' ? 'failure' : 'success',
    metadata: metadata && typeof metadata === 'object' ? metadata : {},
    created_at: new Date().toISOString(),
  }

  try {
    await supabaseRest('audit_events', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify([row]),
    })
    return { ok: true }
  } catch (error) {
    if (/relation.*audit_events|42P01|schema cache/i.test(String(error?.message || ''))) {
      return { skipped: true, reason: 'table_missing' }
    }
    console.warn('audit_events insert:', error?.message || error)
    return { ok: false, error: error?.message || String(error) }
  }
}

export async function listAuditEventsForOrg(legacyOrgId, { limit = 50, action = null } = {}) {
  if (!isAuditEventsEnabled() || !legacyOrgId) return []

  const orgUuid = await resolveOrgUuid(legacyOrgId)
  const cap = Math.min(200, Math.max(1, Number(limit) || 50))
  let path = `audit_events?legacy_org_id=eq.${encodeURIComponent(legacyOrgId)}&select=id,action,resource_type,resource_id,outcome,metadata,actor_legacy_user_id,created_at&order=created_at.desc&limit=${cap}`
  if (orgUuid) {
    path = `audit_events?or=(legacy_org_id.eq.${encodeURIComponent(legacyOrgId)},organization_id.eq.${encodeURIComponent(orgUuid)})&select=id,action,resource_type,resource_id,outcome,metadata,actor_legacy_user_id,created_at&order=created_at.desc&limit=${cap}`
  }
  if (action) {
    path += `&action=eq.${encodeURIComponent(action)}`
  }

  try {
    const rows = await supabaseRest(path, {}, { timeoutMs: 12_000, attempts: 1 })
    return Array.isArray(rows) ? rows : []
  } catch (error) {
    if (/relation.*audit_events|42P01/i.test(String(error?.message || ''))) return []
    throw error
  }
}
