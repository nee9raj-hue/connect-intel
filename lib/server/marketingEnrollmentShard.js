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
  return Array.isArray(fromShard) ? fromShard : []
}

function slimEnrollmentRow(row) {
  if (!row || typeof row !== 'object') return row
  return {
    ...row,
    whatsappMessage: row.whatsappMessage ? String(row.whatsappMessage).slice(0, 480) : row.whatsappMessage,
    whatsappUrl: row.whatsappUrl ? String(row.whatsappUrl).slice(0, 500) : row.whatsappUrl,
    lastError: row.lastError ? String(row.lastError).slice(0, 240) : row.lastError,
  }
}

export async function writeCampaignEnrollments(campaignId, entries) {
  if (!campaignId) return
  const shard = enrollmentShardName(campaignId)
  const list = (Array.isArray(entries) ? entries : []).map(slimEnrollmentRow)
  await writeStoreCollections({ [shard]: list }, [shard])
}

export async function countPendingCampaignEnrollments(campaignId) {
  const now = new Date().toISOString()
  return (await readCampaignEnrollments(campaignId)).filter(
    (e) => e.status === 'active' && e.nextSendAt && e.nextSendAt <= now
  ).length
}
