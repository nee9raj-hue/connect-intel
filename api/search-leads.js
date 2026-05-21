/**
 * Lead search — database → mock → Gemini keyword expand → Perplexity discovery.
 */
import { isApolloConfigured, searchApolloPeople, verifyApolloApiKey } from '../lib/server/apollo.js'
import { paidApisEnabled } from '../lib/server/config.js'
import { expandSearchKeywords, isGeminiConfigured } from '../lib/server/gemini.js'
import { discoverLeadsWithPerplexity, isPerplexityConfigured } from '../lib/server/perplexity.js'
import { ensureBuiltInDatabase } from '../lib/server/seed.js'
import { readStore } from '../lib/server/store.js'
import { getMockLeadsForViewer, searchStoredLeads, shapeLeadForViewer } from '../lib/server/search.js'
import { DEFAULT_SEARCH_LIMIT } from '../lib/server/config.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../lib/server/http.js'
import { consumeSearchQuota, requireUser } from '../lib/server/auth.js'

const FREE_NOTICE =
  'Results from the Connect Intel database — built-in India B2B records plus data your team imports.'

function hasStructuredFilters(filters) {
  return Boolean(
    filters.jobTitles?.length ||
      filters.states?.length ||
      filters.cities?.length ||
      filters.industries?.length ||
      filters.companySizes?.length
  )
}

function tryLocalSearch(store, filters, count, viewer) {
  const databaseResults = searchStoredLeads(store, filters, count, viewer)
  if (databaseResults?.leads?.length) {
    return { ...databaseResults, notice: FREE_NOTICE }
  }

  const mockLeads = getMockLeadsForViewer(store, viewer, filters, count)
  if (mockLeads.length) {
    return {
      leads: mockLeads,
      total: Math.max(mockLeads.length * 40, mockLeads.length),
      netNew: mockLeads.length,
      provider: 'database',
      notice: 'Sample prospects matching your filters.',
    }
  }

  if (!hasStructuredFilters(filters)) {
    const broadMock = getMockLeadsForViewer(store, viewer, { ...filters, keywords: '' }, count)
    if (broadMock.length) {
      return {
        leads: broadMock,
        total: broadMock.length,
        netNew: broadMock.length,
        provider: 'database',
        notice:
          'No exact keyword match — showing related India prospects. Add state or role filters to narrow further.',
      }
    }
  }

  return null
}

function runLocalSearch(store, filters, count, viewer) {
  let result = tryLocalSearch(store, filters, count, viewer)

  if (!result?.leads?.length && filters.jobTitles?.length) {
    const relaxed = tryLocalSearch(store, { ...filters, jobTitles: [] }, count, viewer)
    if (relaxed?.leads?.length) {
      return {
        ...relaxed,
        notice: `${relaxed.notice || FREE_NOTICE} Designation filter had no matches — results shown without role filter.`,
        relaxedRoleFilter: true,
      }
    }
  }

  return result
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])

  const user = await requireUser(req, res)
  if (!user) return

  let quotaUser
  try {
    quotaUser = await consumeSearchQuota(req, res)
  } catch (error) {
    return sendJson(res, 402, { error: error.message || 'Search quota exceeded' })
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY
  const { filters = {}, count = DEFAULT_SEARCH_LIMIT, provider = 'free' } = getBody(req)

  await ensureBuiltInDatabase()
  const store = await readStore()
  const viewer = quotaUser

  let result = runLocalSearch(store, filters, count, viewer)

  if (!result?.leads?.length && isGeminiConfigured()) {
    const expanded = await expandSearchKeywords(filters)
    if (expanded.keywords && expanded.keywords !== filters.keywords) {
      const retry = runLocalSearch(
        store,
        { ...filters, keywords: expanded.keywords },
        count,
        viewer
      )
      if (retry?.leads?.length) {
        result = {
          ...retry,
          notice: `${retry.notice} Gemini expanded your search terms.`,
          expandedKeywords: expanded.keywords,
        }
      }
    }
  }

  let discoveryError = null

  if (!result?.leads?.length && isPerplexityConfigured()) {
    const discovery = await discoverLeadsWithPerplexity(filters, Math.min(count, 8))
    if (discovery.leads?.length) {
      const leads = discovery.leads.map((lead, index) => shapeLeadForViewer(lead, store, viewer, index))
      result = {
        leads,
        total: leads.length,
        netNew: leads.length,
        provider: 'ai-discovery',
        notice: discovery.notice,
        discoveryMethod: discovery.method,
      }
    } else if (discovery.error) {
      discoveryError = discovery.error
    }
  }

  if (result?.leads?.length) {
    return sendJson(res, 200, { ...result, user: quotaUser })
  }

  const usePaid = paidApisEnabled()
  const apolloOk = usePaid && isApolloConfigured() && (await verifyApolloApiKey()).ok
  const useApollo = apolloOk && (provider === 'apollo' || provider === 'auto')

  if (useApollo) {
    try {
      const apolloResults = await searchApolloPeople(filters, count, store, viewer)
      if (apolloResults?.leads?.length) {
        return sendJson(res, 200, { ...apolloResults, user: quotaUser })
      }
      if (provider === 'apollo') {
        return sendJson(res, 200, {
          leads: [],
          total: 0,
          netNew: 0,
          provider: 'apollo',
          notice: 'No matches in partner data. Try different filters or ask your admin to import more companies.',
          user: quotaUser,
        })
      }
    } catch (error) {
      if (provider === 'apollo') {
        return sendJson(res, 502, { error: error.message })
      }
    }
  } else if (provider === 'apollo') {
    return sendJson(res, 200, {
      leads: [],
      total: 0,
      netNew: 0,
      provider: 'database',
      notice: 'Extended partner search is not enabled for your account. Results use the Connect Intel database.',
      user: quotaUser,
    })
  }

  if (usePaid && (provider === 'claude' || provider === 'auto') && anthropicKey) {
    try {
      const leads = await searchViaClaude(filters, count, store, viewer, anthropicKey)
      if (leads.length) {
        const total = Math.max(leads.length * 120, 2400)
        return sendJson(res, 200, {
          leads,
          total,
          netNew: Math.floor(total * 0.88),
          provider: 'claude',
          user: quotaUser,
        })
      }
    } catch (e) {
      return sendJson(res, 500, { error: e.message || 'Claude search failed' })
    }
  }

  if (provider === 'claude') {
    return sendJson(res, 200, {
      leads: [],
      total: 0,
      netNew: 0,
      provider: 'database',
      notice: 'AI expansion search is not enabled. Results use the Connect Intel database.',
      user: quotaUser,
    })
  }

  const hints = []
  if (!isGeminiConfigured()) hints.push('Set GEMINI_API_KEY for smarter keyword expansion')
  if (!isPerplexityConfigured()) hints.push('Set PERPLEXITY_API_KEY for AI discovery when the database is empty')

  return sendJson(res, 200, {
    leads: [],
    total: 0,
    netNew: 0,
    provider: 'none',
    notice: `No leads matched your filters. Try clearing Designation, use keyword "exporter", or import data in Admin.${hints.length ? ` ${hints.join('. ')}.` : ''}`,
    discoveryError,
    user: quotaUser,
  })
}

async function searchViaClaude(filters, count, store, viewer, apiKey) {
  const prompt = buildPrompt(filters, count)
  const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  const data = await anthropicRes.json()
  if (!anthropicRes.ok) {
    throw new Error(data.error?.message || 'Claude API error')
  }

  const text = (data.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')

  return parseLeadsJson(text).map((lead, index) => shapeLeadForViewer(lead, store, viewer, index))
}

function buildPrompt(filters, count) {
  const parts = []
  if (filters.keywords) parts.push(`Keywords: ${filters.keywords}`)
  if (filters.jobTitles?.length) parts.push(`Job titles: ${filters.jobTitles.join(', ')}`)
  if (filters.states?.length) parts.push(`Indian states: ${filters.states.join(', ')}`)
  if (filters.cities?.length) parts.push(`Cities: ${filters.cities.join(', ')}`)
  if (filters.industries?.length) parts.push(`Industries: ${filters.industries.join(', ')}`)

  const criteria = parts.length ? parts.join('\n') : 'General B2B prospects in India'

  return `Find ${count} realistic Indian B2B contacts matching:\n${criteria}\n\nReturn ONLY a JSON array of lead objects with firstName, lastName, title, company, email, phone, city, state, industry.`
}

function parseLeadsJson(text) {
  try {
    const m = text.match(/\[[\s\S]*\]/)
    if (!m) return []
    const arr = JSON.parse(m[0])
    return arr.map((l, i) => ({
      ...l,
      id: l.id || `claude-${i}-${Date.now()}`,
      source: 'claude',
    }))
  } catch {
    return []
  }
}
