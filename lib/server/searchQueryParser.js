import { INDIAN_STATES, getAllCities, getCitiesForStates } from '../../frontend/src/lib/indiaLocations.js'
import { isGeminiConfigured, parseSearchQueryWithGemini } from './gemini.js'

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function findMentionedStates(text) {
  const hay = normalizeText(text)
  return INDIAN_STATES.filter((state) => hay.includes(normalizeText(state)))
}

function findMentionedCities(text, states) {
  const hay = normalizeText(text)
  const pool = states?.length ? getCitiesForStates(states) : getAllCities()

  return pool.filter((city) => {
    const c = normalizeText(city)
    return hay.includes(c) || hay.split(' ').includes(c)
  })
}

function detectIntent(text) {
  const hay = normalizeText(text)
  if (/\b(ceo|cto|cfo|founder|director|vp|head of|email|phone|contact)\b/.test(hay)) {
    if (/\b(email|phone|contact|reach)\b/.test(hay)) return 'find_contact_at_company'
    return 'find_people'
  }
  if (/\b(manufacturer|supplier|exporter|importer|distributor|wholesaler|dealer)\b/.test(hay)) {
    return 'find_companies'
  }
  return 'find_companies'
}

function extractCompanyHint(text) {
  const hay = String(text || '')
  const patterns = [
    /\b(?:at|for|of|from)\s+([A-Za-z0-9][A-Za-z0-9\s&.'-]{2,60}?)(?:\s+(?:email|phone|ceo|contact)|$)/i,
    /\b([A-Za-z0-9][A-Za-z0-9\s&.'-]{2,50}?)\s+(?:network|pvt|ltd|limited|inc|llp|trade|trades|exports?|industries?)\b/i,
  ]
  for (const re of patterns) {
    const m = hay.match(re)
    if (m?.[1]) return m[1].trim().replace(/\s+/g, ' ')
  }
  return ''
}

function parseSearchQueryFallback(rawQuery, existingFilters = {}) {
  const text = String(rawQuery || '').trim()
  if (!text) {
    return {
      filters: { ...existingFilters },
      naturalQuery: '',
      intent: 'find_companies',
      parsedBy: 'none',
    }
  }

  const states = findMentionedStates(text)
  const cities = findMentionedCities(text, states.length ? states : [])
  const intent = detectIntent(text)
  const targetCompany = extractCompanyHint(text)

  let keywords = text
  for (const s of [...states, ...cities]) {
    keywords = keywords.replace(new RegExp(s, 'gi'), ' ')
  }
  keywords = keywords
    .replace(/\b(in|at|from|the|and|for|of|a|an|to|need|i|email|id|ceo|phone|contact)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (targetCompany && intent === 'find_contact_at_company') {
    keywords = targetCompany
  }

  const merged = {
    ...existingFilters,
    keywords: keywords || text,
    states: existingFilters.states?.length ? existingFilters.states : states,
    cities: existingFilters.cities?.length ? existingFilters.cities : cities.slice(0, 8),
  }

  return {
    filters: merged,
    naturalQuery: text,
    intent,
    targetCompany: targetCompany || null,
    targetRole: /\bceo\b/i.test(text) ? 'CEO' : null,
    parsedBy: 'fallback',
  }
}

export async function parseSearchQuery(rawQuery, existingFilters = {}) {
  const text = String(rawQuery || '').trim()
  if (!text) {
    return parseSearchQueryFallback('', existingFilters)
  }

  if (isGeminiConfigured()) {
    try {
      const parsed = await parseSearchQueryWithGemini(text, existingFilters)
      if (parsed?.filters) return parsed
    } catch {
      // use fallback
    }
  }

  return parseSearchQueryFallback(text, existingFilters)
}

export function mergeParsedFilters(existingFilters, parsed) {
  const p = parsed?.filters || {}
  return {
    ...existingFilters,
    keywords: p.keywords || existingFilters.keywords || '',
    states: existingFilters.states?.length ? existingFilters.states : p.states || [],
    cities: existingFilters.cities?.length ? existingFilters.cities : p.cities || [],
    industries: existingFilters.industries?.length ? existingFilters.industries : p.industries || [],
    companySizes: existingFilters.companySizes || [],
    jobTitles: [],
  }
}
