import { updateStorePartial } from '../store.js'
import { bumpCampaignStatsShard, readCampaignStatsShard } from '../marketingCampaignStatsShard.js'

/** Canonical send lifecycle (Email Infrastructure V2). */
export const CAMPAIGN_SEND_STATUSES = [
  'draft',
  'validating',
  'queued',
  'preparing',
  'personalizing',
  'connecting',
  'sending',
  'delivered',
  'paused',
  'completed',
  'failed',
  'cancelled',
]

const TERMINAL = new Set(['completed', 'failed', 'cancelled', 'archived', 'stopped'])

export function isTerminalCampaignStatus(status) {
  return TERMINAL.has(String(status || '').toLowerCase())
}

/** Map legacy marketing status + send phase to V2 display status. */
export function resolveSendDisplayStatus(campaign, { pending = 0, due = 0 } = {}) {
  const explicit = campaign?.sendStatus || campaign?.stats?.sendStatus
  if (explicit && CAMPAIGN_SEND_STATUSES.includes(explicit)) return explicit

  const base = String(campaign?.status || 'draft').toLowerCase()
  if (base === 'draft' || base === 'scheduled') return base === 'scheduled' ? 'queued' : 'draft'
  if (isTerminalCampaignStatus(base)) {
    if (base === 'stopped') return 'cancelled'
    return base === 'archived' ? 'completed' : base
  }
  if (pending > 0 || due > 0) return due > 0 ? 'sending' : 'queued'
  if (base === 'active') return 'completed'
  return base
}

export async function setCampaignSendStatus(campaignId, sendStatus, patch = {}) {
  if (!campaignId || !sendStatus) return null

  const now = new Date().toISOString()
  const statsPatch = {
    sendStatus,
    sendStatusAt: now,
    ...patch,
  }

  if (sendStatus === 'sending' && !patch.status) statsPatch.status = 'active'
  if (sendStatus === 'completed') {
    statsPatch.status = 'completed'
    statsPatch.completedAt = patch.completedAt || now
  }
  if (sendStatus === 'failed') statsPatch.status = 'failed'
  if (sendStatus === 'cancelled') statsPatch.status = 'stopped'

  await bumpCampaignStatsShard(campaignId, statsPatch)

  await updateStorePartial(['marketingCampaigns'], (draft) => {
    const row = (draft.marketingCampaigns || []).find((c) => c.id === campaignId)
    if (!row) return draft
    row.sendStatus = sendStatus
    row.updatedAt = now
    if (statsPatch.status) row.status = statsPatch.status
    if (statsPatch.completedAt) row.completedAt = statsPatch.completedAt
    return draft
  })

  return readCampaignStatsShard(campaignId)
}
