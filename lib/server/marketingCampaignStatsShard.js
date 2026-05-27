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
  if (delta.status) stats.status = delta.status
  if (delta.completedAt) stats.completedAt = delta.completedAt
  await writeCampaignStatsShard(campaignId, stats)
}

/** Merge lightweight stats shards into campaign rows for API responses. */
export async function mergeCampaignStatsShards(campaigns) {
  if (!campaigns?.length) return campaigns || []
  const names = campaigns.map((c) => campaignStatsShardName(c.id))
  const store = await readStore({ only: names })
  return campaigns.map((c) => {
    const shard = store[campaignStatsShardName(c.id)]
    if (!shard) return c
    return {
      ...c,
      status: shard.status || c.status,
      completedAt: shard.completedAt || c.completedAt,
      stats: { ...(c.stats || {}), ...shard },
    }
  })
}
