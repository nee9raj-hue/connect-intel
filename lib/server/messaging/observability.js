import { createId } from '../store.js'

/** Structured log context for every messaging job. */
export function createMessagingContext(user, options = {}) {
  const jobId = String(options.jobId || options.campaignId || createId('mjob'))
  return {
    jobId,
    correlationId: String(options.correlationId || jobId),
    organizationId: user?.organizationId || null,
    userId: user?.id || null,
    source: String(options.source || 'messaging').slice(0, 64),
    campaignId: options.campaignId || null,
  }
}

export function messagingLog(ctx, event, extra = {}) {
  const payload = {
    event,
    jobId: ctx?.jobId,
    correlationId: ctx?.correlationId,
    organizationId: ctx?.organizationId,
    userId: ctx?.userId,
    source: ctx?.source,
    campaignId: ctx?.campaignId,
    ...extra,
  }
  console.info('[messaging]', JSON.stringify(payload))
}

export function messagingWarn(ctx, event, extra = {}) {
  messagingLog(ctx, event, { level: 'warn', ...extra })
}
