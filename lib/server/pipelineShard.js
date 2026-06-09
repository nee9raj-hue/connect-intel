import {
  readStore,
  updateStorePartial,
  writeStoreCollections,
  writeSavedLeadsCollection,
  isPipelineShardCollection,
  withStoreLock,
} from './store.js'
import { isSupabaseEnabled, upsertCollection, fetchStoreCollectionJson } from './supabaseClient.js'
import { getOrganization, listPipelineSavedEntries } from './organizations.js'
import { isFreightDealOrg } from '../freightDeal.js'
import { invalidatePipelineIndex, refreshPipelineIndex } from './pipelineIndex.js'
import { findPipelineEntry } from './pipelineAccess.js'
import { PIPELINE_STORE_COLLECTIONS } from './pipelineStore.js'
import { normalizeDealsList } from './crmWorkflow.js'

const META_STORE_COLLECTIONS = ['users', 'organizations', 'organizationMemberships']

const CACHE_TTL_MS = 90_000
const DASHBOARD_CACHE_TTL_MS = 60_000
const shardCache = new Map()
const dashboardVisibleCache = new Map()

export { isPipelineShardCollection }

export function pipelineOrgShardName(organizationId) {
  return `pipeline_org_${organizationId}`
}

export function pipelineUserShardName(userId) {
  return `pipeline_user_${userId}`
}

export function pipelineShardNameForUser(user) {
  if (user?.organizationId && user?.accountType === 'company') {
    return pipelineOrgShardName(user.organizationId)
  }
  return pipelineUserShardName(user.id)
}

/** Shard for a pipeline row — use for webhooks/system writes (not viewer assignee filter). */
export function pipelineShardNameForEntry(entry) {
  if (entry?.organizationId) return pipelineOrgShardName(entry.organizationId)
  const uid = entry.assignedToUserId || entry.savedByUserId || entry.userId
  if (uid) return pipelineUserShardName(uid)
  return null
}

export function pipelineEntryKey(entry) {
  return String(entry?.lead?.id || entry?.contactId || entry?.id || '')
}

/** Newest CRM revision wins when shard and savedLeads copies diverge. */
export function pipelineEntryFreshness(entry) {
  if (!entry) return 0
  let max = 0
  if (entry.pipelineUpdatedAt) {
    const t = new Date(entry.pipelineUpdatedAt).getTime()
    if (Number.isFinite(t)) max = t
  }
  const crm = entry.crm || {}
  for (const iso of [crm.lastCommunicationAt, crm.lastEmailSentAt, crm.lastResponseAt, entry.savedAt]) {
    const t = new Date(iso || 0).getTime()
    if (Number.isFinite(t) && t > max) max = t
  }
  for (const act of crm.activities || []) {
    const t = new Date(act.createdAt || 0).getTime()
    if (Number.isFinite(t) && t > max) max = t
  }
  for (const task of crm.tasks || []) {
    for (const iso of [task.completedAt, task.createdAt]) {
      const t = new Date(iso || 0).getTime()
      if (Number.isFinite(t) && t > max) max = t
    }
  }
  for (const meeting of crm.meetings || []) {
    for (const iso of [meeting.visitRecordedAt, meeting.scheduledAt, meeting.createdAt]) {
      const t = new Date(iso || 0).getTime()
      if (Number.isFinite(t) && t > max) max = t
    }
  }
  return max
}

function crmActivityFreshness(crm) {
  let max = 0
  for (const act of crm?.activities || []) {
    const t = new Date(act?.createdAt || 0).getTime()
    if (Number.isFinite(t) && t > max) max = t
  }
  return max
}

function mergeCrmRecords(primaryCrm, secondaryCrm) {
  const a = primaryCrm && typeof primaryCrm === 'object' ? primaryCrm : {}
  const b = secondaryCrm && typeof secondaryCrm === 'object' ? secondaryCrm : {}
  const mergeById = (left, right, max, sortKey = 'createdAt') => {
    const map = new Map()
    for (const row of left || []) {
      if (row?.id) map.set(row.id, row)
    }
    for (const row of right || []) {
      if (row?.id) map.set(row.id, row)
    }
    return [...map.values()]
      .sort((x, y) => new Date(y[sortKey] || 0) - new Date(x[sortKey] || 0))
      .slice(0, max)
  }
  const activities = mergeById(a.activities, b.activities, 80)
  const tasks = mergeById(a.tasks, b.tasks, 200)
  const meetings = mergeById(a.meetings, b.meetings, 200, 'scheduledAt')
    .sort(
      (x, y) =>
        new Date(y.scheduledAt || y.createdAt || 0) - new Date(x.scheduledAt || x.createdAt || 0)
    )
    .slice(0, 200)
  // Deals follow the fresher pipeline row only — union merge would resurrect deleted deals.
  const deals = normalizeDealsList(Array.isArray(a.deals) ? a.deals : b.deals)
  const emailMap = new Map()
  for (const em of [...(a.emails || []), ...(b.emails || [])]) {
    if (em?.id) emailMap.set(em.id, em)
  }
  return {
    ...b,
    ...a,
    activities,
    tasks,
    meetings,
    deals,
    emails: [...emailMap.values()],
  }
}

export function mergePipelineEntry(prev, incoming) {
  if (!prev) return incoming
  if (!incoming) return prev
  const prevFresh = pipelineEntryFreshness(prev)
  const nextFresh = pipelineEntryFreshness(incoming)
  let primary = prev
  let secondary = incoming
  if (nextFresh > prevFresh) {
    primary = incoming
    secondary = prev
  } else if (nextFresh < prevFresh) {
    primary = prev
    secondary = incoming
  } else if (crmActivityFreshness(incoming.crm) > crmActivityFreshness(prev.crm)) {
    primary = incoming
    secondary = prev
  } else if (crmActivityFreshness(prev.crm) > crmActivityFreshness(incoming.crm)) {
    primary = prev
    secondary = incoming
  } else if ((incoming.crm?.activities?.length || 0) > (prev.crm?.activities?.length || 0)) {
    primary = incoming
    secondary = prev
  }
  return {
    ...secondary,
    ...primary,
    pipelineUpdatedAt: primary.pipelineUpdatedAt || secondary.pipelineUpdatedAt || null,
    crm: mergeCrmRecords(primary.crm, secondary.crm),
  }
}

export function mergePipelineEntries(existing, incoming) {
  const map = new Map()
  for (const entry of existing || []) {
    const key = pipelineEntryKey(entry)
    if (key) map.set(key, entry)
  }
  for (const entry of incoming || []) {
    const key = pipelineEntryKey(entry)
    if (!key) continue
    const prev = map.get(key)
    map.set(key, prev ? mergePipelineEntry(prev, entry) : entry)
  }
  return [...map.values()]
}

export function touchPipelineEntry(entry) {
  if (entry) entry.pipelineUpdatedAt = new Date().toISOString()
}

async function mirrorShardEntriesToSavedLeads(entries) {
  const incoming = Array.isArray(entries) ? entries : []
  if (!incoming.length) return
  const current = isSupabaseEnabled()
    ? await fetchStoreCollectionJson('savedLeads')
    : (await readStore({ only: ['savedLeads'] })).savedLeads || []
  const byKey = new Map()
  for (const entry of current) {
    const key = pipelineEntryKey(entry)
    if (key) byKey.set(key, entry)
  }
  for (const entry of incoming) {
    const key = pipelineEntryKey(entry)
    if (key) byKey.set(key, entry)
  }
  await writeSavedLeadsCollection([...byKey.values()])
}

export async function readPipelineShardEntries(shardName, { bypassCache = false } = {}) {
  if (!bypassCache) {
    const cached = shardCache.get(shardName)
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      return cached.entries
    }
  }

  const store = await readStore({ only: [shardName] })
  const entries = Array.isArray(store[shardName]) ? store[shardName] : null
  if (entries) {
    shardCache.set(shardName, { entries, at: Date.now() })
  }
  return entries
}

export async function writePipelineShardEntries(
  shardName,
  entries,
  { mirrorToSavedLeads = true, refreshIndex = true } = {}
) {
  const list = Array.isArray(entries) ? entries : []
  if (isSupabaseEnabled()) {
    await upsertCollection(shardName, list)
  } else {
    await writeStoreCollections({ [shardName]: list }, [shardName])
  }
  shardCache.set(shardName, { entries: list, at: Date.now() })
  if (mirrorToSavedLeads) {
    await mirrorShardEntriesToSavedLeads(list)
  }
  if (refreshIndex) {
    try {
      const orgId = shardName.startsWith('pipeline_org_')
        ? shardName.replace('pipeline_org_', '')
        : null
      const metaStore = orgId
        ? await readStore({ only: ['organizations'] })
        : null
      const org = orgId ? getOrganization(metaStore, orgId) : null
      const freightOrg = isFreightDealOrg(org, null)
      await refreshPipelineIndex(shardName, list, { freightOrg, organizationId: orgId })
    } catch (err) {
      console.warn('pipeline index refresh failed:', err?.message || err)
    }
  }
}

/** CRM patches for bulk sends — one shard read/write; skip monolith mirror during batches. */
export async function patchPipelineEntriesCrmBatch(
  user,
  patches,
  { mirrorToSavedLeads = false, refreshIndex = false } = {}
) {
  const list = Array.isArray(patches) ? patches.filter((p) => p?.leadId) : []
  if (!list.length) return []

  const { patchPipelineLeadsTable, pipelineLeadsTableActive } = await import('./pipelineLeadsTable.js')
  if (pipelineLeadsTableActive()) {
    const tableResult = await patchPipelineLeadsTable(user, list)
    if (tableResult.patched > 0) {
      if (refreshIndex) {
        const shardName = pipelineShardNameForUser(user)
        const { enqueueSearchIndexLeads } = await import('./queue/producer.js')
        void enqueueSearchIndexLeads(
          user.organizationId,
          shardName,
          list.map((p) => p.leadId)
        )
      }
      return list.map((p) => ({ leadId: p.leadId, mode: 'table' }))
    }
  }

  return withStoreLock(async () => {
    const shardName = pipelineShardNameForUser(user)
    const [entries, metaStore] = await Promise.all([
      readPipelineShardEntries(shardName, { bypassCache: true }),
      readStore({ only: META_STORE_COLLECTIONS }),
    ])
    if (!entries?.length) {
      return patchPipelineEntriesCrm(user, list)
    }

    const draft = attachPipelineEntriesToStore(metaStore, entries)
    const updated = []
    for (const { leadId, updateCrm } of list) {
      const entry = findPipelineEntry(draft, user, leadId)
      if (!entry) continue
      entry.crm = updateCrm(entry.crm)
      touchPipelineEntry(entry)
      updated.push(entry)
    }
    if (!updated.length) return []

    await writePipelineShardEntries(shardName, entries, { mirrorToSavedLeads, refreshIndex })
    dashboardVisibleCache.delete(shardName)
    return updated
  })
}

export function invalidatePipelineShard(shardName) {
  shardCache.delete(shardName)
  dashboardVisibleCache.delete(shardName)
  invalidatePipelineIndex(shardName)
}

export async function syncPipelineShardsFromSavedLeads(savedLeads) {
  const byShard = new Map()
  for (const entry of savedLeads || []) {
    if (!entry || typeof entry !== 'object') continue
    const shardName = entry.organizationId
      ? pipelineOrgShardName(entry.organizationId)
      : entry.userId
        ? pipelineUserShardName(entry.userId)
        : null
    if (!shardName) continue
    if (!byShard.has(shardName)) byShard.set(shardName, [])
    byShard.get(shardName).push(entry)
  }
  await Promise.all(
    [...byShard.entries()].map(async ([name, savedEntries]) => {
      const existing = (await readPipelineShardEntries(name, { bypassCache: true })) || []
      const merged = mergePipelineEntries(existing, savedEntries)
      await writePipelineShardEntries(name, merged, { mirrorToSavedLeads: false })
      await mirrorShardEntriesToSavedLeads(merged)
    })
  )
}

async function monolithPipelineEntriesForUser(user, metaStore) {
  const monolith = await readStore({ only: ['savedLeads'] })
  return listPipelineSavedEntries(
    attachPipelineEntriesToStore(metaStore, monolith.savedLeads || []),
    user
  )
}

function pipelineStoresDiverged(fromMonolith, fromShard, merged) {
  if (merged.length !== fromShard.length) return true
  if (merged.length > fromMonolith.length) return true
  if (fromShard.length === 0 && merged.length > 0) return true
  const shardByKey = new Map(fromShard.map((e) => [pipelineEntryKey(e), e]))
  for (const entry of merged) {
    const key = pipelineEntryKey(entry)
    const prev = shardByKey.get(key)
    if (!prev) return true
    if (pipelineEntryFreshness(entry) !== pipelineEntryFreshness(prev)) return true
  }
  return false
}

export async function ensurePipelineEntriesForUser(user, authStore = null) {
  const shardName = pipelineShardNameForUser(user)
  const metaStore =
    authStore ||
    (await readStore({
      only: ['savedLeads', 'users', 'organizations', 'organizationMemberships'],
    }))
  const fromMonolith = listPipelineSavedEntries(metaStore, user)
  const shardRaw = await readPipelineShardEntries(shardName, { bypassCache: true })
  const fromShard = Array.isArray(shardRaw) ? shardRaw : []
  const entries = mergePipelineEntries(fromMonolith, fromShard)
  if (pipelineStoresDiverged(fromMonolith, fromShard, entries)) {
    await writePipelineShardEntries(shardName, entries)
  }
  return entries
}

export function attachPipelineEntriesToStore(store, entries) {
  return { ...store, savedLeads: entries }
}

/** Fast path: read tenant shard only; skip monolithic savedLeads when shard exists. */
/**
 * Load pipeline rows for specific lead IDs only.
 * Uses pipeline_leads table when enabled; otherwise falls back to full shard (legacy).
 */
export async function loadPipelineStoreForLeadIds(user, leadIds) {
  const ids = [...new Set((leadIds || []).filter(Boolean))]
  const shardName = pipelineShardNameForUser(user)
  const metaStore = await readStore({ only: META_STORE_COLLECTIONS })

  const { readPipelineLeadsByIds, pipelineLeadsTableActive } = await import('./pipelineLeadsTable.js')
  if (pipelineLeadsTableActive() && ids.length) {
    const entries = (await readPipelineLeadsByIds(shardName, ids)) || []
    const pipelineStore = attachPipelineEntriesToStore(metaStore, entries)
    return {
      pipelineStore,
      visible: entries,
      shardName,
      pipelineSource: 'pipeline_leads_table',
      pipelineRowsRead: entries.length,
    }
  }

  const { pipelineStore, visible } = await loadPipelineStoreContext(user)
  if (!ids.length) {
    return {
      pipelineStore: attachPipelineEntriesToStore(pipelineStore, []),
      visible: [],
      shardName,
      pipelineSource: 'shard_full',
      pipelineRowsRead: visible.length,
    }
  }
  const idSet = new Set(ids)
  const filtered = visible.filter((entry) => {
    const lid = entry?.lead?.id || entry?.id
    return lid && idSet.has(lid)
  })
  return {
    pipelineStore: attachPipelineEntriesToStore(pipelineStore, filtered),
    visible: filtered,
    shardName,
    pipelineSource: 'shard_full_filtered',
    pipelineRowsRead: visible.length,
  }
}

/** Update one pipeline row's CRM without loading the full app store. */
export async function patchPipelineEntryCrm(user, leadId, updateCrm) {
  return updatePipelineStore(user, async (draft) => {
    const entry = findPipelineEntry(draft, user, leadId)
    if (!entry) return draft
    entry.crm = updateCrm(entry.crm)
    touchPipelineEntry(entry)
    return draft
  }).then((store) => findPipelineEntry(store, user, leadId))
}

/** System/webhook CRM update — always writes the shard that owns this pipeline row. */
export async function updatePipelineStoreForEntry(entry, mutator) {
  const shardName = pipelineShardNameForEntry(entry)
  if (!shardName) {
    throw new Error('Pipeline entry has no shard')
  }

  return withStoreLock(async () => {
    const [entries, metaStore] = await Promise.all([
      readPipelineShardEntries(shardName, { bypassCache: true }),
      readStore({ only: META_STORE_COLLECTIONS }),
    ])

    if (entries) {
      const draft = attachPipelineEntriesToStore(metaStore, entries)
      const next = (await mutator(draft)) || draft
      await writePipelineShardEntries(shardName, next.savedLeads || [])
      invalidatePipelineShard(shardName)
      return next
    }

    let nextStore = null
    await updateStorePartial(PIPELINE_STORE_COLLECTIONS, async (draft) => {
      nextStore = (await mutator(draft)) || draft
      return draft
    })
    return nextStore || attachPipelineEntriesToStore(metaStore, [])
  })
}

/** Apply a pipeline mutation on the tenant shard (or savedLeads fallback) without loading the full app store. */
export async function updatePipelineStore(user, mutator, { writeOptions = {} } = {}) {
  return withStoreLock(async () => {
    const shardName = pipelineShardNameForUser(user)
    const [entries, metaStore] = await Promise.all([
      readPipelineShardEntries(shardName, { bypassCache: true }),
      readStore({ only: META_STORE_COLLECTIONS }),
    ])

    if (entries) {
      const draft = attachPipelineEntriesToStore(metaStore, entries)
      const next = (await mutator(draft)) || draft
      await writePipelineShardEntries(shardName, next.savedLeads || [], writeOptions)
      return next
    }

    let nextStore = null
    await updateStorePartial(PIPELINE_STORE_COLLECTIONS, async (draft) => {
      nextStore = (await mutator(draft)) || draft
      return draft
    })
    return nextStore || attachPipelineEntriesToStore(metaStore, [])
  })
}

export async function patchPipelineEntriesCrm(user, patches) {
  const list = Array.isArray(patches) ? patches.filter((p) => p?.leadId) : []
  if (!list.length) return []

  return updatePipelineStore(user, async (draft) => {
    const updated = []
    for (const { leadId, updateCrm } of list) {
      const entry = findPipelineEntry(draft, user, leadId)
      if (!entry) continue
      entry.crm = updateCrm(entry.crm)
      touchPipelineEntry(entry)
      updated.push(entry)
    }
    return draft
  }).then((store) => {
    const out = []
    for (const { leadId } of list) {
      const entry = findPipelineEntry(store, user, leadId)
      if (entry) out.push(entry)
    }
    return out
  })
}

function monolithHasFreshActivity(shard, mono, sinceMs = 0) {
  if (!mono?.crm) return false
  if (pipelineEntryFreshness(mono) > pipelineEntryFreshness(shard)) return true
  const shardIds = new Set((shard?.crm?.activities || []).map((a) => a.id).filter(Boolean))
  for (const act of mono.crm.activities || []) {
    if (!act?.id || shardIds.has(act.id)) continue
    const t = new Date(act.createdAt || 0).getTime()
    if (!Number.isNaN(t) && t >= sinceMs) return true
  }
  return false
}

/** Merge shard + monolith pipeline rows — union CRM activities (same data as Activity log). */
export function overlayMonolithCrmForRead(shardEntries, monolithEntries, { activitySinceMs = 0 } = {}) {
  const monoByKey = new Map()
  for (const entry of monolithEntries || []) {
    const key = pipelineEntryKey(entry)
    if (key) monoByKey.set(key, entry)
  }

  const merged = []
  const seen = new Set()

  for (const shard of shardEntries || []) {
    const key = pipelineEntryKey(shard)
    if (!key) continue
    seen.add(key)
    const mono = monoByKey.get(key)
    if (!mono) {
      merged.push(shard)
      continue
    }
    if (
      pipelineEntryFreshness(shard) >= pipelineEntryFreshness(mono) &&
      !monolithHasFreshActivity(shard, mono, activitySinceMs)
    ) {
      merged.push(shard)
    } else {
      merged.push(mergePipelineEntry(shard, mono))
    }
  }

  for (const mono of monolithEntries || []) {
    const key = pipelineEntryKey(mono)
    if (key && !seen.has(key)) merged.push(mono)
  }

  return merged
}

export async function loadPipelineStoreContext(
  user,
  { dashboard = false, mergeMonolithCrm = false, shardOnly = false, activitySinceMs = 0 } = {}
) {
  const shardName = pipelineShardNameForUser(user)
  const useMonolithMerge = !shardOnly && (mergeMonolithCrm || !dashboard)

  if (dashboard && !mergeMonolithCrm) {
    const cached = dashboardVisibleCache.get(shardName)
    if (cached && Date.now() - cached.at < DASHBOARD_CACHE_TTL_MS) {
      const metaStore = await readStore({ only: META_STORE_COLLECTIONS })
      const pipelineStore = attachPipelineEntriesToStore(metaStore, cached.entries)
      const visible = listPipelineSavedEntries(pipelineStore, user)
      return { pipelineStore, visible, shardName }
    }
  }

  const metaStore = await readStore({ only: META_STORE_COLLECTIONS })
  const shardRaw = await readPipelineShardEntries(shardName)
  const fromShard = Array.isArray(shardRaw) ? shardRaw : []

  let entries
  if (fromShard.length && !useMonolithMerge) {
    // Fast path: shard only (pipeline list). Skip for dashboard KPIs — CRM may be fresher on monolith.
    entries = fromShard
  } else if (fromShard.length) {
    const monolithLeads = (await readStore({ only: ['savedLeads'] })).savedLeads || []
    const fromMonolith = listPipelineSavedEntries(
      attachPipelineEntriesToStore(metaStore, monolithLeads),
      user
    )
    entries = overlayMonolithCrmForRead(fromShard, fromMonolith, { activitySinceMs })
  } else {
    const monolithLeads = (await readStore({ only: ['savedLeads'] })).savedLeads || []
    entries = listPipelineSavedEntries(
      attachPipelineEntriesToStore(metaStore, monolithLeads),
      user
    )
    if (entries.length) {
      await writePipelineShardEntries(shardName, entries)
    }
  }

  if (dashboard && entries.length) {
    dashboardVisibleCache.set(shardName, { entries, at: Date.now() })
  }

  const pipelineStore = attachPipelineEntriesToStore(metaStore, entries)
  const visible = listPipelineSavedEntries(pipelineStore, user)
  return { pipelineStore, visible, shardName }
}
