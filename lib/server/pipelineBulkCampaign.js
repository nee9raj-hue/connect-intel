import { createId, updateStorePartial } from './store.js'
import { canViewMarketingCampaign, marketingScopeKey } from './marketingAccess.js'
import {
  readCampaignSendShard,
  writeCampaignSendShard,
} from './marketingCampaignSendShard.js'
import { bumpCampaignStatsShard, readCampaignStatsShard } from './marketingCampaignStatsShard.js'
import {
  ENROLLMENT_CHUNK_SIZE,
  patchCampaignEnrollments,
  appendCampaignEnrollments,
  writeCampaignEnrollments,
} from './marketingEnrollmentShard.js'

async function scheduleBackgroundTask(task) {
  try {
    const { waitUntil } = await import('@vercel/functions')
    waitUntil(Promise.resolve().then(task).catch((err) => {
      console.warn('pipeline bulk background task failed:', err?.message || err)
    }))
  } catch {
    void Promise.resolve().then(task).catch(() => {})
  }
}

/** Non-blocking index row for Marketing Hub lists — send path uses shards only. */
function scheduleMarketingCampaignIndexAppend(campaign) {
  if (!campaign?.id) return
  scheduleBackgroundTask(async () => {
    await updateStorePartial(['marketingCampaigns'], (draft) => {
      draft.marketingCampaigns = draft.marketingCampaigns || []
      const exists = draft.marketingCampaigns.some((c) => c.id === campaign.id)
      if (!exists) draft.marketingCampaigns.push(campaign)
      return draft
    })
  })
}

function scheduleMarketingCampaignIndexStatsSync(campaignId, nextStats, { finalize = false } = {}) {
  if (!campaignId) return
  const now = new Date().toISOString()
  scheduleBackgroundTask(async () => {
    await updateStorePartial(['marketingCampaigns'], (draft) => {
      const campaign = (draft.marketingCampaigns || []).find((c) => c.id === campaignId)
      if (!campaign) return draft
      campaign.stats = nextStats
      campaign.updatedAt = now
      if (finalize) {
        campaign.status = 'completed'
        campaign.completedAt = now
      }
      return draft
    })
  })
}

/** Fast create — no marketingCampaigns blob read/write on the hot path. */
export async function createPipelineBulkCampaign(user, { subject, body, pipelineBulkOptions = null }) {
  const campaignId = createId('mcamp')
  const now = new Date().toISOString()
  const campaign = {
    id: campaignId,
    ...marketingScopeKey(user),
    name: `Pipeline bulk · ${String(subject || 'Email').trim().slice(0, 48)}`,
    type: 'one_shot',
    channel: 'email',
    source: 'pipeline_bulk',
    subject: String(subject || '').trim(),
    body: String(body || '').trim(),
    steps: [{ subject: String(subject || '').trim(), body: String(body || '').trim(), delayDays: 0 }],
    status: 'active',
    stats: { enrolled: 0, sent: 0, failed: 0, unsubscribed: 0 },
    createdByUserId: user.id,
    createdAt: now,
    updatedAt: now,
    startedAt: now,
    completedAt: null,
    ...(pipelineBulkOptions ? { pipelineBulkOptions } : {}),
  }

  await Promise.all([
    writeCampaignSendShard({}, user, campaign),
    bumpCampaignStatsShard(campaignId, {
      status: 'active',
      enrolled: 0,
      sent: 0,
      failed: 0,
      unsubscribed: 0,
    }),
  ])

  scheduleMarketingCampaignIndexAppend(campaign)
  return campaign
}

export function buildPipelineBulkEnrollment({ scope, campaignId, leadId, email, index }) {
  const now = new Date().toISOString()
  return {
    id: createId('menroll'),
    ...scope,
    campaignId,
    leadId,
    contactEmail: String(email || '').trim().toLowerCase(),
    currentStep: 0,
    nextSendAt: now,
    status: 'active',
    sentCount: 0,
    lastSentAt: null,
    lastError: null,
    chunkIndex: Math.floor(index / ENROLLMENT_CHUNK_SIZE),
    createdAt: now,
    updatedAt: now,
  }
}

export async function markPipelineBulkEnrollmentSent(campaignId, enrollment, { error, sendResult } = {}) {
  const pending = error
    ? [{ kind: 'failed', enrollmentId: enrollment.id, chunkIndex: enrollment.chunkIndex, error }]
    : [
        {
          kind: 'sent',
          enrollmentId: enrollment.id,
          chunkIndex: enrollment.chunkIndex,
          result: sendResult || { sentAt: new Date().toISOString() },
          nextStep: 1,
          isLast: true,
        },
      ]

  await patchCampaignEnrollments(campaignId, pending, applyPipelineBulkEnrollmentWrites)
}

function applyPipelineBulkEnrollmentWrites(enrollments, pendingWrites) {
  for (const write of pendingWrites) {
    const row = enrollments.find((x) => x.id === write.enrollmentId)
    if (!row) continue
    if (write.kind === 'failed') {
      row.status = 'failed'
      row.nextSendAt = null
      row.lastError = String(write.error || 'Failed').slice(0, 240)
      row.updatedAt = new Date().toISOString()
    } else if (write.kind === 'sent') {
      row.sentCount = (row.sentCount || 0) + 1
      row.lastSentAt = write.result?.sentAt || new Date().toISOString()
      row.lastError = null
      row.status = 'completed'
      row.nextSendAt = null
      row.updatedAt = new Date().toISOString()
    }
  }
  return enrollments
}

export async function seedPipelineBulkEnrollments(campaignId, enrollments) {
  if (!enrollments.length) return
  await writeCampaignEnrollments(campaignId, enrollments)
}

export async function appendPipelineBulkEnrollments(campaignId, enrollments) {
  if (!enrollments.length) return
  await appendCampaignEnrollments(campaignId, enrollments)
}

/** @deprecated prefer findPipelineBulkCampaignByShard */
export function findPipelineBulkCampaign(store, user, campaignId) {
  if (!campaignId) return null
  const rows = store?.marketingCampaigns || []
  return rows.find((c) => c.id === campaignId && c.source === 'pipeline_bulk' && canViewMarketingCampaign(c, user)) || null
}

export async function findPipelineBulkCampaignByShard(user, campaignId) {
  const shard = await readCampaignSendShard(campaignId)
  if (!shard || shard.source !== 'pipeline_bulk') return null
  if (!canViewMarketingCampaign(shard, user)) return null
  return shard
}

/** Accumulate send stats — stats shard only on hot path. */
export async function bumpPipelineBulkCampaignStats(
  _store,
  user,
  campaignId,
  { enrolled = 0, sent = 0, failed = 0 },
  { finalize = false } = {}
) {
  const now = new Date().toISOString()
  const statsShard = (await readCampaignStatsShard(campaignId)) || {
    enrolled: 0,
    sent: 0,
    failed: 0,
    unsubscribed: 0,
  }
  const nextStats = {
    enrolled: (statsShard.enrolled || 0) + enrolled,
    sent: (statsShard.sent || 0) + sent,
    failed: (statsShard.failed || 0) + failed,
    unsubscribed: statsShard.unsubscribed || 0,
  }

  await bumpCampaignStatsShard(campaignId, {
    ...nextStats,
    status: finalize ? 'completed' : statsShard.status || 'active',
    ...(finalize ? { completedAt: now } : {}),
  })

  scheduleMarketingCampaignIndexStatsSync(campaignId, nextStats, { finalize })

  if (finalize) {
    const shard = await readCampaignSendShard(campaignId)
    if (shard) {
      await writeCampaignSendShard({}, user, {
        ...shard,
        status: 'completed',
        completedAt: now,
        updatedAt: now,
      })
    }
  }

  return {
    id: campaignId,
    stats: nextStats,
    status: finalize ? 'completed' : 'active',
    updatedAt: now,
  }
}

export async function completePipelineBulkCampaign(store, user, campaignId, stats) {
  return bumpPipelineBulkCampaignStats(store, user, campaignId, stats, { finalize: true })
}
