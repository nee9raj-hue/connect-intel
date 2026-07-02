/**
 * Legacy dashboard compute — used only on snapshot/cache miss.
 * Scans pipeline shard; results are cached so repeat views stay fast.
 */

import { readStore } from './store.js'
import { loadPipelineStoreContext } from './pipelineShard.js'
import { buildTeamDashboard } from './crmDashboard.js'
import { buildMyDayDashboard } from './myDayDashboard.js'
import { listPipelineSavedEntries } from './organizations.js'
import { resolveTimeZone } from '../calendarLocale.js'
import { normalizeDashboardPeriod, periodStart } from './dashboardPeriod.js'
import { patchStoreWithFreshOrgRoster } from './teamMembersFresh.js'
import { resolveViewerScope } from './dashboardRoleScope.js'

export async function computeTeamMetricsLegacy(
  user,
  { period = 'week', memberUserId = null, detailed = false, timeZone = null } = {}
) {
  const dashboardPeriod = normalizeDashboardPeriod(period)
  const tz = resolveTimeZone(user, timeZone)
  const mergeSinceMs = periodStart(dashboardPeriod, tz)

  const [{ pipelineStore, visible }, intelMeta] = await Promise.all([
    loadPipelineStoreContext(user, { mergeMonolithCrm: true, activitySinceMs: mergeSinceMs }),
    readStore({ only: ['searches', 'marketingCampaigns', 'users', 'organizationMemberships'] }),
  ])

  const store = await patchStoreWithFreshOrgRoster({
    ...pipelineStore,
    ...intelMeta,
    savedLeads: visible,
    users: intelMeta.users?.length ? intelMeta.users : pipelineStore.users,
    organizationMemberships:
      intelMeta.organizationMemberships?.length
        ? intelMeta.organizationMemberships
        : pipelineStore.organizationMemberships,
  })

  const metaForScope = {
    users: store.users,
    organizations: store.organizations,
    organizationMemberships: store.organizationMemberships,
  }
  const viewerScope = await resolveViewerScope(user, metaForScope, { requestedMemberId: memberUserId })

  return buildTeamDashboard(store, user, {
    period: dashboardPeriod,
    memberUserId: viewerScope.scopedMemberId,
    light: true,
    detailed,
    timeZone: tz,
    viewerScope,
  })
}

export async function computeActivityTimelineLegacy(user, { period = 'week', memberUserId = null } = {}) {
  const { readActivityTimeline } = await import('./activityTimelineRead.js')
  const result = await readActivityTimeline(user, {
    period,
    memberUserId,
    allowLegacyScan: true,
  })
  return {
    activityTimeline: result.activityTimeline || [],
    recentActivities: result.recentActivities || [],
    period: result.period,
  }
}

export async function computeMyDayLegacy(user, { timeZone = null } = {}) {
  const tz = resolveTimeZone(user, timeZone)
  const since = periodStart('week', tz)

  const [{ pipelineStore, visible }, sqlEntities] = await Promise.all([
    loadPipelineStoreContext(user, { mergeMonolithCrm: true }),
    import('./myDaySqlEntities.js').then((m) => m.loadMyDaySqlEntities(user, { timeZone: tz })),
  ])
  const store = { ...pipelineStore, savedLeads: visible }
  const entries = listPipelineSavedEntries(store, user)

  return buildMyDayDashboard(store, user, entries, { timeZone: tz, since, sqlEntities })
}
