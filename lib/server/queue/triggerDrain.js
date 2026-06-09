import { isRedisEnabled } from '../infra/config.js'

/**
 * Event-driven queue processing — no Vercel cron required.
 * Fire-and-forget POST to workers/cron after enqueue (Hobby-safe).
 */
export function triggerQueueDrainNow() {
  if (!isRedisEnabled()) return

  const base =
    process.env.VERCEL_URL?.startsWith('http')
      ? process.env.VERCEL_URL
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : process.env.PUBLIC_APP_URL || 'https://connectintel.net'

  const secret = process.env.CRON_SECRET || process.env.MARKETING_CRON_SECRET
  const url = `${base.replace(/\/$/, '')}/api/workers/cron`
  const headers = { 'Content-Type': 'application/json' }
  if (secret) headers.Authorization = `Bearer ${secret}`

  void fetch(url, { method: 'POST', headers, body: '{}' }).catch((err) => {
    console.warn('triggerQueueDrainNow failed:', err?.message || err)
  })
}
