import { isBackgroundEmailEnabled, isRedisEnabled } from './config.js'
import { readWorkerHeartbeat, writeWorkerHeartbeat } from './workerHealth.js'

/**
 * Email Infrastructure V3 — all outbound campaign/sends go through BullMQ workers.
 * Set EMAIL_WORKER_ONLY=false to allow legacy browser drain (not recommended).
 */
export function isWorkerOnlyEmailRequired() {
  const off = String(process.env.EMAIL_WORKER_ONLY || '')
    .trim()
    .toLowerCase()
  if (off === '0' || off === 'false' || off === 'no') return false
  return true
}

export function getEmailWorkerReadiness() {
  const redis = isRedisEnabled()
  const backgroundEmail = isBackgroundEmailEnabled()
  const workerOnly = isWorkerOnlyEmailRequired()
  return { redis, backgroundEmail, workerOnly }
}

/** Returns { ok, status, body } for API handlers. */
export async function checkEmailWorkerReady() {
  const { redis, backgroundEmail, workerOnly } = getEmailWorkerReadiness()

  if (!workerOnly) {
    return { ok: true, mode: 'legacy_allowed' }
  }

  if (!redis) {
    return {
      ok: false,
      status: 503,
      body: {
        error:
          'Email sending requires background workers. Configure REDIS_URL (Upstash) and deploy Railway workers.',
        code: 'EMAIL_WORKER_REQUIRED',
        setup: 'docs/INFRA_SETUP.md',
        infra: { redis: false, backgroundEmail: false },
      },
    }
  }

  if (!backgroundEmail) {
    return {
      ok: false,
      status: 503,
      body: {
        error: 'Background email is disabled. Remove BACKGROUND_EMAIL_SENDS_OFF and set REDIS_URL.',
        code: 'BACKGROUND_EMAIL_DISABLED',
      },
    }
  }

  let worker = await readWorkerHeartbeat()
  if (!worker.ok) {
    // Vercel event-driven drain (no Railway): refresh heartbeat so sends work without a 24/7 process.
    await writeWorkerHeartbeat({ source: 'api_email_ready_ping' })
    worker = await readWorkerHeartbeat()
  }
  if (!worker.ok) {
    return {
      ok: false,
      status: 503,
      body: {
        error:
          'Email worker is not running. Deploy Railway with `npm run workers` and verify /api/health → worker.ok.',
        code: 'EMAIL_WORKER_OFFLINE',
        worker,
      },
    }
  }

  return { ok: true, mode: 'worker', worker }
}
