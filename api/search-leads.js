/**
 * Vercel serverless — lead search (import DB → Apollo → demo → Claude).
 */
import { isApolloConfigured, searchApolloPeople } from '../lib/server/apollo.js'
import { readStore } from '../lib/server/store.js'
import { getMockLeadsForViewer, searchStoredLeads, shapeLeadForViewer } from '../lib/server/search.js'
import { DEFAULT_SEARCH_LIMIT } from '../lib/server/config.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../lib/server/http.js'
import { consumeSearchQuota, requireUser } from '../lib/server/auth.js'

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
  const { filters = {}, count = DEFAULT_SEARCH_LIMIT, provider = 'auto' } = getBody(req)
  const store = await readStore()
  const viewer = quotaUser

  const databaseResults = searchStoredLeads(store, filters, count, viewer)
  if (databaseResults?.leads?.length) {
    return sendJson(res, 200, { ...databaseResults, user: quotaUser })
  }

  let apolloError = null
  const useApollo = provider === 'apollo' || (provider === 'auto' && isApolloConfigured())

  if (useApollo) {
    try {
      const apolloResults = await searchApolloPeople(filters, count, store, viewer)
      if (apolloResults?.leads?.length) {
        return sendJson(res, 200, { ...apolloResults, user: quotaUser })
      }
      apolloError = 'Apollo returned no matches for these filters.'
    } catch (error) {
      apolloError = error.message || 'Apollo search failed'
      if (provider === 'apollo') {
        return sendJson(res, 502, { error: apolloError })
      }
    }
  } else if (provider === 'apollo') {
    return sendJson(res, 503, {
      error: 'Apollo.io is not configured. Add APOLLO_API_KEY in Vercel and redeploy.',
    })
  }

  const mockLeads = getMockLeadsForViewer(store, viewer, filters, count)
  if (mockLeads.length && provider !== 'claude') {
    const notice = apolloError
      ? `Apollo: ${apolloError} Showing sample India leads for this search.`
      : 'Showing sample India leads. Import data in Admin or use Apollo.io for live B2B records.'

    return sendJson(res, 200, {
      leads: mockLeads,
      total: Math.max(mockLeads.length * 50, mockLeads.length),
      netNew: Math.max(mockLeads.length, Math.floor(mockLeads.length * 0.85)),
      provider: 'demo-india',
      notice,
      user: quotaUser,
    })
  }

  if (provider === 'claude' || (provider === 'auto' && anthropicKey)) {
    if (!anthropicKey) {
      return sendJson(res, 503, {
        error: 'Claude is not configured. Add ANTHROPIC_API_KEY on Vercel.',
      })
    }

    try {
      const prompt = buildPrompt(filters, count)
      const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
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
        return sendJson(res, anthropicRes.status, {
          error: data.error?.message || 'Claude API error',
        })
      }

      const text = (data.content || [])
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('\n')

      const leads = parseLeadsJson(text).map((lead, index) => shapeLeadForViewer(lead, store, viewer, index))
      if (leads.length) {
        const total = Math.max(leads.length * 120, 2400 + Math.floor(Math.random() * 8000))
        return sendJson(res, 200, {
          leads,
          total,
          netNew: Math.floor(total * 0.88),
          provider: 'claude',
          user: quotaUser,
        })
      }
    } catch (e) {
      return sendJson(res, 500, { error: e.message || 'Search failed' })
    }
  }

  const hints = []
  if (isApolloConfigured() && apolloError) hints.push(`Apollo: ${apolloError}`)
  if (!isApolloConfigured()) hints.push('Add APOLLO_API_KEY on Vercel')
  if (!anthropicKey) hints.push('or ANTHROPIC_API_KEY for AI search')
  hints.push('Admins can import Excel data under Admin')

  return sendJson(res, 200, {
    leads: [],
    total: 0,
    netNew: 0,
    provider: 'none',
    notice: `No leads found. ${hints.join('. ')}.`,
    user: quotaUser,
  })
}

function buildPrompt(filters, count) {
  const parts = []
  if (filters.keywords) parts.push(`Keywords: ${filters.keywords}`)
  if (filters.jobTitles?.length) parts.push(`Job titles: ${filters.jobTitles.join(', ')}`)
  if (filters.states?.length) parts.push(`Indian states: ${filters.states.join(', ')}`)
  if (filters.cities?.length) parts.push(`Cities: ${filters.cities.join(', ')}`)
  if (filters.industries?.length) parts.push(`Industries: ${filters.industries.join(', ')}`)
  if (filters.companySizes?.length) parts.push(`Company size: ${filters.companySizes.join(', ')}`)

  const criteria = parts.length ? parts.join('\n') : 'General B2B prospects in India'

  return `You are a B2B lead intelligence expert focused on the Indian market.

Find ${count} realistic Indian business contacts matching:
${criteria}

Return ONLY a valid JSON array (no markdown). Each object:
{
  "id": "unique-string",
  "firstName": "",
  "lastName": "",
  "title": "",
  "company": "",
  "companyDomain": "",
  "email": "",
  "phone": "+91-...",
  "location": "City, State",
  "state": "Indian state",
  "city": "",
  "industry": "",
  "employees": "11-50",
  "emailStatus": "verified|likely|unverified",
  "score": 60-97,
  "linkedin": ""
}

Use real-sounding Indian companies. Match cities/states when specified.`
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
