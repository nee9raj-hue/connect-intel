/**
 * Lead search — database → mock → Gemini → Perplexity → paid APIs.
 * AI results are persisted to the database so repeat searches avoid paid calls.
 */
import { isApolloConfigured, searchApolloPeople, verifyApolloApiKey } from '../apollo.js'
import { paidApisEnabled } from '../config.js'
import { expandSearchKeywords, isGeminiConfigured } from '../gemini.js'
import {
  enrichSearchFiltersFromQuery,
  mergeParsedFilters,
  parseSearchQuery,
} from '../searchQueryParser.js'
import { discoveryFiltersReady, filterUsableLeads } from '../leadQuality.js'
import { discoverLeadsWithPerplexity, isPerplexityConfigured } from '../perplexity.js'
import { persistDiscoveredLeads } from '../leadPersistence.js'
import { ensureBuiltInDatabase } from '../seed.js'
import { readStore, updateStore } from '../store.js'
import { createId } from '../store.js'
import { getAiDiscoverySearchesLeft, consumeAiDiscoverySearch } from '../aiSearchQuota.js'
import { getMockLeadsForViewer, searchStoredLeads, shapeLeadForViewer } from '../search.js'
import {
  AI_SEARCH_DISPLAY_TOTAL_MIN,
  AI_SEARCH_FETCH_COUNT,
  DEFAULT_SEARCH_LIMIT,
  FREE_FULL_LEAD_PREVIEW_COUNT,
} from '../config.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { consumeSearchQuota, requireUser } from '../auth.js'
import { getExcludedPipelineLeadIds } from '../organizations.js'

const FREE_NOTICE =
  'Results from your database and saved discoveries. Email and phone are shown when available. Pipeline leads are excluded.'

function applyContactQuality(result) {
  if (!result?.leads) return result
  const leads = filterUsableLeads(result.leads)
  if (!leads.length) return { ...result, leads: [], total: 0, netNew: 0 }

  const displayTotal = Math.max(
    AI_SEARCH_DISPLAY_TOTAL_MIN,
    result.total || 0,
    leads.length
  )

  return {
    ...result,
    leads,
    total: displayTotal,
    netNew: Math.max(displayTotal - (result.excludedPipelineCount || 0), leads.length),
    fullPreviewCount: FREE_FULL_LEAD_PREVIEW_COUNT,
    maskedCount: Math.max(0, leads.length - FREE_FULL_LEAD_PREVIEW_COUNT),
  }
}

function hasStructuredFilters(filters) {
  return Boolean(
    filters.states?.length ||
      filters.cities?.length ||
      filters.industries?.length ||
      filters.companySizes?.length
  )
}

function filterDiscoveryLeads(leads, excludeIds) {
  if (!excludeIds?.size) return leads
  return leads.filter((lead) => !excludeIds.has(lead.id))
}

function tryLocalSearch(store, filters, count, viewer, excludeIds, shapeOptions = {}) {
  const databaseResults = applyContactQuality(
    searchStoredLeads(store, filters, count, viewer, excludeIds, shapeOptions)
  )
  if (databaseResults?.leads?.length) {
    return { ...databaseResults, notice: FREE_NOTICE, fromDatabase: true }
  }

  const mockLeads = filterUsableLeads(
    getMockLeadsForViewer(store, viewer, filters, count, excludeIds, shapeOptions)
  )
  if (mockLeads.length) {
    return {
      leads: mockLeads,
      total: Math.max(AI_SEARCH_DISPLAY_TOTAL_MIN, mockLeads.length * 40, mockLeads.length),
      netNew: Math.max(AI_SEARCH_DISPLAY_TOTAL_MIN, mockLeads.length),
      provider: 'database',
      notice: 'Sample prospects matching your filters.',
    }
  }

  if (!hasStructuredFilters(filters)) {
    const broadMock = getMockLeadsForViewer(
      store,
      viewer,
      { ...filters, keywords: '' },
      count,
      excludeIds,
      shapeOptions
    )
    if (broadMock.length) {
      return {
        leads: broadMock,
        total: broadMock.length,
        netNew: broadMock.length,
        provider: 'database',
        notice:
          'No exact keyword match — showing related India prospects. Add state or city filters to narrow further.',
      }
    }
  }

  return null
}

function runLocalSearch(store, filters, count, viewer, excludeIds, shapeOptions = {}) {
  return tryLocalSearch(store, filters, count, viewer, excludeIds, shapeOptions)
}

async function persistAiLeadsAndSearch(
  store,
  rawLeads,
  filters,
  count,
  viewer,
  excludeIds,
  source,
  discoveryMeta = {},
  shapeOptions = {}
) {
  const usable = filterUsableLeads(rawLeads)
  if (!usable.length) return null

  const updatedStore = await updateStore((draft) => {
    const { store: next } = persistDiscoveredLeads(draft, usable, {
      source,
      actor: viewer,
      filters,
    })
    return next
  })

  const freshStore = await readStore()
  const shaped = usable.slice(0, count).map((lead, index) =>
    shapeLeadForViewer(
      {
        ...lead,
        id: lead.id || createId('lead'),
        source: lead.source || source,
      },
      freshStore,
      viewer,
      index,
      shapeOptions
    )
  )

  const leads = filterUsableLeads(filterDiscoveryLeads(shaped, excludeIds))
  const displayLeads = leads.length ? leads : shaped.slice(0, count)

  if (!displayLeads.length) return null

  if (!leads.length && shaped.length) {
    return {
      leads: displayLeads,
      total: Math.max(usable.length, displayLeads.length),
      netNew: displayLeads.length,
      provider: source,
      notice:
        (discoveryMeta.notice || 'Live AI discovery') +
        ' (includes matches already linked to your pipeline).',
      ...discoveryMeta,
      aiPersisted: true,
      fromAiDiscovery: true,
      excludedPipelineCount: excludeIds?.size || 0,
    }
  }

  return {
    leads: displayLeads,
    total: Math.max(usable.length, displayLeads.length, count),
    netNew: displayLeads.length,
    provider: source,
    notice: discoveryMeta.notice || 'Live AI discovery — contacts saved to your database.',
    ...discoveryMeta,
    aiPersisted: true,
    fromAiDiscovery: true,
  }
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
  const rawQuery = String(filters.keywords || '').trim()
  const parsed = await parseSearchQuery(rawQuery, { ...filters, jobTitles: [] })
  const naturalQuery = parsed.naturalQuery || rawQuery
  const searchFilters = enrichSearchFiltersFromQuery(
    mergeParsedFilters({ ...filters, jobTitles: [] }, parsed),
    naturalQuery
  )
  const discoveryOpts = {
    naturalQuery,
    intent: parsed.intent,
    targetCompany: parsed.targetCompany,
    targetRole: parsed.targetRole,
  }
  const parsedSearch = buildParsedSearchSummary(parsed, searchFilters)

  await ensureBuiltInDatabase()
  let store = await readStore()
  const viewer = quotaUser
  const excludeIds = getExcludedPipelineLeadIds(store, viewer)
  const aiDiscoveryLeft = getAiDiscoverySearchesLeft(viewer)
  const liveAiAvailable = isPerplexityConfigured()
  const canRunLiveAi = liveAiAvailable && discoveryFiltersReady(searchFilters, naturalQuery)
  const useLivePerplexity = canRunLiveAi
  let result = null
  let discoveryError = null
  let liveAiAttempted = false
  let aiDiscoverySearchesLeft = aiDiscoveryLeft

  if (useLivePerplexity) {
    liveAiAttempted = true
    const discovery = await discoverLeadsWithPerplexity(
      searchFilters,
      Math.min(count, AI_SEARCH_FETCH_COUNT),
      discoveryOpts
    )
    const toPersist = discovery.leads?.length ? discovery.leads : discovery.allParsed
    if (toPersist?.length) {
      result = await persistAiLeadsAndSearch(
        store,
        toPersist,
        searchFilters,
        count,
        viewer,
        excludeIds,
        'perplexity',
        {
          notice:
            'Live AI search — tap Reveal to use 1 credit per email or phone (₹1 from your wallet).',
          discoveryMethod: discovery.method,
        },
        { fullContactPreview: true }
      )
      if (result?.leads?.length && aiDiscoveryLeft > 0) {
        try {
          aiDiscoverySearchesLeft = await consumeAiDiscoverySearch(viewer)
          const refreshedStore = await readStore()
          const refreshedUser = refreshedStore.users.find((u) => u.id === viewer.id) || viewer
          quotaUser = { ...quotaUser, aiDiscoverySearchesLeft, creditsPaise: refreshedUser.creditsPaise }
        } catch {
          // quota tracking optional if store fails
        }
      }
      store = await readStore()
    } else if (discovery.error) {
      discoveryError = discovery.error
    }
  } else if (!liveAiAvailable && discoveryFiltersReady(searchFilters, naturalQuery)) {
    discoveryError =
      'Live AI search is not enabled on the server yet. Contact Connect Intel support, or import companies in Admin / Team.'
  }

  if (!result?.leads?.length) {
    const skipStaleDb = Boolean(result?.fromAiDiscovery)
    if (!skipStaleDb) {
      result = runLocalSearch(store, searchFilters, count, viewer, excludeIds, { fullContactPreview: true })

      if (!result?.leads?.length && isGeminiConfigured()) {
        const expanded = await expandSearchKeywords(searchFilters, { naturalQuery })
        if (expanded.keywords && expanded.keywords !== searchFilters.keywords) {
          const retry = runLocalSearch(
            store,
            { ...searchFilters, keywords: expanded.keywords },
            count,
            viewer,
            excludeIds,
            { fullContactPreview: true }
          )
          if (retry?.leads?.length) {
            result = {
              ...retry,
              notice: `${retry.notice} Search terms were expanded automatically.`,
              expandedKeywords: expanded.keywords,
            }
          }
        }
      }
    }
  }

  if (result?.leads?.length) {
    return sendJson(res, 200, {
      ...applyContactQuality(result),
      user: quotaUser,
      excludedPipelineCount: excludeIds.size,
      parsedSearch,
      aiDiscoverySearchesLeft,
      usedLiveAi: Boolean(result.fromAiDiscovery),
      liveAiAvailable,
      liveAiAttempted,
      discoveryError: discoveryError || undefined,
    })
  }

  const usePaid = paidApisEnabled()
  const apolloOk = usePaid && isApolloConfigured() && (await verifyApolloApiKey()).ok
  const useApollo = apolloOk && (provider === 'apollo' || provider === 'auto')

  if (useApollo) {
    try {
      const apolloResults = await searchApolloPeople(searchFilters, count, store, viewer)
      if (apolloResults?.leads?.length) {
        const persisted = await persistAiLeadsAndSearch(
          store,
          apolloResults.leads,
          searchFilters,
          count,
          viewer,
          excludeIds,
          'apollo',
          { notice: apolloResults.notice }
        )
        if (persisted?.leads?.length) {
          return sendJson(res, 200, { ...persisted, user: quotaUser, parsedSearch })
        }
      }
      if (provider === 'apollo') {
        return sendJson(res, 200, {
          leads: [],
          total: 0,
          netNew: 0,
          provider: 'apollo',
          notice: 'No matches in partner data. Try different filters or ask your admin to import more companies.',
          user: quotaUser,
          parsedSearch,
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
      const rawLeads = await searchViaClaude(searchFilters, count, store, viewer, anthropicKey)
      const persisted = await persistAiLeadsAndSearch(
        store,
        rawLeads,
        searchFilters,
        count,
        viewer,
        excludeIds,
        'claude',
        { notice: 'Claude discovery saved to your database.' }
      )
      if (persisted?.leads?.length) {
        return sendJson(res, 200, { ...persisted, user: quotaUser, parsedSearch })
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
  if (!liveAiAvailable) {
    hints.push('Live AI search is not enabled on the server yet')
  } else if (!discoveryFiltersReady(searchFilters, naturalQuery)) {
    hints.push('Type a short sentence with product and city for live AI search')
  }

  const pipelineHint =
    excludeIds.size > 0 ? ` ${excludeIds.size} lead(s) already in your pipeline were hidden.` : ''

  return sendJson(res, 200, {
    leads: [],
    total: 0,
    netNew: 0,
    provider: 'none',
    notice: `No leads matched your search. Try a full sentence (product + city/state), or import contacts in Admin / Team.${pipelineHint}${hints.length ? ` ${hints.join('. ')}.` : ''}`,
    discoveryError,
    liveAiAvailable,
    liveAiAttempted,
    user: quotaUser,
    parsedSearch,
    aiDiscoverySearchesLeft: getAiDiscoverySearchesLeft(viewer),
  })
}

function buildParsedSearchSummary(parsed, filters) {
  const parts = []
  if (parsed?.naturalQuery) parts.push(parsed.naturalQuery)
  if (filters.states?.length) parts.push(filters.states.join(', '))
  if (filters.cities?.length) parts.push(filters.cities.join(', '))
  if (filters.keywords && filters.keywords !== parsed?.naturalQuery) {
    parts.push(`matching: ${filters.keywords}`)
  }
  return {
    naturalQuery: parsed?.naturalQuery || filters.keywords || '',
    intent: parsed?.intent || 'find_companies',
    targetCompany: parsed?.targetCompany || null,
    summary: parts.filter(Boolean).join(' · ') || filters.keywords || '',
    parsedBy: parsed?.parsedBy || 'none',
  }
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

  return parseLeadsJson(text)
}

function buildPrompt(filters, count) {
  const parts = []
  if (filters.keywords) parts.push(`Keywords: ${filters.keywords}`)
  if (filters.states?.length) parts.push(`Indian states: ${filters.states.join(', ')}`)
  if (filters.cities?.length) parts.push(`Cities: ${filters.cities.join(', ')}`)
  if (filters.industries?.length) parts.push(`Industries: ${filters.industries.join(', ')}`)

  const criteria = parts.length ? parts.join('\n') : 'General B2B prospects in India'

  return `Find ${Math.min(count, 8)} Indian B2B contacts matching this request:\n${criteria}\n\nAny industry is valid (manufacturing, SaaS, food, logistics, etc.). Return ONLY a JSON array. Each object MUST include firstName, lastName, title, company, city, state, industry, and at least one of: email (business) or phone (+91) when known.`
}

function parseLeadsJson(text) {
  try {
    const m = text.match(/\[[\s\S]*\]/)
    if (!m) return []
    const arr = JSON.parse(m[0])
    return filterUsableLeads(
      arr.map((l, i) => ({
        ...l,
        id: l.id || `claude-${i}-${Date.now()}`,
        source: 'claude',
      }))
    )
  } catch {
    return []
  }
}
