#!/usr/bin/env node
/**
 * Local / VPS loop for SQL marketing email queue (no Redis).
 *
 *   CRON_SECRET=... node scripts/marketing-queue-worker.mjs
 *   MARKETING_QUEUE_INTERVAL_MS=15000 node scripts/marketing-queue-worker.mjs
 */
import { processMarketingEmailQueue } from '../lib/server/marketingEmailQueueWorker.js'

const intervalMs = Math.max(5_000, Number(process.env.MARKETING_QUEUE_INTERVAL_MS) || 15_000)
const batchLimit = Math.min(200, Math.max(1, Number(process.env.MARKETING_QUEUE_LIMIT) || 50))

async function tick() {
  try {
    const result = await processMarketingEmailQueue({ limit: batchLimit, maxMs: 110_000 })
    if (result.claimed) {
      console.log(
        `[marketing-queue] claimed=${result.claimed} sent=${result.sent} failed=${result.failed} skipped=${result.skipped || 0}`
      )
    }
  } catch (error) {
    console.error('[marketing-queue] error:', error?.message || error)
  }
}

console.log(`Marketing SQL queue worker — every ${intervalMs}ms, limit ${batchLimit}`)
await tick()
setInterval(tick, intervalMs)
