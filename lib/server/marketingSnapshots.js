/**
 * Materialized marketing hub snapshots — hot path reads JSON doc, never scans pipeline.
 * Refresh: worker/cron, SQL analytics increment, stale-while-revalidate on dashboard GET.
 */

import { readStore } from './store.js'
import { buildOrgUserResponse } from './organizations.js'
import { buildMarketingDashboard } from './marketingDashboard.js'
import { buildMarketingHub } from './marketingHub.js'
import {
  isSnapshotFresh,
  readSnapshotPayload,
  writeSnapshotPayload,
} from './dashboardSnapshots.js'
import {
  dashboardFromAnalyticsSnapshot,
  readOrgMarketingAnalyticsSnapshot,
} from './marketingAnalyticsSnapshots.js'
import { isMarketingSqlQueueEnabled } from './infra/config.js'
import { filterMarketingCampaignsVisible, filterMarketingRows } from './marketingAccess.js'

const META_SLICES = [
  'marketingCampaigns',
  'marketingLists',
  'marketingSegments',
  'marketingEvents',
  'marketingAutomations',
  'marketingAutomationRuns',
  'marketingSuppressions',
  'users',
  'organizations',
  'organizationMemberships',
]

export function marketingSnapshotCollection(orgId) {
  return `marketing_snapshot_${orgId}`
}

export async function readMarketingSnapshotDoc(organizationId) {
  if (!organizationId) return null
  return readSnapshotPayload(marketingSnapshotCollection(organizationId))
}

export async function refreshMarketingSnapshotForOrg(organizationId, userId, { period = '30d' } = {}) {
  if (!organizationId) return null

  const store = await readStore({ only: META_SLICES })
  const sessionUser =
    (store.users || []).find((u) => u.id === userId) ||
    (store.users || []).find((u) => u.organizationId === organizationId)
  if (!sessionUser) return null

  const user = buildOrgUserResponse(sessionUser, store)
  let dashboard = null

  if (isMarketingSqlQueueEnabled()) {
    const analyticsRow = await readOrgMarketingAnalyticsSnapshot(organizationId, 'rolling')
    if (analyticsRow) {
      const lists = filterMarketingRows(store.marketingLists || [], user)
      const segments = filterMarketingRows(store.marketingSegments || [], user)
      const suppressions = filterMarketingRows(store.marketingSuppressions || [], user)
      const campaigns = filterMarketingCampaignsVisible(store.marketingCampaigns || [], user)
      const fast = dashboardFromAnalyticsSnapshot(analyticsRow, {
        listCount: lists.length,
        segmentCount: segments.length,
        suppressionCount: suppressions.length,
        campaignsSent: campaigns.filter((c) => c.startedAt).length,
        scheduledCount: campaigns.filter((c) => c.status === 'scheduled').length,
      })
      if (fast) dashboard = { ...fast, period }
    }
  }

  if (!dashboard) {
    dashboard = await buildMarketingDashboard(store, user, { period })
  }

  const hub = await buildMarketingHub(store, user, { period })
  const payload = {
    version: 1,
    organizationId,
    period,
    dashboard,
    hub,
    updatedAt: new Date().toISOString(),
  }

  await writeSnapshotPayload(marketingSnapshotCollection(organizationId), payload)
  return payload
}

export async function readMarketingDashboardFromSnapshot(user, { period = '30d', allowStale = true } = {}) {
  if (!user?.organizationId) return null
  const doc = await readMarketingSnapshotDoc(user.organizationId)
  if (!doc?.dashboard) return null
  if (doc.period && doc.period !== period) return null

  const fresh = isSnapshotFresh(doc)
  if (!fresh && !allowStale) return null

  return {
    dashboard: doc.dashboard,
    hub: doc.hub || null,
    fresh,
    updatedAt: doc.updatedAt,
    source: 'marketing_snapshot',
  }
}
