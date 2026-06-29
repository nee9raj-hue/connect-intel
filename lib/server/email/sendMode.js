/** Dual-mode email: inline for small batches, queue+worker for bulk. */
export const INLINE_EMAIL_MAX_RECIPIENTS = 25

export const EMAIL_SEND_MODE = {
  INLINE: 'inline',
  QUEUED: 'queued',
  BROWSER_DRAIN: 'browser_drain',
  SQL_QUEUE: 'sql_queue',
}

/** ≤25 recipients → inline; >25 → queue + worker. */
export function resolveEmailSendMode(recipientCount) {
  const n = Math.max(0, Number(recipientCount) || 0)
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
