/** Per-provider throttle hints for worker re-enqueue delays (conservative defaults). */

export const PROVIDER_RATE_LIMITS = {
  gmail: { burstSize: 8, burstDelayMs: 4_000, maxPerMinute: 80 },
  google: { burstSize: 8, burstDelayMs: 4_000, maxPerMinute: 80 },
  resend: { burstSize: 20, burstDelayMs: 1_500, maxPerMinute: 500 },
  ses: { burstSize: 25, burstDelayMs: 1_000, maxPerMinute: 600 },
  sendgrid: { burstSize: 20, burstDelayMs: 1_500, maxPerMinute: 400 },
  postmark: { burstSize: 20, burstDelayMs: 1_500, maxPerMinute: 400 },
  microsoft: { burstSize: 8, burstDelayMs: 4_000, maxPerMinute: 60 },
  bulk: { burstSize: 8, burstDelayMs: 3_000, maxPerMinute: 100 },
  default: { burstSize: 8, burstDelayMs: 3_000, maxPerMinute: 100 },
}

export function rateLimitForProvider(provider) {
  const key = String(provider || 'default').toLowerCase()
  return PROVIDER_RATE_LIMITS[key] || PROVIDER_RATE_LIMITS.default
}

export function delayBeforeNextBurst(provider, { pending = 0 } = {}) {
  const limits = rateLimitForProvider(provider)
  if (pending <= 0) return 0
  return limits.burstDelayMs
}

export function estimateCompletionMs(provider, { remaining = 0 } = {}) {
  const limits = rateLimitForProvider(provider)
  if (remaining <= 0) return 0
  const bursts = Math.ceil(remaining / limits.burstSize)
  return bursts * (limits.burstDelayMs + 12_000)
}
