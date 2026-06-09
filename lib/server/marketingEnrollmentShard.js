import { readStore, writeStoreCollections } from './store.js'

/** Max enrollments per Supabase row — keeps each write small enough to avoid statement timeout. */
export const ENROLLMENT_CHUNK_SIZE = 40

export function isMarketingEnrollmentShardCollection(name) {
  return typeof name === 'string' && name.startsWith('menroll_')
}

export function isMarketingEnrollmentMetaCollection(name) {
  return typeof name === 'string' && name.startsWith('menroll_meta_')
}

export function enrollmentMetaName(campaignId) {
  return `menroll_meta_${campaignId}`
}

export function enrollmentChunkName(campaignId, chunkIndex) {
  return `menroll_${campaignId}_${chunkIndex}`
}

/** Legacy single-blob shard (pre-chunking). */
export function legacyEnrollmentShardName(campaignId) {
  return `menroll_${campaignId}`
}

function summarizeEnrollments(list, now = new Date().toISOString()) {
  let activeCount = 0
  let dueCount = 0
  for (const e of list || []) {
    if (e.status !== 'active') continue
    activeCount += 1
    if (e.nextSendAt && e.nextSendAt <= now) dueCount += 1
  }
  return { activeCount, dueCount }
}

async function bumpEnrollmentMetaCounts(campaignId, delta) {
  const meta = await readEnrollmentMeta(campaignId)
  if (!meta?.chunkCount) return meta
  const next = {
    ...meta,
    activeCount: Math.max(0, (meta.activeCount || 0) + (delta.activeCount || 0)),
    dueCount: Math.max(0, (meta.dueCount || 0) + (delta.dueCount || 0)),
    updatedAt: new Date().toISOString(),
  }
  await writeEnrollmentMeta(campaignId, next)
  return next
}

function slimEnrollmentRow(row) {
  if (!row || typeof row !== 'object') return row
  return {
    ...row,
    whatsappMessage: row.whatsappMessage ? String(row.whatsappMessage).slice(0, 480) : row.whatsappMessage,
    whatsappUrl: row.whatsappUrl ? String(row.whatsappUrl).slice(0, 500) : row.whatsappUrl,
    lastError: row.lastError ? String(row.lastError).slice(0, 240) : row.lastError,
  }
}

export async function readEnrollmentMeta(campaignId) {
  const metaName = enrollmentMetaName(campaignId)
  const store = await readStore({ only: [metaName] })
  const meta = store[metaName]
  if (meta && typeof meta === 'object' && !Array.isArray(meta) && meta.chunkCount > 0) {
    return meta
  }
  return null
}

async function readEnrollmentChunk(campaignId, chunkIndex) {
  const name = enrollmentChunkName(campaignId, chunkIndex)
  const store = await readStore({ only: [name] })
  const list = store[name]
  return Array.isArray(list) ? list : []
}

async function readLegacyEnrollmentShard(campaignId) {
  const name = legacyEnrollmentShardName(campaignId)
  const store = await readStore({ only: [name] })
  const list = store[name]
  return Array.isArray(list) ? list : []
}

export async function writeEnrollmentChunk(campaignId, chunkIndex, entries) {
  const name = enrollmentChunkName(campaignId, chunkIndex)
  const list = (Array.isArray(entries) ? entries : []).map(slimEnrollmentRow)
  await writeStoreCollections({ [name]: list }, [name])
}

export async function writeEnrollmentMeta(campaignId, meta) {
  const name = enrollmentMetaName(campaignId)
  await writeStoreCollections({ [name]: meta }, [name])
}

/** Migrate one giant legacy shard into chunked rows (best-effort). */
async function migrateLegacyEnrollmentsIfNeeded(campaignId, legacyList) {
  if (!legacyList?.length) return
  const meta = await readEnrollmentMeta(campaignId)
  if (meta?.chunkCount) return

  const withChunks = legacyList.map((row, index) => ({
    ...slimEnrollmentRow(row),
    chunkIndex: Math.floor(index / ENROLLMENT_CHUNK_SIZE),
  }))
  await writeCampaignEnrollments(campaignId, withChunks)
  const legacyName = legacyEnrollmentShardName(campaignId)
  await writeStoreCollections({ [legacyName]: [] }, [legacyName])
}

export async function readCampaignEnrollments(campaignId) {
  if (!campaignId) return []
  const meta = await readEnrollmentMeta(campaignId)
  if (meta?.chunkCount) {
    const names = Array.from({ length: meta.chunkCount }, (_, i) =>
      enrollmentChunkName(campaignId, i)
    )
    const store = await readStore({ only: names })
    const merged = []
    for (const name of names) {
      const chunk = store[name]
      if (Array.isArray(chunk)) merged.push(...chunk)
    }
    return merged
  }

  const legacy = await readLegacyEnrollmentShard(campaignId)
  if (legacy.length) {
    void migrateLegacyEnrollmentsIfNeeded(campaignId, legacy).catch((err) => {
      console.error('enrollment chunk migration failed:', err?.message || err)
    })
  }
  return legacy
}

/** Load only enrollments due now (avoids reading every chunk when the queue is large). */
export async function readDueCampaignEnrollments(campaignId, limit = 1) {
  if (!campaignId || limit < 1) return []
  const now = new Date().toISOString()
  const due = []
  const meta = await readEnrollmentMeta(campaignId)

  if (meta?.chunkCount) {
    for (let i = 0; i < meta.chunkCount && due.length < limit; i += 1) {
      const chunk = await readEnrollmentChunk(campaignId, i)
      for (const e of chunk) {
        if (e.status === 'active' && e.nextSendAt && e.nextSendAt <= now) {
          due.push(e)
          if (due.length >= limit) return due
        }
      }
    }
    return due
  }

  const legacy = await readLegacyEnrollmentShard(campaignId)
  if (legacy.length > ENROLLMENT_CHUNK_SIZE) {
    void migrateLegacyEnrollmentsIfNeeded(campaignId, legacy).catch(() => {})
  }
  for (const e of legacy) {
    if (e.status === 'active' && e.nextSendAt && e.nextSendAt <= now) {
      due.push(e)
      if (due.length >= limit) return due
    }
  }
  return due
}

/** Append enrollments without loading every existing chunk (resume / continue sends). */
export async function appendCampaignEnrollments(campaignId, additions) {
  if (!campaignId || !additions?.length) return
  const rows = additions.map((row) => slimEnrollmentRow({ ...row }))
  const meta = await readEnrollmentMeta(campaignId)
  if (!meta?.chunkCount) {
    const legacy = await readLegacyEnrollmentShard(campaignId)
    await writeCampaignEnrollments(campaignId, [...legacy, ...rows])
    return
  }

  const now = new Date().toISOString()
  let chunkCount = meta.chunkCount
  let lastChunk = await readEnrollmentChunk(campaignId, chunkCount - 1)
  let activeDelta = 0
  let dueDelta = 0

  for (const row of rows) {
    if (row.status === 'active') {
      activeDelta += 1
      if (row.nextSendAt && row.nextSendAt <= now) dueDelta += 1
    }
    if (lastChunk.length >= ENROLLMENT_CHUNK_SIZE) {
      await writeEnrollmentChunk(campaignId, chunkCount - 1, lastChunk)
      lastChunk = []
      chunkCount += 1
    }
    lastChunk.push({ ...row, chunkIndex: chunkCount - 1 })
  }

  await writeEnrollmentChunk(campaignId, chunkCount - 1, lastChunk)
  await writeEnrollmentMeta(campaignId, {
    ...meta,
    chunkCount,
    total: (meta.total || 0) + rows.length,
    activeCount: (meta.activeCount || 0) + activeDelta,
    dueCount: (meta.dueCount || 0) + dueDelta,
    updatedAt: now,
  })
}

export async function writeCampaignEnrollments(campaignId, entries) {
  if (!campaignId) return
  const list = (Array.isArray(entries) ? entries : []).map((row, index) =>
    slimEnrollmentRow({
      ...row,
      chunkIndex:
        row.chunkIndex != null ? row.chunkIndex : Math.floor(index / ENROLLMENT_CHUNK_SIZE),
    })
  )
  const chunkCount = Math.max(1, Math.ceil(list.length / ENROLLMENT_CHUNK_SIZE))
  const writes = []

  for (let i = 0; i < chunkCount; i += 1) {
    const slice = list.filter((row) => row.chunkIndex === i)
    writes.push(writeEnrollmentChunk(campaignId, i, slice))
  }

  await Promise.all(writes)
  const now = new Date().toISOString()
  const counts = summarizeEnrollments(list, now)
  await writeEnrollmentMeta(campaignId, {
    chunkCount,
    total: list.length,
    version: 2,
    activeCount: counts.activeCount,
    dueCount: counts.dueCount,
    updatedAt: now,
  })

  const legacyName = legacyEnrollmentShardName(campaignId)
  await writeStoreCollections({ [legacyName]: [] }, [legacyName])
}

/**
 * Update only the enrollment rows that changed (one small chunk write per send).
 * pendingWrites must include enrollmentId; enrollment.chunkIndex is used when present.
 */
export async function patchCampaignEnrollments(campaignId, pendingWrites, applyEnrollmentWrites) {
  if (!campaignId || !pendingWrites?.length) return

  const meta = await readEnrollmentMeta(campaignId)
  const legacyMode = !meta?.chunkCount

  if (legacyMode) {
    const legacy = await readLegacyEnrollmentShard(campaignId)
    const updated = applyEnrollmentWrites([...legacy], pendingWrites)
    await writeCampaignEnrollments(campaignId, updated)
    return updated
  }

  const chunkIndexes = new Set()
  for (const write of pendingWrites) {
    if (write.chunkIndex != null) chunkIndexes.add(write.chunkIndex)
  }

  if (!chunkIndexes.size) {
    for (let i = 0; i < meta.chunkCount; i += 1) {
      const chunk = await readEnrollmentChunk(campaignId, i)
      if (pendingWrites.some((w) => chunk.some((e) => e.id === w.enrollmentId))) {
        chunkIndexes.add(i)
      }
    }
  }

  const updatedById = new Map()
  for (const chunkIndex of chunkIndexes) {
    const chunk = await readEnrollmentChunk(campaignId, chunkIndex)
    const touched = pendingWrites.filter(
      (w) => w.chunkIndex === chunkIndex || chunk.some((e) => e.id === w.enrollmentId)
    )
    if (!touched.length) continue
    const nextChunk = applyEnrollmentWrites([...chunk], touched)
    await writeEnrollmentChunk(campaignId, chunkIndex, nextChunk)
    for (const row of nextChunk) {
      if (touched.some((w) => w.enrollmentId === row.id)) {
        updatedById.set(row.id, row)
      }
    }
  }

  const delta = { activeCount: 0, dueCount: 0 }
  for (const write of pendingWrites) {
    delta.dueCount -= 1
    if (write.kind === 'sent' && write.isLast) delta.activeCount -= 1
    else if (write.kind === 'failed' || write.kind === 'unsubscribed') delta.activeCount -= 1
  }
  if (meta?.chunkCount && (delta.activeCount || delta.dueCount)) {
    await bumpEnrollmentMetaCounts(campaignId, delta)
  }

  return [...updatedById.values()]
}

export async function campaignHasActiveEnrollments(campaignId) {
  const meta = await readEnrollmentMeta(campaignId)
  if (meta?.chunkCount) {
    if (typeof meta.activeCount === 'number') return meta.activeCount > 0
    for (let i = 0; i < meta.chunkCount; i += 1) {
      const chunk = await readEnrollmentChunk(campaignId, i)
      if (chunk.some((e) => e.status === 'active')) return true
    }
    return false
  }
  return (await readLegacyEnrollmentShard(campaignId)).some((e) => e.status === 'active')
}

/** Persist open/click counts on sharded enrollment rows (tracking pixel / link hits). */
export async function bumpEnrollmentEngagement(campaignId, enrollmentId, { type }) {
  if (!campaignId || !enrollmentId || !type) return

  const meta = await readEnrollmentMeta(campaignId)
  const now = new Date().toISOString()

  const applyBump = (list) => {
    const idx = list.findIndex((x) => x.id === enrollmentId)
    if (idx < 0) return null
    const next = [...list]
    const e = next[idx]
    if (type === 'open') e.openCount = (e.openCount || 0) + 1
    if (type === 'click') e.clickCount = (e.clickCount || 0) + 1
    e.updatedAt = now
    return next
  }

  if (!meta?.chunkCount) {
    const legacy = await readLegacyEnrollmentShard(campaignId)
    const next = applyBump(legacy)
    if (!next) return
    await writeCampaignEnrollments(campaignId, next)
    return
  }

  for (let i = 0; i < meta.chunkCount; i += 1) {
    const chunk = await readEnrollmentChunk(campaignId, i)
    if (!chunk.some((e) => e.id === enrollmentId)) continue
    const nextChunk = applyBump(chunk)
    if (!nextChunk) continue
    await writeEnrollmentChunk(campaignId, i, nextChunk)
    return
  }
}

export async function countPendingCampaignEnrollments(campaignId) {
  const meta = await readEnrollmentMeta(campaignId)
  if (meta?.chunkCount && typeof meta.dueCount === 'number') {
    return meta.dueCount
  }

  const now = new Date().toISOString()
  let pending = 0

  if (meta?.chunkCount) {
    for (let i = 0; i < meta.chunkCount; i += 1) {
      const chunk = await readEnrollmentChunk(campaignId, i)
      pending += chunk.filter((e) => e.status === 'active' && e.nextSendAt && e.nextSendAt <= now)
        .length
    }
    return pending
  }

  return (await readLegacyEnrollmentShard(campaignId)).filter(
    (e) => e.status === 'active' && e.nextSendAt && e.nextSendAt <= now
  ).length
}
