import { createId } from '../store.js'
import { isRedisEnabled } from '../infra/config.js'
import { JOB_TYPES, QUEUE_NAMES } from './names.js'
import { triggerQueueDrainNow } from './triggerDrain.js'

let queueClients = new Map()

async function getQueue(name) {
  if (!isRedisEnabled()) return null
  if (queueClients.has(name)) return queueClients.get(name)

  const { Queue } = await import('bullmq')
  const { default: IORedis } = await import('ioredis')
  const url = process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL
  if (!url) return null

  const connection = new IORedis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  })
  const queue = new Queue(name, {
    connection,
    defaultJobOptions: {
      removeOnComplete: 200,
      removeOnFail: 500,
      attempts: 3,
      backoff: { type: 'exponential', delay: 3000 },
    },
  })
  queueClients.set(name, queue)
  return queue
}

/**
 * Enqueue a background job. Returns job id or null when Redis is not configured.
 */
export async function enqueueJob(queueName, jobType, payload = {}, options = {}) {
  const queue = await getQueue(queueName)
  if (!queue) return null

  const job = await queue.add(jobType, payload, {
    jobId: options.jobId || `${jobType}:${createId('job')}`,
    delay: options.delayMs || 0,
    priority: options.priority,
  })
  if (!options.skipDrainTrigger) triggerQueueDrainNow()
  return job.id
}

export async function enqueueEmailCampaignBurst(userId, campaignId, options = {}) {
  return enqueueJob(
    QUEUE_NAMES.EMAIL,
    JOB_TYPES.EMAIL_CAMPAIGN_BURST,
    { userId, campaignId },
    { delayMs: options.delayMs || 0 }
  )
}

export async function enqueuePipelineBulkDrain(userId, campaignId) {
  return enqueueJob(QUEUE_NAMES.EMAIL, JOB_TYPES.EMAIL_PIPELINE_BULK, { userId, campaignId })
}

export async function enqueueDashboardRefresh(organizationId, userId, period = 'week') {
  return enqueueJob(QUEUE_NAMES.ANALYTICS, JOB_TYPES.ANALYTICS_DASHBOARD, {
    organizationId,
    userId,
    period,
  })
}

export async function enqueueSearchIndexLeads(organizationId, shardName, leadIds = null) {
  return enqueueJob(QUEUE_NAMES.SEARCH_INDEX, JOB_TYPES.SEARCH_UPSERT_LEADS, {
    organizationId,
    shardName,
    leadIds,
  })
}

export async function enqueueSearchSyncOrg(organizationId) {
  if (!organizationId) return null
  return enqueueJob(
    QUEUE_NAMES.SEARCH_INDEX,
    JOB_TYPES.SEARCH_SYNC_ORG,
    { organizationId },
    { jobId: `search-sync-org:${organizationId}`, skipDrainTrigger: true }
  )
}

export async function enqueueImportChunk(importJobId, chunkIndex) {
  return enqueueJob(QUEUE_NAMES.IMPORT, JOB_TYPES.IMPORT_CHUNK, { importJobId, chunkIndex })
}
