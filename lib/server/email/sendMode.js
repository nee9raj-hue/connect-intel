import { isBackgroundEmailEnabled } from '../infra/config.js'

/** Inline fallback cap when Redis/worker is unavailable (solo-free / degraded). */
export const INLINE_EMAIL_MAX_RECIPIENTS = 25

export const EMAIL_SEND_MODE = {
  INLINE: 'inline',
  QUEUED: 'queued',
  BROWSER_DRAIN: 'browser_drain',
  SQL_QUEUE: 'sql_queue',
}

/**
 * When background email is enabled (Redis + worker), every send is queued — never inline.
 * Inline is only used as a degraded fallback when Redis is absent.
 * @param {number} recipientCount
 * @param {{ backgroundEmail?: boolean }} [options] — override for tests
 */
export function resolveEmailSendMode(recipientCount, options = {}) {
  const n = Math.max(0, Number(recipientCount) || 0)
  if (n <= 0) return EMAIL_SEND_MODE.INLINE
  const background =
    typeof options.backgroundEmail === 'boolean'
      ? options.backgroundEmail
      : isBackgroundEmailEnabled()
  if (background) return EMAIL_SEND_MODE.QUEUED
  if (n <= INLINE_EMAIL_MAX_RECIPIENTS) return EMAIL_SEND_MODE.INLINE
  return EMAIL_SEND_MODE.QUEUED
}

export function inlineSendBudgetMs(recipientCount) {
  const n = Math.max(1, Number(recipientCount) || 1)
  if (n <= 1) return 12_000
  if (n <= 5) return 30_000
  if (n <= 10) return 55_000
  return 90_000
}
