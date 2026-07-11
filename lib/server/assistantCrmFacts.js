import { buildAssistantUserContext } from './assistantContext.js'
import { filterMarketingCampaignsVisible, filterMarketingRows } from './marketingAccess.js'
import { scoreFaqMatch, findBestFaqEntries, ASSISTANT_FAQ_VISIBLE } from '../assistantKnowledge.js'
import {
  formatDealsForecastReply,
  isDealsForecastQuestion,
  loadDealsForecastForUser,
} from './dealForecastLoad.js'

function formatStatusBreakdown(counts) {
  const entries = Object.entries(counts || {})
  if (!entries.length) return ''
  return entries.map(([k, v]) => `${k}: ${v}`).join(', ')
}

/**
 * User-specific CRM facts — prefer these answers for accuracy (no hallucination).
 * Returns null when the question is not a factual workspace query.
 */
export function tryGroundedWorkspaceReply(message, store, user, uiContext = {}) {
  const text = String(message || '').trim()
  const lower = text.toLowerCase()
  const ctx = buildAssistantUserContext(store, user)

  const forms = filterMarketingRows(store.marketingForms || [], user)
  const campaigns = filterMarketingCampaignsVisible(store.marketingCampaigns || [], user)
  const liveForms = forms.filter((f) => f.status === 'live')
  const activeCampaigns = campaigns.filter((c) => ['active', 'scheduled'].includes(c.status))

  if (/how many leads|pipeline count|leads in (my )?pipeline|leads do i have/i.test(lower)) {
    const breakdown = formatStatusBreakdown(ctx.pipelineByStatus)
    let reply = `You have **${ctx.pipelineLeadCount}** leads visible in your Pipeline`
    if (ctx.assignedLeadCount != null && ctx.assignedLeadCount !== ctx.pipelineLeadCount) {
      reply += ` (**${ctx.assignedLeadCount}** assigned to you)`
    }
    reply += '.'
    if (breakdown) reply += `\n\nBy stage: ${breakdown}.`
    if (ctx.overdueFollowUps > 0) {
      reply += `\n\n**${ctx.overdueFollowUps}** lead(s) have overdue follow-ups — open Calendar or Pipeline to catch up.`
    }
    return {
      reply,
      actions: [{ type: 'navigate', panel: 'pipeline', label: 'Open Pipeline' }],
      suggestions: ['Filter pipeline by stage', 'Bulk email from Pipeline'],
      source: 'grounded',
    }
  }

  if (/overdue follow|follow.?ups due/i.test(lower)) {
    const n = ctx.overdueFollowUps
    return {
      reply:
        n > 0
          ? `You have **${n}** overdue follow-up(s) on leads in your Pipeline. Open Calendar for the full schedule.`
          : 'You have **no overdue follow-ups** on your visible Pipeline leads right now.',
      actions: [{ type: 'navigate', panel: 'crm-calendar', label: 'Open Calendar' }],
      suggestions: ['How many leads in Pipeline?', 'Calendar and reminders'],
      source: 'grounded',
    }
  }

  if (/gmail connected|is (my )?email connected|work gmail/i.test(lower)) {
    const reply = ctx.gmailConnected
      ? `Yes — work Gmail **${ctx.gmailMailbox}** is connected for CRM send/receive.`
      : ctx.gmailConnectAvailable
        ? 'Work Gmail is **not connected** yet. Open a lead → Email tab → Connect work Gmail (or Work email in the sidebar).'
        : 'In-app Gmail connect is deferred until Google security review. Install the **Chrome extension** for Gmail trail sync and send-and-log, or use **Log reply** on a lead.'
    return {
      reply,
      actions: ctx.gmailConnected
        ? [{ type: 'navigate', panel: 'pipeline', label: 'Open Pipeline' }]
        : [{ type: 'navigate', panel: 'team', teamTab: 'integrations', label: 'Chrome extension' }],
      suggestions: ['Bulk email from Pipeline', 'CRM vs Marketing email'],
      source: 'grounded',
    }
  }

  if (/how many forms|marketing forms/i.test(lower) && /how many|count/i.test(lower)) {
    return {
      reply: `You have **${forms.length}** signup form(s) (**${liveForms.length}** live). Forms feed Pipeline — they are not marketing broadcast emails.`,
      actions: [{ type: 'navigate', panel: 'marketing', tab: 'forms', label: 'Open Forms' }],
      suggestions: ['Marketing campaigns vs Pipeline email', 'Email consent on forms'],
      source: 'grounded',
    }
  }

  if (/how many campaigns|marketing campaigns/i.test(lower) && /how many|count/i.test(lower)) {
    return {
      reply: `You have **${campaigns.length}** marketing campaign(s) (**${activeCampaigns.length}** active or scheduled). Audiences need consent before send.`,
      actions: [{ type: 'navigate', panel: 'marketing', tab: 'campaigns', label: 'Open Campaigns' }],
      suggestions: ['Campaign reports', 'Audience lists and segments'],
      source: 'grounded',
    }
  }

  if (/where am i|current page|what screen/i.test(lower) && uiContext.panel) {
    const tab = uiContext.tab ? ` → ${uiContext.tab}` : ''
    return {
      reply: `You're on **${uiContext.panel}**${tab}. Ask how to use this area or say what you want to accomplish.`,
      actions: [],
      suggestions: ['CRM vs Marketing email', 'Open command palette ⌘K'],
      source: 'grounded',
    }
  }

  return null
}

/** Grounded deal forecast for Connect Copilot (uses Pipeline deals API data). */
export async function tryGroundedDealsForecastReply(message, store, user) {
  if (!isDealsForecastQuestion(message)) return null

  if (!user?.organizationId) {
    return {
      reply:
        'Deal forecasting is available on **company workspaces** with freight deals in Pipeline. Switch to your org account or ask about lead counts instead.',
      actions: [{ type: 'navigate', panel: 'pipeline', label: 'Open Pipeline' }],
      suggestions: ['How many leads in Pipeline?', 'Who needs follow-up today?'],
      source: 'grounded',
    }
  }

  const payload = await loadDealsForecastForUser(user, store, { dealStage: 'all' })
  if (payload.error === 'FORECAST_LIMIT') {
    return {
      reply: `Your deal forecast spans more than **${payload.maxRows.toLocaleString()}** rows. Narrow filters in **Pipeline → Deals** and export or view the forecast bar there.`,
      actions: [{ type: 'navigate', panel: 'pipeline', view: 'deals', label: 'Open Deals' }],
      suggestions: ['Export deals CSV', 'Filter deals by stage'],
      source: 'grounded',
    }
  }

  return {
    reply: formatDealsForecastReply(payload.forecast),
    actions: [{ type: 'navigate', panel: 'pipeline', view: 'deals', label: 'Open deal forecast' }],
    suggestions: ['Highlight stalled deals', 'Export deals CSV', 'Who needs follow-up today?'],
    source: 'grounded',
  }
}

export async function tryGroundedAssistantReply(message, store, user, uiContext = {}) {
  const sync = tryGroundedWorkspaceReply(message, store, user, uiContext)
  if (sync) return sync
  return tryGroundedDealsForecastReply(message, store, user)
}

/** High-confidence FAQ match — skip LLM for known product answers. */
export function tryHighConfidenceFaq(message) {
  const entries = findBestFaqEntries(message, 1)
  const entry = entries[0]
  if (!entry) return null
  const score = scoreFaqMatch(message, entry)
  if (score < 5) return null

  const actions = []
  if (entry.navigate?.panel) {
    actions.push({
      type: 'navigate',
      ...entry.navigate,
      label: `Open ${entry.title}`,
    })
  }
  return {
    reply: entry.body,
    actions,
    suggestions: ASSISTANT_FAQ_VISIBLE.filter((f) => f.id !== entry.id)
      .slice(0, 3)
      .map((f) => f.title),
    source: 'faq_confident',
  }
}

export function enrichContextWithWorkspace(store, user, uiContext = {}) {
  const base = buildAssistantUserContext(store, user)
  const forms = filterMarketingRows(store.marketingForms || [], user)
  const campaigns = filterMarketingCampaignsVisible(store.marketingCampaigns || [], user)
  return {
    ...base,
    uiPanel: uiContext.panel || null,
    uiTab: uiContext.tab || null,
    uiLeadId: uiContext.leadId || null,
    marketingFormCount: forms.length,
    marketingLiveFormCount: forms.filter((f) => f.status === 'live').length,
    marketingCampaignCount: campaigns.length,
    marketingActiveCampaignCount: campaigns.filter((c) =>
      ['active', 'scheduled'].includes(c.status)
    ).length,
  }
}

export function formatEnrichedContextForPrompt(ctx) {
  const lines = [
    `User: ${ctx.name} (${ctx.email})`,
    `Organization: ${ctx.organizationName || 'Individual'}`,
    `Role: ${ctx.isOrgAdmin ? 'company admin' : ctx.orgRole || 'member'}`,
    `Current screen: ${ctx.uiPanel || 'unknown'}${ctx.uiTab ? ` / ${ctx.uiTab}` : ''}`,
    `Pipeline leads visible: ${ctx.pipelineLeadCount}`,
    `Assigned to user: ${ctx.assignedLeadCount}`,
    `Overdue follow-ups: ${ctx.overdueFollowUps}`,
    `Work Gmail: ${ctx.gmailConnected ? `connected (${ctx.gmailMailbox})` : 'not connected'}`,
    `Marketing forms: ${ctx.marketingFormCount} (${ctx.marketingLiveFormCount} live)`,
    `Marketing campaigns: ${ctx.marketingCampaignCount} (${ctx.marketingActiveCampaignCount} active/scheduled)`,
  ]
  if (ctx.pipelineByStatus && Object.keys(ctx.pipelineByStatus).length) {
    lines.push(`Pipeline by stage: ${JSON.stringify(ctx.pipelineByStatus)}`)
  }
  return lines.join('\n')
}
