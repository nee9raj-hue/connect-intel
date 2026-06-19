import { resolveTimeZone, startOfLocalDayMs } from '../calendarLocale.js'
import {
  normalizeDashboardPeriod,
  periodStart,
  previousPeriodStart,
  periodLabel,
  nextLocalDayMs,
  MS_DAY,
} from './dashboardPeriod.js'
import { getScopedLeadsQuery, scopedLeadsListUrl } from './pipelineScopedQuery.js'
import { isPipelineLeadsTableEnabled } from './infra/config.js'
import { supabaseRest } from './supabaseClient.js'
import { readStore } from './store.js'

const MAX_LEAD_SCOPE = 500

export function resolveActivityLogTimeRange(user, params, timeZone = null) {
  const tz = resolveTimeZone(user, params.get('tz') || timeZone)
  const fromRaw = String(params.get('from') || '').trim()
  const toRaw = String(params.get('to') || '').trim()

  if (fromRaw && toRaw) {
    const since = startOfLocalDayMs(tz, new Date(fromRaw))
    const toStart = startOfLocalDayMs(tz, new Date(toRaw))
    const until = nextLocalDayMs(tz, toStart)
    const span = Math.max(MS_DAY, until - since)
    const prevUntil = since
    const prevSince = since - span
    return {
      since,
      until,
      prevSince,
      prevUntil,
      period: 'custom',
      periodLabel: `${fromRaw} – ${toRaw}`,
      timeZone: tz,
    }
  }

  const period = normalizeDashboardPeriod(params.get('period') || 'week')
  const since = periodStart(period, tz)
  const prevSince = previousPeriodStart(period, tz)
  return {
    since,
    until: Infinity,
    prevSince,
    prevUntil: since,
    period,
    periodLabel: periodLabel(period),
    timeZone: tz,
  }
}

export function parseActivityLogFilters(params) {
  const status = String(params.get('status') || 'all').trim()
  const tagId = String(params.get('tagId') || params.get('tag') || '').trim() || null
  const memberUserId = params.get('userId') || null
  const activityType = String(params.get('type') || '').trim().toLowerCase() || null
  return {
    status: status && status !== 'all' ? status : null,
    tagId,
    memberUserId,
    activityType,
  }
}

/** Resolve pipeline lead ids for stage / tag filters (indexed table path). */
export async function resolveActivityLogLeadIds(user, { status, tagId, assigneeUserId } = {}) {
  if (!status && !tagId) return null
  if (!isPipelineLeadsTableEnabled()) return []

  const meta = await readStore({ only: ['users', 'organizations', 'organizationMemberships'] })
  const ids = new Set()
  let offset = 0
  const pageSize = 200

  while (ids.size < MAX_LEAD_SCOPE) {
    const scoped = await getScopedLeadsQuery(
      user,
      {
        status: status || 'all',
        tagIds: tagId ? [tagId] : [],
        assigneeUserId: assigneeUserId || undefined,
        limit: pageSize,
        offset,
      },
      meta
    )
    const url = scopedLeadsListUrl(scoped, { select: 'lead_id', order: 'updated_at.desc,lead_id.desc' })
    const rows = await supabaseRest(url, {}, { timeoutMs: 12_000, attempts: 2 })
    if (!Array.isArray(rows) || !rows.length) break
    for (const row of rows) {
      if (row?.lead_id) ids.add(String(row.lead_id))
    }
    if (rows.length < pageSize) break
    offset += rows.length
  }

  return [...ids]
}
