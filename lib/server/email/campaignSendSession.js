import { readCampaignSendShard } from '../marketingCampaignSendShard.js'
import {
  readCampaignStatsShard,
  writeCampaignStatsShard,
} from '../marketingCampaignStatsShard.js'
import {
  ENROLLMENT_CHUNK_SIZE,
  readCampaignEnrollments,
  readEnrollmentMeta,
  writeEnrollmentChunk,
  writeEnrollmentMeta,
} from '../marketingEnrollmentShard.js'
import { readPipelineLeadsByIds } from '../pipelineLeadsTable.js'
import { pipelineShardNameForUser } from '../pipelineShard.js'
import { appendEmailActivityEvents } from '../emailActivityQueue.js'
import { updateStorePartial } from '../store.js'

function groupEnrollmentsByChunk(enrollments) {
  const byChunk = new Map()
  for (const row of enrollments || []) {
    const idx = row.chunkIndex != null ? row.chunkIndex : 0
    if (!byChunk.has(idx)) byChunk.set(idx, [])
    byChunk.get(idx).push(row)
  }
  return byChunk
}

function summarizeDue(enrollments, now, limit) {
  const due = []
  for (const e of enrollments || []) {
    if (e.status === 'active' && e.nextSendAt && e.nextSendAt <= now) {
      due.push(e)
      if (due.length >= limit) break
    }
  }
  return due
}

/**
 * In-memory send session: one enrollment load + one lead preload per worker job.
 */
export async function createCampaignSendSession(user, campaignId) {
  const [enrollmentMeta, stats, sendCampaign, enrollments] = await Promise.all([
    readEnrollmentMeta(campaignId),
    readCampaignStatsShard(campaignId),
    readCampaignSendShard(campaignId),
    readCampaignEnrollments(campaignId),
  ])

  const session = {
    user,
    campaignId,
    campaign: sendCampaign,
    enrollmentMeta: enrollmentMeta ? { ...enrollmentMeta } : null,
    enrollments: [...(enrollments || [])],
    enrollmentsByChunk: groupEnrollmentsByChunk(enrollments),
    stats: { campaignId, ...(stats || {}) },
    statsDirty: false,
    metaDirty: false,
    dirtyChunks: new Set(),
    leadById: new Map(),
    activityEvents: [],
    pipelineBulk: sendCampaign?.source === 'pipeline_bulk',
  }

  if (session.pipelineBulk && session.enrollments.length) {
    const leadIds = [...new Set(session.enrollments.map((e) => e.leadId).filter(Boolean))]
    const shardName = pipelineShardNameForUser(user)
    const entries = (await readPipelineLeadsByIds(shardName, leadIds)) || []
    for (const entry of entries) {
      const lid = entry?.lead?.id || entry?.leadId
      if (lid) session.leadById.set(lid, entry)
    }
  }

  return session
}

export function getDueEnrollmentsFromSession(session, limit, now = new Date().toISOString()) {
  return summarizeDue(session.enrollments, now, limit)
}

export function attachLeadsFromSession(store, session, dueEnrollments) {
  if (!session?.leadById?.size) return store
  const savedLeads = dueEnrollments
    .map((e) => session.leadById.get(e.leadId))
    .filter(Boolean)
  return { ...store, savedLeads }
}

export function applyEnrollmentWritesToSession(session, pendingWrites, applyEnrollmentWrites) {
  if (!pendingWrites?.length) return

  const chunkLists = new Map()
  for (const [idx, rows] of session.enrollmentsByChunk.entries()) {
    chunkLists.set(idx, [...rows])
  }

  for (const write of pendingWrites) {
    let chunkIndex = write.chunkIndex
    if (chunkIndex == null) {
      const row = session.enrollments.find((e) => e.id === write.enrollmentId)
      chunkIndex = row?.chunkIndex ?? 0
    }
    if (!chunkLists.has(chunkIndex)) chunkLists.set(chunkIndex, [])
    const list = chunkLists.get(chunkIndex)
    applyEnrollmentWrites(list, [write])
    chunkLists.set(chunkIndex, list)
    session.dirtyChunks.add(chunkIndex)
  }

  session.enrollments = []
  for (const idx of [...chunkLists.keys()].sort((a, b) => a - b)) {
    session.enrollments.push(...chunkLists.get(idx))
  }
  session.enrollmentsByChunk = chunkLists

  if (session.enrollmentMeta?.chunkCount) {
    let activeDelta = 0
    let dueDelta = 0
    for (const write of pendingWrites) {
      dueDelta -= 1
      if (write.kind === 'sent' && write.isLast) activeDelta -= 1
      else if (write.kind === 'failed' || write.kind === 'unsubscribed') activeDelta -= 1
    }
    session.enrollmentMeta.activeCount = Math.max(
      0,
      (session.enrollmentMeta.activeCount || 0) + activeDelta
    )
    session.enrollmentMeta.dueCount = Math.max(0, (session.enrollmentMeta.dueCount || 0) + dueDelta)
    session.enrollmentMeta.updatedAt = new Date().toISOString()
    session.metaDirty = true
  }
}

export function accumulateStatsInSession(session, pendingWrites) {
  if (!pendingWrites?.length) return
  for (const write of pendingWrites) {
    if (write.kind === 'failed') session.stats.failed = (session.stats.failed || 0) + 1
    else if (write.kind === 'unsubscribed') {
      session.stats.unsubscribed = (session.stats.unsubscribed || 0) + 1
    } else if (write.kind === 'sent') session.stats.sent = (session.stats.sent || 0) + 1
  }
  session.stats.updatedAt = new Date().toISOString()
  session.statsDirty = true
}

export async function flushCampaignSendSession(session) {
  if (!session) return { writes: 0 }

  let writes = 0

  if (session.dirtyChunks.size && session.enrollmentMeta?.chunkCount) {
    const jobs = []
    for (const chunkIndex of session.dirtyChunks) {
      const rows = session.enrollmentsByChunk.get(chunkIndex) || []
      jobs.push(writeEnrollmentChunk(session.campaignId, chunkIndex, rows))
      writes += 1
    }
    await Promise.all(jobs)
    session.dirtyChunks.clear()
  }

  if (session.metaDirty && session.enrollmentMeta) {
    await writeEnrollmentMeta(session.campaignId, session.enrollmentMeta)
    writes += 1
    session.metaDirty = false
  }

  if (session.statsDirty) {
    await writeCampaignStatsShard(session.campaignId, session.stats)
    writes += 1
    session.statsDirty = false
  }

  if (session.activityEvents.length) {
    await appendEmailActivityEvents(session.activityEvents)
    writes += 1
    session.activityEvents = []
  }

  return { writes }
}

export async function maybeCompleteCampaignFromSession(session) {
  if (!session?.enrollmentMeta) return false
  const active = session.enrollmentMeta.activeCount ?? 0
  if (active > 0) return false

  const completedAt = new Date().toISOString()
  session.stats.status = 'completed'
  session.stats.completedAt = completedAt
  session.stats.sendStatus = 'completed'
  session.stats.updatedAt = completedAt
  session.statsDirty = true

  await updateStorePartial(['marketingCampaigns'], (draft) => {
    const campaign = (draft.marketingCampaigns || []).find((x) => x.id === session.campaignId)
    if (campaign && campaign.status === 'active') {
      campaign.status = 'completed'
      campaign.completedAt = completedAt
      campaign.updatedAt = completedAt
    }
    return draft
  })

  return true
}

export function pendingCountFromSession(session) {
  if (!session?.enrollmentMeta) return 0
  if (typeof session.enrollmentMeta.dueCount === 'number') return session.enrollmentMeta.dueCount
  return getDueEnrollmentsFromSession(session, ENROLLMENT_CHUNK_SIZE * 4).length
}

export function queuedCountFromSession(session) {
  if (!session?.enrollmentMeta) return 0
  if (typeof session.enrollmentMeta.activeCount === 'number') {
    return session.enrollmentMeta.activeCount
  }
  return session.enrollments.filter((e) => e.status === 'active' || e.status === 'paused').length
}
