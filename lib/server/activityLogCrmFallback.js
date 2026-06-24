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

  const start = Math.max(0, Number(offset) || 0)
  const pageSize = Math.max(1, Math.min(200, Number(limit) || 50))
  const activities = allActivities.slice(start, start + pageSize)

  if (!rollup?.activitiesTotal && !activities.length) return null

  return {
    activities,
    rollup: rollup || emptyActivityRollup(),
    prevRollup: prevRollup || emptyActivityRollup(),
    perUser: current.perUser,
    prevPerUser: previous.perUser,
    total: allActivities.length,
    source: 'crm_entries',
  }
}
