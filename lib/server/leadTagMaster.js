import { isSupabaseEnabled, supabaseRest } from './supabaseClient.js'
import { getOrganization } from './organizations.js'
import { listOrgLeadTagDefinitions, normalizeLeadTagDefinition, slugifyName } from './orgLeadTags.js'

export const LEAD_TAG_MASTER_TABLE = 'lead_tag_master'

export function leadTagMasterEnabled() {
  return isSupabaseEnabled()
}

export function leadTagToMasterRow(organizationId, tag) {
  const normalized = normalizeLeadTagDefinition(tag)
  if (!normalized) return null
  return {
    id: String(normalized.id),
    organization_id: String(organizationId),
    name: normalized.name,
    name_slug: slugifyName(normalized.name),
    color: normalized.color || null,
    team_id: normalized.teamId || null,
    source: normalized.source || null,
    engagement_slug: normalized.engagementSlug || null,
    created_by_user_id: normalized.createdByUserId || null,
    created_at: normalized.createdAt || new Date().toISOString(),
  }
}

export function masterRowToLeadTag(row, index = 0) {
  if (!row) return null
  return normalizeLeadTagDefinition(
    {
      id: row.id,
      name: row.name,
      color: row.color,
      teamId: row.team_id,
      source: row.source,
      engagementSlug: row.engagement_slug,
      createdAt: row.created_at,
      createdByUserId: row.created_by_user_id,
    },
    index
  )
}

export async function listLeadTagMaster(organizationId) {
  if (!leadTagMasterEnabled() || !organizationId) return []
  const org = encodeURIComponent(String(organizationId))
  const rows = await supabaseRest(
    `${LEAD_TAG_MASTER_TABLE}?organization_id=eq.${org}&archived_at=is.null&select=*&order=name.asc`,
    {},
    { timeoutMs: 8_000, attempts: 1, bypassCircuit: true }
  )
  if (!Array.isArray(rows)) return []
  return rows.map((row, i) => masterRowToLeadTag(row, i)).filter(Boolean)
}

export async function upsertLeadTagMasterRows(organizationId, tags) {
  if (!leadTagMasterEnabled() || !organizationId) return { upserted: 0 }
  const rows = (tags || []).map((tag) => leadTagToMasterRow(organizationId, tag)).filter(Boolean)
  if (!rows.length) return { upserted: 0 }
  await supabaseRest(
    `${LEAD_TAG_MASTER_TABLE}?on_conflict=id`,
    {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(rows),
    },
    { timeoutMs: 8_000, attempts: 1, bypassCircuit: true }
  )
  return { upserted: rows.length }
}

export async function deleteLeadTagMasterRow(organizationId, tagId) {
  if (!leadTagMasterEnabled() || !organizationId || !tagId) return { deleted: 0 }
  await supabaseRest(
    `${LEAD_TAG_MASTER_TABLE}?id=eq.${encodeURIComponent(String(tagId))}&organization_id=eq.${encodeURIComponent(String(organizationId))}`,
    { method: 'DELETE' },
    { timeoutMs: 8_000, attempts: 1, bypassCircuit: true }
  )
  return { deleted: 1 }
}

/**
 * SQL is the master. Seed from org JSON when the table is empty; overlay SQL onto the in-memory org.
 */
export async function syncOrgLeadTagMaster(store, organizationId) {
  const fromStore = listOrgLeadTagDefinitions(store, organizationId)
  if (!leadTagMasterEnabled()) return fromStore
  try {
    let fromSql = await listLeadTagMaster(organizationId)
    if (fromStore.length) {
      try {
        await upsertLeadTagMasterRows(organizationId, fromStore)
        fromSql = await listLeadTagMaster(organizationId)
      } catch (error) {
        if (!fromSql.length) throw error
        console.warn('lead_tag_master upsert from store:', error?.message || error)
      }
    }
    if (fromSql.length) {
      const org = getOrganization(store, organizationId)
      if (org) org.leadTags = fromSql
      return fromSql
    }
    return fromStore
  } catch (error) {
    console.warn('lead_tag_master sync:', error?.message || error)
    return fromStore
  }
}

export async function writeLeadTagMaster(organizationId, tag) {
  if (!tag) return
  try {
    await upsertLeadTagMasterRows(organizationId, [tag])
  } catch (error) {
    console.warn('lead_tag_master upsert:', error?.message || error)
  }
}

export async function removeLeadTagMaster(organizationId, tagId) {
  try {
    await deleteLeadTagMasterRow(organizationId, tagId)
  } catch (error) {
    console.warn('lead_tag_master delete:', error?.message || error)
  }
}
