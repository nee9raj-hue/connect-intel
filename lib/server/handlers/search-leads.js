/**
 * Lead search — fast database path first (master companies/contacts).
 * Live AI discovery runs when the database has few matches (unless liveAi: false).
 */
import { ensureBuiltInDatabase } from '../seed.js'
import { MASTER_DATA_COLLECTIONS } from '../imports.js'
import { createId } from '../store.js'
import { updateStorePartial } from '../store.js'
import { getAiDiscoverySearchesLeft, consumeAiDiscoverySearch } from '../aiSearchQuota.js'
import { searchStoredLeads, shapeLeadForViewer } from '../search.js'
import {
  AI_SEARCH_FETCH_COUNT,
  DEFAULT_SEARCH_LIMIT,
  FREE_FULL_LEAD_PREVIEW_COUNT,
} from '../config.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { consumeSearchQuota, requireUser } from '../auth.js'
import { loadSearchContext } from '../searchContext.js'
import {
  enrichSearchFiltersFromQuery,
  mergeParsedFilters,
  parseSearchQueryFallback,
} from '../searchQueryParser.js'
import { discoveryFiltersReady, filterUsableLeads } from '../leadQuality.js'
import { discoverLeadsWithPerplexity, isPerplexityConfigured } from '../perplexity.js'
import { persistDiscoveredLeads } from '../leadPersistence.js'

const FREE_NOTICE =
  'Results from your Connect Intel database. Email and phone are shown when available. Pipeline leads are excluded.'

const AI_DISCOVERY_TIMEOUT_MS = 35_000

function withTimeout(promise, ms, label = 'Operation') {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out`)), ms)
    }),
  ])
}

function applyContactQuality(result) {
  if (!result?.leads) return result
  const leads = filterUsableLeads(result.leads)
  if (!leads.length) return { ...result, leads: [], total: 0, netNew: 0 }

  const honestTotal = result.fromDatabase || result.provider === 'database'
  const displayTotal = honestTotal
    ? Math.max(result.total || 0, leads.length)
    : Math.max(result.total || 0, leads.length)

  return {
    ...result,
    leads,
    total: displayTotal,
    netNew: Math.max((result.total || leads.length) - (result.excludedPipelineCount || 0), leads.length),
    fullPreviewCount: FREE_FULL_LEAD_PREVIEW_COUNT,
    maskedCount: Math.max(0, leads.length - FREE_FULL_LEAD_PREVIEW_COUNT),
  }
}

function filterDiscoveryLeads(leads, excludeIds) {
  if (!excludeIds?.size) return leads
  return leads.filter((lead) => !excludeIds.has(lead.id))
}

function runDatabaseSearch(store, filters, count, viewer, excludeIds) {
  const raw = searchStoredLeads(store, filters, count, viewer, excludeIds, { fullContactPreview: true })
  if (!raw?.leads?.length) return null
  return {
    ...applyContactQuality({ ...raw, excludedPipelineCount: excludeIds?.size || 0 }),
    notice: FREE_NOTICE,
    fromDatabase: true,
  }
}

async function persistAiLeadsAndSearch(store, rawLeads, filters, count, viewer, excludeIds, source, discoveryMeta = {}) {
  const usable = filterUsableLeads(rawLeads)
  if (!usable.length) return null

  await updateStorePartial(MASTER_DATA_COLLECTIONS, (draft) => {
    const { store: next } = persistDiscoveredLeads(draft, usable, {
      source,
      actor: viewer,
      filters,
    })
    return next
  })

  const { store: freshStore } = await loadSearchContext(viewer)
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
      { fullContactPreview: true }
    )
  )

  const leads = filterUsableLeads(filterDiscoveryLeads(shaped, excludeIds))
  const displayLeads = leads.length ? leads : shaped.slice(0, count)
  if (!displayLeads.length) return null

  return applyContactQuality({
    leads: displayLeads,
    total: Math.max(usable.length, displayLeads.length, count),
    netNew: displayLeads.length,
    provider: source,
    notice: discoveryMeta.notice || 'Live AI discovery — contacts saved to your database.',
    ...discoveryMeta,
    fromAiDiscovery: true,
    excludedPipelineCount: excludeIds?.size || 0,
  })
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

  const body = getBody(req)
  const { filters = {}, count = DEFAULT_SEARCH_LIMIT } = body
  const skipLiveAi = body.liveAi === false

  const rawQuery = String(filters.keywords || '').trim()
  const parsed = parseSearchQueryFallback(rawQuery, { ...filters, jobTitles: [] })
  const naturalQuery = parsed.naturalQuery || rawQuery
  const searchFilters = enrichSearchFiltersFromQuery(
    mergeParsedFilters({ ...filters, jobTitles: [] }, parsed),
    naturalQuery
  )
  const parsedSearch = buildParsedSearchSummary(parsed, searchFilters)

  try {
    await ensureBuiltInDatabase()
    const { store, excludeIds } = await loadSearchContext(quotaUser)
    let result = runDatabaseSearch(store, searchFilters, count, quotaUser, excludeIds)

    let discoveryError = null
    let liveAiAttempted = false
    let aiDiscoverySearchesLeft = getAiDiscoverySearchesLeft(quotaUser)
    const liveAiAvailable = isPerplexityConfigured()

    const dbHitCount = result?.leads?.length || 0
    const shouldTryLiveAi =
      !skipLiveAi &&
      liveAiAvailable &&
      discoveryFiltersReady(searchFilters, naturalQuery) &&
      dbHitCount < 3 &&
      aiDiscoverySearchesLeft > 0

    if (shouldTryLiveAi) {
      liveAiAttempted = true
      try {
        const discovery = await withTimeout(
          discoverLeadsWithPerplexity(searchFilters, Math.min(count, AI_SEARCH_FETCH_COUNT), {
            naturalQuery,
            intent: parsed.intent,
            targetCompany: parsed.targetCompany,
            targetRole: parsed.targetRole,
          }),
          AI_DISCOVERY_TIMEOUT_MS,
          'Live AI search'
        )
        const toPersist = discovery.leads?.length ? discovery.leads : discovery.allParsed
        if (toPersist?.length) {
          const aiResult = await persistAiLeadsAndSearch(
            store,
            toPersist,
            searchFilters,
            count,
            quotaUser,
            excludeIds,
            'perplexity',
            {
              notice:
                'Live AI search — tap Reveal to use 1 credit per email or phone (₹1 from your wallet).',
              discoveryMethod: discovery.method,
            }
          )
          if (aiResult?.leads?.length) {
            result = aiResult
            try {
              aiDiscoverySearchesLeft = await consumeAiDiscoverySearch(quotaUser)
            } catch {
              // optional
            }
          }
        } else if (discovery.error) {
          discoveryError = discovery.error
        }
      } catch (error) {
        discoveryError = error.message || 'Live AI search timed out.'
      }
    }

    if (result?.leads?.length) {
      return sendJson(res, 200, {
        ...result,
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

    const pipelineHint =
      excludeIds.size > 0 ? ` ${excludeIds.size} lead(s) already in your pipeline were hidden.` : ''

    return sendJson(res, 200, {
      leads: [],
      total: 0,
      netNew: 0,
      provider: 'none',
      notice: `No leads matched your search. Try a full sentence (product + city/state), or import contacts in Platform backend → Data & imports.${pipelineHint}`,
      discoveryError,
      liveAiAvailable,
      liveAiAttempted,
      user: quotaUser,
      parsedSearch,
      aiDiscoverySearchesLeft,
    })
  } catch (error) {
    const message = error.message || 'Search failed'
    const status = /timed out/i.test(message) ? 503 : 500
    return sendJson(res, status, {
      error:
        status === 503
          ? 'Search timed out while loading the database. Run Remove duplicate entries in Data & imports, then try again.'
          : message,
    })
  }
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
    summary: parts.filter(Boolean).join(' · ') || filters.keywords || '',
    intent: parsed?.intent || 'find_companies',
    parsedBy: parsed?.parsedBy || 'fallback',
  }
}
