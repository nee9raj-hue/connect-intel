import { readStore } from '../store.js'
import { enrichContextWithWorkspace } from '../assistantCrmFacts.js'
import { sanitizeAssistantActions } from '../assistantActions.js'
import { planCopilotTurn, inferConfidence } from './planner.js'
import {
  retrieveCrmFacts,
  retrieveKnowledge,
  retrieveCrmSearch,
  retrieveLeadContext,
  retrieveWebResearch,
  formatCrmSearchForPrompt,
  formatLeadContextForPrompt,
} from './retrievers.js'
import { synthesizeCopilotReply, enrichCompanyCard } from './synthesizer.js'
import { buildCopilotActions, buildCopilotSuggestions } from './actions.js'
import { appendCopilotLog } from './logger.js'

const META_COLLECTIONS = ['users', 'organizations', 'organizationMemberships']

export async function processCopilotTurn(store, user, message, uiContext = {}, { history = [], thread = null } = {}) {
  const text = String(message || '').trim().slice(0, 2000)
  const plan = planCopilotTurn(text, uiContext)
  const ctx = enrichContextWithWorkspace(store, user, uiContext)

  const metaStore = await readStore({ only: META_COLLECTIONS })

  const [grounded, faq, crmSearch, leadContext, webRaw] = await Promise.all([
    plan.runCrmFacts ? Promise.resolve(retrieveCrmFacts(store, user, text, uiContext)) : null,
    plan.runKnowledge ? Promise.resolve(retrieveKnowledge(text)) : null,
    plan.runCrmSearch && plan.crmSearchQuery
      ? retrieveCrmSearch(store, user, plan.crmSearchQuery)
      : null,
    plan.runCrmLead && plan.leadId
      ? retrieveLeadContext(store, user, plan.leadId, metaStore)
      : null,
    plan.runWeb && plan.webQuery ? retrieveWebResearch(user.id, plan.webQuery, { news: plan.runNews }) : null,
  ])

  const leadContextPrompt = formatLeadContextForPrompt(leadContext)
  const crmSearchPrompt = crmSearch ? formatCrmSearchForPrompt(crmSearch) : ''

  let result = await synthesizeCopilotReply({
    message: text,
    plan,
    ctx,
    history,
    grounded,
    faq,
    crmSearch,
    leadContext,
    leadContextPrompt,
    crmSearchPrompt,
    webRaw,
  })

  if (!result) {
    result = {
      reply:
        '**Answer:** I can search your CRM, research companies on the web, and guide you through Connect Intel.\n\n**Details:** Ask something specific — e.g. lead counts, a company name, or how Pipeline bulk email works.',
      source: 'default',
      sources: [{ type: 'copilot', label: 'Connect Copilot' }],
      confidence: 'low',
      suggestions: buildCopilotSuggestions({ plan, uiContext }),
      actions: [
        { type: 'navigate', panel: 'pipeline', label: 'Open Pipeline' },
        { type: 'navigate', panel: 'overview', label: 'Dashboard' },
      ],
    }
  }

  const companyCard = enrichCompanyCard(result.companyCard, {
    reply: result.reply,
    leadContext,
    crmSearch,
    query: text,
  })

  const actions = sanitizeAssistantActions([
    ...(result.actions || []),
    ...buildCopilotActions({ plan, leadContext, crmSearch, companyCard, uiContext }),
  ])

  const uniqueActions = []
  const seen = new Set()
  for (const a of actions) {
    const key = `${a.type}:${a.panel || ''}:${a.leadId || ''}:${a.url || ''}:${a.label}`
    if (seen.has(key)) continue
    seen.add(key)
    uniqueActions.push(a)
  }

  const sources = result.sources?.length
    ? result.sources
    : [{ type: result.source || 'copilot', label: 'Connect Copilot' }]

  const confidence =
    result.confidence ||
    inferConfidence({
      sources: sources.map((s) => s.type),
      grounded: Boolean(grounded),
      webError: webRaw?.error && !webRaw?.text,
    })

  const suggestions =
    result.suggestions?.length > 0
      ? result.suggestions
      : buildCopilotSuggestions({ plan, uiContext, companyCard })

  if (thread) {
    appendCopilotLog(thread, {
      message: text.slice(0, 500),
      plan: {
        runWeb: plan.runWeb,
        runCrmSearch: plan.runCrmSearch,
        runCrmLead: plan.runCrmLead,
        intents: Object.keys(plan.intents || {}).filter((k) => plan.intents[k]),
      },
      sources: sources.map((s) => s.label),
      confidence,
      webCached: Boolean(webRaw?.fromCache),
    })
  }

  return {
    reply: result.reply,
    actions: uniqueActions.slice(0, 4),
    suggestions: suggestions.slice(0, 4),
    sources,
    confidence,
    companyCard,
    source: result.source || 'copilot',
    needsHuman: result.needsHuman || false,
  }
}
