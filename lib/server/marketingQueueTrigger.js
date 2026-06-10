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

/** Fire-and-forget SQL queue drain (no Redis). */
export function triggerMarketingQueueWorker({ afterMs = 0, limit = 50 } = {}) {
  if (!marketingSqlQueueActive()) return

  const run = () => {
    void fetch(workerUrl(), {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ limit }),
    }).catch((err) => {
      console.warn('triggerMarketingQueueWorker failed:', err?.message || err)
    })
  }

  if (afterMs > 0) setTimeout(run, afterMs)
  else run()
}
