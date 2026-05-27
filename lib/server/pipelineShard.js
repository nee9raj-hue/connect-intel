import { readStore, writeStoreCollections, isPipelineShardCollection } from './store.js'
import { isSupabaseEnabled, upsertCollection } from './supabaseClient.js'
import { listPipelineSavedEntries } from './organizations.js'
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

export async function loadPipelineStoreContext(user) {
  const shardName = pipelineShardNameForUser(user)
  let entries = await readPipelineShardEntries(shardName)

  let metaStore
  if (entries) {
    metaStore = await readStore({ only: META_STORE_COLLECTIONS })
  } else {
    metaStore = await readStore({ only: PIPELINE_STORE_COLLECTIONS })
    entries = await ensurePipelineEntriesForUser(user, metaStore)
  }

  const pipelineStore = attachPipelineEntriesToStore(metaStore, entries)
  const visible = listPipelineSavedEntries(pipelineStore, user)
  return { pipelineStore, visible, shardName }
}
