import { pipelineOwnerUserId } from '../pipelineOwner.js'
import { orgMemberUserIdSet, isOrgMemberUserId } from './orgMemberSet.js'
import { readStore, updateStorePartial } from './store.js'
import { fetchStoreCollectionJson, isSupabaseEnabled } from './supabaseClient.js'
import { pipelineOrgShardName, invalidatePipelineShard } from './pipelineShard.js'
import { invalidatePipelineIndex } from './pipelineIndex.js'
import { isPipelineLeadsTableEnabled } from './infra/config.js'
import { supabaseRest } from './supabaseClient.js'

const TABLE = 'pipeline_leads'
const META = ['users', 'organizations', 'organizationMemberships']

async function loadMetaStore() {
  if (isSupabaseEnabled()) {
    const [users, organizations, organizationMemberships] = await Promise.all([
      fetchStoreCollectionJson('users'),
      fetchStoreCollectionJson('organizations'),
      fetchStoreCollectionJson('organizationMemberships'),
    ])
    return { users, organizations, organizationMemberships }
  }
  return readStore({ only: META })
}

function foreignOwnerIdsForOrg(metaStore, organizationId, ownerIds) {
  const members = orgMemberUserIdSet(metaStore, organizationId)
  return [...new Set((ownerIds || []).map(String))].filter((id) => id && !members.has(id))
}

function clearAssigneeOnEntry(entry) {
  if (!entry || typeof entry !== 'object') return entry
  const owner = pipelineOwnerUserId(entry)
  if (!owner) return entry
  const next = { ...entry }
  if (next.assignedToUserId) {
    next.assignedToUserId = null
    next.assignedAt = null
    next.assignedByUserId = null
  } else if (String(next.savedByUserId || '') === owner || String(next.userId || '') === owner) {
    next.savedByUserId = null
    if (String(next.userId || '') === owner) next.userId = null
  }
  next.pipelineUpdatedAt = new Date().toISOString()
  return next
}

function entryOwnedBy(entry, userId) {
  const owner = pipelineOwnerUserId(entry)
  return owner != null && String(owner) === String(userId)
}

/** Strip assignees / savers who are not members of the entry's organization (write-time guard). */
export function enforceOrgMembershipOnPipelineEntries(metaStore, entries) {
  if (!Array.isArray(entries) || !entries.length) return entries || []
  return entries.map((entry) => {
    const orgId = entry?.organizationId
    if (!orgId) return entry
    const owner = pipelineOwnerUserId(entry)
    if (!owner) return entry
    if (isOrgMemberUserId(metaStore, orgId, owner)) return entry
    return clearAssigneeOnEntry(entry)
  })
}

/** Rows in pipeline_leads owned by users who are not org members. */
export async function findForeignPipelineOwnersForOrg(organizationId, metaStore = null) {
  if (!organizationId) return { foreignOwnerIds: [], rows: [] }
  const store = metaStore || (await loadMetaStore())

  let ownerIds = []
  if (isSupabaseEnabled() && isPipelineLeadsTableEnabled()) {
    try {
      const rows = await supabaseRest(
        `${TABLE}?organization_id=eq.${encodeURIComponent(organizationId)}&owner_id=not.is.null&select=owner_id,lead_id`,
        {},
        { timeoutMs: 20_000, attempts: 1 }
      )
      if (Array.isArray(rows)) {
        ownerIds = rows.map((r) => r.owner_id).filter(Boolean)
      }
    } catch {
      ownerIds = []
    }
  }

  const foreignOwnerIds = foreignOwnerIdsForOrg(store, organizationId, ownerIds)
  if (!foreignOwnerIds.length) {
    return { foreignOwnerIds: [], rows: [], metaStore: store }
  }

  const foreignSet = new Set(foreignOwnerIds.map(String))
  const contaminated = []
  if (isSupabaseEnabled() && isPipelineLeadsTableEnabled()) {
    try {
      const inList = [...foreignSet].map((id) => encodeURIComponent(id)).join(',')
      const rows = await supabaseRest(
        `${TABLE}?organization_id=eq.${encodeURIComponent(organizationId)}&owner_id=in.(${inList})&select=lead_id,owner_id,entry`,
        {},
        { timeoutMs: 25_000, attempts: 1 }
      )
      if (Array.isArray(rows)) contaminated.push(...rows)
    } catch {
      // fall through to shard scan
    }
  }

  return { foreignOwnerIds, rows: contaminated, metaStore: store }
}

/** Unassign pipeline rows owned by a user leaving an org (or any non-member owner). */
export async function unassignOrgMemberPipelineLeads(
  organizationId,
  memberUserId,
  { dryRun = false, reason = 'member_removed' } = {}
) {
  if (!organizationId || !memberUserId) return { unassigned: 0, leadIds: [], dryRun }

  const shardName = pipelineOrgShardName(organizationId)
  const leadIds = new Set()

  if (isSupabaseEnabled() && isPipelineLeadsTableEnabled()) {
    const rows = await supabaseRest(
      `${TABLE}?organization_id=eq.${encodeURIComponent(organizationId)}&owner_id=eq.${encodeURIComponent(memberUserId)}&select=lead_id,entry`,
      {},
      { timeoutMs: 25_000, attempts: 1 }
    )
    if (Array.isArray(rows)) {
      const patches = []
      for (const row of rows) {
        const entry = row.entry
        if (!entry?.lead?.id && !row.lead_id) continue
        const leadId = String(row.lead_id || entry.lead?.id)
        leadIds.add(leadId)
        if (dryRun) continue
        const next = clearAssigneeOnEntry(entry)
        patches.push(next)
      }
      if (!dryRun && patches.length) {
        const { upsertPipelineLeadRows } = await import('./pipelineLeadsTable.js')
        await upsertPipelineLeadRows(shardName, patches, { force: true })
      }
    }
  }

  if (!dryRun) {
    await updateStorePartial([shardName, 'savedLeads'], async (draft) => {
      const shard = draft[shardName]
      if (Array.isArray(shard)) {
        draft[shardName] = shard.map((entry) =>
          entry.organizationId === organizationId && entryOwnedBy(entry, memberUserId)
            ? clearAssigneeOnEntry(entry)
            : entry
        )
      }
      if (Array.isArray(draft.savedLeads)) {
        draft.savedLeads = draft.savedLeads.map((entry) =>
          entry.organizationId === organizationId && entryOwnedBy(entry, memberUserId)
            ? clearAssigneeOnEntry(entry)
            : entry
        )
      }
      return draft
    })
    invalidatePipelineShard(shardName)
    invalidatePipelineIndex(shardName)
  } else {
    const store = await readStore({ only: [shardName, 'savedLeads'] })
    for (const entry of store[shardName] || []) {
      if (entry.organizationId === organizationId && entryOwnedBy(entry, memberUserId)) {
        leadIds.add(String(entry.lead?.id || entry.id))
      }
    }
    for (const entry of store.savedLeads || []) {
      if (entry.organizationId === organizationId && entryOwnedBy(entry, memberUserId)) {
        leadIds.add(String(entry.lead?.id || entry.id))
      }
    }
  }

  return { unassigned: leadIds.size, leadIds: [...leadIds], dryRun, reason }
}

/** Fix all pipeline rows in an org assigned to users outside that org. */
export async function repairForeignPipelineOwnersForOrg(organizationId, { dryRun = false } = {}) {
  const { foreignOwnerIds, rows, metaStore } = await findForeignPipelineOwnersForOrg(organizationId)
  if (!foreignOwnerIds.length) {
    return { organizationId, foreignOwnerIds: [], repaired: 0, dryRun }
  }

  let repaired = 0
  for (const foreignId of foreignOwnerIds) {
    const result = await unassignOrgMemberPipelineLeads(organizationId, foreignId, { dryRun })
    repaired += result.unassigned
  }

  return {
    organizationId,
    foreignOwnerIds,
    contaminatedLeadCount: rows.length,
    repaired,
    dryRun,
    orgName: metaStore?.organizations?.find((o) => o.id === organizationId)?.name || null,
  }
}

/** Audit every org for foreign pipeline owners. */
export async function auditAllOrganizationsTenantIsolation({ dryRun = false } = {}) {
  const metaStore = await loadMetaStore()
  const orgs = metaStore.organizations || []
  const reports = []

  for (const org of orgs) {
    if (!org?.id) continue
    const { foreignOwnerIds, rows } = await findForeignPipelineOwnersForOrg(org.id, metaStore)
    if (!foreignOwnerIds.length) continue
    const names = foreignOwnerIds.map((uid) => {
      const u = (metaStore.users || []).find((row) => String(row.id) === String(uid))
      return { userId: uid, name: u?.name || null, email: u?.email || null, organizationId: u?.organizationId || null }
    })
    reports.push({
      organizationId: org.id,
      organizationName: org.name,
      foreignOwnerIds,
      foreignUsers: names,
      contaminatedLeadCount: rows.length,
    })
    if (!dryRun) {
      await repairForeignPipelineOwnersForOrg(org.id, { dryRun: false })
    }
  }

  return { dryRun, issueCount: reports.length, reports }
}
