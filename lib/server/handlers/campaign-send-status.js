import { requireUser } from '../auth.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { getCampaignSendProgress } from '../email/campaignProgress.js'
import { findPipelineBulkCampaignByShard } from '../pipelineBulkCampaign.js'
import { getMarketingCampaign } from '../marketingCampaigns.js'
import { readStore } from '../store.js'
import { isBackgroundEmailEnabled } from '../infra/config.js'
import { drainPipelineBulkCampaign } from '../pipelineBulkQueue.js'
import { readWorkerHeartbeat } from '../infra/workerHealth.js'
import { isTerminalCampaignStatus } from '../email/campaignLifecycle.js'
import { EMAIL_SEND_MODE, resolveEmailSendMode } from '../email/sendMode.js'

// Prevent overlapping self-heal bursts across rapid polls (per warm instance).
const lastSelfHeal = new Map()
const SELF_HEAL_COOLDOWN_MS = 6000
// Only heal a campaign that has been idle for a bit, so we don't race the normal
// deferred send task that usually finishes within a few seconds.
const SELF_HEAL_STALE_MS = 12000

function hasPendingWork(progress) {
  const remaining = Number(progress?.remaining ?? 0)
  const queued = Number(progress?.queuedSends ?? progress?.queued ?? 0)
  const due = Number(progress?.pendingSends ?? progress?.sending ?? 0)
  return remaining > 0 || queued > 0 || due > 0
}

function isStale(progress) {
  const updated = progress?.updatedAt ? Date.parse(progress.updatedAt) : 0
  if (!updated) return true
  return Date.now() - updated > SELF_HEAL_STALE_MS
}

/**
 * Safety net: if a pipeline bulk campaign is stalled (no worker draining it and
 * recipients are still pending), push a small send burst inline on this poll so
 * the campaign never gets stuck forever when the deferred send task was dropped.
 */
async function maybeSelfHealPipelineBulk(user, campaignId, progress) {
  const status = String(progress?.sendStatus || '').toLowerCase()
  if (progress?.done || isTerminalCampaignStatus(status)) return false
  if (!hasPendingWork(progress) || !isStale(progress)) return false

  const now = Date.now()
  if (now - (lastSelfHeal.get(campaignId) || 0) < SELF_HEAL_COOLDOWN_MS) return false
  lastSelfHeal.set(campaignId, now)

  try {
    // Inline-mode campaigns (≤25 recipients) are never enqueued to the BullMQ worker,
    // so we must always drain them here. Only defer to an online worker for the larger
    // queued batches it actually processes.
    const inlineMode = resolveEmailSendMode(progress?.total || 0) === EMAIL_SEND_MODE.INLINE
    if (!inlineMode) {
      const worker = await readWorkerHeartbeat()
      if (worker?.ok) return false // an online worker will drain it
    }
    await drainPipelineBulkCampaign(user, campaignId, { limit: 10, maxMs: 20000 })
    return true
  } catch (err) {
    console.warn('campaign self-heal drain failed:', err?.message || err)
    return false
  }
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const user = await requireUser(req, res)
  if (!user) return

  const params = new URL(req.url || '', 'http://localhost').searchParams
  const campaignId = String(params.get('campaignId') || '').trim()
  if (!campaignId) {
    return sendJson(res, 400, { error: 'campaignId is required' })
  }

  const meta = await readStore({
    only: ['users', 'marketingEvents', 'organizations', 'organizationMemberships'],
  })
  const storeUser = (meta.users || []).find((u) => u.id === user.id) || user
  const pipeline = await findPipelineBulkCampaignByShard(storeUser, campaignId)
  let marketing = null
  if (!pipeline) {
    const withCampaigns = await readStore({
      only: ['marketingCampaigns', 'users', 'organizations', 'organizationMemberships'],
    })
    marketing = getMarketingCampaign(withCampaigns, storeUser, campaignId)
  }
  if (!pipeline && !marketing) {
    return sendJson(res, 404, { error: 'Campaign not found' })
  }

  let progress = await getCampaignSendProgress(campaignId, storeUser, meta)

  if (pipeline) {
    const healed = await maybeSelfHealPipelineBulk(storeUser, campaignId, progress)
    if (healed) {
      progress = (await getCampaignSendProgress(campaignId, storeUser, meta)) || progress
    }
  }

  return sendJson(res, 200, {
    ...progress,
    backgroundEmailEnabled: isBackgroundEmailEnabled(),
  })
}
