import { readStore } from '../store.js'
import { processCampaignSendBurst } from '../marketingCampaigns.js'
import { processBackgroundCampaignSendJob } from '../email/campaignSendOrchestrator.js'
import { buildTeamDashboard } from '../crmDashboard.js'
import { loadPipelineStoreContext } from '../pipelineShard.js'
import { cacheSet, dashboardCacheKey } from '../infra/cache.js'
import { syncPipelineLeadsToMeilisearch, syncOrgCrmToMeilisearch } from '../meilisearch/sync.js'
import { writeWorkerHeartbeat } from '../infra/workerHealth.js'
import { refreshPipelineIndexForShard } from '../dashboardMaterialized.js'
import { processDueAutomationRuns } from '../marketingAutomations.js'
import { JOB_TYPES } from './names.js'
import { incCounter } from '../infra/metrics.js'

async function resolveUser(userId) {
  const store = await readStore({ only: ['users'] })
  return (store.users || []).find((u) => u.id === userId) || null
}

export async function processQueueJob(job) {
  const type = job.name
  const payload = job.data || {}
  incCounter('connectintel_queue_jobs_total', { type, status: 'started' })

  try {
    let result
    switch (type) {
      case JOB_TYPES.EMAIL_CAMPAIGN_SEND:
      case JOB_TYPES.EMAIL_CAMPAIGN_BURST:
      case JOB_TYPES.EMAIL_PIPELINE_BULK: {
        const user = await resolveUser(payload.userId)
        if (!user) throw new Error('User not found for email job')
        result = await processBackgroundCampaignSendJob(user, payload.campaignId)
        break
      }
      case JOB_TYPES.AUTOMATION_RUN:
        result = await processDueAutomationRuns({ limit: payload.limit || 20 })
        break
      case JOB_TYPES.ANALYTICS_DASHBOARD: {
        const user = await resolveUser(payload.userId)
        if (!user) throw new Error('User not found for dashboard refresh')
        const { pipelineStore, visible } = await loadPipelineStoreContext(user, {
          mergeMonolithCrm: true,
        })
        const intelMeta = await readStore({
          only: ['searches', 'marketingCampaigns', 'users', 'organizationMemberships'],
        })
        const store = { ...pipelineStore, ...intelMeta, savedLeads: visible }
        const data = buildTeamDashboard(store, user, {
          period: payload.period || 'week',
          light: true,
        })
        const key = dashboardCacheKey(user, {
          period: payload.period || 'week',
          memberUserId: null,
          detailed: false,
        })
        await cacheSet(key, data, { ttlSeconds: 120 })
        result = { cached: true, key }
        break
      }
      case JOB_TYPES.ANALYTICS_PIPELINE_INDEX:
        result = await refreshPipelineIndexForShard(payload.shardName)
        break
      case JOB_TYPES.SEARCH_UPSERT_LEADS:
        result = await syncPipelineLeadsToMeilisearch(payload)
        break
      case JOB_TYPES.SEARCH_SYNC_ORG:
        result = await syncOrgCrmToMeilisearch(payload.organizationId)
        break
      default:
        throw new Error(`Unknown job type: ${type}`)
    }
    incCounter('connectintel_queue_jobs_total', { type, status: 'ok' })
    void writeWorkerHeartbeat({ lastJob: type })
    return result
  } catch (error) {
    incCounter('connectintel_queue_jobs_total', { type, status: 'error' })
    throw error
  }
}
