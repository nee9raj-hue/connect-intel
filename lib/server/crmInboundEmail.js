import crypto from 'node:crypto'
import { getOAuthStateSecret } from './oauthSecret.js'
import { readStore } from './store.js'
import { updatePipelineStore, readPipelineShardEntries, pipelineOrgShardName, pipelineUserShardName, touchPipelineEntry } from './pipelineShard.js'
import { findPipelineEntryRaw } from './pipelineAccess.js'
import { getUserCrmGmail } from './crmUserGmail.js'
import { buildEmailRecord, applyEmailToCrm, applyLeadEmailBounce } from './crmEmailThread.js'
import { fetchResendReceivingEmail, sendResendEmail, isResendConfigured } from './resend.js'
import { isBounceFromAddress } from '../emailBounce.js'

const ADDRESS_PREFIX = 'sync-'
const SIG_LEN = 10

function inboundSecret() {
  return String(process.env.CRM_INBOUND_EMAIL_SECRET || getOAuthStateSecret() || 'crm-inbound-dev').trim()
}

/** Receiving domain — set MX to Resend (see docs/CRM_INBOUND_EMAIL.md). */
export function getCrmInboundEmailDomain() {
  return String(process.env.CRM_INBOUND_EMAIL_DOMAIN || 'inbound.connectintel.net')
    .trim()
    .toLowerCase()
}

export function getCrmInboundForwardFrom() {
  return (
    String(process.env.CRM_INBOUND_FORWARD_FROM || '').trim() ||
    'Connect Intel <sync@connectintel.net>'
  )
}

export function isCrmInboundEmailEnabled() {
  return isResendConfigured() && Boolean(getCrmInboundEmailDomain())
}

function sanitizeLeadIdForAddress(leadId) {
  return String(leadId || '')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 48)
}

function signLeadAddress(leadId) {
  return crypto.createHmac('sha256', inboundSecret()).update(String(leadId)).digest('base64url').slice(0, SIG_LEN)
}

/** Per-lead reply address — lead replies here; CRM logs + forwards to rep inbox. */
export function buildCrmInboundReplyAddress(leadId) {
  const id = sanitizeLeadIdForAddress(leadId)
  if (!id) return null
  const sig = signLeadAddress(id)
  return `${ADDRESS_PREFIX}${id}-${sig}@${getCrmInboundEmailDomain()}`
}

export function parseCrmInboundReplyAddress(rawAddress) {
  const raw = String(rawAddress || '').trim()
  const at = raw.lastIndexOf('@')
  if (at <= 0) return null
  const local = raw.slice(0, at)
  const domain = raw.slice(at + 1).toLowerCase()
  if (domain !== getCrmInboundEmailDomain()) return null
  if (!local.startsWith(ADDRESS_PREFIX)) return null

  const m = local.match(/^sync-(.+)-([A-Za-z0-9_-]{10})$/)
  if (!m) return null
  const leadId = m[1]
  const sig = m[2]
  if (!leadId || sig.length !== SIG_LEN) return null
  if (signLeadAddress(leadId) !== sig) return null
  return { leadId, domain }
}

export function extractInboundAddressFromRecipients(recipients) {
  const list = Array.isArray(recipients) ? recipients : [recipients]
  for (const raw of list) {
    const match = String(raw || '').match(/<?([^\s<>]+@[^\s<>]+)>?/i)
    const addr = (match?.[1] || raw || '').trim()
    const parsed = parseCrmInboundReplyAddress(addr)
    if (parsed) return parsed
  }
  return null
}

function headerMap(headers) {
  if (!headers) return {}
  if (Array.isArray(headers)) {
    const map = {}
    for (const row of headers) {
      const name = row?.name || row?.key
      if (name) map[String(name).toLowerCase()] = row.value ?? row.val ?? ''
    }
    return map
  }
  if (typeof headers === 'object') {
    const map = {}
    for (const [k, v] of Object.entries(headers)) map[String(k).toLowerCase()] = v
    return map
  }
  return {}
}

function parseFromName(from) {
  const raw = String(from || '')
  const m = raw.match(/^(.+?)\s*<[^>]+>/)
  return (m?.[1] || raw.split('@')[0] || 'Lead').replace(/"/g, '').trim()
}

function lastOutboundMessageId(crm) {
  const emails = (crm?.emails || []).filter((e) => e.direction !== 'inbound')
  for (let i = emails.length - 1; i >= 0; i -= 1) {
    const mid = emails[i]?.internetMessageId || emails[i]?.rfc822MessageId
    if (mid) return mid
  }
  return null
}

async function forwardReplyToRep({
  repMailbox,
  leadEmail,
  leadName,
  subject,
  html,
  text,
  inReplyTo,
  references,
}) {
  if (!repMailbox?.includes('@')) return { forwarded: false, reason: 'no_rep_mailbox' }

  const safeSubject = String(subject || 'Lead reply').trim().slice(0, 500)
  const bodyHtml =
    html ||
    `<pre style="font-family:system-ui,sans-serif;white-space:pre-wrap">${String(text || '').replace(/</g, '&lt;')}</pre>`
  const bodyText = text || String(html || '').replace(/<[^>]+>/g, ' ')

  const headers = {}
  if (inReplyTo) headers['In-Reply-To'] = inReplyTo
  if (references) headers.References = references
  headers['X-ConnectIntel-Forward'] = 'inbound-reply'

  const result = await sendResendEmail({
    from: getCrmInboundForwardFrom(),
    to: repMailbox,
    subject: safeSubject,
    html: bodyHtml,
    text: bodyText,
    replyTo: leadEmail,
    headers,
  })

  return { forwarded: Boolean(result.sent), ...result }
}

/**
 * Process one Resend inbound email: match lead, append CRM timeline, forward to rep.
 */
export async function ingestCrmInboundEmailEvent(eventData) {
  if (!isCrmInboundEmailEnabled()) {
    return { ok: false, reason: 'inbound_disabled' }
  }

  const emailId = eventData?.email_id
  const toList = Array.isArray(eventData?.to)
    ? eventData.to
    : eventData?.to
      ? [eventData.to]
      : []
  const fromRaw = eventData?.from || ''
  const subject = eventData?.subject || ''

  const parsed = extractInboundAddressFromRecipients(toList)
  if (!parsed) {
    return { ok: false, reason: 'unknown_recipient' }
  }

  const fromLower = String(fromRaw).toLowerCase()
  if (isBounceFromAddress(fromLower)) {
    return ingestCrmInboundBounce({ leadId: parsed.leadId, fromRaw, subject, emailId })
  }

  const received = await fetchResendReceivingEmail(emailId)
  if (!received.ok) {
    return { ok: false, reason: 'fetch_failed', error: received.error }
  }

  const email = received.email || {}
  const hdrs = headerMap(email.headers)
  const fromEmail = parseAddressEmail(fromRaw)
  const bodyText = String(email.text || '').trim()
  const bodyHtml = String(email.html || '').trim()
  const body = bodyText || bodyHtml.replace(/<[^>]+>/g, ' ').trim()
  const sentAt = email.created_at || eventData?.created_at || new Date().toISOString()
  const messageId = hdrs['message-id'] || null
  const inReplyTo = hdrs['in-reply-to'] || null
  const references = hdrs.references || null

  const located = await findLeadEntryForInbound(parsed.leadId)
  if (!located) {
    return { ok: false, reason: 'lead_not_found', leadId: parsed.leadId }
  }
  const matchedUser = located.user
  const matchedEntry = located.entry

  const lead = matchedEntry.lead || matchedEntry
  const repMailbox = getUserCrmGmail(matchedUser)?.email || matchedUser.email

  const duplicate = (matchedEntry.crm?.emails || []).some(
    (em) => em.resendInboundId === emailId || (messageId && em.internetMessageId === messageId)
  )
  if (duplicate) {
    return { ok: true, duplicate: true, leadId: parsed.leadId }
  }

  const record = buildEmailRecord({
    direction: 'inbound',
    subject,
    body,
    sentAt,
    fromMailbox: fromRaw.slice(0, 120),
    toEmail: repMailbox,
    provider: 'inbound_sync',
    inReplyTo,
    internetMessageId: messageId,
    resendInboundId: emailId,
  })

  await updatePipelineStore(matchedUser, async (draft) => {
    const row = findPipelineEntryRaw(draft, parsed.leadId)
    if (!row) return draft
    row.crm = applyEmailToCrm(row.crm, record, {
      userId: matchedUser.id,
      userName: matchedUser.name,
    })
    touchPipelineEntry(row)
    return draft
  })

  const outboundMid = lastOutboundMessageId(matchedEntry.crm)
  const forward = await forwardReplyToRep({
    repMailbox,
    leadEmail: fromEmail || lead.email,
    leadName: parseFromName(fromRaw),
    subject,
    html: bodyHtml || undefined,
    text: bodyText || body,
    inReplyTo: inReplyTo || outboundMid,
    references: references || outboundMid,
  })

  return {
    ok: true,
    leadId: parsed.leadId,
    logged: true,
    forwarded: forward.forwarded,
    repMailbox,
  }
}

async function ingestCrmInboundBounce({ leadId, fromRaw, subject, emailId }) {
  const located = await findLeadEntryForInbound(leadId)
  if (!located) return { ok: false, reason: 'lead_not_found', leadId }
  const matchedUser = located.user

  await updatePipelineStore(matchedUser, async (draft) => {
    const row = findPipelineEntryRaw(draft, leadId)
    if (!row) return draft
    applyLeadEmailBounce(row, { reason: subject || 'Delivery failure', detectedAt: new Date().toISOString() })
    const bounceRecord = buildEmailRecord({
      direction: 'inbound',
      subject: subject || 'Delivery failure',
      body: `Bounce detected from ${fromRaw}`,
      sentAt: new Date().toISOString(),
      fromMailbox: fromRaw.slice(0, 120),
      provider: 'inbound_bounce',
      isBounce: true,
      resendInboundId: emailId,
    })
    row.crm = applyEmailToCrm(row.crm, bounceRecord, {
      userId: matchedUser.id,
      userName: matchedUser.name,
    })
    return draft
  })

  return { ok: true, bounce: true, leadId, emailId }
}

function parseAddressEmail(raw) {
  const m = String(raw || '').match(/<?([^\s<>]+@[^\s<>]+)>?/i)
  return m?.[1]?.trim().toLowerCase() || null
}

function entryLeadId(entry) {
  return String(entry?.lead?.id || entry?.id || '')
}

function resolveUserForPipelineEntry(meta, entry) {
  const userId = entry.assignedToUserId || entry.savedByUserId || entry.userId
  let user = (meta.users || []).find((u) => u.id === userId)
  if (!user && entry.organizationId) {
    user = (meta.users || []).find(
      (u) =>
        u.organizationId === entry.organizationId &&
        (u.isOrgAdmin || u.orgRole === 'org_admin')
    )
  }
  if (!user && entry.organizationId) {
    user = (meta.users || []).find((u) => u.organizationId === entry.organizationId)
  }
  return user || null
}

async function findLeadEntryForInbound(leadId) {
  const meta = await readStore({
    only: ['users', 'organizations', 'organizationMemberships', 'savedLeads'],
  })
  const target = String(leadId)

  for (const org of meta.organizations || []) {
    if (!org?.id) continue
    const entries = (await readPipelineShardEntries(pipelineOrgShardName(org.id))) || []
    const entry = entries.find((row) => entryLeadId(row) === target)
    if (!entry) continue
    const user = resolveUserForPipelineEntry(meta, entry)
    if (user) return { entry, user }
  }

  for (const entry of meta.savedLeads || []) {
    if (entryLeadId(entry) !== target) continue
    const user = resolveUserForPipelineEntry(meta, entry)
    if (user) return { entry, user }
  }

  for (const user of meta.users || []) {
    if (user.organizationId) continue
    const entries = (await readPipelineShardEntries(pipelineUserShardName(user.id))) || []
    const entry = entries.find((row) => entryLeadId(row) === target)
    if (!entry) continue
    return { entry, user }
  }

  return null
}

/** Reply-To for outbound CRM sends — lead replies hit inbound; we forward to rep. */
export function crmOutboundReplyTo(leadId) {
  if (!isCrmInboundEmailEnabled()) return null
  return buildCrmInboundReplyAddress(leadId)
}

/** Generate RFC 5322 Message-ID for outbound threading. */
export function createCrmOutboundMessageId() {
  const id = crypto.randomBytes(12).toString('hex')
  return `<ci-${id}@connectintel.net>`
}
