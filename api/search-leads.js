/**
 * Lead search — free built-in database first; paid Apollo/Claude only if ENABLE_PAID_APIS=true.
 */
import { isApolloConfigured, searchApolloPeople, verifyApolloApiKey } from '../lib/server/apollo.js'
import { paidApisEnabled } from '../lib/server/config.js'
import { ensureBuiltInDatabase } from '../lib/server/seed.js'
import { readStore } from '../lib/server/store.js'
import { getMockLeadsForViewer, searchStoredLeads, shapeLeadForViewer } from '../lib/server/search.js'
import { DEFAULT_SEARCH_LIMIT } from '../lib/server/config.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../lib/server/http.js'
import { consumeSearchQuota, requireUser } from '../lib/server/auth.js'

const FREE_NOTICE =
  'Connect Intel free database — no Apollo or Claude API needed. Admins can add more rows via Excel import.'

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

  const databaseResults = searchStoredLeads(store, filters, count, viewer)
  if (databaseResults?.leads?.length) {
    return sendJson(res, 200, {
      ...databaseResults,
      notice: FREE_NOTICE,
      user: quotaUser,
    })
  }

  const mockLeads = getMockLeadsForViewer(store, viewer, filters, count)
  if (mockLeads.length) {
    return sendJson(res, 200, {
      leads: mockLeads,
      total: Math.max(mockLeads.length * 40, mockLeads.length),
      netNew: mockLeads.length,
      provider: 'demo-india',
      notice: `${FREE_NOTICE} Showing extra sample leads.`,
      user: quotaUser,
    })
  }

  if (provider === 'free' || provider === 'auto' || provider === 'database') {
    const broadMock = getMockLeadsForViewer(store, viewer, { ...filters, keywords: '' }, count)
    if (broadMock.length) {
      return sendJson(res, 200, {
        leads: broadMock,
        total: broadMock.length,
        netNew: broadMock.length,
        provider: 'demo-india',
        notice: 'No exact match — showing available India sample leads. Try keywords like Jaipur or exporter.',
        user: quotaUser,
      })
    }
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
          notice: 'No Apollo matches. Switch source to Free database or add Admin import data.',
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
      notice:
        'Apollo is off in free mode. Use source “Free database”, or set ENABLE_PAID_APIS=true on Vercel with a valid master API key.',
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
      notice: 'Claude is off in free mode. Use Free database source, or add ENABLE_PAID_APIS=true and ANTHROPIC_API_KEY.',
      user: quotaUser,
    })
  }

  return sendJson(res, 200, {
    leads: [],
    total: 0,
    netNew: 0,
    provider: 'none',
    notice: 'No leads matched. Try: keywords “exporter”, city Jaipur, state Rajasthan.',
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
