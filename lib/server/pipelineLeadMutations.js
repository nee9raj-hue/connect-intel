import { readStore, writeStoreCollections, withStoreLock } from './store.js'
import { addManualPipelineLead } from './manualPipelineLead.js'
import { findPipelineEntry } from './pipelineAccess.js'
import {
  findPipelineEntryWithScope,
  resolvePipelineVisibleOwnerIds,
} from './pipelineVisibility.js'
import {
  attachPipelineEntriesToStore,
  invalidatePipelineShard,
  persistPipelineEntryUpdates,
  pipelineShardNameForUser,
  readPipelineShardEntries,
  touchPipelineEntry,
  updatePipelineStore,
  writePipelineShardEntries,
} from './pipelineShard.js'

const MASTER_COLLECTIONS = [
  'contacts',
  'companies',
  'importJobs',
  'users',
  'organizations',
  'organizationMemberships',
  'crmPipelines',
  'marketingEvents',
]

import { FAST_PIPELINE_WRITE as FAST_SHARD_WRITE } from './pipelineShard.js'

async function syncEntriesToPipelineTable(shardName, entries) {
  const { pipelineLeadsTableActive, upsertPipelineLeadRows } = await import('./pipelineLeadsTable.js')
  if (!pipelineLeadsTableActive() || !entries?.length) return
  try {
    await upsertPipelineLeadRows(shardName, entries, { batchSize: 25 })
  } catch (err) {
    console.warn('pipeline_leads upsert failed:', err?.message || err)
  }
}

/**
 * Add a manual pipeline lead without loading/writing the full app store.
 */
export async function persistManualPipelineLead(user, organizationId, fields) {
  let createdLeadId = null
  let createdEntry = null
  let masterDirty = false

  const store = await withStoreLock(async () => {
    const shardName = pipelineShardNameForUser(user)
    const [entries, masterStore] = await Promise.all([
      readPipelineShardEntries(shardName, { bypassCache: true }),
      readStore({ only: MASTER_COLLECTIONS }),
    ])

    const draft = attachPipelineEntriesToStore(masterStore, entries || [])
    const contactsBefore = draft.contacts?.length || 0
    const companiesBefore = draft.companies?.length || 0

    const created = addManualPipelineLead(draft, { user, organizationId, fields })
    createdLeadId = created?.id || null
    createdEntry = createdLeadId ? findPipelineEntry(draft, user, createdLeadId) : null

    masterDirty =
      (draft.contacts?.length || 0) !== contactsBefore ||
      (draft.companies?.length || 0) !== companiesBefore ||
      (draft.importJobs?.length || 0) !== (masterStore.importJobs?.length || 0)

    if (Array.isArray(entries)) {
      await writePipelineShardEntries(shardName, draft.savedLeads || [], FAST_SHARD_WRITE)
      if (createdEntry) {
        await syncEntriesToPipelineTable(shardName, [createdEntry])
      }
      invalidatePipelineShard(shardName)
    }

    if (masterDirty) {
      await writeStoreCollections(draft, ['contacts', 'companies', 'importJobs'])
    }

    return draft
  })

  return { store, entry: createdEntry, createdLeadId, lead: createdEntry?.lead || null }
}

/**
 * Bulk-update pipeline rows (assign, status, tags) without monolith mirror/index refresh.
 */
export async function bulkMutatePipelineEntries(user, leadIds, mutator) {
  const ids = [...new Set((leadIds || []).filter(Boolean))]
  if (!ids.length) return { store: null, updated: 0, skipped: 0, updatedEntries: [] }

  const { readPipelineLeadsByIds, pipelineLeadsTableActive } = await import('./pipelineLeadsTable.js')
  if (pipelineLeadsTableActive()) {
    return bulkMutatePipelineEntriesViaTable(user, ids, mutator)
  }

  return bulkMutatePipelineEntriesViaShard(user, ids, mutator)
}

async function bulkMutatePipelineEntriesViaTable(user, leadIds, mutator) {
  const shardName = pipelineShardNameForUser(user)
  let updated = 0
  let skipped = 0
  const updatedEntries = []

  const metaStore = await readStore({ only: MASTER_COLLECTIONS })
  const visibleOwnerIds = await resolvePipelineVisibleOwnerIds(user, metaStore)
  const fromTable = (await readPipelineLeadsByIds(shardName, leadIds)) || []
  const entryMap = new Map()
  for (const entry of fromTable) {
    const lid = entry?.lead?.id
    if (lid) entryMap.set(String(lid), entry)
  }

  const shardEntries = (await readPipelineShardEntries(shardName, { bypassCache: true })) || []
  for (const entry of shardEntries) {
    const lid = entry?.lead?.id
    if (lid && !entryMap.has(String(lid))) entryMap.set(String(lid), entry)
  }

  for (const leadId of leadIds) {
    const entry = entryMap.get(String(leadId))
    if (!entry) {
      skipped += 1
      continue
    }
    const draft = attachPipelineEntriesToStore(metaStore, [entry])
    const scoped = findPipelineEntryWithScope(draft, user, leadId, { visibleOwnerIds })
    if (!scoped) {
      skipped += 1
      continue
    }
    const changed = mutator(scoped, draft, user)
    if (changed === false) {
      skipped += 1
      continue
    }
    touchPipelineEntry(scoped)
    updatedEntries.push(scoped)
    updated += 1
  }

  if (updatedEntries.length) {
    await persistPipelineEntryUpdates(shardName, updatedEntries, { refreshIndex: true })
  }

  const store = attachPipelineEntriesToStore(metaStore, updatedEntries)
  return { store, updated, skipped, updatedEntries }
}

async function bulkMutatePipelineEntriesViaShard(user, leadIds, mutator) {
  let updated = 0
  let skipped = 0
  const updatedEntries = []

  const metaStore = await readStore({ only: MASTER_COLLECTIONS })
  const visibleOwnerIds = await resolvePipelineVisibleOwnerIds(user, metaStore)

  const store = await updatePipelineStore(
    user,
    async (draft) => {
      let entryMap = new Map()

      for (const leadId of leadIds) {
        let entry = findPipelineEntryWithScope(draft, user, leadId, { visibleOwnerIds })
        if (!entry && entryMap.has(leadId)) {
          const candidate = entryMap.get(leadId)
          const probe = attachPipelineEntriesToStore(draft, [...(draft.savedLeads || []), candidate])
          entry = findPipelineEntryWithScope(probe, user, leadId, { visibleOwnerIds })
          if (entry) {
            const already = (draft.savedLeads || []).some((e) => e.lead?.id === leadId)
            if (!already) draft.savedLeads.push(candidate)
          }
        }
        if (!entry) {
          skipped += 1
          continue
        }
        const changed = mutator(entry, draft, user)
        if (changed === false) {
          skipped += 1
          continue
        }
        touchPipelineEntry(entry)
        updatedEntries.push(entry)
        updated += 1
      }
      return draft
    },
    { writeOptions: FAST_SHARD_WRITE }
  )

  return { store, updated, skipped, updatedEntries }
}
