import { readStore, writeStoreCollections } from './store.js'

export function isMarketingEnrollmentShardCollection(name) {
  return typeof name === 'string' && name.startsWith('menroll_')
}

export function enrollmentShardName(campaignId) {
  return `menroll_${campaignId}`
}

export async function readCampaignEnrollments(campaignId) {
  if (!campaignId) return []
  const shard = enrollmentShardName(campaignId)
  const store = await readStore({ only: [shard] })
  const fromShard = store[shard]
  if (Array.isArray(fromShard) && fromShard.length) return fromShard

  try {
    const legacy = await readStore({ only: ['marketingEnrollments'] })
    const migrated = (legacy.marketingEnrollments || []).filter((e) => e.campaignId === campaignId)
    if (migrated.length) {
      await writeCampaignEnrollments(campaignId, migrated)
      return migrated
    }
  } catch (error) {
    console.error('legacy marketingEnrollments migrate skipped:', error?.message || error)
  }
  return []
}

export async function writeCampaignEnrollments(campaignId, entries) {
  if (!campaignId) return
  const shard = enrollmentShardName(campaignId)
  const list = Array.isArray(entries) ? entries : []
  await writeStoreCollections({ [shard]: list }, [shard])
}

export async function countPendingCampaignEnrollments(campaignId) {
  const now = new Date().toISOString()
  return (await readCampaignEnrollments(campaignId)).filter(
    (e) => e.status === 'active' && e.nextSendAt && e.nextSendAt <= now
  ).length
}
