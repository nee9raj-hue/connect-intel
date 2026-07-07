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
import { buildV4Reply } from './structuredResponse.js'
import { tryRefineDiscovery } from './discoveryMemory.js'
import {
  buildApproachNarrative,
  INDUSTRY_CLARIFICATION_OPTIONS,
} from './businessGoal.js'
import {
  retrieveCrmFollowUps,
  retrieveStalledDeals,
  formatFollowUpReply,
} from './crmPipelineQueries.js'
import {
  prepareTurnContext,
  enrichSalesIntentFromState,
  formatContactLookupReply,
  updateConversationState,
  selfCheckResponse,
  buildStateAwarePlanSteps,
} from './conversationState.js'
import { inferSalesIntent } from './salesIntent.js'

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
  const turnCtx = prepareTurnContext(thread, text, uiContext)
  const { state, resolved, entities } = turnCtx

  let salesIntent = inferSalesIntent(text, uiContext)
  salesIntent = enrichSalesIntentFromState(salesIntent, state, resolved, entities)
  const plan = planCopilotTurn(text, uiContext, { salesIntent, resolved })
  plan.salesIntent = salesIntent
  const ctx = enrichContextWithWorkspace(store, user, uiContext)

  if (resolved?.inferredIntent === 'contact_lookup' && resolved.contactFromResearch) {
    const contactResult = formatContactLookupReply(resolved.contactFromResearch)
    contactResult.planSteps = buildStateAwarePlanSteps(plan, state, { refined: true })
    return finalizeCopilotResult({
      result: contactResult,
      plan,
      text,
      uiContext,
      thread,
      turnCtx,
      webRaw: null,
      leadContext: null,
      crmSearch: null,
    })
  }

  if (isDiscoveryRefinement(text, thread)) {
    const refined = tryRefineDiscovery(thread, text, plan)
    if (refined) {
      return finalizeCopilotResult({
        result: refined,
        plan,
        text,
        uiContext,
        thread,
        turnCtx,
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
      turnCtx,
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
      turnCtx,
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
      turnCtx,
      webRaw: null,
      leadContext: null,
      crmSearch: stalled,
    })
  }

  if (plan.salesIntent?.needsIndustryClarification) {
    const approach = buildApproachNarrative('lead_generation')
    const options = INDUSTRY_CLARIFICATION_OPTIONS.map((o) => `**${o}**`).join(' · ')
    const reply = buildV4Reply({
      approach: `${approach} Before I start researching, which industry are you targeting?`,
      whatIFound: 'No search run yet — one quick filter will sharpen results.',
      whyItMatters: `Narrowing industry avoids associations and irrelevant manufacturers. Options: ${options}`,
      nbsa: 'Reply with an industry — e.g. **Toys** or **Textiles** — and I\'ll search verified exporters.',
    })
    return finalizeCopilotResult({
      result: {
        reply,
        nbsa: 'Reply with an industry — e.g. **Toys** or **Textiles** — and I\'ll search verified exporters.',
        source: 'clarification',
        sources: [{ type: 'copilot', label: 'Connect Copilot' }],
        confidence: 'high',
        suggestions: INDUSTRY_CLARIFICATION_OPTIONS.map((o) =>
          o === 'All industries' ? 'All industries' : `${o} exporters`
        ),
        actions: [],
        planSteps: [{ id: 'understand', label: 'Understanding your request', status: 'done' }],
      },
      plan,
      text,
      uiContext,
      thread,
      turnCtx,
      webRaw: null,
      leadContext: null,
      crmSearch: null,
    })
  }

  if (plan.salesIntent?.needsExportClarification) {
    const understanding = buildUnderstandingLine({
      intentCategory: 'lead_generation',
      entities: plan.salesIntent.entities,
      message: text,
    })
    const reply = buildV4Reply({
      approach: `${buildApproachNarrative('lead_generation')} ${understanding}.`,
      whatIFound: 'No search run yet — hundreds of exporters exist across India.',
      whyItMatters:
        'Narrowing by export market gives you a sharper, outreach-ready list instead of random companies.',
      nbsa: 'Which export markets matter most — **USA**, **UK**, **Europe**, **Middle East**, or **all markets**?',
    })
    return finalizeCopilotResult({
      result: {
        reply,
        understanding,
        nbsa: 'Which export markets matter most — **USA**, **UK**, **Europe**, **Middle East**, or **all markets**?',
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
      turnCtx,
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
      turnCtx,
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
      turnCtx,
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
    turnCtx,
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
  turnCtx,
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
  if (
    nbsa &&
    !reply.includes('**Recommended next:**') &&
    !reply.includes('**If I were handling this account:**')
  ) {
    reply = `${reply}\n\n**If I were handling this account:** ${nbsa}`
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

  const planSteps =
    result.planSteps ||
    (turnCtx?.state ? buildStateAwarePlanSteps(plan, turnCtx.state) : null)

  if (thread && turnCtx) {
    updateConversationState(thread, {
      message: text,
      plan,
      result: { ...result, reply, nbsa, actions: uniqueActions, planSteps },
      uiContext,
      resolved: turnCtx.resolved,
    })
    selfCheckResponse(turnCtx.state, { ...result, reply, source: result.source }, turnCtx.resolved)
  }

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
    planSteps,
    discoveryMeta: result.discoveryMeta || null,
    emailDraft: result.emailDraft || null,
    executedAction: result.executedAction || null,
    source: result.source || 'copilot',
    needsHuman: result.needsHuman || false,
  }
}
