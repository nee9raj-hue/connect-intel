/** Backoff schedule in minutes: 1, 5, 15, 30, 60 — then terminal fail. */
export const RETRY_BACKOFF_MINUTES = [1, 5, 15, 30, 60]
export const MAX_MESSAGE_RETRY_ATTEMPTS = RETRY_BACKOFF_MINUTES.length

const PERMANENT_PATTERNS = [
  /invalid_grant/i,
  /token has been expired or revoked/i,
  /invalid_rapt/i,
  /unsubscribed/i,
  /no_consent/i,
  /no email/i,
  /invalid.*email/i,
  /mailbox not found/i,
  /user blocked/i,
  /550[\s-]/i,
  /551[\s-]/i,
  /553[\s-]/i,
  /address rejected/i,
  /does not exist/i,
  /needsGmailConnect/i,
  /needsSetup/i,
]

const TRANSIENT_PATTERNS = [
  /429/,
  /rate.?limit/i,
  /timeout/i,
  /timed out/i,
  /econnreset/i,
  /etimedout/i,
  /503/,
  /502/,
  /500/,
  /temporarily unavailable/i,
  /try again/i,
  /service unavailable/i,
]

export function isPermanentSendError(error, { code } = {}) {
  if (code === 'no_consent' || code === 'needsGmailConnect') return true
  const text = String(error || '')
  return PERMANENT_PATTERNS.some((re) => re.test(text))
}

export function isTransientSendError(error) {
  const text = String(error || '')
  if (isPermanentSendError(text)) return false
  return TRANSIENT_PATTERNS.some((re) => re.test(text))
}

export function shouldRetrySendError(error, attempts = 0, { code } = {}) {
  if (attempts >= MAX_MESSAGE_RETRY_ATTEMPTS) return false
  if (isPermanentSendError(error, { code })) return false
  return isTransientSendError(error) || attempts < 1
}

export function nextRetryAtIso(attempts = 0) {
  const idx = Math.min(Math.max(0, attempts), RETRY_BACKOFF_MINUTES.length - 1)
  const minutes = RETRY_BACKOFF_MINUTES[idx]
  const d = new Date()
  d.setUTCMinutes(d.getUTCMinutes() + minutes)
  return d.toISOString()
}
