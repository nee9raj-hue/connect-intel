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
import { tryCopilotCrmTools } from './crmTools.js'
import { buildMorningBrief } from './morningBrief.js'
import { runLeadDiscoveryAgent } from './leadDiscoveryAgent.js'
import { runPeopleDiscoveryAgent } from './peopleDiscoveryAgent.js'
import { isDiscoveryRefinement } from './salesIntent.js'
import { buildUnderstandingLine } from './entityExtractor.js'
import { buildNBSA, nbsaActions } from './nbsa.js'
import { buildV3Reply } from './structuredResponse.js'
import { tryRefineDiscovery } from './discoveryMemory.js'
import {
  retrieveCrmFollowUps,
  retrieveStalledDeals,
  formatFollowUpReply,
} from './crmPipelineQueries.js'

const META_COLLECTIONS = ['users', 'organizations', 'organizationMemberships']

const PRODUCTIVE_FALLBACK = {
  reply:
    '**Answer:** Tell me a sales goal — find exporters, check follow-ups, or draft outreach.\n\n**Next step:** Try **"toy exporters in Delhi NCR"** or **"who needs follow-up today?"**',
  source: 'copilot',
  sources: [{ type: 'copilot', label: 'Connect Copilot' }],
  confidence: 'medium',
  suggestions: [
    'Toy exporters in Delhi NCR',
    'Who needs follow-up today?',
    'Brief me',
    'Draft follow-up email',
  ],
  actions: [
    { type: 'navigate', panel: 'pipeline', label: 'Open Pipeline' },
    { type: 'navigate', panel: 'overview', label: 'Dashboard' },
  ],
}

export async function processCopilotTurn(store, user, message, uiContext = {}, { history = [], thread = null } = {}) {
  const text = String(message || '').trim().slice(0, 2000)
  const plan = planCopilotTurn(text, uiContext)
  const ctx = enrichContextWithWorkspace(store, user, uiContext)

  if (isDiscoveryRefinement(text, thread)) {
    const refined = tryRefineDiscovery(thread, text)
    if (refined) {
      return finalizeCopilotResult({
        result: refined,
        plan,
        text,
        uiContext,
        thread,
        webRaw: null,
        leadContext: null,
        crmSearch: null,
      })
    }
  }

  if (plan.intents?.morningBrief) {
    const brief = await buildMorningBrief(store, user)
    return finalizeCopilotResult({
      result: brief,
      plan,
      text,
      uiContext,
      thread,
      webRaw: null,
      leadContext: null,
      crmSearch: null,
    })
  }

  if (plan.intents?.crmFollowUp) {
    const followUps = retrieveCrmFollowUps(store, user)
    return finalizeCopilotResult({
      result: formatFollowUpReply(followUps),
      plan,
      text,
      uiContext,
      thread,
      webRaw: null,
      leadContext: null,
      crmSearch: followUps,
    })
  }

  if (plan.intents?.crmStalled) {
    const stalled = retrieveStalledDeals(store, user)
    const result = formatFollowUpReply({
      ...stalled,
      query: 'stalled deals',
    })
    result.reply = result.reply.replace('follow-up', 'stalled deal').replace('follow-ups', 'stalled deals')
    return finalizeCopilotResult({
      result,
      plan,
      text,
      uiContext,
      thread,
      webRaw: null,
      leadContext: null,
      crmSearch: stalled,
    })
  }

  if (plan.salesIntent?.needsExportClarification) {
    const understanding = buildUnderstandingLine({
      intentCategory: 'lead_generation',
      entities: plan.salesIntent.entities,
      message: text,
    })
    const reply = buildV3Reply({
      understanding: `I understand you're looking for ${understanding}.`,
      answer:
        'There are hundreds of exporters in India — narrowing by export market will give you a sharper list.',
      recommendations:
        'Which export markets matter most — **USA**, **UK**, **Europe**, **Middle East**, or **all markets**?',
    })
    return finalizeCopilotResult({
      result: {
        reply,
        understanding,
        source: 'clarification',
        sources: [{ type: 'copilot', label: 'Connect Copilot' }],
        confidence: 'high',
        suggestions: ['Exporting to USA', 'Exporting to UK', 'Exporting to Europe', 'All export markets'],
        actions: [],
      },
      plan,
      text,
      uiContext,
      thread,
      webRaw: null,
      leadContext: null,
      crmSearch: null,
    })
  }

  if (plan.runPeopleDiscovery) {
    const people = await runPeopleDiscoveryAgent({
      store,
      user,
      message: text,
      entities: plan.salesIntent.entities,
      plan,
    })
    return finalizeCopilotResult({
      result: people,
      plan,
      text,
      uiContext,
      thread,
      webRaw: null,
      leadContext: null,
      crmSearch: null,
    })
  }

  if (plan.runLeadDiscovery) {
    const discovery = await runLeadDiscoveryAgent({
      store,
      user,
      message: text,
      salesIntent: plan.salesIntent,
      thread,
    })
    return finalizeCopilotResult({
      result: discovery,
      plan,
      text,
      uiContext,
      thread,
      webRaw: null,
      leadContext: null,
      crmSearch: null,
    })
  }

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

  let result =
    plan.leadId || leadContext
      ? await tryCopilotCrmTools({ user, message: text, plan, leadContext, uiContext })
      : null

  if (!result) {
    result = await synthesizeCopilotReply({
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
  }

  if (!result) {
    result = { ...PRODUCTIVE_FALLBACK, suggestions: buildCopilotSuggestions({ plan, uiContext }) }
  }

  return finalizeCopilotResult({
    result,
    plan,
    text,
    uiContext,
    thread,
    webRaw,
    leadContext,
    crmSearch,
    grounded,
  })
}

function finalizeCopilotResult({
  result,
  plan,
  text,
  uiContext,
  thread,
  webRaw,
  leadContext,
  crmSearch,
  grounded,
}) {
  const companyCard = enrichCompanyCard(result.companyCard, {
    reply: result.reply,
    leadContext,
    crmSearch,
    query: text,
  })

  const nbsa =
    result.nbsa ||
    buildNBSA({
      plan,
      result,
      leadContext,
      companyCard,
      companies: result.companies,
      discoveryMeta: result.discoveryMeta,
      entities: plan.salesIntent?.entities,
    })

  let reply = result.reply
  if (nbsa && !reply.includes('**Recommended next:**')) {
    reply = `${reply}\n\n**Recommended next:** ${nbsa}`
  }

  const nbsaExtraActions = nbsaActions({
    nbsa,
    plan,
    companies: result.companies,
    companyCard,
    leadContext,
  })

  const actions = sanitizeAssistantActions([
    ...(result.actions || []),
    ...nbsaExtraActions,
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
        runLeadDiscovery: plan.runLeadDiscovery,
        runCrmSearch: plan.runCrmSearch,
        runCrmCrossRef: plan.runCrmCrossRef,
        runCrmLead: plan.runCrmLead,
        intentCategory: plan.intentCategory,
        intents: Object.keys(plan.intents || {}).filter((k) => plan.intents[k]),
      },
      sources: sources.map((s) => s.label),
      confidence,
      webCached: Boolean(webRaw?.fromCache),
      discoveryTotal: result.discoveryMeta?.total || result.companies?.length || 0,
    })
  }

  return {
    reply,
    understanding: result.understanding || null,
    nbsa,
    actions: uniqueActions.slice(0, 8),
    suggestions: suggestions.slice(0, 4),
    sources,
    confidence,
    companyCard,
    companies: result.companies || null,
    people: result.people || null,
    planSteps: result.planSteps || null,
    discoveryMeta: result.discoveryMeta || null,
    emailDraft: result.emailDraft || null,
    executedAction: result.executedAction || null,
    source: result.source || 'copilot',
    needsHuman: result.needsHuman || false,
  }
}
