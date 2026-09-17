import { applyErpAccountStage } from '../erpAccountStage.js'
import { stampLastOrderCreatedAt } from '../leadLastOrder.js'
import { invalidatePipelineIndex } from './pipelineIndex.js'
import { pipelineOrgShardName } from './pipelineShard.js'
import { upsertPipelineLeadRows } from './pipelineLeadsTable.js'
import { loadPipelineLeadPage } from './xindusErpOverlayApply.js'

const STAGE_COOLDOWN_MS = 6 * 60 * 60 * 1000
const PAGES_PER_BOOTSTRAP = 3
const PAGE_SIZE = 250
const classifiedAt = new Map()
const classifyOffset = new Map()

export function applyErpAccountStageIfChanged(entry, now = Date.now()) {
  if (!entry || typeof entry !== 'object') return false
  const beforeStatus = entry.crm?.status
  const beforeOrder = entry.crm?.lastOrderCreatedAt
  stampLastOrderCreatedAt(entry)
  applyErpAccountStage(entry, now)
  return entry.crm?.status !== beforeStatus || entry.crm?.lastOrderCreatedAt !== beforeOrder
}

export async function persistErpAccountStagesForEntries(
  entries,
  { shardName, dryRun = false } = {}
) {
  const now = Date.now()
  const byShard = new Map()
  let scanned = 0
  let classified = 0

  for (const entry of entries || []) {
    if (!entry) continue
    scanned += 1
    if (!applyErpAccountStageIfChanged(entry, now)) continue
    classified += 1
    const shard =
      shardName || (entry.organizationId ? pipelineOrgShardName(entry.organizationId) : null)
    if (!shard) continue
    const list = byShard.get(shard) || []
    list.push(entry)
    byShard.set(shard, list)
  }

  if (dryRun || !byShard.size) {
    return { scanned, classified, updated: 0 }
  }

  let updated = 0
  for (const [shard, list] of byShard) {
    await upsertPipelineLeadRows(shard, list, {
      force: true,
      skipMembershipGuard: true,
      skipEnterpriseSync: true,
      batchSize: 50,
    })
    updated += list.length
    invalidatePipelineIndex(shard)
  }

  return { scanned, classified, updated }
}

export async function applyErpAccountStagesToLeadPage({
  organizationId,
  offset = 0,
  limit = PAGE_SIZE,
  dryRun = false,
} = {}) {
  const tableRows = await loadPipelineLeadPage(organizationId, offset, limit)
  const pendingByShard = new Map()
  let classified = 0

  for (const row of tableRows) {
    const entry = row.entry
    if (!entry) continue
    if (!applyErpAccountStageIfChanged(entry)) continue
    classified += 1
    const shard = row.shard_name || pipelineOrgShardName(organizationId)
    const list = pendingByShard.get(shard) || []
    list.push(entry)
    pendingByShard.set(shard, list)
  }

  let updated = 0
  if (!dryRun) {
    for (const [shard, entries] of pendingByShard) {
      await upsertPipelineLeadRows(shard, entries, {
        force: true,
        skipMembershipGuard: true,
        skipEnterpriseSync: true,
        batchSize: 50,
      })
      updated += entries.length
      invalidatePipelineIndex(shard)
    }
  }

  return {
    scanned: tableRows.length,
    classified,
    updated: dryRun ? 0 : updated,
    nextOffset: offset + tableRows.length,
    done: tableRows.length < limit,
  }
}

export async function classifyErpPipelineStagesOnce(organizationId, { force = false } = {}) {
  if (!organizationId) return null
  const last = classifiedAt.get(organizationId) || 0
  const pendingOffset = classifyOffset.get(organizationId)
  if (!force && pendingOffset == null && Date.now() - last < STAGE_COOLDOWN_MS) {
    return { skipped: true }
  }

  let offset = pendingOffset || 0
  let pages = 0
  let updated = 0
  let scanned = 0
  let classified = 0
  let done = false

  while (pages < PAGES_PER_BOOTSTRAP) {
    const result = await applyErpAccountStagesToLeadPage({
      organizationId,
      offset,
      limit: PAGE_SIZE,
    })
    pages += 1
    scanned += result.scanned
    classified += result.classified
    updated += result.updated
    if (result.done) {
      done = true
      classifyOffset.delete(organizationId)
      classifiedAt.set(organizationId, Date.now())
      break
    }
    offset = result.nextOffset
    classifyOffset.set(organizationId, offset)
  }

  return { scanned, classified, updated, offset, done, pages }
}
