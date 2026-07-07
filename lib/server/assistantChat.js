import { createId } from './store.js'
import {
  ASSISTANT_FAQ_VISIBLE,
  ASSISTANT_NAV_PANELS,
  buildFaqDigestForPrompt,
  findBestFaqEntries,
} from '../assistantKnowledge.js'
import { ASSISTANT_CONSTITUTION } from '../assistantConstitution.js'
import { buildAssistantUserContext } from './assistantContext.js'
import {
  enrichContextWithWorkspace,
  formatEnrichedContextForPrompt,
  tryGroundedWorkspaceReply,
  tryHighConfidenceFaq,
} from './assistantCrmFacts.js'
import {
  analyzeCustomerConcern,
  createSupportTicket,
  customerTicketConfirmation,
  listTicketsForUser,
  notifyCustomerTicketCreated,
  notifySupportTeamNewTicket,
} from './supportTickets.js'
import { sanitizeAssistantActions } from './assistantActions.js'
import { processCopilotTurn } from './copilot/orchestrator.js'
import { getContextualSuggestions } from './copilot/contextSuggestions.js'
import { isPerplexityConfigured } from './perplexity.js'

const MAX_THREAD_MESSAGES = 40
const MAX_USER_MESSAGES_PER_DAY = 60

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
        'Your workspace uses the **free CRM tier** for Pipeline, team, and imports. There is no paid subscription wallet in the app unless your admin enabled billing. Prospect credits (if shown) are for AI search unlocks only.',
      actions: [{ type: 'navigate', panel: 'team', label: 'Open workspace' }],
      suggestions: ['CRM vs Marketing email', 'How do I connect work Gmail?'],
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
      '**Answer:** I can help you **find companies**, **manage follow-ups**, and **draft outreach** in Connect Intel.\n\n**Next step:** Try **"toy exporters in Delhi NCR"** or open Pipeline.',
    actions: [
      { type: 'navigate', panel: 'overview', label: 'Go to Dashboard' },
      { type: 'navigate', panel: 'pipeline', label: 'Open Pipeline' },
    ],
    suggestions: ['Toy exporters in Delhi NCR', 'Who needs follow-up today?', 'CRM vs Marketing email?'],
    source: 'default',
  }
}

function buildFaqDigest() {
  return buildFaqDigestForPrompt()
}

function shouldAutoResearch(message, mode) {
  if (mode === 'research') return true
  const t = String(message || '').trim()
  if (/^\/web\s+/i.test(t)) return true
  return /^(search|research|look up|find on|google)\b/i.test(t) && /linkedin|amazon|web|internet|company news|competitor/i.test(t)
}

function stripResearchPrefix(message) {
  return String(message || '')
    .replace(/^\/web\s+/i, '')
    .trim()
}

function formatResearchReply(result) {
  let reply = String(result.text || '').trim()
  if (!reply) return reply

  // Normalize section headers for consistent UI rendering
  reply = reply
    .replace(/^#{1,3}\s+/gm, '')
    .replace(/\*\*Answer:\*\*/i, '**Answer**')
    .replace(/\*\*Findings:\*\*/i, '**Findings**')
    .replace(/\*\*Gaps:\*\*/i, '**Gaps**')

  const cites = (result.citations || []).filter((u) => /^https:\/\//i.test(String(u || '').trim()))
  if (cites.length) {
    const unique = [...new Set(cites.map((u) => String(u).trim()))].slice(0, 6)
    reply += '\n\n**Sources**'
    unique.forEach((url, i) => {
      reply += `\n${i + 1}. ${url}`
    })
  }
  return reply
}

function researchFollowUpSuggestions(query) {
  const q = String(query || '')
  const company = q.match(/\bat\s+([A-Z][A-Za-z0-9&.' -]{2,40})\b/)?.[1]
  if (company) {
    return [
      `Latest news about ${company}`,
      `More leadership at ${company}`,
      `Competitors of ${company}`,
    ]
  }
  if (/amazon|product|category/i.test(q)) {
    return ['Top brands in this category', 'Price range on Amazon', 'Research another product']
  }
  if (/linkedin|manager|director|people|contact/i.test(q)) {
    return ['Find more people at this company', 'Company overview', 'Recent company news']
  }
  return ['Research another company', 'Find decision makers', 'Industry news']
}

function crmFollowUpSuggestions(query, ctx) {
  const lower = String(query || '').toLowerCase()
  if (/pipeline|leads/i.test(lower)) {
    return ['Overdue follow-ups?', 'Bulk email from Pipeline', 'Filter by stage']
  }
  if (/marketing|campaign|form/i.test(lower)) {
    return ['CRM vs Marketing email', 'How many campaigns?', 'Email consent on forms']
  }
  if (/gmail|email connect/i.test(lower)) {
    return ['Bulk email from Pipeline', 'Calendar and reminders']
  }
  if (ctx?.pipelineLeadCount != null) {
    return [`How many leads in my pipeline?`, 'CRM vs Marketing email', 'Open command palette ⌘K']
  }
  return ['How many leads in my pipeline?', 'CRM vs Marketing email', 'How do I connect work Gmail?']
}

function citationsToActions(citations) {
  return (citations || [])
    .slice(0, 3)
    .map((url, i) => {
      const safe = String(url || '').trim()
      if (!/^https:\/\//i.test(safe)) return null
      return { type: 'open_url', url: safe, label: `Open source ${i + 1}` }
    })
    .filter(Boolean)
}

async function processResearchMessage(message) {
  const result = await crmAssistantWebResearch(message)
  if (result.error && !result.text) {
    return {
      reply: result.error,
      actions: isPerplexityConfigured()
        ? []
        : [{ type: 'navigate', panel: 'pipeline', label: 'Open Pipeline' }],
      suggestions: crmFollowUpSuggestions(message),
      source: 'web_error',
      needsHuman: false,
    }
  }
  return {
    reply: formatResearchReply(result),
    actions: sanitizeAssistantActions(citationsToActions(result.citations)),
    suggestions: researchFollowUpSuggestions(message),
    source: 'web',
    needsHuman: false,
  }
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

  const system = `You are Connect Intel CRM AI — the in-app expert for Connect Intel CRM and Marketing Hub.

${ASSISTANT_CONSTITUTION}

Response rules:
- Answer the user's EXACT question in the first line (**Direct answer**). No filler like "I can help with..." or repeating their question.
- Then **Details**: 2–5 compact bullets with specifics from USER CONTEXT and PRODUCT KNOWLEDGE. Use real numbers from context (lead counts, Gmail status, forms, campaigns).
- Be detailed yet compact — every line must add information. No vague overviews.
- Use **bold** for key terms, numbers, and panel names.
- Respond with ONLY valid JSON (no markdown outside JSON):
{
  "reply": "string using **Direct answer** then **Details** sections with \\n line breaks",
  "actions": [{ "type": "navigate", "panel": "pipeline", "tab": "list", "label": "Open list" }],
  "suggestions": ["follow-up 1", "follow-up 2"],
  "needsHuman": false,
  "escalationReason": "optional when needsHuman true"
}
- actions: max 3. navigate panels: ${[...ASSISTANT_NAV_PANELS].join(', ')}. Optional keys: tab, status, leadId, leadTab.
- type escalate with label "Raise support ticket" when needsHuman is true (bugs, billing, data loss, OAuth failures).
- type open_url only for https://connectintel.net/privacy.html or public help links.
- CRM bulk email: max 200 leads per request, 50 per processing chunk. Marketing campaigns: lists/segments, consent preview, >10 recipients use background queue.
- Never invent features, limits, or panels not in knowledge.

USER CONTEXT:
${formatEnrichedContextForPrompt(ctx)}

PRODUCT KNOWLEDGE:
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
      max_tokens: 1100,
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
  if (
    result.source === 'web' ||
    result.source === 'web_error' ||
    result.source === 'grounded' ||
    result.source === 'faq_confident' ||
    result.source === 'copilot' ||
    result.source === 'crm'
  ) {
    return { ...result, offerEscalation: false }
  }
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

export async function processAssistantMessage(store, user, message, uiContext = {}) {
  const text = String(message || '').trim().slice(0, 2000)
  if (!text) {
    return { error: 'Message is required' }
  }

  const thread = getAssistantThread(store, user.id)
  const today = new Date().toISOString().slice(0, 10)
  if (thread.messageCountDate === today && (thread.messageCountToday || 0) >= MAX_USER_MESSAGES_PER_DAY) {
    return { error: 'Daily assistant limit reached. Try again tomorrow or contact support.' }
  }

  const ctx = enrichContextWithWorkspace(store, user, uiContext)
  const history = (thread.messages || []).filter((m) => m.role === 'user' || m.role === 'assistant')

  let result = await processCopilotTurn(store, user, text, uiContext, { history, thread })

  if (!result?.reply) {
    result = faqFallbackReply(text, ctx)
    result.suggestions = result.suggestions?.length
      ? result.suggestions
      : getContextualSuggestions(uiContext)
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
    sources: result.sources || [],
    confidence: result.confidence || null,
    companyCard: result.companyCard || null,
    companies: result.companies || null,
    planSteps: result.planSteps || null,
    discoveryMeta: result.discoveryMeta || null,
    emailDraft: result.emailDraft || null,
    executedAction: result.executedAction || null,
    createdAt: new Date().toISOString(),
  }

  thread.messages = [...(thread.messages || []), userMsg, assistantMsg].slice(-MAX_THREAD_MESSAGES)
  thread.updatedAt = new Date().toISOString()
  bumpDailyCount(thread)

  return {
    reply: assistantMsg.content,
    actions: assistantMsg.actions,
    suggestions: assistantMsg.suggestions,
    sources: assistantMsg.sources,
    confidence: assistantMsg.confidence,
    companyCard: assistantMsg.companyCard,
    companies: assistantMsg.companies,
    planSteps: assistantMsg.planSteps,
    discoveryMeta: assistantMsg.discoveryMeta,
    emailDraft: assistantMsg.emailDraft,
    executedAction: assistantMsg.executedAction,
    offerEscalation: assistantMsg.offerEscalation,
    messages: thread.messages,
    myTickets: listTicketsForUser(store, user.id, { limit: 5 }),
    context: {
      gmailConnected: ctx.gmailConnected,
      pipelineLeadCount: ctx.pipelineLeadCount,
      prospectCredits: ctx.prospectCredits,
      marketingFormCount: ctx.marketingFormCount,
      marketingCampaignCount: ctx.marketingCampaignCount,
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
    webResearchAvailable: isPerplexityConfigured(),
    messages: (thread.messages || []).map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      actions: m.actions || [],
      suggestions: m.suggestions || [],
      offerEscalation: m.offerEscalation || false,
      source: m.source || null,
      sources: m.sources || [],
      confidence: m.confidence || null,
      companyCard: m.companyCard || null,
      companies: m.companies || null,
      planSteps: m.planSteps || null,
      discoveryMeta: m.discoveryMeta || null,
      createdAt: m.createdAt,
    })),
    myTickets: listTicketsForUser(store, userId, { limit: 8 }),
  }
}
