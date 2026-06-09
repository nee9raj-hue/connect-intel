#!/usr/bin/env node
/**
 * Connect Intel background workers (BullMQ).
 *
 * Run on Railway, Fly.io, or a VPS — not on Vercel serverless.
 *
 *   REDIS_URL=redis://... node workers/index.mjs
 *
 * Queues: email, automation, import, export, analytics, notification, search-index
 */

import { Worker } from 'bullmq'
import IORedis from 'ioredis'
import { pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const processorsUrl = pathToFileURL(join(ROOT, 'lib/server/queue/processors.js')).href

const { processQueueJob } = await import(processorsUrl)
const { QUEUE_NAMES } = await import(pathToFileURL(join(ROOT, 'lib/server/queue/names.js')).href)

const redisUrl = process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL
if (!redisUrl) {
  console.error('REDIS_URL is required to run workers')
  process.exit(1)
}

const connection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
})

const workerConfig = {
  connection,
  concurrency: Number(process.env.WORKER_CONCURRENCY || 2),
}

const queues = [
  { name: QUEUE_NAMES.EMAIL, concurrency: Number(process.env.EMAIL_WORKER_CONCURRENCY || 2) },
  { name: QUEUE_NAMES.AUTOMATION, concurrency: 3 },
  { name: QUEUE_NAMES.IMPORT, concurrency: 1 },
  { name: QUEUE_NAMES.EXPORT, concurrency: 1 },
  { name: QUEUE_NAMES.ANALYTICS, concurrency: 1 },
  { name: QUEUE_NAMES.NOTIFICATION, concurrency: 2 },
  { name: QUEUE_NAMES.SEARCH_INDEX, concurrency: 2 },
]

const workers = queues.map(({ name, concurrency }) => {
  const worker = new Worker(
    name,
    async (job) => processQueueJob(job),
    { ...workerConfig, concurrency }
  )
  worker.on('completed', (job) => {
    console.log(`[${name}] completed ${job.id} (${job.name})`)
  })
  worker.on('failed', async (job, err) => {
    console.error(`[${name}] failed ${job?.id}:`, err?.message || err)
    if (name === QUEUE_NAMES.EMAIL && job?.attemptsMade >= (job?.opts?.attempts || 3)) {
      try {
        const { setCampaignSendStatus } = await import(
          pathToFileURL(join(ROOT, 'lib/server/email/campaignLifecycle.js')).href
        )
        const campaignId = job?.data?.campaignId
        if (campaignId) {
          await setCampaignSendStatus(campaignId, 'failed', {
            lastError: String(err?.message || 'Worker failed').slice(0, 240),
          })
        }
        const { Queue } = await import('bullmq')
        const dlq = new Queue(QUEUE_NAMES.EMAIL_DLQ, { connection })
        await dlq.add(job.name || 'failed', job.data, { jobId: `dlq:${job.id}` })
      } catch (e) {
        console.error('[dlq] move failed:', e?.message || e)
      }
    }
  })
  return worker
})

console.log(`Connect Intel workers started (${workers.length} queues) — ${redisUrl.replace(/:[^:@]+@/, ':***@')}`)

async function shutdown() {
  await Promise.all(workers.map((w) => w.close()))
  await connection.quit()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
