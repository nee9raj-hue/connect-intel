import { createId, updateStore } from './store.js'
import { canApproveMarketingCampaign } from './marketingRoles.js'
import { getMarketingCampaign } from './marketingCampaigns.js'

export async function submitCampaignForApproval(store, user, campaignId) {
  const campaign = getMarketingCampaign(store, user, campaignId, { manage: true })
  if (!campaign) throw new Error('Campaign not found')
  if (campaign.status !== 'draft') throw new Error('Only draft campaigns can be submitted')
  if (campaign.approvalStatus === 'pending') throw new Error('Already pending approval')

  const now = new Date().toISOString()
  await updateStore((draft) => {
    const row = (draft.marketingCampaigns || []).find((c) => c.id === campaignId)
    if (row) {
      row.approvalStatus = 'pending'
      row.updatedAt = now
    }
    draft.marketingApprovals = draft.marketingApprovals || []
    draft.marketingApprovals.push({
      id: createId('mappr'),
      campaignId,
      organizationId: row?.organizationId || null,
      createdByUserId: row?.createdByUserId || user.id,
      status: 'pending',
      actorUserId: user.id,
      comment: null,
      createdAt: now,
    })
    return draft
  })

  return { ok: true, approvalStatus: 'pending' }
}

export async function reviewCampaignApproval(store, user, campaignId, { approve, comment } = {}) {
  if (!canApproveMarketingCampaign(user, store)) {
    throw new Error('You do not have permission to approve campaigns')
  }

  const campaign = getMarketingCampaign(store, user, campaignId)
  if (!campaign) throw new Error('Campaign not found')
  if (campaign.approvalStatus !== 'pending') {
    throw new Error('Campaign is not pending approval')
  }

  const now = new Date().toISOString()
  const status = approve ? 'approved' : 'rejected'

  await updateStore((draft) => {
    const row = (draft.marketingCampaigns || []).find((c) => c.id === campaignId)
    if (row) {
      row.approvalStatus = status
      row.updatedAt = now
    }
    draft.marketingApprovals = draft.marketingApprovals || []
    draft.marketingApprovals.push({
      id: createId('mappr'),
      campaignId,
      organizationId: row?.organizationId || null,
      createdByUserId: row?.createdByUserId || null,
      status,
      actorUserId: user.id,
      comment: comment ? String(comment).slice(0, 500) : null,
      createdAt: now,
    })
    return draft
  })

  return { ok: true, approvalStatus: status }
}

export function listPendingApprovals(store, user) {
  return (store.marketingCampaigns || []).filter(
    (c) =>
      c.organizationId === user.organizationId &&
      c.approvalStatus === 'pending' &&
      c.status === 'draft'
  )
}
