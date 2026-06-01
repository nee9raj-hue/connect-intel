/**
 * Detect delivery failures / NDRs in synced mail (Gmail and error strings).
 * Provider-specific: Gmail labels vary; headers + mailer-daemon senders are most reliable.
 */

const BOUNCE_ERROR_RE =
  /bounce|bounced|undeliver|invalid recipient|mailbox unavailable|mailbox not found|550 |554 |550-5|user unknown|address rejected|does not exist|no such user|delivery status notification|mail delivery failed|delivery failure|permanent error|recipient address rejected/i

const BOUNCE_FROM_RE =
  /mailer-daemon|mail delivery subsystem|postmaster@|microsoftexchange|mailer_daemon|noreply.*bounce/i

const BOUNCE_SUBJECT_RE =
  /undeliverable|delivery status notification|delivery failure|mail delivery failed|returned mail|failure notice|delivery has failed|message not delivered|address not found/i

export function isBounceError(error) {
  return BOUNCE_ERROR_RE.test(String(error || ''))
}

export function isBounceFromAddress(fromHeader) {
  return BOUNCE_FROM_RE.test(String(fromHeader || '').toLowerCase())
}

export function isBounceSubject(subject) {
  return BOUNCE_SUBJECT_RE.test(String(subject || ''))
}

/**
 * @param {object} opts
 * @param {string} [opts.from]
 * @param {string} [opts.subject]
 * @param {string} [opts.snippet]
 * @param {string} [opts.body]
 * @param {string[]} [opts.labelIds] Gmail labelIds when available
 * @param {string} [opts.leadEmail] When set, body must mention lead or X-Failed-Recipients
 */
export function detectEmailBounce({
  from = '',
  subject = '',
  snippet = '',
  body = '',
  labelIds = [],
  leadEmail = '',
  failedRecipients = '',
} = {}) {
  const fromLower = String(from || '').toLowerCase()
  const subj = String(subject || '')
  const text = `${snippet}\n${body}\n${failedRecipients}`.toLowerCase()
  const leadLower = String(leadEmail || '').trim().toLowerCase()

  if (labelIds.includes('TRASH') && isBounceFromAddress(fromLower) && isBounceSubject(subj)) {
    return true
  }

  const fromLooksBounce = isBounceFromAddress(fromLower)
  const subjLooksBounce = isBounceSubject(subj)
  const textLooksBounce = isBounceError(text)

  if (fromLooksBounce && (subjLooksBounce || textLooksBounce)) {
    if (!leadLower) return true
    return text.includes(leadLower) || failedRecipients.toLowerCase().includes(leadLower)
  }

  if (subjLooksBounce && textLooksBounce) {
    if (!leadLower) return true
    return text.includes(leadLower)
  }

  return false
}

export function extractFailedRecipients(headers) {
  if (!Array.isArray(headers)) return ''
  const names = ['X-Failed-Recipients', 'X-Original-To', 'To']
  return names
    .map((name) => {
      const row = headers.find((h) => String(h.name || '').toLowerCase() === name.toLowerCase())
      return row?.value || ''
    })
    .filter(Boolean)
    .join(' ')
}
