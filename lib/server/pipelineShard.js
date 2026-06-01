import { readStore, updateStorePartial, writeStoreCollections, isPipelineShardCollection } from './store.js'
import { isSupabaseEnabled, upsertCollection } from './supabaseClient.js'
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

export async function readPipelineShardEntries(shardName) {
  const cached = shardCache.get(shardName)
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.entries
  }

  const store = await readStore({ only: [shardName] })
  const entries = Array.isArray(store[shardName]) ? store[shardName] : null
  if (entries) {
    shardCache.set(shardName, { entries, at: Date.now() })
  }
  return entries
}

export async function writePipelineShardEntries(shardName, entries) {
  const list = Array.isArray(entries) ? entries : []
  if (isSupabaseEnabled()) {
    await upsertCollection(shardName, list)
  } else {
    await writeStoreCollections({ [shardName]: list }, [shardName])
  }
  shardCache.set(shardName, { entries: list, at: Date.now() })
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
    [...byShard.entries()].map(([name, entries]) => writePipelineShardEntries(name, entries))
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
  const shardName = pipelineShardNameForUser(user)
  let entries = await readPipelineShardEntries(shardName)
  if (entries) {
    const idx = entries.findIndex((e) => e?.lead?.id === leadId)
    if (idx < 0) return null
    const entry = entries[idx]
    entry.crm = updateCrm(entry.crm)
    entries[idx] = entry
    await writePipelineShardEntries(shardName, entries)
    return entry
  }

  let updated = null
  await updateStorePartial(['savedLeads'], async (draft) => {
    const entry = findPipelineEntry(draft, user, leadId)
    if (!entry) return draft
    entry.crm = updateCrm(entry.crm)
    updated = entry
    return draft
  })
  return updated
}

/** Batch CRM patches on the tenant pipeline shard (one read + one write). */
/**
 * Apply a pipeline mutation on the tenant shard (or savedLeads fallback) without loading the full app store.
 */
export async function updatePipelineStore(user, mutator) {
  const shardName = pipelineShardNameForUser(user)
  const [entries, metaStore] = await Promise.all([
    readPipelineShardEntries(shardName),
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
}

export async function patchPipelineEntriesCrm(user, patches) {
  const list = Array.isArray(patches) ? patches.filter((p) => p?.leadId) : []
  if (!list.length) return []

  const shardName = pipelineShardNameForUser(user)
  let entries = await readPipelineShardEntries(shardName)
  if (entries) {
    const updated = []
    for (const { leadId, updateCrm } of list) {
      const idx = entries.findIndex((e) => e?.lead?.id === leadId)
      if (idx < 0) continue
      const entry = entries[idx]
      entry.crm = updateCrm(entry.crm)
      entries[idx] = entry
      updated.push(entry)
    }
    if (updated.length) await writePipelineShardEntries(shardName, entries)
    return updated
  }

  const updated = []
  await updateStorePartial(['savedLeads'], async (draft) => {
    for (const { leadId, updateCrm } of list) {
      const entry = findPipelineEntry(draft, user, leadId)
      if (!entry) continue
      entry.crm = updateCrm(entry.crm)
      updated.push(entry)
    }
    return draft
  })
  return updated
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
