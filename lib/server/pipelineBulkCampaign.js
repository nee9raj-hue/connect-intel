import { createId, updateStore } from './store.js'
import { marketingScopeKey } from './marketingAccess.js'
import { writeCampaignSendShard } from './marketingCampaignSendShard.js'
import { writeCampaignStatsShard } from './marketingCampaignStatsShard.js'
import {
  ENROLLMENT_CHUNK_SIZE,
  patchCampaignEnrollments,
  writeCampaignEnrollments,
} from './marketingEnrollmentShard.js'

export async function createPipelineBulkCampaign(store, user, { subject, body }) {
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

export async function completePipelineBulkCampaign(campaignId, { enrolled, sent, failed }) {
  const now = new Date().toISOString()
  await updateStore((draft) => {
    const campaign = (draft.marketingCampaigns || []).find((c) => c.id === campaignId)
    if (campaign) {
      campaign.status = 'completed'
      campaign.completedAt = now
      campaign.updatedAt = now
      campaign.stats = {
        enrolled,
        sent,
        failed,
        unsubscribed: campaign.stats?.unsubscribed || 0,
      }
    }
    return draft
  })
  await writeCampaignStatsShard(campaignId, {
    status: 'completed',
    enrolled,
    sent,
    failed,
    completedAt: now,
  })
}
