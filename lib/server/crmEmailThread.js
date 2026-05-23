import { createId, updateStore } from './store.js'
import { appendActivity, normalizeExtendedCrm } from './crmWorkflow.js'
import { getUserCrmGmail } from './crmUserGmail.js'
import { gmailScopesForKind, refreshAccessToken } from './gmailOAuth.js'

const GMAIL_READONLY_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly'

export function crmGmailHasReadScope(oauth) {
  const scopes = String(oauth?.scope || oauth?.scopes || '').toLowerCase()
  return scopes.includes('gmail.readonly') || scopes.includes('gmail.modify')
}

/** True when Gmail API read works (fixes legacy connects that omitted scope in DB). */
export async function probeGmailReadAccess(oauth) {
  if (!oauth?.refreshToken) return { ok: false, needsReconnect: true }

  let accessToken
  try {
    accessToken = await refreshAccessToken(oauth.refreshToken)
  } catch {
    return { ok: false, needsReconnect: true }
  }

  try {
    await fetchGmailJson(
      accessToken,
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=1'
    )
    return {
      ok: true,
      scope: oauth.scope || gmailScopesForKind('user_crm'),
    }
  } catch (e) {
    if (e.status === 403) return { ok: false, needsReconnect: true }
    return { ok: false, needsReconnect: false }
  }
}

export async function ensureCrmGmailReadScopeRecorded(userId, oauth) {
  if (!oauth || crmGmailHasReadScope(oauth)) return oauth
  const probe = await probeGmailReadAccess(oauth)
  if (!probe.ok) return oauth

  const scope = probe.scope || gmailScopesForKind('user_crm')
  await updateStore((draft) => {
    const user = draft.users.find((u) => u.id === userId)
    if (user?.crmGmailOAuth?.refreshToken) {
      user.crmGmailOAuth.scope = scope
    }
    return draft
  })
  return { ...oauth, scope }
}

export function buildEmailRecord({
  direction = 'outbound',
  subject,
  body,
  sentAt,
  fromMailbox,
  toEmail,
  gmailMessageId = null,
  threadId = null,
  inReplyTo = null,
  aiGenerated = false,
  provider = 'email',
  cc,
}) {
  const text = String(body || '').trim()
  return {
    id: createId('email'),
    direction: direction === 'inbound' ? 'inbound' : 'outbound',
    subject: String(subject || '').trim().slice(0, 500),
    body: text.slice(0, 12000),
    bodyPreview: text.slice(0, 280),
    sentAt: sentAt || new Date().toISOString(),
    fromMailbox: fromMailbox || null,
    toEmail: toEmail || null,
    cc: cc?.length ? cc : undefined,
    gmailMessageId: gmailMessageId || null,
    threadId: threadId || null,
    inReplyTo: inReplyTo || null,
    aiGenerated: Boolean(aiGenerated),
    provider,
  }
}

export function applyEmailToCrm(crm, emailRecord, { userId, userName } = {}) {
  let next = normalizeExtendedCrm(crm)
  const existingIds = new Set(
    (next.emails || []).map((e) => e.gmailMessageId).filter(Boolean)
  )
  if (emailRecord.gmailMessageId && existingIds.has(emailRecord.gmailMessageId)) {
    return next
  }

  next.emails = [emailRecord, ...(next.emails || [])]
    .sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt))
    .slice(0, 80)

  const at = emailRecord.sentAt
  next.lastCommunicationAt = at
  next.lastCommunicationType = 'email'
  next.lastCommunicationSummary = emailRecord.subject

  if (emailRecord.direction === 'outbound') {
    next.lastEmailSentAt = at
    if (next.status === 'new') next.status = 'contacted'
  } else {
    next.lastResponseAt = at
    next.responseReceived = true
    if (['new', 'contacted', 'follow_up'].includes(next.status)) {
      next.status = 'replied'
    }
  }

  const actType = emailRecord.direction === 'inbound' ? 'email_inbound' : 'email'
  const actSummary =
    emailRecord.direction === 'inbound'
      ? `Reply received: ${emailRecord.subject}`
      : `Email sent: ${emailRecord.subject}`

  next = appendActivity(next, {
    type: actType,
    summary: actSummary,
    userId,
    userName,
    meta: {
      emailId: emailRecord.id,
      gmailMessageId: emailRecord.gmailMessageId,
      direction: emailRecord.direction,
    },
  })

  return next
}

function headerValue(headers, name) {
  const row = (headers || []).find((h) => String(h.name || '').toLowerCase() === name.toLowerCase())
  return row?.value || ''
}

function extractBodyFromPayload(payload) {
  if (!payload) return ''
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64').toString('utf8')
  }
  for (const part of payload.parts || []) {
    const nested = extractBodyFromPayload(part)
    if (nested) return nested
  }
  if (payload.body?.data && payload.mimeType?.includes('text')) {
    return Buffer.from(payload.body.data, 'base64').toString('utf8')
  }
  return ''
}

function parseGmailMessage(msg, userEmail, leadEmail) {
  const headers = msg.payload?.headers || []
  const from = headerValue(headers, 'From')
  const to = headerValue(headers, 'To')
  const subject = headerValue(headers, 'Subject') || '(No subject)'
  const dateHeader = headerValue(headers, 'Date')
  const leadLower = String(leadEmail || '').toLowerCase()
  const fromLower = from.toLowerCase()
  const direction = fromLower.includes(leadLower) ? 'inbound' : 'outbound'
  let sentAt = dateHeader ? new Date(dateHeader).toISOString() : null
  if (!sentAt || Number.isNaN(new Date(sentAt).getTime())) {
    sentAt = msg.internalDate
      ? new Date(Number(msg.internalDate)).toISOString()
      : new Date().toISOString()
  }

  const body = extractBodyFromPayload(msg.payload) || msg.snippet || ''

  return buildEmailRecord({
    direction,
    subject,
    body,
    sentAt,
    fromMailbox: direction === 'inbound' ? from.slice(0, 120) : userEmail,
    toEmail: direction === 'inbound' ? userEmail : leadEmail,
    gmailMessageId: msg.id,
    threadId: msg.threadId || null,
    provider: 'gmail_sync',
  })
}

async function fetchGmailJson(accessToken, url) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const data = await response.json()
  if (!response.ok) {
    const err = new Error(data.error?.message || `Gmail API error (${response.status})`)
    err.status = response.status
    throw err
  }
  return data
}

export async function syncLeadEmailThreadFromGmail(user, lead) {
  const oauth = getUserCrmGmail(user)
  if (!oauth?.refreshToken) {
    return { ok: false, error: 'Connect work Gmail to sync replies.', needsGmailConnect: true }
  }

  const leadEmail = String(lead.email || '').trim()
  if (!leadEmail.includes('@')) {
    return { ok: false, error: 'Lead has no email address on file.' }
  }

  let accessToken
  try {
    accessToken = await refreshAccessToken(oauth.refreshToken)
  } catch (e) {
    return { ok: false, error: e.message || 'Gmail token expired — reconnect work Gmail.' }
  }

  const q = encodeURIComponent(`(from:${leadEmail} OR to:${leadEmail}) newer_than:90d`)
  let list
  try {
    list = await fetchGmailJson(
      accessToken,
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${q}&maxResults=25`
    )
  } catch (e) {
    if (e.status === 403) {
      return {
        ok: false,
        error:
          'Gmail read access not granted. Disconnect and reconnect work Gmail to enable reply sync.',
        needsReconnect: true,
      }
    }
    return { ok: false, error: e.message }
  }

  const messages = list.messages || []
  const imported = []

  for (const stub of messages.slice(0, 25)) {
    try {
      const full = await fetchGmailJson(
        accessToken,
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${stub.id}?format=full`
      )
      imported.push(parseGmailMessage(full, oauth.email, leadEmail))
    } catch {
      // skip single message failures
    }
  }

  return { ok: true, messages: imported, userEmail: oauth.email }
}

export function recordInboundReply(crm, { subject, body, fromEmail, userId, userName }) {
  const record = buildEmailRecord({
    direction: 'inbound',
    subject,
    body,
    fromMailbox: fromEmail,
    toEmail: null,
    provider: 'manual',
  })
  return applyEmailToCrm(crm, record, { userId, userName })
}

export function recordOutboundEmail(crm, payload, actor) {
  const record = buildEmailRecord({
    direction: 'outbound',
    ...payload,
  })
  return applyEmailToCrm(crm, record, actor)
}

export { GMAIL_READONLY_SCOPE }
