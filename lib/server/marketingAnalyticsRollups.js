import { createId, readStore, updateStore } from './store.js'

/**
 * Store-based analytics rollups (ClickHouse-style daily aggregates without external infra).
 * Partition key: organizationId + date + metric.
 */
export async function recordMarketingRollup({
  organizationId,
  createdByUserId,
  date,
  metric,
  dimensions = {},
  delta = 1,
}) {
  const day = (date || new Date().toISOString()).slice(0, 10)
  const scopeKey = organizationId || `user:${createdByUserId}`
  const dimKey = JSON.stringify(dimensions)

  await updateStore((draft) => {
    draft.marketingAnalyticsRollups = draft.marketingAnalyticsRollups || []
    const existing = draft.marketingAnalyticsRollups.find(
      (r) =>
        r.scopeKey === scopeKey &&
        r.date === day &&
        r.metric === metric &&
        r.dimKey === dimKey
    )
    if (existing) {
      existing.value = (existing.value || 0) + delta
      existing.updatedAt = new Date().toISOString()
    } else {
      draft.marketingAnalyticsRollups.push({
        id: createId('mroll'),
        scopeKey,
        organizationId: organizationId || null,
        createdByUserId: createdByUserId || null,
        date: day,
        metric,
        dimensions,
        dimKey,
        value: delta,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    }
    if (draft.marketingAnalyticsRollups.length > 50000) {
      draft.marketingAnalyticsRollups = draft.marketingAnalyticsRollups.slice(-40000)
    }
    return draft
  })
}

export function queryMarketingRollups(store, user, { metric, from, to, dimensions = {} } = {}) {
  const scopeKey = user.organizationId || `user:${user.id}`
  const dimKey = JSON.stringify(dimensions)
  const hasDims = Object.keys(dimensions).length > 0

  return (store.marketingAnalyticsRollups || [])
    .filter((r) => {
      if (r.scopeKey !== scopeKey && r.organizationId !== user.organizationId) return false
      if (metric && r.metric !== metric) return false
      if (from && r.date < from) return false
      if (to && r.date > to) return false
      if (hasDims && r.dimKey !== dimKey) return false
      return true
    })
    .sort((a, b) => a.date.localeCompare(b.date))
}

export async function rollupFromMarketingEvent(event) {
  if (!event?.type) return
  const metric = event.type === 'open' ? 'opens' : event.type === 'click' ? 'clicks' : null
  if (!metric) return

  await recordMarketingRollup({
    organizationId: event.organizationId,
    createdByUserId: event.createdByUserId,
    date: event.createdAt,
    metric,
    dimensions: {
      campaignId: event.campaignId || null,
      abVariantId: event.abVariantId || null,
    },
  })

  await recordMarketingRollup({
    organizationId: event.organizationId,
    createdByUserId: event.createdByUserId,
    date: event.createdAt,
    metric: 'events_total',
    dimensions: { type: event.type },
  })
}

export function buildRollupTrend(store, user, { days = 30 } = {}) {
  const from = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
  const rows = queryMarketingRollups(store, user, { from })
  const byDate = new Map()

  for (const r of rows) {
    if (!byDate.has(r.date)) {
      byDate.set(r.date, { date: r.date, opens: 0, clicks: 0, events: 0 })
    }
    const b = byDate.get(r.date)
    if (r.metric === 'opens') b.opens += r.value
    if (r.metric === 'clicks') b.clicks += r.value
    if (r.metric === 'events_total') b.events += r.value
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
}
