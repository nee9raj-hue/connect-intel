import { createId, updateStore } from './store.js'
import { filterMarketingCampaignsVisible, marketingScopeKey } from './marketingAccess.js'
import { writeCampaignSendShard } from './marketingCampaignSendShard.js'
import { bumpCampaignStatsShard } from './marketingCampaignStatsShard.js'
import {
  ENROLLMENT_CHUNK_SIZE,
  patchCampaignEnrollments,
  readCampaignEnrollments,
  writeCampaignEnrollments,
} from './marketingEnrollmentShard.js'

export async function createPipelineBulkCampaign(store, user, { subject, body, pipelineBulkOptions = null }) {
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

  await updateStore((draft) => {
    draft.marketingCampaigns = draft.marketingCampaigns || []
    draft.marketingCampaigns.push(campaign)
    return draft
  })
  await writeCampaignSendShard(store, user, campaign)
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
  const existing = await readCampaignEnrollments(campaignId)
  await writeCampaignEnrollments(campaignId, [...existing, ...enrollments])
}

export function findPipelineBulkCampaign(store, user, campaignId) {
  if (!campaignId) return null
  const visible = filterMarketingCampaignsVisible(store.marketingCampaigns || [], user)
  return visible.find((c) => c.id === campaignId && c.source === 'pipeline_bulk') || null
}

/** Accumulate send stats across batched API requests; finalize marks campaign completed. */
export async function bumpPipelineBulkCampaignStats(
  store,
  user,
  campaignId,
  { enrolled = 0, sent = 0, failed = 0 },
  { finalize = false } = {}
) {
  const now = new Date().toISOString()
  let updated = null

  await updateStore((draft) => {
    const campaign = (draft.marketingCampaigns || []).find((c) => c.id === campaignId)
    if (!campaign) return draft
    const prev = campaign.stats || { enrolled: 0, sent: 0, failed: 0, unsubscribed: 0 }
    campaign.stats = {
      enrolled: (prev.enrolled || 0) + enrolled,
      sent: (prev.sent || 0) + sent,
      failed: (prev.failed || 0) + failed,
      unsubscribed: prev.unsubscribed || 0,
    }
    campaign.updatedAt = now
    if (finalize) {
      campaign.status = 'completed'
      campaign.completedAt = now
    } else if (campaign.status === 'draft') {
      campaign.status = 'active'
    }
    updated = { ...campaign }
    return draft
  })

  if (!updated) return null

  await bumpCampaignStatsShard(campaignId, {
    enrolled: updated.stats.enrolled,
    sent: sent,
    failed: failed,
    status: finalize ? 'completed' : 'active',
    ...(finalize ? { completedAt: now } : {}),
  })

  if (finalize) {
    await writeCampaignSendShard(store, user, updated)
  }

  return updated
}

export async function completePipelineBulkCampaign(store, user, campaignId, stats) {
  return bumpPipelineBulkCampaignStats(store, user, campaignId, stats, { finalize: true })
}
