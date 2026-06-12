import { readStore, writeStoreCollections } from './store.js'

export function isMarketingStatsShardCollection(name) {
  return typeof name === 'string' && name.startsWith('mcstat_')
}

export function campaignStatsShardName(campaignId) {
  return `mcstat_${campaignId}`
}

export async function readCampaignStatsShard(campaignId) {
  if (!campaignId) return null
  const name = campaignStatsShardName(campaignId)
  const store = await readStore({ only: [name] })
  const row = store[name]
  return row && typeof row === 'object' && !Array.isArray(row) ? row : null
}

export async function writeCampaignStatsShard(campaignId, patch) {
  if (!campaignId) return
  const name = campaignStatsShardName(campaignId)
  const prev = (await readCampaignStatsShard(campaignId)) || {}
  const next = {
    campaignId,
    ...prev,
    ...patch,
    updatedAt: new Date().toISOString(),
  }
  await writeStoreCollections({ [name]: next }, [name])
}

export async function bumpCampaignStatsShard(campaignId, delta = {}) {
  const prev = (await readCampaignStatsShard(campaignId)) || { campaignId }
  const stats = { ...prev }
  if (delta.enrolled != null) stats.enrolled = delta.enrolled
  if (delta.sent != null) stats.sent = (stats.sent || 0) + delta.sent
  if (delta.failed != null) stats.failed = (stats.failed || 0) + delta.failed
  if (delta.unsubscribed != null) stats.unsubscribed = (stats.unsubscribed || 0) + delta.unsubscribed
  if (delta.testSent != null) stats.testSent = (stats.testSent || 0) + delta.testSent
  if (delta.lastTestSentAt) stats.lastTestSentAt = delta.lastTestSentAt
  if (delta.status) stats.status = delta.status
  if (delta.completedAt) stats.completedAt = delta.completedAt
  await writeCampaignStatsShard(campaignId, stats)
}

/** Infer list status when main row is stale but stats shard has send progress. */
export function resolveMergedCampaignStatus(campaign, shard) {
  const terminal = new Set(['completed', 'stopped', 'archived', 'failed'])
  const base = String(campaign?.status || 'draft').toLowerCase()
  if (terminal.has(base)) return base

  const shardStatus = shard?.status ? String(shard.status).toLowerCase() : ''
  if (shardStatus && !['draft'].includes(shardStatus)) return shardStatus

  const stats = { ...(campaign?.stats || {}), ...(shard || {}) }
  const sent = Math.max(stats.sent || 0, stats.recipientsSent || 0)
  const enrolled = stats.enrolled || 0
  const failed = stats.failed || 0
  const testSent = stats.testSent || campaign?.testSendCount || 0

  if (enrolled > 0 && sent + failed >= enrolled) return 'completed'
  if (sent > 0) return enrolled > 0 && sent < enrolled ? 'active' : 'completed'
  if (base === 'scheduled') return 'scheduled'
  if (base === 'draft' && testSent > 0) return 'draft'
  return base
}

/** Merge lightweight stats shards into campaign rows for API responses. */
export async function mergeCampaignStatsShards(campaigns) {
  if (!campaigns?.length) return campaigns || []
  const names = campaigns.map((c) => campaignStatsShardName(c.id))
  const store = await readStore({ only: names })
  return campaigns.map((c) => {
    const shard = store[campaignStatsShardName(c.id)]
    if (!shard) {
      const testSent = c.stats?.testSent || c.testSendCount || 0
      if (!testSent) return c
      return {
        ...c,
        lastTestSentAt: c.lastTestSentAt || c.stats?.lastTestSentAt || null,
        stats: { ...(c.stats || {}), testSent },
      }
    }
    const status = resolveMergedCampaignStatus(c, shard)
    const prev = c.stats || {}
    const analytics = c.analytics || {}
    const stats = { ...prev, ...shard }
    const pickMax = (key) => {
      const best = Math.max(prev[key] || 0, analytics[key] || 0, stats[key] || 0)
      if (best > (stats[key] || 0)) stats[key] = best
    }
    pickMax('uniqueOpens')
    pickMax('uniqueClicks')
    pickMax('opens')
    pickMax('clicks')
    if ((prev.openRate || analytics.openRate) && !stats.openRate) {
      stats.openRate = prev.openRate || analytics.openRate
    }
    if ((prev.clickRate || analytics.clickRate) && !stats.clickRate) {
      stats.clickRate = prev.clickRate || analytics.clickRate
    }
    return {
      ...c,
      status,
      completedAt: shard.completedAt || c.completedAt,
      lastTestSentAt: shard.lastTestSentAt || c.lastTestSentAt || stats.lastTestSentAt || null,
      testSendCount: Math.max(c.testSendCount || 0, stats.testSent || 0),
      stats,
    }
  })
}
