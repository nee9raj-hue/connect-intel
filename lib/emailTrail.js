/**
 * Trail mail = messages tied to this lead's CRM email conversation — not the whole mailbox.
 *
 * Qualifies when ANY of:
 * 1. Gmail threadId matches a thread already stored on this lead's CRM emails.
 * 2. Gmail message id already stored on CRM (re-sync).
 * 3. In-Reply-To / References references a CRM-sent gmailMessageId.
 * 4. Seed (no CRM thread yet): outbound from the rep's work mailbox to the lead only.
 * 5. Delivery failure (NDR) mentioning the lead address (bounce detection).
 *
 * Does NOT qualify: unrelated inbox mail, CC-only presence, or any message to/from the
 * lead that is not in a known CRM thread (after at least one CRM outbound exists).
 */

function normalizeEmail(value) {
  const raw = String(value || '').toLowerCase()
  const match = raw.match(/[\w.+-]+@[\w.-]+\.\w+/g)
  return match ? match : []
}

export function parseAddressEmails(headerValue) {
  return normalizeEmail(headerValue)
}

export function messageInvolvesLead(headerValueFields, leadEmail) {
  const leadLower = String(leadEmail || '').trim().toLowerCase()
  if (!leadLower.includes('@')) return false
  for (const field of headerValueFields) {
    if (parseAddressEmails(field).includes(leadLower)) return true
  }
  return false
}

export function collectTrailThreadIds(crmEmails = []) {
  const ids = new Set()
  for (const row of crmEmails) {
    if (row?.threadId) ids.add(String(row.threadId))
  }
  return ids
}

export function collectTrailGmailMessageIds(crmEmails = []) {
  const ids = new Set()
  for (const row of crmEmails) {
    if (row?.gmailMessageId) ids.add(String(row.gmailMessageId))
  }
  return ids
}

function referencesKnownMessage(referencesHeader, knownIds) {
  const refs = String(referencesHeader || '')
  for (const id of knownIds) {
    if (id && refs.includes(id)) return true
  }
  return false
}

/**
 * @param {object} msg Gmail API message (metadata or full)
 * @param {object} ctx
 * @param {string} ctx.leadEmail
 * @param {string} ctx.userEmail Rep work mailbox
 * @param {Set<string>} ctx.trailThreadIds
 * @param {Set<string>} ctx.knownGmailIds
 * @param {boolean} ctx.hasCrmOutbound
 * @param {boolean} [ctx.isBounce]
 */
export function isTrailGmailMessage(msg, ctx) {
  const headers = msg.payload?.headers || msg.headers || []
  const header = (name) => {
    const row = headers.find((h) => String(h.name || '').toLowerCase() === name.toLowerCase())
    return row?.value || ''
  }

  const from = header('From')
  const to = header('To')
  const cc = header('Cc')
  const leadEmail = String(ctx.leadEmail || '').trim().toLowerCase()
  const userEmail = String(ctx.userEmail || '').trim().toLowerCase()

  if (ctx.isBounce) return true

  if (!messageInvolvesLead([from, to, cc], leadEmail)) return false

  const threadId = msg.threadId ? String(msg.threadId) : ''
  if (threadId && ctx.trailThreadIds?.has(threadId)) return true

  const gmailId = msg.id ? String(msg.id) : ''
  if (gmailId && ctx.knownGmailIds?.has(gmailId)) return true

  const inReplyTo = header('In-Reply-To')
  const references = header('References')
  if (referencesKnownMessage(inReplyTo, ctx.knownGmailIds) || referencesKnownMessage(references, ctx.knownGmailIds)) {
    return true
  }

  const fromEmails = parseAddressEmails(from)
  const toEmails = parseAddressEmails(to)

  if (!ctx.hasCrmOutbound) {
    return fromEmails.includes(userEmail) && toEmails.includes(leadEmail)
  }

  return false
}

export function crmHasOutboundToLead(crmEmails = []) {
  return (crmEmails || []).some((e) => e?.direction === 'outbound')
}
