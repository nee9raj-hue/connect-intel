import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { processDueSequenceEnrollments } from '../crmSequences.js'
import { processDueEnrollments, processScheduledCampaigns } from '../marketingCampaigns.js'
import { processDueAutomationRuns } from '../marketingAutomations.js'
import { processRssFeeds } from '../marketingRss.js'
import { processCompletedRecurringCampaigns } from '../marketingRecurring.js'
import { readStore, updateStore } from '../store.js'
import { processAllCrmReminderEmails } from '../crmReminderEmails.js'
import { drainQueueJobsOnce } from '../queue/drainOnce.js'
import { refreshDynamicSegmentsForOrg } from '../marketingSegments.js'
import { refreshAudienceRecommendationsForOrg } from '../marketingAudienceCache.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'POST' && req.method !== 'GET') {
    return methodNotAllowed(res, ['GET', 'POST'])
  }

  const secret = process.env.CRON_SECRET || process.env.MARKETING_CRON_SECRET
  const authHeader = req.headers?.authorization || ''
  const querySecret = req.query?.secret
  const bodySecret = getBody(req)?.secret
  const provided = authHeader.replace(/^Bearer\s+/i, '') || querySecret || bodySecret

  if (secret && provided !== secret) {
    return sendJson(res, 401, { error: 'Unauthorized' })
  }

  const rss = await processRssFeeds({ limit: 5 })
  const recurring = await processCompletedRecurringCampaigns({ limit: 3 })
  const scheduled = await processScheduledCampaigns({ limit: 5 })
  const marketing = await processDueEnrollments({ limit: 50 })
  const automations = await processDueAutomationRuns({ limit: 20 })

  let crmSequences = { processed: 0 }
  await updateStore((draft) => {
    crmSequences = processDueSequenceEnrollments(draft, null)
    return draft
  })

  let crmReminders = { usersChecked: 0, morning: 0, imminent: 0 }
  try {
    crmReminders = await processAllCrmReminderEmails()
  } catch (err) {
    console.error('crm reminder cron failed:', err?.message || err)
  }

  let queueWorkers = { ok: true, mode: 'skipped' }
  try {
    queueWorkers = await drainQueueJobsOnce()
  } catch (err) {
    queueWorkers = { ok: false, error: err?.message || 'queue drain failed' }
  }

  let audienceMaintenance = { orgs: 0, segmentsRefreshed: 0, recommendationCaches: 0, errors: 0 }
  try {
    const meta = await readStore({ only: ['organizations'] })
    for (const org of meta.organizations || []) {
      if (!org?.id) continue
      try {
        const segmentsRefreshed = await refreshDynamicSegmentsForOrg(org.id)
        const recCount = await refreshAudienceRecommendationsForOrg(org.id)
        audienceMaintenance.orgs += 1
        audienceMaintenance.segmentsRefreshed += segmentsRefreshed
        if (recCount > 0) audienceMaintenance.recommendationCaches += 1
      } catch (err) {
        audienceMaintenance.errors += 1
        console.error('audience cron failed:', org.id, err?.message || err)
      }
    }
  } catch (err) {
    console.error('audience maintenance cron failed:', err?.message || err)
    audienceMaintenance.errors += 1
  }

  return sendJson(res, 200, {
    ok: true,
    rss,
    recurring,
    scheduled,
    marketing,
    automations,
    crmSequences,
    crmReminders,
    queueWorkers,
    audienceMaintenance,
  })
}
