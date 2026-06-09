/** Cached audience snapshots — avoid full pipeline scans on campaign open/send. */

const SNAPSHOT_MAX_AGE_MS = 24 * 60 * 60 * 1000

export function buildAudienceSnapshot(leadIds, previousSnapshot = null) {
  const ids = [...new Set((leadIds || []).filter(Boolean))]
  const prevCount = previousSnapshot?.contactCount ?? 0
  const contactCount = ids.length
  const growthPct =
    prevCount > 0 ? Math.round(((contactCount - prevCount) / prevCount) * 100) : contactCount > 0 ? 100 : 0
  const now = new Date().toISOString()
  return {
    leadIds: ids,
    contactCount,
    createdAt: previousSnapshot?.createdAt || now,
    lastRefreshed: now,
    growthPct,
    deliverableCount: contactCount,
    engagedCount: previousSnapshot?.engagedCount ?? null,
  }
}

export function applySnapshotToAudience(row, leadIds) {
  if (!row) return row
  row.snapshot = buildAudienceSnapshot(leadIds, row.snapshot)
  row.memberCount = row.snapshot.contactCount
  if (Array.isArray(row.leadIds)) row.leadIds = row.snapshot.leadIds
  row.updatedAt = row.snapshot.lastRefreshed
  return row
}

export function snapshotLeadIds(entity) {
  const fromSnap = entity?.snapshot?.leadIds
  if (Array.isArray(fromSnap) && fromSnap.length) return fromSnap
  if (Array.isArray(entity?.leadIds) && entity.leadIds.length) return entity.leadIds
  return []
}

export function isSnapshotFresh(entity, maxAgeMs = SNAPSHOT_MAX_AGE_MS) {
  const at = entity?.snapshot?.lastRefreshed
  if (!at) return false
  return Date.now() - new Date(at).getTime() < maxAgeMs
}

export function audienceDisplayMetrics(entity) {
  const snap = entity?.snapshot || {}
  return {
    contactCount: snap.contactCount ?? entity?.memberCount ?? entity?.leadIds?.length ?? 0,
    growthPct: snap.growthPct ?? 0,
    lastRefreshed: snap.lastRefreshed ?? entity?.updatedAt ?? null,
    deliverableCount: snap.deliverableCount ?? snap.contactCount ?? entity?.memberCount ?? 0,
    engagedCount: snap.engagedCount ?? null,
  }
}

/** Unified card shape for lists + segments in Audience Studio. */
export function toAudienceCard(row, sourceType) {
  const metrics = audienceDisplayMetrics(row)
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    sourceType,
    audienceType: sourceType === 'segment' ? row.type || 'dynamic' : 'static',
    channel: row.channel || 'email',
    contactCount: metrics.contactCount,
    growthPct: metrics.growthPct,
    lastRefreshed: metrics.lastRefreshed,
    deliverableCount: metrics.deliverableCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    listId: sourceType === 'list' ? row.id : null,
    segmentId: sourceType === 'segment' ? row.id : null,
  }
}
