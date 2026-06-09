/**
 * Legacy dashboard compute — used only on snapshot/cache miss.
 * Scans pipeline shard; results are cached so repeat views stay fast.
 */

import { readStore } from './store.js'
import { loadPipelineStoreContext } from './pipelineShard.js'
import { buildTeamDashboard } from './crmDashboard.js'
import { buildMyDayDashboard } from './myDayDashboard.js'
import { buildTeamActivityTimeline } from './teamActivityTimeline.js'
import { listPipelineSavedEntries } from './organizations.js'
import { resolveTimeZone } from '../calendarLocale.js'
import { normalizeDashboardPeriod, periodStart } from './dashboardPeriod.js'
import { isFreightDealOrg } from '../freightDeal.js'

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

  const store = {
    ...pipelineStore,
    ...intelMeta,
    savedLeads: visible,
    users: intelMeta.users?.length ? intelMeta.users : pipelineStore.users,
    organizationMemberships:
      intelMeta.organizationMemberships?.length
        ? intelMeta.organizationMemberships
        : pipelineStore.organizationMemberships,
  }

  return buildTeamDashboard(store, user, {
    period: dashboardPeriod,
    memberUserId,
    light: true,
    detailed,
    timeZone: tz,
  })
}

export async function computeActivityTimelineLegacy(user, { period = 'week', memberUserId = null } = {}) {
  const dashboardPeriod = normalizeDashboardPeriod(period)
  const tz = resolveTimeZone(user, null)
  const since = periodStart(dashboardPeriod, tz)

  const { pipelineStore, visible } = await loadPipelineStoreContext(user, { mergeMonolithCrm: true })
  const store = { ...pipelineStore, savedLeads: visible }
  const entries = listPipelineSavedEntries(store, user)
  const org = store.organizations?.find((o) => o.id === user.organizationId)
  const freightOrg = isFreightDealOrg(org, user)

  return {
    activityTimeline: buildTeamActivityTimeline(store, user, entries, {
      since,
      memberUserId: memberUserId || null,
      limit: 100,
      freightOrg,
    }),
    recentActivities: [],
    period: dashboardPeriod,
  }
}

export async function computeMyDayLegacy(user, { timeZone = null } = {}) {
  const tz = resolveTimeZone(user, timeZone)
  const since = periodStart('week', tz)

  const { pipelineStore, visible } = await loadPipelineStoreContext(user, { mergeMonolithCrm: true })
  const store = { ...pipelineStore, savedLeads: visible }
  const entries = listPipelineSavedEntries(store, user)

  return buildMyDayDashboard(store, user, entries, { timeZone: tz, since })
}
