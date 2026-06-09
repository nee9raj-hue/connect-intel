import { isRedisEnabled } from '../infra/config.js'

/**
 * Event-driven queue processing — no Vercel cron required.
 * Fire-and-forget POST to workers/cron after enqueue (Hobby-safe).
 */
function drainUrl() {
  const base =
    process.env.VERCEL_URL?.startsWith('http')
      ? process.env.VERCEL_URL
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : process.env.PUBLIC_APP_URL || 'https://connectintel.net'
  return `${base.replace(/\/$/, '')}/api/workers/cron`
}

function drainHeaders() {
  const secret = process.env.CRON_SECRET || process.env.MARKETING_CRON_SECRET
  const headers = { 'Content-Type': 'application/json' }
  if (secret) headers.Authorization = `Bearer ${secret}`
  return headers
}

/** Fire-and-forget POST to workers/cron (Hobby-safe; no Railway required). */
export function triggerQueueDrainNow({ afterMs = 0 } = {}) {
  if (!isRedisEnabled()) return

  const run = () => {
    void fetch(drainUrl(), { method: 'POST', headers: drainHeaders(), body: '{}' }).catch((err) => {
      console.warn('triggerQueueDrainNow failed:', err?.message || err)
    })
  }

  if (afterMs > 0) {
    setTimeout(run, afterMs)
  } else {
    run()
  }
}
