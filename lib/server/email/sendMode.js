/** Dual-mode email: inline for small batches, queue+worker for bulk. */
export const INLINE_EMAIL_MAX_RECIPIENTS = 10

export const EMAIL_SEND_MODE = {
  INLINE: 'inline',
  QUEUED: 'queued',
}

/** ≤10 recipients → inline; >10 → queue + worker. */
export function resolveEmailSendMode(recipientCount) {
  const n = Math.max(0, Number(recipientCount) || 0)
  if (n <= INLINE_EMAIL_MAX_RECIPIENTS) return EMAIL_SEND_MODE.INLINE
  return EMAIL_SEND_MODE.QUEUED
}

export function inlineSendBudgetMs(recipientCount) {
  const n = Math.max(1, Number(recipientCount) || 1)
  if (n <= 1) return 8_000
  if (n <= 3) return 12_000
  return 25_000
}
