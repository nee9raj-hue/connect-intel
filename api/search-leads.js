/**
 * Vercel serverless — Claude lead search (keeps API key off the browser).
 * Set ANTHROPIC_API_KEY in Vercel → Environment Variables.
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
    quotaUser = await consumeSearchQuota(user.id)
  } catch (error) {
    return sendJson(res, 402, { error: error.message || 'Search quota exceeded' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  const { filters = {}, count = DEFAULT_SEARCH_LIMIT, provider = 'auto' } = getBody(req)
  const store = await readStore()
  const viewer = quotaUser
  const databaseResults = searchStoredLeads(store, filters, count, viewer)
  if (databaseResults?.leads?.length) {
    return sendJson(res, 200, { ...databaseResults, user: quotaUser })
  }

  const useApollo = provider === 'apollo' || (provider === 'auto' && isApolloConfigured())
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
          notice: 'No Apollo matches for these filters. Try broader keywords or India city/state filters.',
          user: quotaUser,
        })
      }
    } catch (error) {
      if (provider === 'apollo') {
        return sendJson(res, 502, { error: error.message || 'Apollo search failed' })
      }
      console.warn('Apollo search fallback:', error.message)
    }
  }

  if (provider === 'apollo') {
    return sendJson(res, 503, {
      error: 'Apollo.io is not configured. Add APOLLO_API_KEY to your server environment.',
    })
  }

  if (!apiKey) {
    const mockLeads = getMockLeadsForViewer(store, viewer, filters, count)
    return sendJson(res, 200, {
      leads: mockLeads,
      total: mockLeads.length,
      netNew: Math.max(mockLeads.length, Math.floor(mockLeads.length * 0.8)),
      provider: mockLeads.length ? 'demo-india' : 'database',
      notice: mockLeads.length
        ? 'Showing demo India leads. Import records or add Apollo later for production data.'
        : 'No imported records matched this search yet. Add datasets in Admin or enable Claude fallback.',
      user: quotaUser,
    })
  }

  const prompt = buildPrompt(filters, count)

  try {
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
      return sendJson(res, anthropicRes.status, {
        error: data.error?.message || 'Claude API error',
      })
    }

    const text = (data.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n')

    const leads = parseLeadsJson(text).map((lead, index) => shapeLeadForViewer(lead, store, viewer, index))
    const total = Math.max(leads.length * 120, 2400 + Math.floor(Math.random() * 8000))

    return sendJson(res, 200, {
      leads,
      total,
      netNew: Math.floor(total * 0.88),
      provider: 'claude',
      user: quotaUser,
    })
  } catch (e) {
    return sendJson(res, 500, { error: e.message || 'Search failed' })
  }
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
