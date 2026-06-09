import { readStore, writeStoreCollections, withStoreLock } from './store.js'
import { addManualPipelineLead } from './manualPipelineLead.js'
import { findPipelineEntry } from './pipelineAccess.js'
import {
  attachPipelineEntriesToStore,
  invalidatePipelineShard,
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

const FAST_SHARD_WRITE = { mirrorToSavedLeads: false, refreshIndex: false }

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
  const shardName = pipelineShardNameForUser(user)
  let updated = 0
  let skipped = 0
  const updatedEntries = []

  const store = await updatePipelineStore(
    user,
    async (draft) => {
      let entryMap = new Map()

      if (pipelineLeadsTableActive()) {
        const fromTable = (await readPipelineLeadsByIds(shardName, ids)) || []
        for (const entry of fromTable) {
          const lid = entry?.lead?.id
          if (lid) entryMap.set(lid, entry)
        }
      }

      for (const leadId of ids) {
        let entry = findPipelineEntry(draft, user, leadId)
        if (!entry && entryMap.has(leadId)) {
          entry = entryMap.get(leadId)
          draft.savedLeads.push(entry)
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

  if (updatedEntries.length) {
    await syncEntriesToPipelineTable(shardName, updatedEntries)
  }

  return { store, updated, skipped, updatedEntries }
}
