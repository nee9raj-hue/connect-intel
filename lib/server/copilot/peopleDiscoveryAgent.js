/**
 * People Discovery Agent — founder/LinkedIn at a company, NOT a company list.
 */

import { discoverLinkedinForContact, isPerplexityConfigured } from '../perplexity.js'
import { retrieveCrmSearch } from './retrievers.js'
import { buildV3Reply } from './structuredResponse.js'
import { buildUnderstandingLine } from './entityExtractor.js'
import { buildPlanSteps } from './discoveryMemory.js'
import { buildNBSA } from './nbsa.js'

function withPeopleTimeout(promise, ms = 45_000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('people_timeout')), ms)
    }),
  ])
}

export async function runPeopleDiscoveryAgent({ store, user, message, entities, plan }) {
  const company = entities.company || ''
  const role = entities.personRole || 'Founder'
  const understanding = buildUnderstandingLine({
    intentCategory: 'person_discovery',
    entities,
    message,
  })

  const planSteps = [
    { id: 'intent', label: 'Person discovery intent', status: 'done' },
    { id: 'crm', label: 'Searching CRM for company', status: 'done' },
    { id: 'people', label: 'Searching public LinkedIn & web', status: 'done' },
    { id: 'validate', label: 'Validating profiles', status: 'done' },
    { id: 'ready', label: 'Results ready', status: 'done' },
  ]

  let crmLines = []
  let crmLeadId = null
  if (company) {
    const crm = await retrieveCrmSearch(store, user, company, { limit: 3 })
    if (crm?.results?.length) {
      crmLines = crm.results.map((r) => `**${r.title}**${r.subtitle ? ` — ${r.subtitle}` : ''}`)
      crmLeadId = crm.results[0]?.leadId || null
    } else {
      crmLines = [`No CRM record for **${company}** yet`]
    }
  }

  if (!isPerplexityConfigured()) {
    return formatPeopleResult({
      understanding,
      answer: `I can't search public profiles without web search configured.`,
      crmLines,
      externalLines: ['Enable Market Intelligence search on the server.'],
      planSteps,
      confidence: 'low',
      crmLeadId,
      people: [],
      plan,
      entities,
    })
  }

  let discovery
  try {
    discovery = await withPeopleTimeout(
      discoverLinkedinForContact({
        company,
        title: role,
        firstName: '',
        lastName: '',
      })
    )
  } catch (err) {
    const timedOut = err?.message === 'people_timeout'
    return formatPeopleResult({
      understanding,
      answer: timedOut
        ? `Profile search timed out for **${company}**. Try again with the exact company spelling.`
        : `I couldn't complete the profile search.`,
      crmLines,
      externalLines: [
        "I couldn't verify this from reliable public sources yet.",
        'Try directors or leadership pages on the company website instead.',
      ],
      planSteps,
      confidence: 'low',
      crmLeadId,
      people: [],
      plan,
      entities,
    })
  }

  const matches = discovery.matches || []
  const people = matches.slice(0, 5).map((m, i) => ({
    id: m.id || `person-${i}`,
    name: m.fullName || [m.firstName, m.lastName].filter(Boolean).join(' ') || role,
    title: m.title || role,
    company: m.company || company,
    linkedinUrl: m.linkedin || '',
    city: m.city || entities.location.cities[0] || '',
    confidence: m.confidence || (i === 0 ? 'high' : 'medium'),
  }))

  if (!people.length) {
    return formatPeopleResult({
      understanding,
      answer: `I couldn't confidently identify the **${role}** at **${company}** from public sources.`,
      crmLines,
      externalLines: [
        discovery.error || 'No verified LinkedIn profile found.',
        'Would you like me to search directors, leadership pages, or public business records instead?',
      ],
      planSteps,
      confidence: 'low',
      crmLeadId,
      people: [],
      plan,
      entities,
      suggestions: [
        `Search directors at ${company}`,
        `Research ${company} on the web`,
        'Add company to CRM',
      ],
    })
  }

  const top = people[0]
  const externalLines = people.map(
    (p) =>
      `**${p.name}** — ${p.title}${p.linkedinUrl ? ` · [LinkedIn](${p.linkedinUrl})` : ''} (${p.confidence} confidence)`
  )

  return formatPeopleResult({
    understanding,
    answer: `Found **${people.length}** public profile candidate(s) for **${role}** at **${company}**. Top match: **${top.name}**.`,
    crmLines,
    externalLines,
    planSteps,
    confidence: top.confidence === 'high' ? 'high' : 'medium',
    crmLeadId,
    people,
    plan,
    entities,
    companyCard: {
      name: company,
      contactName: top.name,
      title: top.title,
      linkedinUrl: top.linkedinUrl,
      leadId: crmLeadId,
      crmStatus: crmLeadId ? 'In CRM' : 'Not in CRM',
    },
    actions: [
      ...(top.linkedinUrl
        ? [{ type: 'open_url', url: top.linkedinUrl, label: 'Open LinkedIn profile' }]
        : []),
      ...(crmLeadId
        ? [{ type: 'navigate', panel: 'pipeline', leadId: crmLeadId, label: 'Open CRM record' }]
        : [
            {
              type: 'create_lead',
              label: 'Add company to CRM',
              payload: { company, industry: '' },
            },
          ]),
    ],
  })
}

function formatPeopleResult(ctx) {
  const nbsa = buildNBSA({
    plan: ctx.plan,
    result: { people: ctx.people },
    companyCard: ctx.companyCard,
    entities: ctx.entities,
  })

  const reply = buildV3Reply({
    understanding: `I understand you're looking for ${ctx.understanding}.`,
    answer: ctx.answer,
    crmFindings: ctx.crmLines,
    externalFindings: ctx.externalLines,
    recommendations: nbsa,
  })

  return {
    reply,
    understanding: `I understand you're looking for ${ctx.understanding}.`,
    nbsa,
    source: 'people_discovery',
    sources: [
      { type: 'crm', label: 'CRM' },
      { type: 'web', label: 'Public web' },
    ],
    confidence: ctx.confidence,
    people: ctx.people,
    companyCard: ctx.companyCard || null,
    planSteps: ctx.planSteps,
    suggestions: ctx.suggestions || [
      'Draft intro email',
      'Save contact to CRM',
      `Research ${ctx.entities?.company || 'company'}`,
    ],
    actions: ctx.actions || [],
  }
}
