import { readStore, updateStore, writeStoreCollections, withStoreLock } from './store.js'
import { addManualPipelineLead } from './manualPipelineLead.js'
import { findPipelineEntry } from './pipelineAccess.js'
import { updatePipelineContactDetails, updateMasterContactById } from './pipelineContact.js'
import { appendActivity, normalizeExtendedCrm } from './crmWorkflow.js'
import {
  findPipelineEntryWithScope,
  resolvePipelineVisibleOwnerIds,
} from './pipelineVisibility.js'
import {
  attachPipelineEntriesToStore,
  FAST_PIPELINE_WRITE as FAST_SHARD_WRITE,
  filterPipelineEntriesByLeadIds,
  invalidatePipelineShard,
  loadPipelineLeadForMutation,
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

    if (createdEntry) {
      await persistPipelineEntryUpdates(shardName, [createdEntry], {
        refreshIndex: true,
        deferHeavyMirror: false,
      })
    } else if (Array.isArray(entries)) {
      await writePipelineShardEntries(shardName, draft.savedLeads || [], FAST_SHARD_WRITE)
      invalidatePipelineShard(shardName)
    }

    if (masterDirty) {
      await writeStoreCollections(draft, ['contacts', 'companies', 'importJobs'])
    }

    return draft
  })

  return { store, entry: createdEntry, createdLeadId, lead: createdEntry?.lead || null }
}

/** Mirror captured LinkedIn fields onto the pipeline lead JSON (list/kanban read from here). */
export function applyCapturePatchToLeadSnapshot(entry, patch = {}) {
  if (!entry?.lead) return entry
  const lead = entry.lead
  for (const [key, raw] of Object.entries(patch)) {
    const value = String(raw ?? '').trim()
    if (!value) continue
    if (
      key === 'company' ||
      key === 'companyDomain' ||
      key === 'linkedin' ||
      key === 'firstName' ||
      key === 'lastName' ||
      key === 'title' ||
      key === 'email' ||
      key === 'phone' ||
      key === 'city' ||
      key === 'state' ||
      key === 'industry'
    ) {
      lead[key] = value
    }
  }
  if (lead.city || lead.state) {
    lead.location = [lead.city, lead.state].filter(Boolean).join(', ')
  }
  return entry
}

/**
 * Merge extension capture fields into an existing pipeline lead and persist
 * to pipeline_leads + shard + contacts/companies master records.
 */
export async function persistExtensionCaptureEnrichment(user, leadId, patch, options = {}) {
  const { organizationId = null, activitySummary = '', actor = user } = options
  if (!leadId || !patch || !Object.keys(patch).length) {
    return { store: null, entry: null, updated: false }
  }

  let updatedEntry = null
  const store = await withStoreLock(async () => {
    const shardName = pipelineShardNameForUser(user)
    const masterStore = await readStore({ only: MASTER_COLLECTIONS })
    const tableLoad = await loadPipelineLeadForMutation(user, leadId)

    let entry = tableLoad?.entry || null
    if (!entry) {
      const shardEntries = (await readPipelineShardEntries(shardName, { bypassCache: true })) || []
      entry = filterPipelineEntriesByLeadIds(shardEntries, [leadId])[0] || null
    }
    if (!entry) throw new Error('Lead not in pipeline')

    const draft = attachPipelineEntriesToStore(masterStore, [entry])
    const target = findPipelineEntry(draft, user, leadId)
    if (!target) throw new Error('Lead not in pipeline')

    const contactsBefore = draft.contacts?.length || 0
    const companiesBefore = draft.companies?.length || 0

    updatePipelineContactDetails(draft, target, patch)
    applyCapturePatchToLeadSnapshot(target, patch)

    if (organizationId && activitySummary) {
      target.crm = appendActivity(normalizeExtendedCrm(target.crm), {
        type: 'note',
        summary: activitySummary,
        userId: actor.id,
        userName: actor.name || actor.email,
      })
    }

    touchPipelineEntry(target)
    updatedEntry = target

    await persistPipelineEntryUpdates(shardName, [target], {
      refreshIndex: true,
      deferHeavyMirror: false,
    })

    const masterDirty =
      (draft.contacts?.length || 0) !== contactsBefore ||
      (draft.companies?.length || 0) !== companiesBefore
    if (masterDirty) {
      await writeStoreCollections(draft, ['contacts', 'companies'])
    }

    return draft
  })

  return { store, entry: updatedEntry, updated: Boolean(updatedEntry) }
}

/**
 * Contacts page PATCH — update master record and persist email/phone onto pipeline shard rows.
 */
export async function persistMasterContactUpdate(user, contactId, patch = {}) {
  const id = String(contactId || '').trim()
  if (!id) throw new Error('contactId is required')

  let shaped = null
  const store = await withStoreLock(async () => {
    const shardName = pipelineShardNameForUser(user)
    const masterStore = await readStore({ only: MASTER_COLLECTIONS })
    const shardEntries = (await readPipelineShardEntries(shardName, { bypassCache: true })) || []
    const draft = attachPipelineEntriesToStore(masterStore, shardEntries)

    const contactsBefore = JSON.stringify(
      draft.contacts?.find((row) => row.id === id) || {}
    )

    shaped = updateMasterContactById(draft, user, id, patch)

    const updatedEntries = (draft.savedLeads || []).filter(
      (entry) => entry.contactId === id || entry.lead?.id === id
    )
    for (const entry of updatedEntries) {
      touchPipelineEntry(entry)
    }

    if (updatedEntries.length) {
      await persistPipelineEntryUpdates(shardName, updatedEntries, {
        refreshIndex: true,
        deferHeavyMirror: false,
      })
    }

    const contactChanged =
      JSON.stringify(draft.contacts?.find((row) => row.id === id) || {}) !== contactsBefore
    if (contactChanged || updatedEntries.length) {
      await writeStoreCollections(draft, ['contacts', 'companies'])
    }

    return draft
  })

  return { store, contact: shaped }
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
  const { readPipelineLeadsByIds } = await import('./pipelineLeadsTable.js')
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
    await persistPipelineEntryUpdates(shardName, updatedEntries, {
      refreshIndex: false,
      deferHeavyMirror: true,
    })
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

/**
 * Permanently remove pipeline leads (shard + pipeline_leads + master mirror).
 */
export async function bulkDeletePipelineEntries(user, leadIds) {
  const ids = [...new Set((leadIds || []).map(String).filter(Boolean))]
  if (!ids.length) return { deleted: 0, skipped: 0, deletedIds: [] }

  const { canUserDeletePipelineEntry } = await import('./pipelineVisibility.js')
  const metaStore = await readStore({ only: MASTER_COLLECTIONS })
  const visibleOwnerIds = await resolvePipelineVisibleOwnerIds(user, metaStore)
  const shardName = pipelineShardNameForUser(user)
  const organizationId = user.organizationId || null

  const { readPipelineLeadsByIds, deletePipelineLeadRows, pipelineLeadsTableActive } =
    await import('./pipelineLeadsTable.js')

  const entryById = new Map()
  if (pipelineLeadsTableActive()) {
    for (const entry of (await readPipelineLeadsByIds(shardName, ids)) || []) {
      const lid = entry?.lead?.id
      if (lid) entryById.set(String(lid), entry)
    }
  }

  const shardEntries = (await readPipelineShardEntries(shardName, { bypassCache: true })) || []
  for (const entry of shardEntries) {
    const lid = entry?.lead?.id
    if (lid && !entryById.has(String(lid))) entryById.set(String(lid), entry)
  }

  const toDelete = []
  let skipped = 0
  for (const leadId of ids) {
    const entry = entryById.get(String(leadId))
    if (!entry) {
      skipped += 1
      continue
    }
    const probe = attachPipelineEntriesToStore(metaStore, [entry])
    const scoped = findPipelineEntryWithScope(probe, user, leadId, { visibleOwnerIds })
    if (!scoped || !canUserDeletePipelineEntry(user, scoped, metaStore)) {
      skipped += 1
      continue
    }
    toDelete.push(String(leadId))
  }

  if (!toDelete.length) return { deleted: 0, skipped, deletedIds: [] }

  const deleteSet = new Set(toDelete)
  const nextShard = shardEntries.filter((e) => !deleteSet.has(String(e.lead?.id)))
  await writePipelineShardEntries(shardName, nextShard, FAST_SHARD_WRITE)
  invalidatePipelineShard(shardName)

  if (pipelineLeadsTableActive()) {
    await deletePipelineLeadRows(shardName, toDelete)
  }

  await updateStore((draft) => {
    draft.savedLeads = (draft.savedLeads || []).filter((e) => {
      const lid = e.lead?.id
      if (!lid || !deleteSet.has(String(lid))) return true
      if (organizationId) return e.organizationId !== organizationId
      return e.userId !== user.id
    })
    return draft
  })

  return { deleted: toDelete.length, skipped, deletedIds: toDelete }
}
