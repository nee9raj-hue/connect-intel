import { readStore, updateStorePartial } from './store.js'
import { duplicateMarketingCampaign } from './marketingCampaignReport.js'
import { buildOrgUserResponse } from './organizations.js'

function addRecurrence(iso, recurrence) {
  const d = new Date(iso || Date.now())
  if (recurrence === 'daily') d.setUTCDate(d.getUTCDate() + 1)
  else if (recurrence === 'weekly') d.setUTCDate(d.getUTCDate() + 7)
  else if (recurrence === 'monthly') d.setUTCMonth(d.getUTCMonth() + 1)
  else return null
  return d.toISOString()
}

/**
 * After a recurring campaign completes, schedule the next run.
 */
export async function scheduleNextRecurrence(campaignId) {
  const store = await readStore({ only: ['marketingCampaigns', 'users', 'organizations', 'organizationMemberships'] })
  const campaign = (store.marketingCampaigns || []).find((c) => c.id === campaignId)
  if (!campaign?.recurrence) return null

  const runs = (campaign.recurrenceRunCount || 0) + 1
  const maxRuns = campaign.recurrenceMaxRuns || 52
  if (runs >= maxRuns) return null

  const nextAt = addRecurrence(campaign.scheduledAt || campaign.completedAt || new Date().toISOString(), campaign.recurrence)
  if (!nextAt) return null

  const owner = store.users.find((u) => u.id === campaign.createdByUserId)
  if (!owner) return null
  const user = buildOrgUserResponse(owner, store)

  let nextCampaign = null
  await updateStorePartial(['marketingCampaigns'], (draft) => {
    const row = (draft.marketingCampaigns || []).find((c) => c.id === campaignId)
    if (row) {
      row.recurrenceRunCount = runs
      row.nextRecurrenceAt = nextAt
    }
    nextCampaign = duplicateMarketingCampaign(draft, user, campaignId)
    if (nextCampaign) {
      nextCampaign.name = `${campaign.name} (#${runs + 1})`.slice(0, 120)
      nextCampaign.status = 'scheduled'
      nextCampaign.scheduledAt = nextAt
      nextCampaign.sendMode = 'scheduled'
      nextCampaign.recurrence = campaign.recurrence
      nextCampaign.recurrenceParentId = campaign.recurrenceParentId || campaign.id
      nextCampaign.recurrenceRunIndex = runs
      nextCampaign.recurrenceRunCount = 0
      nextCampaign.recurrenceScheduled = false
      nextCampaign.segmentId = campaign.segmentId
      nextCampaign.startedAt = null
      nextCampaign.completedAt = null
      nextCampaign.stats = { enrolled: 0, sent: 0, failed: 0, unsubscribed: 0 }
      nextCampaign.updatedAt = new Date().toISOString()
    }
    return draft
  })

  return nextCampaign
}

export async function processCompletedRecurringCampaigns({ limit = 3 } = {}) {
  const store = await readStore({ only: ['marketingCampaigns'] })
  const done = (store.marketingCampaigns || [])
    .filter(
      (c) =>
        c.recurrence &&
        c.status === 'completed' &&
        !c.recurrenceScheduled &&
        (c.completedAt || c.updatedAt)
    )
    .slice(0, limit)

  let scheduled = 0
  for (const c of done) {
    const next = await scheduleNextRecurrence(c.id)
    if (next) {
      await updateStorePartial(['marketingCampaigns'], (draft) => {
        const row = (draft.marketingCampaigns || []).find((x) => x.id === c.id)
        if (row) row.recurrenceScheduled = true
        return draft
      })
      scheduled += 1
    }
  }
  return { scheduled }
}
