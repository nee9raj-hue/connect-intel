import { createId, updateStore } from './store.js'
import { appendActivity, normalizeExtendedCrm } from './crmWorkflow.js'
import { getUserCrmGmail } from './crmUserGmail.js'
import { gmailScopesForKind, refreshAccessToken } from './gmailOAuth.js'
import {
  collectTrailGmailMessageIds,
  collectTrailThreadIds,
  crmHasOutboundToLead,
  isTrailGmailMessage,
  messageInvolvesLead,
  parseAddressEmails,
} from '../emailTrail.js'
import {
  detectEmailBounce,
  extractFailedRecipients,
  isBounceFromAddress,
} from '../emailBounce.js'

const GMAIL_READONLY_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly'
const MAX_TRAIL_THREADS = 8
const MAX_MESSAGES_PER_THREAD = 30

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
  attachments,
  campaignId = null,
  campaignStep = null,
  isBounce = false,
}) {
  const text = String(body || '').trim()
  const attachmentList = attachments?.length
    ? attachments.map((file) => ({
        filename: file.filename,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
      }))
    : undefined
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
    attachments: attachmentList,
    gmailMessageId: gmailMessageId || null,
    threadId: threadId || null,
    inReplyTo: inReplyTo || null,
    aiGenerated: Boolean(aiGenerated),
    provider,
    campaignId: campaignId || null,
    campaignStep: campaignStep == null ? null : Number(campaignStep),
    isBounce: Boolean(isBounce),
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

  if (!emailRecord.isBounce) {
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
  }

  const actType = emailRecord.isBounce
    ? 'email_bounce'
    : emailRecord.direction === 'inbound'
      ? 'email_inbound'
      : 'email'
  const actSummary = emailRecord.isBounce
    ? `Email bounced: ${emailRecord.subject}`
    : emailRecord.direction === 'inbound'
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
      isBounce: Boolean(emailRecord.isBounce),
    },
  })

  return next
}

/** Mark lead email as bounced after NDR / delivery failure detection. */
export function applyLeadEmailBounce(entry, { detectedAt, reason } = {}) {
  if (!entry?.lead) return entry
  const at = detectedAt || new Date().toISOString()
  entry.lead = {
    ...entry.lead,
    emailBouncedAt: at,
    emailBounceReason: String(reason || 'Delivery failed').trim().slice(0, 240),
  }
  return entry
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

function parseGmailMessage(msg, userEmail, leadEmail, { isBounce = false } = {}) {
  const headers = msg.payload?.headers || []
  const from = headerValue(headers, 'From')
  const to = headerValue(headers, 'To')
  const subject = headerValue(headers, 'Subject') || '(No subject)'
  const dateHeader = headerValue(headers, 'Date')
  const leadLower = String(leadEmail || '').toLowerCase()
  const fromLower = from.toLowerCase()
  const direction =
    isBounce || isBounceFromAddress(fromLower) ? 'inbound' : fromLower.includes(leadLower) ? 'inbound' : 'outbound'
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
    provider: isBounce ? 'gmail_bounce' : 'gmail_sync',
    isBounce,
  })
}

function classifyGmailBounce(msg, leadEmail) {
  const headers = msg.payload?.headers || []
  const from = headerValue(headers, 'From')
  const subject = headerValue(headers, 'Subject')
  const body = extractBodyFromPayload(msg.payload) || msg.snippet || ''
  const failedRecipients = extractFailedRecipients(headers)
  return detectEmailBounce({
    from,
    subject,
    snippet: msg.snippet,
    body,
    labelIds: msg.labelIds || [],
    leadEmail,
    failedRecipients,
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

function trailContextForLead(crm, leadEmail, userEmail) {
  const crmEmails = crm?.emails || []
  return {
    leadEmail,
    userEmail,
    trailThreadIds: collectTrailThreadIds(crmEmails),
    knownGmailIds: collectTrailGmailMessageIds(crmEmails),
    hasCrmOutbound: crmHasOutboundToLead(crmEmails),
  }
}

function shouldImportMessage(msg, ctx) {
  const headers = msg.payload?.headers || []
  const isBounce = classifyGmailBounce(msg, ctx.leadEmail)
  if (isBounce) return { import: true, isBounce: true }
  return {
    import: isTrailGmailMessage(msg, { ...ctx, isBounce: false }),
    isBounce: false,
  }
}

async function fetchThreadMessages(accessToken, threadId) {
  const thread = await fetchGmailJson(
    accessToken,
    `https://gmail.googleapis.com/gmail/v1/users/me/threads/${encodeURIComponent(threadId)}?format=full`
  )
  return thread.messages || []
}

async function fetchMessageList(accessToken, query, maxResults = 15) {
  const list = await fetchGmailJson(
    accessToken,
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`
  )
  const stubs = list.messages || []
  const full = []
  for (const stub of stubs) {
    try {
      const msg = await fetchGmailJson(
        accessToken,
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${stub.id}?format=full`
      )
      full.push(msg)
    } catch {
      // skip single message failures
    }
  }
  return full
}

/**
 * Sync trail mail only: known CRM Gmail threads, seed outbound to lead, and NDRs.
 * Does not import unrelated inbox messages.
 */
export async function syncLeadEmailThreadFromGmail(user, lead, crm = null) {
  const oauth = getUserCrmGmail(user)
  if (!oauth?.refreshToken) {
    return { ok: false, error: 'Connect work Gmail to sync replies.', needsGmailConnect: true }
  }

  const leadEmail = String(lead.email || '').trim()
  if (!leadEmail.includes('@')) {
    return { ok: false, error: 'Lead has no email address on file.' }
  }

  const userEmail = String(oauth.email || user.email || '').trim().toLowerCase()
  const ctx = trailContextForLead(crm || lead.crm, leadEmail, userEmail)

  let accessToken
  try {
    accessToken = await refreshAccessToken(oauth.refreshToken)
  } catch (e) {
    return { ok: false, error: e.message || 'Gmail token expired — reconnect work Gmail.' }
  }

  const seenIds = new Set()
  const imported = []
  let bounceDetected = false

  const consider = (msg) => {
    if (!msg?.id || seenIds.has(msg.id)) return
    const { import: ok, isBounce } = shouldImportMessage(msg, ctx)
    if (!ok) return
    seenIds.add(msg.id)
    if (isBounce) bounceDetected = true
    imported.push(parseGmailMessage(msg, oauth.email, leadEmail, { isBounce }))
  }

  try {
    const threadIds = new Set(ctx.trailThreadIds)
    if (threadIds.size === 0 && ctx.knownGmailIds.size > 0) {
      for (const messageId of [...ctx.knownGmailIds].slice(0, 5)) {
        try {
          const meta = await fetchGmailJson(
            accessToken,
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=minimal`
          )
          if (meta.threadId) threadIds.add(String(meta.threadId))
        } catch {
          // ignore
        }
      }
    }

    const threadIdList = [...threadIds].slice(0, MAX_TRAIL_THREADS)
    if (threadIdList.length > 0) {
      for (const threadId of threadIdList) {
        const messages = await fetchThreadMessages(accessToken, threadId)
        for (const msg of messages.slice(-MAX_MESSAGES_PER_THREAD)) {
          consider(msg)
        }
      }
    } else if (!ctx.hasCrmOutbound) {
      const seedQuery = `to:${leadEmail} from:${userEmail} newer_than:90d`
      const seedMessages = await fetchMessageList(accessToken, seedQuery, 15)
      for (const msg of seedMessages) {
        consider(msg)
      }
    }

    const bounceQuery = `(from:mailer-daemon OR from:postmaster) "${leadEmail}" newer_than:90d`
    const bounceMessages = await fetchMessageList(accessToken, bounceQuery, 10)
    for (const msg of bounceMessages) {
      if (classifyGmailBounce(msg, leadEmail)) consider(msg)
    }
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

  return {
    ok: true,
    messages: imported,
    userEmail: oauth.email,
    bounceDetected,
    trailOnly: true,
    scannedThreads: ctx.trailThreadIds.size,
  }
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

export { GMAIL_READONLY_SCOPE, messageInvolvesLead, parseAddressEmails }
