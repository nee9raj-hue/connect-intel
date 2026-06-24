import { readStore } from './store.js'
import {
  attachPipelineEntriesToStore,
  loadPipelineStoreContext,
  META_STORE_COLLECTIONS,
  pipelineShardNameForUser,
} from './pipelineShard.js'
import { listPipelineSavedEntries } from './organizations.js'
import { loadPipelineListPage } from './pipelineListLoad.js'
import {
  countCrmActivities,
  listCrmActivities,
  ACTIVITY_FEED_LIMIT,
  emptyActivityRollup,
} from './crmActivityCounts.js'
import { entriesForActivityScanWindows } from './crmTouchpoints.js'

const MAX_MEMBER_LEADS = 500
const MAX_LEGACY_SCAN = 1500
const MEMBER_PAGE_SIZE = 200

/** Org-wide feed: sample recent activity from each rep so one rep cannot dominate the list. */
export function mergeBalancedOrgActivityFeed(activities, maxItems = ACTIVITY_FEED_LIMIT) {
  if (!activities?.length) return []
  const byActor = new Map()
  for (const a of activities) {
    const id = String(a.createdByUserId || a.userId || '')
    if (!id) continue
    if (!byActor.has(id)) byActor.set(id, [])
    byActor.get(id).push(a)
  }
  for (const list of byActor.values()) {
    list.sort((x, y) => new Date(y.createdAt) - new Date(x.createdAt))
  }
  if (byActor.size <= 1) {
    return [...activities]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, maxItems)
  }
  const perCap = Math.max(4, Math.ceil(maxItems / byActor.size))
  const picked = []
  for (const list of byActor.values()) {
    picked.push(...list.slice(0, perCap))
  }
  picked.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  return picked.slice(0, maxItems)
}

function sumRollupMaps(perUser) {
  const rollup = emptyActivityRollup()
  for (const row of perUser.values()) {
    for (const key of Object.keys(rollup)) {
      if (typeof row[key] === 'number') rollup[key] += row[key]
    }
  }
  return rollup
}

/**
 * All-reps activity feed — load each rep's CRM activities in parallel, then balance the merged feed.
 * Avoids pipeline_activities table indexing gaps and single-rep dominance in the SQL feed.
 */
export async function readBalancedOrgActivityFromCrm(
  user,
  {
    rosterMemberIds = [],
    since,
    until = Infinity,
    prevSince,
    prevUntil,
    activityType = null,
    limit = 50,
    offset = 0,
  } = {}
) {
  const repIds = [...new Set((rosterMemberIds || []).map(String).filter(Boolean))]
  if (!repIds.length) {
    return readActivityLogFromCrmEntries(user, {
      since,
      until,
      prevSince,
      prevUntil,
      activityType,
      limit,
      offset,
    })
  }

  const pageSize = Math.max(1, Math.min(200, Number(limit) || 50))
  const start = Math.max(0, Number(offset) || 0)
  const perRepLimit = Math.min(80, Math.max(20, Math.ceil((start + pageSize) / repIds.length) + 20))

  const parts = await Promise.all(
    repIds.slice(0, 30).map((uid) =>
      readActivityLogFromCrmEntries(user, {
        scopedMemberId: uid,
        since,
        until,
        prevSince,
        prevUntil,
        activityType,
        limit: perRepLimit,
        offset: 0,
      }).catch(() => null)
    )
  )

  const allActivities = []
  const perUser = new Map()
  const prevPerUser = new Map()
  for (const part of parts) {
    if (!part) continue
    allActivities.push(...(part.activities || []))
    for (const [uid, row] of part.perUser || []) perUser.set(uid, row)
    for (const [uid, row] of part.prevPerUser || []) prevPerUser.set(uid, row)
  }

  const balanced = mergeBalancedOrgActivityFeed(allActivities, ACTIVITY_FEED_LIMIT)
  const activities = balanced.slice(start, start + pageSize)
  const rollup = sumRollupMaps(perUser)
  const prevRollup = sumRollupMaps(prevPerUser)

  if (!rollup.activitiesTotal && !activities.length) return null

  return {
    activities,
    rollup,
    prevRollup,
    perUser,
    prevPerUser,
    total: balanced.length,
    source: 'crm_balanced_per_rep',
  }
}

async function loadEntriesByLeadIds(user, leadIds) {
  const ids = [...new Set((leadIds || []).filter(Boolean))].slice(0, MAX_MEMBER_LEADS)
  if (!ids.length) return null

  const metaStore = await readStore({ only: META_STORE_COLLECTIONS })
  const shardName = pipelineShardNameForUser(user)
  const { pipelineLeadsTableActive, readPipelineLeadsByIds } = await import('./pipelineLeadsTable.js')

  let entries = []
  if (pipelineLeadsTableActive()) {
    entries = (await readPipelineLeadsByIds(shardName, ids)) || []
  } else {
    const { visible } = await loadPipelineStoreContext(user, { shardOnly: true })
    const idSet = new Set(ids.map(String))
    entries = (visible || []).filter((entry) => {
      const lid = entry?.lead?.id || entry?.id
      return lid && idSet.has(String(lid))
    })
  }

  if (!entries.length) return null
  return {
    entries,
    pipelineStore: attachPipelineEntriesToStore(metaStore, entries),
  }
}

async function loadEntriesForAssignee(user, assigneeUserId) {
  const allEntries = []
  let offset = 0

  while (allEntries.length < MAX_MEMBER_LEADS) {
    const page = await loadPipelineListPage(user, {
      offset,
      limit: MEMBER_PAGE_SIZE,
      filters: { assigneeUserId, status: 'all' },
      light: false,
    })
    const batch = page?.visible || []
    if (!batch.length) break
    allEntries.push(...batch)
    if (!page.hasMore || batch.length < MEMBER_PAGE_SIZE) break
    offset += batch.length
  }

  if (!allEntries.length) return null
  const metaStore = await readStore({ only: META_STORE_COLLECTIONS })
  return {
    entries: allEntries,
    pipelineStore: attachPipelineEntriesToStore(metaStore, allEntries),
  }
}

async function loadEntriesOrgLegacyScan(user, { since, until, prevSince, prevUntil } = {}) {
  const { pipelineStore, visible } = await loadPipelineStoreContext(user, { mergeMonolithCrm: true })
  const store = { ...pipelineStore, savedLeads: visible }
  const allEntries = listPipelineSavedEntries(store, user)
  const entries = entriesForActivityScanWindows(
    allEntries,
    [
      { since: prevSince, until: prevUntil },
      { since, until },
    ],
    MAX_LEGACY_SCAN
  )
  if (!entries.length) return null
  return { entries, pipelineStore: store }
}

/**
 * Read activity log rollups + feed from pipeline lead CRM JSON (crm.activities).
 * Used when pipeline_activities table / snapshots are empty or stale.
 */
export async function readActivityLogFromCrmEntries(
  user,
  {
    scopedMemberId = null,
    leadIds = null,
    since,
    until = Infinity,
    prevSince,
    prevUntil,
    activityType = null,
    limit = 50,
    offset = 0,
  } = {}
) {
  let loaded = null

  if (Array.isArray(leadIds) && leadIds.length) {
    loaded = await loadEntriesByLeadIds(user, leadIds)
  } else if (scopedMemberId) {
    loaded = await loadEntriesForAssignee(user, scopedMemberId)
  } else {
    loaded = await loadEntriesOrgLegacyScan(user, { since, until, prevSince, prevUntil })
  }

  if (!loaded?.entries?.length) return null

  const { entries, pipelineStore } = loaded
  const countOpts = {
    memberUserId: scopedMemberId,
    activityType,
    feedLimit: 0,
  }

  const current = countCrmActivities(pipelineStore, user, entries, {
    ...countOpts,
    since,
    until,
  })
  const previous = countCrmActivities(pipelineStore, user, entries, {
    ...countOpts,
    since: prevSince,
    until: prevUntil,
  })

  const rollup = scopedMemberId
    ? current.perUser.get(String(scopedMemberId)) || current.org
    : current.org
  const prevRollup = scopedMemberId
    ? previous.perUser.get(String(scopedMemberId)) || previous.org
    : previous.org

  const allActivities = listCrmActivities(pipelineStore, user, entries, {
    since,
    until,
    memberUserId: scopedMemberId,
    activityType,
    feedLimit: ACTIVITY_FEED_LIMIT,
  })

  const normalized =
    !scopedMemberId && !leadIds?.length
      ? mergeBalancedOrgActivityFeed(allActivities, ACTIVITY_FEED_LIMIT)
      : allActivities

  const start = Math.max(0, Number(offset) || 0)
  const pageSize = Math.max(1, Math.min(200, Number(limit) || 50))
  const activities = normalized.slice(start, start + pageSize)

  if (!rollup?.activitiesTotal && !activities.length) return null

  return {
    activities,
    rollup: rollup || emptyActivityRollup(),
    prevRollup: prevRollup || emptyActivityRollup(),
    perUser: current.perUser,
    prevPerUser: previous.perUser,
    total: normalized.length,
    source: 'crm_entries',
  }
}
