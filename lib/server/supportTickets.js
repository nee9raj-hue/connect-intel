import crypto from 'node:crypto'
import { createId } from './store.js'
import { buildAssistantUserContext } from './assistantContext.js'
import { buildOrgUserResponse } from './organizations.js'
import { getAdminEmails } from './config.js'
import { sendResendEmail } from './resend.js'
import { recordAdminAudit } from './platformSupport.js'
import { formatEmailAddress } from './email.js'

export const SUPPORT_SLA_HOURS = 48
export const SUPPORT_SLA_LABEL = '24–48 business hours'

export const TICKET_STATUSES = ['open', 'in_progress', 'waiting_customer', 'resolved', 'closed']

const ESCALATION_SIGNALS = [
  { pattern: /\b(bug|broken|error|failed|not working|doesn't work|doesnt work|crash|stuck|freeze)\b/i, category: 'technical', weight: 3 },
  { pattern: /\b(401|403|500|oauth|unauthorized|permission denied|sync failed)\b/i, category: 'technical', weight: 4 },
  { pattern: /\b(can't|cannot|unable to|won't let me|impossible to)\b/i, category: 'technical', weight: 2 },
  { pattern: /\b(billing|payment|refund|charged|invoice|credits? wrong|money)\b/i, category: 'billing', weight: 3 },
  { pattern: /\b(import failed|duplicate|missing leads?|wrong data|lost data|csv error)\b/i, category: 'data', weight: 3 },
  { pattern: /\b(gmail|email not send|email not sending|smtp|inbox)\b/i, category: 'technical', weight: 2 },
  { pattern: /\b(complaint|urgent|escalate|speak to human|real person|support team|help me fix)\b/i, category: 'other', weight: 3 },
  { pattern: /\b(account locked|can't login|cannot login|sign in problem)\b/i, category: 'access', weight: 3 },
]

function supportInbox() {
  const configured = String(process.env.SUPPORT_EMAIL || '').trim().toLowerCase()
  if (configured) return configured
  const admins = getAdminEmails()
  return admins[0] || 'invite@connectintel.net'
}

export function generateTicketNumber() {
  const d = new Date()
  const ymd =
    String(d.getUTCFullYear()).slice(2) +
    String(d.getUTCMonth() + 1).padStart(2, '0') +
    String(d.getUTCDate()).padStart(2, '0')
  const rand = crypto.randomBytes(2).toString('hex').toUpperCase()
  return `CI-${ymd}-${rand}`
}

export function analyzeCustomerConcern(text) {
  const message = String(text || '')
  let score = 0
  let category = 'other'
  let reason = null

  let bestWeight = 0
  for (const signal of ESCALATION_SIGNALS) {
    if (signal.pattern.test(message)) {
      score += signal.weight
      if (signal.weight >= bestWeight) {
        bestWeight = signal.weight
        category = signal.category
        reason = message.slice(0, 120)
      }
    }
  }

  return {
    shouldOfferEscalation: score >= 3,
    score,
    category,
    reason,
    suggestedSubject: inferSubject(message, category),
  }
}

function inferSubject(message, category) {
  const line = String(message || '')
    .trim()
    .split('\n')[0]
    .slice(0, 100)
  if (line.length >= 8) return line
  const labels = {
    technical: 'Technical issue',
    billing: 'Billing or credits',
    data: 'Import or data issue',
    access: 'Account access',
    other: 'Support request',
  }
  return labels[category] || 'Support request'
}

function slaDueAt(fromIso = new Date().toISOString()) {
  return new Date(new Date(fromIso).getTime() + SUPPORT_SLA_HOURS * 60 * 60 * 1000).toISOString()
}

function normalizeLegacyTicket(old) {
  return {
    id: old.id,
    ticketNumber: old.ticketNumber || generateTicketNumber(),
    userId: old.userId,
    userEmail: old.userEmail,
    userName: old.userName || null,
    organizationId: old.organizationId || null,
    organizationName: old.context?.organizationName || null,
    subject: old.subject || old.summary?.slice(0, 120) || 'Support request',
    description: old.summary || old.description || '',
    category: old.category || 'other',
    priority: old.priority || 'normal',
    status: old.status || 'open',
    source: old.source || 'assistant',
    threadId: old.threadId || null,
    transcript: old.transcript || [],
    context: old.context || {},
    slaDueAt: old.slaDueAt || slaDueAt(old.createdAt),
    createdAt: old.createdAt,
    updatedAt: old.updatedAt || old.createdAt,
    resolvedAt: old.resolvedAt || null,
    updates: old.updates || [],
  }
}

export function getSupportTicketsStore(store) {
  store.supportTickets = store.supportTickets || []
  const legacy = store.assistantSupportTickets || []
  if (legacy.length) {
    for (const old of legacy) {
      if (!store.supportTickets.some((t) => t.id === old.id)) {
        store.supportTickets.push(normalizeLegacyTicket(old))
      }
    }
    store.assistantSupportTickets = []
  }
  return store.supportTickets
}

export function customerTicketConfirmation(ticket, userEmail) {
  return (
    `Your concern is logged as ticket **${ticket.ticketNumber}**.\n\n` +
    `Our support team will review it and respond within **${SUPPORT_SLA_LABEL}** at **${userEmail}**. ` +
    `Please keep this ticket number for reference.\n\n` +
    `We do not offer live phone support — email and in-app updates are how we resolve issues.`
  )
}

export function createSupportTicket(
  store,
  user,
  { subject, description, category = 'other', priority = 'normal', source = 'assistant', threadId = null, transcript = null }
) {
  const tickets = getSupportTicketsStore(store)
  const profile = buildOrgUserResponse(store.users.find((u) => u.id === user.id) || user, store)
  const ctx = buildAssistantUserContext(store, user)
  const recent = transcript || []

  const desc = String(description || subject || '').trim().slice(0, 8000)
  const subj = String(subject || inferSubject(desc, category)).trim().slice(0, 200)

  const ticket = {
    id: createId('tkt'),
    ticketNumber: generateTicketNumber(),
    userId: user.id,
    userEmail: user.email,
    userName: profile.name || user.name || null,
    organizationId: user.organizationId || null,
    organizationName: profile.organizationName || null,
    subject: subj,
    description: desc,
    category,
    priority,
    status: 'open',
    source,
    threadId: threadId || null,
    transcript: recent,
    context: {
      pipelineLeadCount: ctx.pipelineLeadCount,
      gmailConnected: ctx.gmailConnected,
      prospectCredits: ctx.prospectCredits,
      onboardingComplete: ctx.onboardingComplete,
    },
    slaDueAt: slaDueAt(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    resolvedAt: null,
    updates: [
      {
        id: createId('tupd'),
        authorType: 'customer',
        authorEmail: user.email,
        message: desc,
        visibleToCustomer: true,
        createdAt: new Date().toISOString(),
      },
    ],
  }

  tickets.push(ticket)
  store.supportTickets = tickets.slice(-2000)

  recordAdminAudit(store, {
    actorUserId: user.id,
    actorEmail: user.email,
    action: 'support_ticket_created',
    targetType: 'support_ticket',
    targetId: ticket.id,
    detail: { ticketNumber: ticket.ticketNumber, subject: subj.slice(0, 120) },
  })

  return ticket
}

export function listTicketsForUser(store, userId, { limit = 20 } = {}) {
  return getSupportTicketsStore(store)
    .filter((t) => t.userId === userId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit)
    .map(publicTicketSummary)
}

export function listTicketsForAdmin(store, { status, q, limit = 80 } = {}) {
  const needle = String(q || '').trim().toLowerCase()
  let rows = getSupportTicketsStore(store).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  if (status && status !== 'all') {
    if (status === 'active') {
      rows = rows.filter((t) => t.status === 'open' || t.status === 'in_progress' || t.status === 'waiting_customer')
    } else {
      rows = rows.filter((t) => t.status === status)
    }
  }

  if (needle) {
    rows = rows.filter(
      (t) =>
        t.ticketNumber?.toLowerCase().includes(needle) ||
        t.userEmail?.toLowerCase().includes(needle) ||
        t.subject?.toLowerCase().includes(needle) ||
        t.userName?.toLowerCase().includes(needle)
    )
  }

  return rows.slice(0, limit).map(adminTicketSummary)
}

export function getTicketById(store, ticketId) {
  return getSupportTicketsStore(store).find((t) => t.id === ticketId || t.ticketNumber === ticketId) || null
}

function publicTicketSummary(t) {
  return {
    id: t.id,
    ticketNumber: t.ticketNumber,
    subject: t.subject,
    status: t.status,
    category: t.category,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    slaDueAt: t.slaDueAt,
    slaLabel: SUPPORT_SLA_LABEL,
    updates: (t.updates || [])
      .filter((u) => u.visibleToCustomer)
      .map((u) => ({
        id: u.id,
        authorType: u.authorType,
        message: u.message,
        createdAt: u.createdAt,
      })),
  }
}

function adminTicketSummary(t) {
  const overdue = t.status !== 'resolved' && t.status !== 'closed' && new Date(t.slaDueAt).getTime() < Date.now()
  return {
    id: t.id,
    ticketNumber: t.ticketNumber,
    subject: t.subject,
    status: t.status,
    category: t.category,
    priority: t.priority,
    userId: t.userId,
    userEmail: t.userEmail,
    userName: t.userName,
    organizationName: t.organizationName,
    source: t.source,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    slaDueAt: t.slaDueAt,
    overdue,
  }
}

export function getAdminTicketDetail(store, ticketId) {
  const t = getTicketById(store, ticketId)
  if (!t) return null
  return {
    ...adminTicketSummary(t),
    description: t.description,
    threadId: t.threadId,
    transcript: t.transcript || [],
    context: t.context || {},
    updates: t.updates || [],
  }
}

export function applyAdminTicketAction(store, actor, ticketId, { action, status, message, internalNote }) {
  const t = getTicketById(store, ticketId)
  if (!t) throw new Error('Ticket not found')

  const now = new Date().toISOString()

  if (action === 'set_status') {
    if (!TICKET_STATUSES.includes(status)) throw new Error('Invalid status')
    t.status = status
    t.updatedAt = now
    if (status === 'resolved' || status === 'closed') t.resolvedAt = now
    t.updates.push({
      id: createId('tupd'),
      authorType: 'system',
      authorEmail: actor.email,
      message: `Status changed to ${status.replace('_', ' ')}`,
      visibleToCustomer: true,
      createdAt: now,
    })
  } else if (action === 'reply') {
    const body = String(message || '').trim()
    if (!body) throw new Error('Reply message required')
    if (t.status === 'open') t.status = 'in_progress'
    t.updatedAt = now
    t.updates.push({
      id: createId('tupd'),
      authorType: 'admin',
      authorEmail: actor.email,
      message: body,
      visibleToCustomer: true,
      createdAt: now,
    })
  } else if (action === 'internal_note') {
    const body = String(internalNote || message || '').trim()
    if (!body) throw new Error('Note required')
    t.updatedAt = now
    t.updates.push({
      id: createId('tupd'),
      authorType: 'admin',
      authorEmail: actor.email,
      message: body,
      visibleToCustomer: false,
      createdAt: now,
    })
  } else {
    throw new Error('Unknown action')
  }

  recordAdminAudit(store, {
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: `support_ticket_${action}`,
    targetType: 'support_ticket',
    targetId: t.id,
    detail: { ticketNumber: t.ticketNumber, status: t.status },
  })

  return t
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export async function notifySupportTeamNewTicket({ ticket, user, ctx, recent }) {
  const inbox = supportInbox()
  const from = formatEmailAddress('Connect Intel Support', 'invite@connectintel.net')
  const html = `
    <p><strong>New support ticket ${escapeHtml(ticket.ticketNumber)}</strong></p>
    <p><strong>Customer:</strong> ${escapeHtml(user.email)} (${escapeHtml(ticket.userName || '')})</p>
    <p><strong>Organization:</strong> ${escapeHtml(ticket.organizationName || '—')}</p>
    <p><strong>Category:</strong> ${escapeHtml(ticket.category)} · <strong>Priority:</strong> ${escapeHtml(ticket.priority)}</p>
    <p><strong>Subject:</strong> ${escapeHtml(ticket.subject)}</p>
    <p>${escapeHtml(ticket.description)}</p>
    <p><strong>SLA due:</strong> ${escapeHtml(ticket.slaDueAt)} (${SUPPORT_SLA_LABEL})</p>
    <p><strong>Context:</strong> Pipeline ${ctx.pipelineLeadCount} leads · Gmail ${ctx.gmailConnected ? 'yes' : 'no'} · Credits ₹${ctx.prospectCredits}</p>
    <hr/>
    <pre style="font-size:12px;white-space:pre-wrap">${escapeHtml(
      (recent || []).map((m) => `${m.role}: ${m.content}`).join('\n\n')
    )}</pre>
  `
  return sendResendEmail({
    from,
    to: inbox,
    replyTo: user.email,
    subject: `[${ticket.ticketNumber}] ${ticket.subject}`,
    html,
    text: `${ticket.subject}\n\n${ticket.description}\n\nTicket: ${ticket.ticketNumber}\nFrom: ${user.email}`,
  })
}

export async function notifyCustomerTicketCreated({ ticket, user }) {
  const from = formatEmailAddress('Connect Intel Support', 'invite@connectintel.net')
  const html = `
    <p>Hi ${escapeHtml(ticket.userName || 'there')},</p>
    <p>We received your concern and created support ticket <strong>${escapeHtml(ticket.ticketNumber)}</strong>.</p>
    <p><strong>Subject:</strong> ${escapeHtml(ticket.subject)}</p>
    <p>Our team will respond within <strong>${SUPPORT_SLA_LABEL}</strong> at <strong>${escapeHtml(user.email)}</strong>.</p>
    <p>We do not offer live phone support — please reply to this email or use the in-app assistant and quote your ticket number.</p>
    <p>— Connect Intel Support</p>
  `
  return sendResendEmail({
    from,
    to: user.email,
    replyTo: supportInbox(),
    subject: `Ticket ${ticket.ticketNumber} — we received your request`,
    html,
    text: `Ticket ${ticket.ticketNumber}\n\nWe received your request and will respond within ${SUPPORT_SLA_LABEL} at ${user.email}.`,
  })
}

export async function notifyCustomerAdminReply({ ticket, replyMessage }) {
  const from = formatEmailAddress('Connect Intel Support', 'invite@connectintel.net')
  const html = `
    <p>Update on ticket <strong>${escapeHtml(ticket.ticketNumber)}</strong>:</p>
    <p>${escapeHtml(replyMessage)}</p>
    <p>Reply to this email if you need more help. Status: <strong>${escapeHtml(ticket.status.replace('_', ' '))}</strong>.</p>
    <p>— Connect Intel Support</p>
  `
  return sendResendEmail({
    from,
    to: ticket.userEmail,
    replyTo: supportInbox(),
    subject: `Re: [${ticket.ticketNumber}] ${ticket.subject}`,
    html,
    text: `Ticket ${ticket.ticketNumber}\n\n${replyMessage}`,
  })
}

export function supportTicketMetrics(store) {
  const tickets = getSupportTicketsStore(store)
  const active = tickets.filter((t) => ['open', 'in_progress', 'waiting_customer'].includes(t.status))
  const overdue = active.filter((t) => new Date(t.slaDueAt).getTime() < Date.now())
  const openToday = tickets.filter((t) => {
    const created = new Date(t.createdAt).getTime()
    return created > Date.now() - 24 * 60 * 60 * 1000
  })
  return {
    total: tickets.length,
    active: active.length,
    overdue: overdue.length,
    openLast24h: openToday.length,
    resolved: tickets.filter((t) => t.status === 'resolved' || t.status === 'closed').length,
  }
}
