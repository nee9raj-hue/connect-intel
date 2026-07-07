import { ASSISTANT_CONSTITUTION } from '../../assistantConstitution.js'
import { formatEnrichedContextForPrompt } from '../assistantCrmFacts.js'
import { buildFaqDigestForPrompt } from '../../assistantKnowledge.js'

function extractCompanyFromText(text) {
  const atMatch = String(text || '').match(/\bat\s+([A-Z][A-Za-z0-9&.' -]{2,48})/)
  if (atMatch) return atMatch[1].trim()
  const quoted = String(text || '').match(/["']([^"']{2,48})["']/)
  if (quoted) return quoted[1].trim()
  return null
}

function parseCompanyCardFromReply(reply, { leadContext, crmSearch, query }) {
  const card = {}

  if (leadContext) {
    card.name = leadContext.company || leadContext.name
    card.website = leadContext.website || ''
    card.industry = leadContext.industry || ''
    card.crmStatus = `In pipeline · ${leadContext.status}`
    card.leadId = leadContext.id
  }

  const nameFromQuery = extractCompanyFromText(query)
  if (nameFromQuery && !card.name) card.name = nameFromQuery

  const websiteMatch = String(reply || '').match(/(https?:\/\/[^\s)\]]+)/i)
  if (websiteMatch && !card.website) {
    const url = websiteMatch[1]
    if (!/linkedin\.com/i.test(url)) card.website = url
  }

  const industryMatch = String(reply || '').match(/\bindustry[:\s]+([^\n.]+)/i)
  if (industryMatch) card.industry = industryMatch[1].trim().slice(0, 80)

  const newsMatch = String(reply || '').match(/\*\*Findings\*\*[\s\S]*?[-•]\s*([^\n]{20,120}(?:news|funding|raised|launch)[^\n]*)/i)
  if (newsMatch) card.newsHeadline = newsMatch[1].trim().slice(0, 140)

  if (crmSearch?.results?.length) {
    const companyHits = crmSearch.results.filter((r) => r.type === 'company' || r.type === 'lead')
    if (companyHits.length && !card.crmStatus) {
      card.crmStatus = `${companyHits.length} match(es) in your CRM`
    }
  }

  if (!card.name && !card.website && !card.industry) return null
  return card
}

function formatSingleSourceReply(result, source) {
  if (!result?.reply) return null
  return {
    reply: result.reply,
    source,
    sources: [sourceBadge(source)],
    suggestions: result.suggestions || [],
    actions: result.actions || [],
  }
}

function sourceBadge(source) {
  const map = {
    grounded: { type: 'crm', label: 'Your workspace' },
    faq_confident: { type: 'guide', label: 'Product guide' },
    faq: { type: 'guide', label: 'Product guide' },
    web: { type: 'web', label: 'Web research' },
    crm: { type: 'crm', label: 'CRM records' },
    ai: { type: 'copilot', label: 'Connect Copilot' },
  }
  return map[source] || { type: 'copilot', label: 'Connect Copilot' }
}

function formatWebReply(webResult) {
  if (webResult.error && !webResult.text) {
    return {
      reply: webResult.error,
      source: 'web_error',
      sources: [{ type: 'web', label: 'Web research' }],
      suggestions: [],
      actions: [],
    }
  }

  let reply = String(webResult.text || '').trim()
  const cites = (webResult.citations || []).filter((u) => /^https:\/\//i.test(String(u)))
  if (cites.length) {
    reply += '\n\n**Sources**'
    ;[...new Set(cites)].slice(0, 6).forEach((url, i) => {
      reply += `\n${i + 1}. ${url}`
    })
  }

  return {
    reply,
    source: 'web',
    sources: [{ type: 'web', label: webResult.fromCache ? 'Web (cached)' : 'Web research' }],
    suggestions: [],
    actions: (cites || [])
      .slice(0, 3)
      .filter((u) => /^https:\/\//i.test(u))
      .map((url, i) => ({ type: 'open_url', url, label: `Source ${i + 1}` })),
  }
}

function formatCrmSearchReply(searchResult) {
  if (!searchResult?.results?.length) {
    return {
      reply: `**Answer:** No CRM records matched "${searchResult?.query || 'your search'}".\n\n**Details:** Try a company name, contact email, or open Pipeline to browse.`,
      source: 'crm',
      sources: [{ type: 'crm', label: 'CRM search' }],
      suggestions: ['How many leads in my pipeline?', 'Open Pipeline'],
      actions: [{ type: 'navigate', panel: 'pipeline', label: 'Open Pipeline' }],
    }
  }

  const lines = searchResult.results.map((r, i) => {
    const extra = r.subtitle ? ` — ${r.subtitle}` : ''
    return `${i + 1}. **${r.title}**${extra}`
  })

  return {
    reply: `**Answer:** Found **${searchResult.results.length}** record(s) for "${searchResult.query}".\n\n**Details:**\n${lines.join('\n')}`,
    source: 'crm',
    sources: [{ type: 'crm', label: 'CRM search' }],
    suggestions: [],
    actions: [],
  }
}

function formatLeadSummaryReply(lead) {
  const location = [lead.city, lead.state].filter(Boolean).join(', ')
  return {
    reply: `**Answer:** **${lead.name}** at **${lead.company || '—'}** is in your pipeline (${lead.status}).\n\n**Details:**\n- Email: ${lead.email || '—'}\n- Phone: ${lead.phone || '—'}\n- Location: ${location || '—'}\n- Open deals: ${lead.openDeals}\n- Overdue follow-up: ${lead.overdueFollowUp ? '**yes**' : 'no'}`,
    source: 'crm',
    sources: [{ type: 'crm', label: 'Current lead' }],
    suggestions: ['Research this company on the web', 'Draft a follow-up email'],
    actions: [
      { type: 'navigate', panel: 'pipeline', leadId: lead.id, label: 'Open lead' },
      { type: 'navigate', panel: 'pipeline', leadId: lead.id, leadTab: 'email', label: 'Draft email' },
    ],
  }
}

async function callCopilotSynthesizer({ message, ctx, retrievalBundle, history }) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null

  const blocks = []
  if (retrievalBundle.grounded?.reply) blocks.push(`WORKSPACE FACTS:\n${retrievalBundle.grounded.reply}`)
  if (retrievalBundle.faq?.reply) blocks.push(`PRODUCT FAQ:\n${retrievalBundle.faq.reply}`)
  if (retrievalBundle.leadContext) blocks.push(retrievalBundle.leadContextPrompt)
  if (retrievalBundle.crmSearchPrompt) blocks.push(retrievalBundle.crmSearchPrompt)
  if (retrievalBundle.web?.reply) blocks.push(`WEB RESEARCH:\n${retrievalBundle.web.reply}`)

  const system = `You are Connect Copilot — Connect Intel's sales copilot.

${ASSISTANT_CONSTITUTION}

Synthesize the RETRIEVAL BLOCKS into one compact answer for the user.

Format:
**Answer:** 1-2 sentences — direct answer to the exact question.
**Details:** 3-6 bullets with specific names, numbers, URLs, CRM matches.
**Next step:** (optional) one actionable line.

Rules:
- Use facts from blocks only — never invent CRM counts or people.
- Prefer named entities over generic advice.
- If web found people, list Name — Title @ Company with URLs.
- Respond with ONLY valid JSON:
{"reply":"...","confidence":"high|medium|low","companyName":"","website":"","industry":"","newsHeadline":"","crmNote":""}

USER CONTEXT:
${formatEnrichedContextForPrompt(ctx)}

PRODUCT KNOWLEDGE (reference):
${buildFaqDigestForPrompt().slice(0, 4000)}`

  const messages = [
    ...history.slice(-8).map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    })),
    {
      role: 'user',
      content: `Question: ${message}\n\nRETRIEVAL BLOCKS:\n${blocks.join('\n\n---\n\n')}`,
    },
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
      max_tokens: 1200,
      system,
      messages,
    }),
  })

  const data = await response.json()
  if (!response.ok) throw new Error(data.error?.message || 'Synthesis failed')

  const text = (data.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')

  try {
    const block = text.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(block ? block[0] : text)
    const sources = []
    if (retrievalBundle.grounded) sources.push({ type: 'crm', label: 'Your workspace' })
    if (retrievalBundle.crmSearch?.results?.length) sources.push({ type: 'crm', label: 'CRM search' })
    if (retrievalBundle.web) sources.push({ type: 'web', label: 'Web research' })
    if (!sources.length) sources.push({ type: 'copilot', label: 'Connect Copilot' })

    const companyCard =
      parsed.companyName || parsed.website
        ? {
            name: parsed.companyName || '',
            website: parsed.website || '',
            industry: parsed.industry || '',
            newsHeadline: parsed.newsHeadline || '',
            crmStatus: parsed.crmNote || '',
          }
        : null

    return {
      reply: String(parsed.reply || '').trim(),
      source: 'copilot',
      sources,
      confidence: parsed.confidence || 'medium',
      companyCard,
      suggestions: [],
      actions: [],
    }
  } catch {
    return {
      reply: text.trim(),
      source: 'copilot',
      sources: [{ type: 'copilot', label: 'Connect Copilot' }],
      confidence: 'medium',
      suggestions: [],
      actions: [],
    }
  }
}

export async function synthesizeCopilotReply({
  message,
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
}) {
  const web = webRaw?.text ? formatWebReply(webRaw) : webRaw?.error ? formatWebReply(webRaw) : null

  if (
    grounded &&
    !plan.runWeb &&
    !plan.runCrmSearch &&
    !/\b(summarize|research|draft)\b/i.test(message)
  ) {
    return { ...formatSingleSourceReply(grounded, 'grounded'), confidence: 'high' }
  }

  if (faq && !plan.runWeb && !plan.runCrmSearch) {
    return { ...formatSingleSourceReply(faq, 'faq_confident'), confidence: 'high' }
  }

  if (plan.intents?.crmSearch && crmSearch && !plan.runWeb && !leadContext) {
    const out = formatCrmSearchReply(crmSearch)
    return { ...out, confidence: 'high' }
  }

  if (
    leadContext &&
    /\b(summarize|summary|this lead|current lead)\b/i.test(message) &&
    !plan.runWeb
  ) {
    return { ...formatLeadSummaryReply(leadContext), confidence: 'high' }
  }

  if (web && !grounded && !faq && !crmSearch?.results?.length && !leadContext) {
    return { ...web, confidence: web.source === 'web_error' ? 'low' : 'medium' }
  }

  const bundle = {
    grounded,
    faq,
    leadContext,
    leadContextPrompt,
    crmSearch,
    crmSearchPrompt,
    web,
  }

  try {
    const synthesized = await callCopilotSynthesizer({
      message,
      ctx,
      retrievalBundle: bundle,
      history,
    })
    if (synthesized?.reply) return synthesized
  } catch {
    /* fall through */
  }

  if (web?.reply) return { ...web, confidence: 'medium' }
  if (grounded) return { ...formatSingleSourceReply(grounded, 'grounded'), confidence: 'high' }
  if (faq) return { ...formatSingleSourceReply(faq, 'faq_confident'), confidence: 'high' }
  if (crmSearch) return { ...formatCrmSearchReply(crmSearch), confidence: 'medium' }
  if (leadContext) return { ...formatLeadSummaryReply(leadContext), confidence: 'high' }

  return null
}

export function enrichCompanyCard(companyCard, { reply, leadContext, crmSearch, query }) {
  const parsed = parseCompanyFromReply(reply, { leadContext, crmSearch, query })
  if (!parsed && !companyCard) return null
  return { ...parsed, ...companyCard, name: companyCard?.name || parsed?.name }
}

function parseCompanyFromReply(reply, opts) {
  return parseCompanyCardFromReply(reply, opts)
}
