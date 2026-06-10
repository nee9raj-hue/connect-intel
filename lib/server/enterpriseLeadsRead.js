import { isEnterpriseLeadsReadEnabled } from './infra/config.js'
import { supabaseRest } from './supabaseClient.js'
import { resolveOrgUuid, resolveProfileId } from './enterpriseLeadsTable.js'
import { resolveEnterpriseAssigneeFilter } from './enterpriseLeadsScope.js'

const VIEW = 'decrypted_leads'
const CHUNK = 40

/** decrypted_leads row → frontend camelCase PII (already plaintext from Vault). */
export function mapDecryptedRowToClientPii(row) {
  if (!row) return null
  return {
    firstName: row.first_name || null,
    lastName: row.last_name || null,
    email: row.email || null,
    phone: row.phone || null,
  }
}

function leadIdFromClientRow(row) {
  return row?.id || row?.leadId || null
}

function applyPiiToClientRow(row, pii) {
  if (!row || !pii) return row
  return { ...row, ...pii }
}

async function buildDecryptedLeadsFilter(user, filters = {}, cache = { orgs: new Map(), profiles: new Map() }) {
  if (!user?.organizationId || user.accountType !== 'company') return null

  const orgUuid = await resolveOrgUuid(user.organizationId, cache)
  if (!orgUuid) return null

  const parts = [`organization_id=eq.${encodeURIComponent(orgUuid)}`]
  const scope = resolveEnterpriseAssigneeFilter(user, filters)

  if (scope.mode === 'rep' && scope.legacyUserId) {
    const profileId = await resolveProfileId(scope.legacyUserId, cache)
    if (profileId) parts.push(`assigned_to=eq.${encodeURIComponent(profileId)}`)
    else return null
  } else if (scope.legacyAssigneeUserId) {
    const profileId = await resolveProfileId(scope.legacyAssigneeUserId, cache)
    if (profileId) parts.push(`assigned_to=eq.${encodeURIComponent(profileId)}`)
  } else if (scope.unassigned) {
    parts.push('assigned_to=is.null')
  }

  return parts.join('&')
}

async function fetchDecryptedPiiMap(user, legacyLeadIds, filters = {}) {
  const ids = [...new Set((legacyLeadIds || []).map((id) => String(id)).filter(Boolean))]
  if (!ids.length || !isEnterpriseLeadsReadEnabled()) return new Map()

  const baseFilter = await buildDecryptedLeadsFilter(user, filters)
  if (!baseFilter) return new Map()

  const cache = { orgs: new Map(), profiles: new Map() }
  const map = new Map()

  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK)
    const inList = chunk.map((id) => encodeURIComponent(id)).join(',')
    const rows = await supabaseRest(
      `${VIEW}?${baseFilter}&legacy_lead_id=in.(${inList})&select=legacy_lead_id,first_name,last_name,email,phone`,
      {},
      { timeoutMs: 30_000, attempts: 2 }
    )
    for (const row of rows || []) {
      const pii = mapDecryptedRowToClientPii(row)
      if (pii && row.legacy_lead_id) map.set(String(row.legacy_lead_id), pii)
    }
  }

  return map
}

async function enrichClientLeadRows(user, rows, filters = {}) {
  if (!Array.isArray(rows) || !rows.length || !isEnterpriseLeadsReadEnabled()) return rows
  const piiMap = await fetchDecryptedPiiMap(
    user,
    rows.map(leadIdFromClientRow),
    filters
  )
  if (!piiMap.size) return rows
  return rows.map((row) => {
    const id = leadIdFromClientRow(row)
    const pii = id ? piiMap.get(String(id)) : null
    return pii ? applyPiiToClientRow(row, pii) : row
  })
}

/** Enrich API payloads that expose pipeline leads (read path uses decrypted_leads for PII). */
export async function enrichSavedLeadsPayload(user, payload, filters = {}) {
  if (!payload || !isEnterpriseLeadsReadEnabled()) return payload

  const next = { ...payload }

  if (next.lead) {
    const [enriched] = await enrichClientLeadRows(user, [next.lead], filters)
    next.lead = enriched
  }

  if (Array.isArray(next.leads)) {
    next.leads = await enrichClientLeadRows(user, next.leads, filters)
  }

  if (next.board && typeof next.board === 'object') {
    const board = { ...next.board }
    for (const [status, entries] of Object.entries(board)) {
      board[status] = await enrichClientLeadRows(user, entries, filters)
    }
    next.board = board
  }

  return next
}
