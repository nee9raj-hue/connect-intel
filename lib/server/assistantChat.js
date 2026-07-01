import { createId } from './store.js'
import {
  ASSISTANT_FAQ_VISIBLE,
  ASSISTANT_NAV_PANELS,
  findBestFaqEntries,
} from '../assistantKnowledge.js'
import { buildAssistantUserContext, formatContextForPrompt } from './assistantContext.js'
import {
  analyzeCustomerConcern,
  createSupportTicket,
  customerTicketConfirmation,
  listTicketsForUser,
  notifyCustomerTicketCreated,
  notifySupportTeamNewTicket,
} from './supportTickets.js'

const MAX_THREAD_MESSAGES = 40
const MAX_USER_MESSAGES_PER_DAY = 60

const ALLOWED_NAV_KEYS = new Set([
  'panel',
  'tab',
  'status',
  'upcomingOnly',
  'leadId',
  'leadTab',
  'label',
])

export function getAssistantThread(store, userId) {
  store.assistantThreads = store.assistantThreads || []
  let thread = store.assistantThreads.find((t) => t.userId === userId)
  if (!thread) {
    thread = {
      id: createId('ast'),
      userId,
      messages: [],
      messageCountToday: 0,
      messageCountDate: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    store.assistantThreads.push(thread)
  }
  return thread
}

function bumpDailyCount(thread) {
  const today = new Date().toISOString().slice(0, 10)
  if (thread.messageCountDate !== today) {
    thread.messageCountDate = today
    thread.messageCountToday = 0
  }
  thread.messageCountToday = (thread.messageCountToday || 0) + 1
}

export function sanitizeAssistantActions(actions = []) {
  if (!Array.isArray(actions)) return []
  const out = []
  for (const raw of actions.slice(0, 4)) {
    if (!raw || typeof raw !== 'object') continue
    if (raw.type === 'open_url' && typeof raw.url === 'string' && /^https:\/\//i.test(raw.url)) {
      out.push({
        type: 'open_url',
        url: raw.url,
        label: String(raw.label || 'Open link').slice(0, 80),
      })
      continue
    }
    if (raw.type === 'escalate') {
      out.push({
        type: 'escalate',
        label: String(raw.label || 'Raise support ticket').slice(0, 80),
      })
      continue
    }
    if (raw.type !== 'navigate') continue
    const panel = String(raw.panel || '').trim()
    if (!ASSISTANT_NAV_PANELS.has(panel)) continue
    const action = { type: 'navigate', panel, label: String(raw.label || 'Open').slice(0, 80) }
    for (const key of ALLOWED_NAV_KEYS) {
      if (key === 'panel' || key === 'label') continue
      if (raw[key] != null && raw[key] !== '') action[key] = raw[key]
    }
    out.push(action)
  }
  return out
}

function faqFallbackReply(message, ctx) {
  const matches = findBestFaqEntries(message, 2)
  if (matches.length) {
    const primary = matches[0]
    const actions = []
    if (primary.navigate?.panel) {
      actions.push({
        type: 'navigate',
        ...primary.navigate,
        label: `Open ${primary.title}`,
      })
    }
    let reply = `${primary.body}`
    if (matches[1] && matches[1].id !== primary.id) {
      reply += `\n\nRelated: **${matches[1].title}** — ${matches[1].body.split('.')[0]}.`
    }
    return {
      reply,
      actions: sanitizeAssistantActions(actions),
      suggestions: ASSISTANT_FAQ_VISIBLE.filter((f) => f.id !== primary.id)
        .slice(0, 3)
        .map((f) => f.title),
      source: 'faq',
    }
  }

  if (/credit|balance|rupee|billing|subscription|invoice|plan/i.test(message)) {
    return {
      reply:
        'Core CRM is included for your workspace during go-live — no subscription is required for pipeline, team, and imports. Open Team → Workspace for seat usage. Paid plans and AI products will be billed separately when those launch.',
      actions: [{ type: 'navigate', panel: 'team', teamTab: 'workspace', label: 'Open workspace' }],
      suggestions: ['How do I connect work Gmail?', 'Invite a teammate'],
      source: 'context',
    }
  }

  if (/gmail|email connect/i.test(message)) {
    const status = ctx.gmailConnected
      ? `Your work Gmail (${ctx.gmailMailbox}) is connected.`
      : ctx.gmailConnectAvailable
        ? 'Work Gmail is not connected yet. Open any lead → Email tab → Connect work Gmail.'
        : 'Gmail connect may be limited until Google app verification completes. Your admin can add test users in Google Cloud Console.'
    return {
      reply: status,
      actions: ctx.gmailConnected
        ? [{ type: 'navigate', panel: 'pipeline', label: 'Open Pipeline' }]
        : [{ type: 'navigate', panel: 'team', label: 'Team & email help' }],
      suggestions: ['Bulk email from Pipeline', 'Calendar and reminders'],
      source: 'context',
    }
  }

  return {
    reply:
      'I can help with Pipeline, Gmail setup, imports, bulk email, marketing campaigns, team invites, and navigation. Try a quick prompt below, or ask something specific. If you are stuck, use **Contact support** and we will follow up by email.',
    actions: [
      { type: 'navigate', panel: 'overview', label: 'Go to Dashboard' },
      { type: 'navigate', panel: 'pipeline', label: 'Open Pipeline' },
    ],
    suggestions: ['How do I connect work Gmail?', 'Bulk email from Pipeline', 'Marketing forms in campaigns'],
    source: 'default',
  }
}

function buildFaqDigest() {
  return ASSISTANT_FAQ_VISIBLE.map((f) => `- ${f.title}: ${f.body}`).join('\n')
}

function parseAssistantJson(text) {
  const trimmed = String(text || '').trim()
  const block = trimmed.match(/```json\s*([\s\S]*?)```/i) || trimmed.match(/\{[\s\S]*\}/)
  const raw = block ? (block[1] || block[0]) : trimmed
  try {
    return JSON.parse(raw)
  } catch {
    return { reply: trimmed, actions: [], suggestions: [] }
  }
}

async function callAnthropicAssistant({ message, history, ctx }) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null

  const system = `You are Connect Intel Assistant — a helpful in-app guide for B2B sales teams using Connect Intel CRM.

Rules:
- Answer only about Connect Intel product usage. No legal/medical advice.
- Never mention internal providers (Apollo, Perplexity, Anthropic, Supabase, Vercel, etc.).
- Never say "master data" or expose other customers' data.
- Use the user's context below when relevant (credits, Gmail, pipeline counts).
- Respond with ONLY valid JSON (no markdown outside JSON):
{
  "reply": "string, concise, use short paragraphs or bullet lines with \\n",
  "actions": [{ "type": "navigate", "panel": "pipeline", "tab": "list", "label": "Open list view" }],
  "suggestions": ["follow-up question 1", "follow-up question 2"],
  "needsHuman": false,
  "escalationReason": "optional short reason when needsHuman is true"
}
- actions: max 3. type navigate panels: ${[...ASSISTANT_NAV_PANELS].join(', ')}. Optional: tab, status, upcomingOnly, leadTab. type escalate with label "Raise support ticket" when needsHuman is true.
- type open_url only for https://connectintel.net/privacy.html or public help links.
- Set needsHuman true when: bugs, errors, billing disputes, data loss, OAuth failures, or anything requiring backend/engineering — not simple how-to questions.
- When needsHuman is true, explain briefly and tell them to tap Raise support ticket for a ticket number (24-48 hour SLA).
- Bulk email limit: 50 leads per batch.

USER CONTEXT:
${formatContextForPrompt(ctx)}

PRODUCT FAQ (use as truth):
${buildFaqDigest()}`

  const messages = [
    ...history.slice(-12).map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    })),
    { role: 'user', content: message },
  ]

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 900,
      system,
      messages,
    }),
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.error?.message || 'Assistant unavailable')
  }

  const text = (data.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')

  const parsed = parseAssistantJson(text)
  const actions = sanitizeAssistantActions(parsed.actions)
  const needsHuman = Boolean(parsed.needsHuman)
  if (needsHuman && !actions.some((a) => a.type === 'escalate')) {
    actions.push({ type: 'escalate', label: 'Raise support ticket' })
  }
  return {
    reply: String(parsed.reply || '').trim() || 'How can I help you with Connect Intel?',
    actions,
    suggestions: Array.isArray(parsed.suggestions)
      ? parsed.suggestions.slice(0, 4).map((s) => String(s).slice(0, 120))
      : [],
    needsHuman,
    escalationReason: parsed.escalationReason || null,
    source: 'ai',
  }
}

function enrichWithEscalationOffer(result, message) {
  const concern = analyzeCustomerConcern(message)
  const needsHuman = result.needsHuman || concern.shouldOfferEscalation
  if (!needsHuman) {
    return { ...result, offerEscalation: false }
  }

  const actions = [...(result.actions || [])]
  if (!actions.some((a) => a.type === 'escalate')) {
    actions.push({ type: 'escalate', label: 'Raise support ticket' })
  }

  let reply = result.reply || ''
  if (!/ticket|support team|24|48|raise/i.test(reply)) {
    reply +=
      `\n\nThis looks like something our support team should handle. Tap **Raise support ticket** — you'll get a ticket number and we'll respond within **24–48 business hours** at your account email.`
  }

  return {
    ...result,
    reply,
    actions: sanitizeAssistantActions(actions),
    offerEscalation: true,
    escalationCategory: concern.category,
    escalationSubject: concern.suggestedSubject,
    source: result.source,
  }
}

export async function processAssistantMessage(store, user, message) {
  const text = String(message || '').trim().slice(0, 2000)
  if (!text) {
    return { error: 'Message is required' }
  }

  const thread = getAssistantThread(store, user.id)
  const today = new Date().toISOString().slice(0, 10)
  if (thread.messageCountDate === today && (thread.messageCountToday || 0) >= MAX_USER_MESSAGES_PER_DAY) {
    return { error: 'Daily assistant limit reached. Try again tomorrow or contact support.' }
  }

  const ctx = buildAssistantUserContext(store, user)
  const history = (thread.messages || []).filter((m) => m.role === 'user' || m.role === 'assistant')

  let result
  try {
    result = (await callAnthropicAssistant({ message: text, history, ctx })) || faqFallbackReply(text, ctx)
  } catch {
    result = faqFallbackReply(text, ctx)
  }
  result = enrichWithEscalationOffer(result, text)

  const userMsg = {
    id: createId('amsg'),
    role: 'user',
    content: text,
    createdAt: new Date().toISOString(),
  }
  const assistantMsg = {
    id: createId('amsg'),
    role: 'assistant',
    content: result.reply,
    actions: result.actions,
    suggestions: result.suggestions,
    offerEscalation: result.offerEscalation || false,
    source: result.source,
    createdAt: new Date().toISOString(),
  }

  thread.messages = [...(thread.messages || []), userMsg, assistantMsg].slice(-MAX_THREAD_MESSAGES)
  thread.updatedAt = new Date().toISOString()
  bumpDailyCount(thread)

  return {
    reply: assistantMsg.content,
    actions: assistantMsg.actions,
    suggestions: assistantMsg.suggestions,
    offerEscalation: assistantMsg.offerEscalation,
    messages: thread.messages,
    myTickets: listTicketsForUser(store, user.id, { limit: 5 }),
    context: {
      gmailConnected: ctx.gmailConnected,
      pipelineLeadCount: ctx.pipelineLeadCount,
      prospectCredits: ctx.prospectCredits,
    },
  }
}

export function recordAssistantEscalation(store, user, { message, threadId, subject, category }) {
  const thread = getAssistantThread(store, user.id)
  const ctx = buildAssistantUserContext(store, user)
  const summary = String(message || '').trim().slice(0, 4000)
  const recent = (thread.messages || []).slice(-12).map((m) => ({ role: m.role, content: m.content }))
  const concern = analyzeCustomerConcern(summary)

  const ticket = createSupportTicket(store, user, {
    subject: subject || concern.suggestedSubject,
    description: summary || 'Customer raised a concern via Connect Intel Assistant',
    category: category || concern.category,
    priority: concern.score >= 5 ? 'high' : 'normal',
    source: 'assistant',
    threadId: threadId || thread.id,
    transcript: recent,
  })

  return { ticket, ctx, recent, user }
}

export async function sendAssistantEscalationEmail({ ticket, ctx, recent, user }) {
  const [teamMail, customerMail] = await Promise.all([
    notifySupportTeamNewTicket({ ticket, user, ctx, recent }),
    notifyCustomerTicketCreated({ ticket, user }),
  ])

  return {
    ok: true,
    ticketId: ticket.id,
    ticketNumber: ticket.ticketNumber,
    message: customerTicketConfirmation(ticket, user.email),
    emailSent: Boolean(teamMail.sent),
    customerNotified: Boolean(customerMail.sent),
  }
}

export function getAssistantHistory(store, userId) {
  const thread = getAssistantThread(store, userId)
  return {
    threadId: thread.id,
    messages: (thread.messages || []).map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      actions: m.actions || [],
      suggestions: m.suggestions || [],
      offerEscalation: m.offerEscalation || false,
      createdAt: m.createdAt,
    })),
    myTickets: listTicketsForUser(store, userId, { limit: 8 }),
  }
}
