import {
  readStore,
  updateStorePartial,
  writeStoreCollections,
  writeSavedLeadsCollection,
  isPipelineShardCollection,
  withStoreLock,
} from './store.js'
import { isSupabaseEnabled, upsertCollection, fetchStoreCollectionJson } from './supabaseClient.js'
import { listPipelineSavedEntries } from './organizations.js'
import { findPipelineEntry } from './pipelineAccess.js'
import { PIPELINE_STORE_COLLECTIONS } from './pipelineStore.js'

const META_STORE_COLLECTIONS = ['users', 'organizations', 'organizationMemberships']

const CACHE_TTL_MS = 90_000
const shardCache = new Map()

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
    if (!prev) {
      map.set(key, entry)
      continue
    }
    const prevFresh = pipelineEntryFreshness(prev)
    const nextFresh = pipelineEntryFreshness(entry)
    if (nextFresh > prevFresh) {
      map.set(key, entry)
      continue
    }
    if (nextFresh < prevFresh) continue
    const prevActs = prev.crm?.activities?.length || 0
    const nextActs = entry.crm?.activities?.length || 0
    if (nextActs >= prevActs) map.set(key, entry)
  }
  return [...map.values()]
}

export function touchPipelineEntry(entry) {
  if (entry) entry.pipelineUpdatedAt = new Date().toISOString()
}

async function mirrorShardEntriesToSavedLeads(entries) {
  if (!entries?.length) return
  const current = isSupabaseEnabled()
    ? await fetchStoreCollectionJson('savedLeads')
    : (await readStore({ only: ['savedLeads'] })).savedLeads || []
  const merged = mergePipelineEntries(current, entries)
  await writeSavedLeadsCollection(merged)
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

export async function writePipelineShardEntries(shardName, entries, { mirrorToSavedLeads = true } = {}) {
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
}

export function invalidatePipelineShard(shardName) {
  shardCache.delete(shardName)
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

export async function ensurePipelineEntriesForUser(user, authStore = null) {
  const shardName = pipelineShardNameForUser(user)
  let entries = await readPipelineShardEntries(shardName)
  if (entries) return entries

  const store =
    authStore ||
    (await readStore({
      only: ['savedLeads', 'users', 'organizations', 'organizationMemberships'],
    }))
  entries = listPipelineSavedEntries(store, user)
  await writePipelineShardEntries(shardName, entries)
  return entries
}

export function attachPipelineEntriesToStore(store, entries) {
  return { ...store, savedLeads: entries }
}

/** Fast path: read tenant shard only; skip monolithic savedLeads when shard exists. */
/** Only pipeline rows for specific lead IDs (faster campaign enroll than full CRM load). */
export async function loadPipelineStoreForLeadIds(user, leadIds) {
  const ids = [...new Set((leadIds || []).filter(Boolean))]
  const { pipelineStore, visible } = await loadPipelineStoreContext(user)
  if (!ids.length) {
    return { pipelineStore: attachPipelineEntriesToStore(pipelineStore, []), visible: [] }
  }
  const idSet = new Set(ids)
  const filtered = visible.filter((entry) => {
    const lid = entry?.lead?.id || entry?.id
    return lid && idSet.has(lid)
  })
  return {
    pipelineStore: attachPipelineEntriesToStore(pipelineStore, filtered),
    visible: filtered,
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

/** Apply a pipeline mutation on the tenant shard (or savedLeads fallback) without loading the full app store. */
export async function updatePipelineStore(user, mutator) {
  return withStoreLock(async () => {
    const shardName = pipelineShardNameForUser(user)
    const [entries, metaStore] = await Promise.all([
      readPipelineShardEntries(shardName, { bypassCache: true }),
      readStore({ only: META_STORE_COLLECTIONS }),
    ])

    if (entries) {
      const draft = attachPipelineEntriesToStore(metaStore, entries)
      const next = (await mutator(draft)) || draft
      await writePipelineShardEntries(shardName, next.savedLeads || [])
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

export async function loadPipelineStoreContext(user) {
  const shardName = pipelineShardNameForUser(user)
  const [shardEntries, metaStoreIfShard] = await Promise.all([
    readPipelineShardEntries(shardName),
    readStore({ only: META_STORE_COLLECTIONS }),
  ])
  let entries = shardEntries
  let metaStore = metaStoreIfShard

  if (!entries) {
    metaStore = await readStore({ only: PIPELINE_STORE_COLLECTIONS })
    entries = await ensurePipelineEntriesForUser(user, metaStore)
  }

  const pipelineStore = attachPipelineEntriesToStore(metaStore, entries)
  const visible = listPipelineSavedEntries(pipelineStore, user)
  return { pipelineStore, visible, shardName }
}
