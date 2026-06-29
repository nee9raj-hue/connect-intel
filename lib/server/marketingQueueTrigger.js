import { marketingSqlQueueActive } from './marketingEmailQueue.js'

function workerUrl() {
  const base =
    process.env.VERCEL_URL?.startsWith('http')
      ? process.env.VERCEL_URL
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : process.env.APP_URL || process.env.PUBLIC_APP_URL || 'https://connectintel.net'
  return `${base.replace(/\/$/, '')}/api/marketing/queue-worker`
}

function headers() {
  const secret = process.env.CRON_SECRET || process.env.MARKETING_CRON_SECRET
  const h = { 'Content-Type': 'application/json' }
  if (secret) h.Authorization = `Bearer ${secret}`
  return h
}

async function drainQueueInline(limit) {
  const n = Math.max(0, Math.min(50, Number(limit) || 0))
  if (!n) return
  const { processMarketingEmailQueue } = await import('./marketingEmailQueueWorker.js')
  await processMarketingEmailQueue({ limit: n, maxMs: 90_000 })
}

/** Fire-and-forget SQL queue drain (no Redis). Optionally processes first rows inline via waitUntil. */
export function triggerMarketingQueueWorker({ afterMs = 0, limit = 50, drainInline = 0 } = {}) {
  if (!marketingSqlQueueActive()) return

  const run = async () => {
    if (drainInline > 0) {
      try {
        await drainQueueInline(drainInline)
      } catch (err) {
        console.warn('triggerMarketingQueueWorker inline drain:', err?.message || err)
      }
    }
    void fetch(workerUrl(), {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ limit }),
    }).catch((err) => {
      console.warn('triggerMarketingQueueWorker failed:', err?.message || err)
    })
  }

  const schedule = () => {
    void run()
  }

  if (afterMs > 0) {
    setTimeout(schedule, afterMs)
    return
  }

  if (drainInline > 0) {
    void (async () => {
      try {
        const { waitUntil } = await import('@vercel/functions')
        waitUntil(run())
      } catch {
        schedule()
      }
    })()
    return
  }

  schedule()
}
