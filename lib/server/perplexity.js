import { createId } from './store.js'
import { isApolloConfigured } from './apollo.js'
import {
  filterUsableLeads,
  normalizeLeadContact,
  isDisplayableLead,
} from './leadQuality.js'
import {
  MIN_LINKEDIN_MATCH_SCORE,
  pickBestLinkedinMatch,
  rankLinkedinProfileMatches,
  scoreLinkedinProfileMatch,
} from './linkedinProfileMatch.js'

export function isPerplexityConfigured() {
  return Boolean(process.env.PERPLEXITY_API_KEY)
}

function perplexityModels() {
  const preferred = process.env.PERPLEXITY_MODEL
  const list = preferred ? [preferred] : []
  return [...new Set([...list, 'sonar-pro', 'sonar'])]
}

function buildCriteria(filters) {
  const parts = []
  if (filters.keywords) parts.push(`Business focus: ${filters.keywords}`)
  if (filters.states?.length) parts.push(`States: ${filters.states.join(', ')}`)
  if (filters.cities?.length) parts.push(`Cities: ${filters.cities.join(', ')}`)
  if (filters.industries?.length) parts.push(`Industries: ${filters.industries.join(', ')}`)
  return parts.length ? parts.join('\n') : ''
}

function preprocessAiText(text) {
  return String(text || '')
    .replace(/\[\d+\]/g, '')
    .replace(/^\uFEFF/, '')
    .trim()
}

function repairJsonText(jsonText) {
  return preprocessAiText(jsonText)
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/,\s*([\]}])/g, '$1')
    .replace(/\bundefined\b/g, 'null')
}

function tryParseObject(slice) {
  const base = String(slice || '').trim()
  if (!base.startsWith('{')) return null

  const attempts = [
    base,
    repairJsonText(base),
    `${base}}`,
    `${repairJsonText(base)}}`,
    `${base}"}`,
    `${repairJsonText(base)}"}`,
  ]

  for (const candidate of attempts) {
    try {
      const obj = JSON.parse(candidate)
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) return obj
    } catch {
      // continue
    }
  }
  return null
}

function closeTruncatedJsonArray(raw) {
  const start = raw.indexOf('[')
  if (start === -1) return null

  let fragment = raw.slice(start).trim()
  fragment = fragment.replace(/,\s*$/, '')

  if (!fragment.endsWith(']')) {
    if (!fragment.endsWith('}')) fragment += '}'
    fragment += ']'
  }

  return tryParseArray(fragment) || tryParseArray(repairJsonText(fragment))
}

function tryParseArray(jsonText) {
  const attempts = [jsonText, repairJsonText(jsonText)]
  for (const candidate of attempts) {
    try {
      const arr = JSON.parse(candidate)
      if (Array.isArray(arr) && arr.length) return arr
    } catch {
      // continue
    }
  }
  return null
}

function extractBalancedJsonArray(raw) {
  const start = raw.indexOf('[')
  if (start === -1) return null

  let depth = 0
  let inString = false
  let escape = false

  for (let i = start; i < raw.length; i += 1) {
    const char = raw[i]
    if (inString) {
      if (escape) escape = false
      else if (char === '\\') escape = true
      else if (char === '"') inString = false
      continue
    }
    if (char === '"') {
      inString = true
      continue
    }
    if (char === '[') depth += 1
    if (char === ']') {
      depth -= 1
      if (depth === 0) return raw.slice(start, i + 1)
    }
  }

  return raw.slice(start)
}

function extractJsonObjectsFromText(text) {
  const raw = String(text || '').trim()
  const objects = []
  let i = 0

  while (i < raw.length) {
    const start = raw.indexOf('{', i)
    if (start === -1) break

    let depth = 0
    let inString = false
    let escape = false
    let end = -1

    for (let j = start; j < raw.length; j += 1) {
      const char = raw[j]
      if (inString) {
        if (escape) escape = false
        else if (char === '\\') escape = true
        else if (char === '"') inString = false
        continue
      }
      if (char === '"') {
        inString = true
        continue
      }
      if (char === '{') depth += 1
      if (char === '}') {
        depth -= 1
        if (depth === 0) {
          end = j
          break
        }
      }
    }

    if (end === -1) {
      const salvaged = tryParseObject(raw.slice(start))
      if (salvaged) objects.push(salvaged)
      break
    }

    const slice = raw.slice(start, end + 1)
    const obj = tryParseObject(slice)
    if (obj) objects.push(obj)
    i = end + 1
  }

  return objects
}

function extractJsonArray(text) {
  const raw = preprocessAiText(text)
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/gi)
  if (fenced?.length) {
    for (const block of fenced) {
      const inner = block.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim()
      const arr = tryParseArray(inner)
      if (arr?.length) return arr
    }
  }

  const objectMatch = raw.match(/\{[\s\S]*\}/)
  if (objectMatch) {
    try {
      const obj = JSON.parse(repairJsonText(objectMatch[0]))
      for (const key of ['leads', 'results', 'companies', 'contacts', 'data', 'profiles', 'matches']) {
        if (Array.isArray(obj[key]) && obj[key].length) return obj[key]
      }
    } catch {
      // continue
    }
  }

  const balanced = extractBalancedJsonArray(raw)
  if (balanced) {
    const arr = tryParseArray(balanced)
    if (arr?.length) return arr
  }

  const greedy = raw.match(/\[[\s\S]*\]/)
  if (greedy) {
    const arr = tryParseArray(greedy[0])
    if (arr?.length) return arr
  }

  const closed = closeTruncatedJsonArray(raw)
  if (closed?.length) return closed

  const looseObjects = extractJsonObjectsFromText(raw)
  if (looseObjects.length) return looseObjects

  return null
}

function extractJsonObject(text) {
  let raw = String(text || '').trim()
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced) raw = fenced[1].trim()
  const match = raw.match(/\{[\s\S]*\}/)
  return match ? match[0] : null
}

function collectPerplexityCitations(data) {
  const urls = []
  if (Array.isArray(data?.citations)) {
    for (const entry of data.citations) {
      if (typeof entry === 'string') urls.push(entry)
      else if (entry?.url) urls.push(entry.url)
    }
  }
  if (Array.isArray(data?.search_results)) {
    for (const entry of data.search_results) {
      if (typeof entry === 'string') urls.push(entry)
      else if (entry?.url) urls.push(entry.url)
    }
  }
  return [...new Set(urls.map((u) => String(u || '').trim()).filter(Boolean))]
}

const DISCOVERY_SYSTEM = `You are a B2B lead discovery agent for India. Your ONLY job is to return REAL operating companies — never trade associations, federations, directories, news articles, or government bodies.

NEVER RETURN:
- Trade associations (e.g. "Toy Association", "EPCH", "FIEO", "CEPC")
- Directories, listicles, "Top 10 exporters" articles
- Government ministries or chambers unless naming a specific private company

ALWAYS RETURN:
- Private companies: manufacturers, exporters, suppliers, distributors, wholesalers
- Company name must be a real business (e.g. "ABC Toys Pvt Ltd", "XYZ Exports")
- Include decision-maker name/title when found in sources
- Include website, city, state, industry, export markets when available
- Only include email/phone from public sources — never invent

OUTPUT RULES (critical):
- Respond with ONLY a valid JSON array — no markdown, no prose before or after.
- Every object MUST have "company" (non-empty string).
- firstName/lastName may be "" if unknown; use title like "Export Manager" or "Director" when known.

Example output shape:
[{"company":"ABC Toys Pvt Ltd","firstName":"Rajesh","lastName":"Kumar","title":"Export Manager","email":"","phone":"+91-98765-43210","city":"Noida","state":"Delhi NCR","industry":"Toys","website":"abctoys.in","exportMarkets":"USA, UK, Germany"}]`

async function chatCompletion(
  prompt,
  {
    system,
    temperature = 0.15,
    maxTokens = 12000,
    searchDomainFilter = null,
    returnCitations = true,
    searchRecencyFilter = 'year',
  } = {}
) {
  const apiKey = process.env.PERPLEXITY_API_KEY
  const systemMessage = system || DISCOVERY_SYSTEM
  let lastError = null

  for (const model of perplexityModels()) {
    try {
      const payload = {
        model,
        temperature,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: prompt },
        ],
      }
      if (returnCitations) payload.return_citations = true
      if (searchRecencyFilter) payload.search_recency_filter = searchRecencyFilter
      if (Array.isArray(searchDomainFilter) && searchDomainFilter.length) {
        payload.search_domain_filter = searchDomainFilter
      }

      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      })

      const data = await response.json()
      if (!response.ok) {
        lastError = new Error(data.error?.message || `Perplexity error (${response.status}) model ${model}`)
        continue
      }

      const text = data.choices?.[0]?.message?.content || ''
      const citations = collectPerplexityCitations(data)
      if (text || citations.length) return { text, model, citations }
    } catch (error) {
      lastError = error
    }
  }

  throw lastError || new Error('Perplexity chat failed for all models')
}

function shapeLeadRow(row, index) {
  const normalized = normalizeLeadContact({
    id: row.id || `pplx-${createId('lead')}-${index}`,
    firstName: row.firstName || row.first_name || '',
    lastName: row.lastName || row.last_name || '',
    title: row.title || row.designation || row.role || 'Business Contact',
    company: row.company || row.company_name || row.business_name || row.business || row.firm || '',
    companyDomain: row.companyDomain || row.website || row.domain || '',
    email: row.email || row.work_email || row.contact_email || row.business_email || '',
    phone: row.phone || row.mobile || row.phone_number || row.contact_phone || row.whatsapp || '',
    city: row.city || '',
    state: row.state || '',
    location: row.location || [row.city, row.state].filter(Boolean).join(', '),
    industry: row.industry || row.sector || '',
    employees: row.employees || '',
    source: 'perplexity',
    linkedin: row.linkedin || row.linkedin_url || '',
    products: row.product || row.products || '',
    exportMarkets: row.exportMarkets || row.export_markets || row.exports || '',
    season: row.season || '',
  })

  return {
    ...normalized,
    emailStatus: normalized.email ? 'likely' : 'unverified',
    score: Math.max(72, 92 - index * 2),
  }
}

function parseLeadsFromText(text, max) {
  const cap = Math.max(max, 1) * 3
  const fromArray = extractJsonArray(text)
  if (fromArray?.length) {
    return fromArray.slice(0, cap).map((row, index) => shapeLeadRow(row, index))
  }

  const fromObjects = extractJsonObjectsFromText(text)
  if (fromObjects.length) {
    return fromObjects.slice(0, cap).map((row, index) => shapeLeadRow(row, index))
  }

  return []
}

function resolveCityFromFilters(filters, userAsk) {
  if (filters.cities?.length) return filters.cities.join(', ')
  const m = String(userAsk || '').match(
    /\b(ludhiana|amritsar|jalandhar|surat|ahmedabad|jaipur|mumbai|delhi|chennai|hyderabad|kolkata|bengaluru|bangalore|coimbatore|kanpur|noida|gurugram|pune|nagpur)\b/i
  )
  return m?.[1] ? m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase() : ''
}

function buildWebSearchQuery(naturalQuery, filters = {}, options = {}) {
  if (options.semanticQuery) {
    return String(options.semanticQuery).slice(0, 480)
  }

  const userAsk = String(naturalQuery || filters.keywords || '').trim()
  const city = resolveCityFromFilters(filters, userAsk)
  const state = filters.states?.length ? filters.states.join(' ') : ''
  const parts = [
    userAsk,
    city,
    state,
    'India',
    'private company',
    'exporter OR manufacturer OR supplier',
    'site:indiamart.com OR site:tradeindia.com OR site:exportersindia.com OR company website',
    'contact phone email',
  ].filter(Boolean)
  return parts.join(' ').replace(/\s+/g, ' ').slice(0, 480)
}

function extractCompanyNameFromSearchHit(result) {
  let title = String(result?.title || '').trim()
  if (!title || title.length < 3) return ''
  title = title
    .replace(/\s*[-|–|:]\s*(linkedin|facebook|instagram|youtube|indiamart|tradeindia|justdial|exportersindia|google|wikipedia).*$/i, '')
    .replace(/\s*\|\s*.*/, '')
    .replace(/\s+-\s+.*$/, '')
    .trim()
  if (title.length < 3 || title.length > 120) return ''
  if (/^(top|best|list of|directory)/i.test(title)) return ''
  if (/^\d+$/.test(title)) return ''
  return title
}

function leadsFromWebSearchSnippets(webResults, limit) {
  const leads = []
  const seen = new Set()
  for (const hit of webResults || []) {
    const company = extractCompanyNameFromSearchHit(hit)
    if (!company) continue
    const key = company.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    leads.push(
      shapeLeadRow(
        {
          company,
          title: 'Business Contact',
          industry: '',
        },
        leads.length
      )
    )
    if (leads.length >= limit) break
  }
  return leads
}

async function structureLeadsFromWebResults(webResults, filters, limit, options = {}) {
  const userAsk = String(options.naturalQuery || filters.keywords || '').trim()
  const location = [
    filters.cities?.length ? `Cities: ${filters.cities.join(', ')}` : '',
    filters.states?.length ? `States: ${filters.states.join(', ')}` : '',
    resolveCityFromFilters(filters, userAsk) ? `City from query: ${resolveCityFromFilters(filters, userAsk)}` : '',
  ]
    .filter(Boolean)
    .join('. ')

  const context = (webResults || [])
    .slice(0, 18)
    .map((r, i) => `${i + 1}. ${r.title || 'Result'}\nURL: ${r.url || ''}\n${r.snippet || ''}`)
    .join('\n\n')

  const prompt = `USER SEARCH: ${userAsk}
${location ? `LOCATION: ${location}` : 'LOCATION: India'}

Use the web results below to build a JSON array of ${limit} distinct Indian B2B prospects (companies + contacts when available).
Skip directories, news articles, and government pages unless they name a specific company.
Match the user's product/industry (e.g. textile exporters, food manufacturers, logistics firms).

WEB RESULTS:
${context}`

  const { text, model } = await chatCompletion(prompt, {
    system: DISCOVERY_SYSTEM,
    temperature: 0.08,
    maxTokens: 14000,
    searchRecencyFilter: 'year',
  })

  const parsed = parseLeadsFromText(text, limit * 2)
  let leads = acceptParsedLeads(parsed, limit)
  if (!leads.length) {
    const fromObjects = extractJsonObjectsFromText(text).map((row, i) => shapeLeadRow(row, i))
    leads = acceptParsedLeads(fromObjects, limit)
  }
  return { leads, model, parsedCount: parsed.length }
}

function buildDiscoveryPrompt(
  filters,
  limit,
  { focused = false, naturalQuery = '', intent = 'find_companies', targetCompany = null, targetRole = null, simple = false } = {}
) {
  const criteria = buildCriteria(filters)
  const userAsk = String(naturalQuery || filters.keywords || '').trim() || 'B2B prospects in India'
  const stateLine = filters.states?.length ? filters.states.join(', ') : 'India'
  const cityFromQuery = resolveCityFromFilters(filters, userAsk)

  if (intent === 'find_contact_at_company' && targetCompany) {
    const role = targetRole || 'decision maker'
    return `Find ${limit} real ${role} contacts at "${targetCompany}" in India.

User request: ${userAsk}
${cityFromQuery ? `City context: ${cityFromQuery}` : ''}

Return ONLY a JSON array. Each object: firstName, lastName, title, company, email, phone, city, state, industry, website.`
  }

  if (simple && cityFromQuery) {
    return `Search the web for ${limit} real ${userAsk} in ${cityFromQuery}, ${stateLine}, India.

Focus on registered businesses (exporters, manufacturers, traders, wholesalers) with operations in ${cityFromQuery}.
Return ONLY a JSON array (min ${Math.min(5, limit)} rows, up to ${limit}).`
  }

  if (focused) {
    return `Search the web for ${limit} Indian B2B companies matching:
"${userAsk}"
City: ${cityFromQuery || 'as stated'}
State/region: ${stateLine}

Return ONLY a JSON array. company field required on every row.`
  }

  return `Search the web and list ${limit} real Indian B2B prospects for:
"${userAsk}"

Location: ${cityFromQuery ? `${cityFromQuery}, ` : ''}${stateLine}.
${criteria ? `Additional filters: ${criteria}` : ''}

Return ONLY a JSON array with ${limit} objects.
Each must be a real company matching the search (not generic advice).`
}

/** Draft CRM outreach email via Perplexity Sonar. */
export async function generatePerplexityEmail(lead, options = {}) {
  if (!isPerplexityConfigured()) return null

  const { emailPromptBlock } = await import('./crmEmailPrompt.js')
  const prompt = emailPromptBlock(lead, options)

  try {
    const { text, model } = await chatCompletion(prompt, {
      system:
        'You write concise, professional B2B sales emails. Output only valid JSON: {"subject":"...","body":"..."}',
      temperature: 0.35,
      maxTokens: 1200,
    })

    const jsonText = extractJsonObject(text)
    if (!jsonText) return null

    const parsed = JSON.parse(jsonText)
    if (!parsed.subject || !parsed.body) return null

    return {
      subject: String(parsed.subject).trim(),
      body: String(parsed.body).trim(),
      aiGenerated: true,
      provider: 'perplexity',
      model,
      purpose: options.purpose,
      tone: options.tone,
    }
  } catch {
    return null
  }
}

export async function generatePerplexityWhatsApp(lead, options = {}) {
  if (!isPerplexityConfigured()) return null
  const { emailPromptBlock } = await import('./crmEmailPrompt.js')
  const prompt = `${emailPromptBlock(lead, options)}

Write a short WhatsApp message (not email). Max 80 words. Return ONLY JSON: {"message":"..."}`

  try {
    const { text, model } = await chatCompletion(prompt, {
      system: 'You write concise B2B WhatsApp messages. Output only valid JSON: {"message":"..."}',
      temperature: 0.35,
      maxTokens: 600,
    })
    const jsonText = extractJsonObject(text)
    if (!jsonText) return null
    const parsed = JSON.parse(jsonText)
    if (!parsed.message) return null
    return {
      message: String(parsed.message).trim(),
      aiGenerated: true,
      provider: 'perplexity',
      model,
    }
  } catch {
    return null
  }
}

function acceptParsedLeads(parsed, limit) {
  const usable = filterUsableLeads(parsed)
  if (usable.length) return usable.slice(0, limit)

  return parsed
    .map(normalizeLeadContact)
    .filter(isDisplayableLead)
    .slice(0, limit)
}

function discoverySuccessPayload(leads, parsed, limit, method, notice) {
  return {
    leads,
    allParsed: parsed?.length ? parsed : leads,
    parsedCount: Math.max(parsed?.length || 0, leads.length),
    aiGenerated: true,
    provider: 'perplexity',
    method,
    notice: notice || 'Live AI discovery — verify contacts before outreach.',
  }
}

/** Knowledge entity fetch — structured factual lookup (NOT B2B exporter keyword search). */
const KNOWLEDGE_SYSTEM = `You are a knowledge research agent. Extract REAL facts from credible public web sources.
For TV shows: list startups/companies that pitched on the show with founder names, season number, website, and LinkedIn when public.
Output ONLY a valid JSON array. No markdown fences, no commentary.
Never invent companies. Skip unrelated keyword matches (e.g. "Shark Exports" is NOT Shark Tank India).`

function buildKnowledgeWebSearchQuery(semanticQuery, { entity, entityType } = {}) {
  const q = String(semanticQuery || '').trim()
  if (entityType === 'TV_SHOW' && entity) {
    return [
      entity,
      'all seasons',
      'complete list startups companies founders pitched',
      'SonyLIV Wikipedia',
    ]
      .join(' ')
      .slice(0, 480)
  }
  return q.slice(0, 480)
}

function leadsFromKnowledgeSnippets(webResults, limit, entity = '') {
  const leads = []
  const seen = new Set()
  const entityLower = String(entity || '').toLowerCase()

  for (const hit of webResults || []) {
    const title = String(hit?.title || '').trim()
    const snippet = String(hit?.snippet || '').trim()
    const blob = `${title} ${snippet}`

    if (/wikipedia|news|article|episode recap|watch online/i.test(title) && !/\blist\b/i.test(title)) {
      continue
    }

    const listItems = blob.match(/[A-Z][A-Za-z0-9&.'+\- ]{2,40}(?:\s+(?:Pvt|Ltd|Limited|LLP|Inc)\.?)?/g) || []
    for (const item of listItems) {
      const company = item.trim()
      if (company.length < 3 || company.length > 80) continue
      if (/^(shark tank|season|episode|founder|startup|india|sony)/i.test(company)) continue
      if (entityLower && /^shark\b/i.test(company) && !entityLower.includes(company.toLowerCase())) continue
      if (/\b(exports?|exim|trading)\b/i.test(company) && !/shark tank/i.test(company)) continue

      const key = company.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      leads.push(shapeLeadRow({ company }, leads.length))
      if (leads.length >= limit) return leads
    }

    const fromTitle = extractCompanyNameFromSearchHit(hit)
    if (fromTitle && !seen.has(fromTitle.toLowerCase())) {
      seen.add(fromTitle.toLowerCase())
      leads.push(shapeLeadRow({ company: fromTitle }, leads.length))
      if (leads.length >= limit) return leads
    }
  }

  return leads
}

async function structureKnowledgeFromWebResults(webResults, semanticQuery, limit, options = {}) {
  const context = (webResults || [])
    .slice(0, 20)
    .map((r, i) => `${i + 1}. ${r.title || 'Result'}\nURL: ${r.url || ''}\n${r.snippet || ''}`)
    .join('\n\n')

  const prompt = `RESEARCH TASK: ${semanticQuery}

From the web results below, extract up to ${limit} distinct real entries.
Each JSON object when known: company, firstName, lastName, title, product, industry, website, linkedin, exportMarkets, city, season.
${options.wantLinkedIn ? 'Include founder LinkedIn profile URLs when publicly known.' : ''}
${options.preferExport ? 'Include exportMarkets when the company exports internationally.' : ''}
Only include companies/people actually linked to the research task. Never invent data.

WEB RESULTS:
${context}`

  const { text, model } = await chatCompletion(prompt, {
    system: KNOWLEDGE_SYSTEM,
    temperature: 0.06,
    maxTokens: 14000,
    searchRecencyFilter: 'year',
  })

  const parsed = parseLeadsFromText(text, limit * 2)
  let leads = acceptParsedLeads(parsed, limit)
  if (!leads.length) {
    const fromObjects = extractJsonObjectsFromText(text).map((row, i) => shapeLeadRow(row, i))
    leads = acceptParsedLeads(fromObjects, limit)
  }
  if (!leads.length && parsed.length) {
    leads = parsed.filter(isDisplayableLead).slice(0, limit)
  }
  return { leads, model, parsedCount: parsed.length }
}

export async function fetchKnowledgeEntities(
  semanticQuery,
  { count = 15, entity, entityType, preferExport, wantLinkedIn } = {}
) {
  if (!isPerplexityConfigured()) {
    return { leads: [], error: 'PERPLEXITY_API_KEY is not set' }
  }

  const query = String(semanticQuery || '').trim()
  if (!query) return { leads: [], error: 'Empty knowledge query' }

  const limit = Math.min(Math.max(count, 1), 30)
  const errors = []
  const webQuery = buildKnowledgeWebSearchQuery(query, { entity, entityType })

  try {
    const webResults = await perplexityWebSearch(webQuery, { maxResults: 20 })
    if (webResults.length) {
      const structured = await structureKnowledgeFromWebResults(webResults, query, limit, {
        preferExport,
        wantLinkedIn,
        entity,
        entityType,
      })
      if (structured.leads.length) {
        return {
          leads: structured.leads,
          model: structured.model,
          method: `knowledge-search+structure:${structured.model}`,
        }
      }

      const heuristic = acceptParsedLeads(
        leadsFromKnowledgeSnippets(webResults, limit, entity),
        limit
      )
      if (heuristic.length) {
        return { leads: heuristic, method: 'knowledge-search-heuristic' }
      }
      errors.push(`web-structure: parsed=${structured.parsedCount} usable=0 hits=${webResults.length}`)
    } else {
      errors.push('web-search: 0 results')
    }
  } catch (error) {
    errors.push(`web-search: ${error.message || 'failed'}`)
  }

  const sonarPrompt = `Knowledge research: ${query}

Return ONLY a JSON array of up to ${limit} real entries from public sources.
Each object when known: company, firstName, lastName, title, product, industry, website, linkedin, exportMarkets, city, season.
${wantLinkedIn ? 'Include founder LinkedIn URLs when publicly known.' : ''}
${preferExport ? 'Note exportMarkets for companies that export internationally.' : ''}
Only include real companies/people. Never invent data.`

  const attempts = [
    { label: 'knowledge-sonar', temperature: 0.05, maxTokens: 14000 },
    { label: 'knowledge-sonar-focused', temperature: 0.08, maxTokens: 10000 },
  ]

  for (const attempt of attempts) {
    try {
      const { text, model } = await chatCompletion(sonarPrompt, {
        system: KNOWLEDGE_SYSTEM,
        temperature: attempt.temperature,
        maxTokens: attempt.maxTokens,
        searchRecencyFilter: 'year',
      })

      const parsed = parseLeadsFromText(text, limit * 2)
      let leads = acceptParsedLeads(parsed, limit)
      if (!leads.length) {
        const fromObjects = extractJsonObjectsFromText(text).map((row, i) => shapeLeadRow(row, i))
        leads = acceptParsedLeads(fromObjects, limit)
      }
      if (!leads.length && parsed.length) {
        leads = parsed.filter(isDisplayableLead).slice(0, limit)
      }

      if (leads.length) {
        return { leads, model, method: `${attempt.label}:${model}` }
      }
      errors.push(`${attempt.label}: usable=0`)
    } catch (error) {
      errors.push(`${attempt.label}: ${error.message || 'failed'}`)
    }
  }

  return {
    leads: [],
    error: 'Knowledge search returned no structured contestants. Try a specific season.',
    notice: errors.join(' · '),
  }
}

/** Web-informed discovery — Search API + Sonar structuring + chat retries. */
export async function discoverLeadsWithPerplexity(filters, count = 5, options = {}) {
  if (!isPerplexityConfigured()) {
    return { leads: [], error: 'PERPLEXITY_API_KEY is not set' }
  }

  const naturalQuery = String(options.naturalQuery || filters.keywords || '').trim()
  const criteria = buildCriteria(filters) || naturalQuery

  if (!criteria) {
    return {
      leads: [],
      error: 'Describe who you need to find (product, role, company, or location).',
    }
  }

  const limit = Math.min(Math.max(count, 1), 50)
  const requestCount = Math.min(limit + (options.copilotFast ? 5 : 15), 55)
  const errors = []
  const copilotFast = Boolean(options.copilotFast)
  const promptOptions = {
    naturalQuery,
    intent: options.intent || 'find_companies',
    targetCompany: options.targetCompany || null,
    targetRole: options.targetRole || null,
  }

  const webQuery = buildWebSearchQuery(naturalQuery, filters, { semanticQuery: options.semanticQuery })
  try {
    const webResults = await perplexityWebSearch(webQuery, {
      maxResults: copilotFast ? 12 : 18,
    })
    if (webResults.length) {
      const structured = await structureLeadsFromWebResults(webResults, filters, limit, promptOptions)
      if (structured.leads.length) {
        return discoverySuccessPayload(
          structured.leads,
          structured.leads,
          limit,
          `search+structure:${structured.model}`,
          'Live AI search used web results — verify contacts before outreach.'
        )
      }

      const heuristic = acceptParsedLeads(leadsFromWebSearchSnippets(webResults, limit), limit)
      if (heuristic.length) {
        return discoverySuccessPayload(
          heuristic,
          heuristic,
          limit,
          'search-heuristic',
          'Matched companies from web search titles — open each row to reveal contact details.'
        )
      }
      errors.push(`web-structure: parsed=${structured.parsedCount} usable=0 hits=${webResults.length}`)
    } else {
      errors.push('web-search: 0 results')
    }
  } catch (error) {
    errors.push(`web-search: ${error.message || 'failed'}`)
  }

  if (copilotFast) {
    try {
      const prompt = buildDiscoveryPrompt(filters, requestCount, {
        ...promptOptions,
        focused: true,
        simple: true,
        label: 'sonar-copilot',
      })
      const { text, model } = await chatCompletion(prompt, {
        system: DISCOVERY_SYSTEM,
        temperature: 0.15,
        maxTokens: 6000,
        searchRecencyFilter: 'year',
      })
      const parsed = parseLeadsFromText(text, requestCount)
      let leads = acceptParsedLeads(parsed, limit)
      if (!leads.length) {
        const fromObjects = extractJsonObjectsFromText(text).map((row, i) => shapeLeadRow(row, i))
        leads = acceptParsedLeads(fromObjects, limit)
      }
      if (leads.length) {
        return discoverySuccessPayload(leads, parsed, limit, `sonar:${model}:copilot-fast`)
      }
      errors.push(`copilot-fast: usable=0`)
    } catch (error) {
      errors.push(`copilot-fast: ${error.message || 'failed'}`)
    }

    return {
      leads: [],
      error:
        'Company search is taking longer than usual. Try a shorter query with product + city, e.g. "toy exporters in Noida".',
      notice: errors.join(' · '),
    }
  }

  const attempts = [
    { focused: false, simple: false, label: 'sonar-primary' },
    { focused: true, simple: false, label: 'sonar-focused' },
    { focused: true, simple: true, label: 'sonar-city' },
  ]

  let lastRaw = ''

  for (const attempt of attempts) {
    try {
      const prompt = buildDiscoveryPrompt(filters, requestCount, { ...promptOptions, ...attempt })
      const { text, model } = await chatCompletion(prompt, {
        system: DISCOVERY_SYSTEM,
        temperature: attempt.simple ? 0.2 : 0.1,
        maxTokens: 14000,
        searchRecencyFilter: 'year',
      })
      lastRaw = text.slice(0, 240)
      const parsed = parseLeadsFromText(text, requestCount)
      let leads = acceptParsedLeads(parsed, limit)
      if (!leads.length) {
        const fromObjects = extractJsonObjectsFromText(text).map((row, i) => shapeLeadRow(row, i))
        leads = acceptParsedLeads(fromObjects, limit)
      }
      if (!leads.length && parsed.length) {
        leads = parsed.filter(isDisplayableLead).slice(0, limit)
      }

      if (leads.length) {
        return discoverySuccessPayload(leads, parsed, limit, `sonar:${model}:${attempt.label}`)
      }

      const objCount = extractJsonObjectsFromText(text).length
      errors.push(
        `${attempt.label}: array=${parsed.length} objects=${objCount} usable=0` +
          (lastRaw ? ` preview=${lastRaw.replace(/\s+/g, ' ').slice(0, 100)}` : '')
      )
    } catch (error) {
      errors.push(`${attempt.label}: ${error.message || 'request failed'}`)
    }
  }

  return {
    leads: [],
    error:
      'No matching companies found. Try a full phrase with product and city, e.g. "textile exporters in Ludhiana, Punjab".',
    notice: errors.join(' · '),
  }
}

function normalizeLinkedinUrl(value) {
  let s = String(value || '').trim()
  if (!s) return ''
  if (!/^https?:\/\//i.test(s)) {
    if (s.startsWith('www.')) s = `https://${s}`
    else if (s.startsWith('linkedin.com')) s = `https://${s}`
    else if (s.startsWith('/in/')) s = `https://www.linkedin.com${s}`
    else if (s.startsWith('in/')) s = `https://www.linkedin.com/${s}`
  }
  try {
    const u = new URL(s)
    if (!u.hostname.includes('linkedin.com')) return s
    return u.href.split('?')[0].replace(/\/$/, '')
  } catch {
    return s
  }
}

function isLinkedinProfileUrl(url) {
  const value = String(url || '')
  if (!/(?:^|\/\/)(?:[a-z]{2,3}\.)?(?:www\.)?linkedin\.com\/in\/[^/?#\s]+/i.test(value)) {
    return false
  }
  if (/\/in\/(company|pub|learning|jobs|school|groups|feed|pulse|posts)\b/i.test(value)) {
    return false
  }
  return true
}

function shapeLinkedinMatch(row, index) {
  const linkedin = normalizeLinkedinUrl(
    row.linkedin || row.linkedin_url || row.linkedinUrl || row.url || row.profileUrl || ''
  )
  const firstName = row.firstName || row.first_name || ''
  const lastName = row.lastName || row.last_name || ''
  const fullName =
    row.fullName ||
    row.name ||
    [firstName, lastName].filter(Boolean).join(' ') ||
    ''

  return {
    id: row.id || `linkedin-match-${index}`,
    linkedin,
    firstName,
    lastName,
    fullName,
    title: row.title || row.jobTitle || row.role || '',
    company: row.company || row.company_name || '',
    city: row.city || '',
    state: row.state || '',
    email: row.email || '',
    phone: row.phone || row.mobile || '',
    confidence: String(row.confidence || row.matchScore || (index === 0 ? 'high' : 'medium')).toLowerCase(),
    reason: String(row.reason || row.matchReason || row.summary || '').trim(),
  }
}

function parseLinkedinMatchesFromText(text, max = 5) {
  const cap = Math.max(max, 1)
  const fromArray = extractJsonArray(text)
  if (fromArray?.length) {
    return fromArray
      .map((row, index) => shapeLinkedinMatch(row, index))
      .filter((row) => isLinkedinProfileUrl(row.linkedin))
      .slice(0, cap)
  }

  const fromObjects = extractJsonObjectsFromText(text)
  if (fromObjects.length) {
    return fromObjects
      .map((row, index) => shapeLinkedinMatch(row, index))
      .filter((row) => isLinkedinProfileUrl(row.linkedin))
      .slice(0, cap)
  }

  const urlMatches = String(text || '').match(
    /(?:https?:\/\/)?(?:[a-z]{2,3}\.)?(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9_%\-]+/gi
  )
  if (urlMatches?.length) {
    return [...new Set(urlMatches.map(normalizeLinkedinUrl))].slice(0, cap).map((url, index) => ({
      id: `linkedin-url-${index}`,
      linkedin: url,
      firstName: '',
      lastName: '',
      fullName: '',
      title: '',
      company: '',
      city: '',
      state: '',
      email: '',
      phone: '',
      confidence: index === 0 ? 'high' : 'medium',
      reason: 'Extracted from AI response',
    }))
  }

  return []
}

function linkedinMatchesFromCitationUrls(urls, contact = {}, cap = 5) {
  const name = [contact.firstName, contact.lastName].filter(Boolean).join(' ')
  const seen = new Set()
  const matches = []

  for (const raw of urls) {
    const linkedin = normalizeLinkedinUrl(raw)
    if (!isLinkedinProfileUrl(linkedin) || seen.has(linkedin)) continue
    const matchScore = scoreLinkedinProfileMatch(linkedin, contact, {
      reason: 'LinkedIn profile URL from live web search',
    })
    if (matchScore < 6) continue
    seen.add(linkedin)
    matches.push({
      id: `linkedin-citation-${matches.length}`,
      linkedin,
      firstName: contact.firstName || '',
      lastName: contact.lastName || '',
      fullName: name,
      title: contact.title || '',
      company: contact.company || '',
      city: contact.city || '',
      state: contact.state || '',
      email: contact.email || '',
      phone: contact.phone || '',
      confidence: matchScore >= MIN_LINKEDIN_MATCH_SCORE ? 'high' : 'medium',
      reason: 'LinkedIn profile URL from live web search',
      _matchScore: matchScore,
    })
    if (matches.length >= cap) break
  }

  return rankLinkedinProfileMatches(matches, contact).slice(0, cap)
}

function mergeLinkedinMatches(primary = [], secondary = [], cap = 5) {
  const seen = new Set()
  const merged = []

  for (const row of [...primary, ...secondary]) {
    const linkedin = normalizeLinkedinUrl(row?.linkedin)
    if (!isLinkedinProfileUrl(linkedin) || seen.has(linkedin)) continue
    seen.add(linkedin)
    merged.push({ ...row, linkedin })
    if (merged.length >= cap) break
  }

  return merged
}

function rankLinkedinMatches(matches, contact = {}) {
  return rankLinkedinProfileMatches(matches, contact)
}

function buildLinkedinDiscoveryQueries(contact, { context = '' } = {}) {
  const firstName = String(contact.firstName || '').trim()
  const lastName = String(contact.lastName || '').trim()
  const name = [firstName, lastName].filter(Boolean).join(' ')
  const company = String(contact.company || '').trim()
  const title = String(contact.title || '').trim()
  const email = String(contact.email || '').trim()
  const location = [contact.city, contact.state].filter(Boolean).join(' ')
  const ctx = String(context || '').trim()
  const queries = new Set()

  if (name) {
    queries.add(`site:linkedin.com/in "${name}" ${company}`.trim())
    queries.add(`${name} ${company} ${title} linkedin.com/in`.trim())
    if (firstName && lastName) {
      queries.add(`"${firstName} ${lastName}" ${company} founder linkedin profile`)
    }
    if (ctx) {
      queries.add(`site:linkedin.com/in "${name}" ${company} ${ctx}`.trim())
    }
    if (location) {
      queries.add(`site:linkedin.com/in "${name}" ${company} ${location}`.trim())
    }
    queries.add(`linkedin.com/in ${firstName || name.split(' ')[0]} ${company}`.trim())
  }
  if (email.includes('@')) {
    const local = email.split('@')[0].replace(/[._]/g, ' ')
    queries.add(`${name || local} ${company} linkedin`.trim())
  }
  if (company && firstName) {
    queries.add(`${firstName} ${company} linkedin`)
  }

  return [...queries].filter((q) => q.length > 4).slice(0, 6)
}

function extractLinkedinUrlsFromSearchResults(results = []) {
  const urls = []
  const linkedinInText =
    /(?:https?:\/\/)?(?:[a-z]{2,3}\.)?(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9_%\-]+/gi

  for (const row of results) {
    if (row?.url) urls.push(row.url)
    const snippet = String(row?.snippet || row?.title || '')
    const found = snippet.match(linkedinInText)
    if (found?.length) urls.push(...found)
  }

  return urls
}

async function perplexityWebSearch(query, { maxResults = 12, searchDomainFilter = null } = {}) {
  const apiKey = process.env.PERPLEXITY_API_KEY
  if (!apiKey) return []

  const body = {
    query: String(query || '').trim(),
    max_results: Math.min(Math.max(maxResults, 1), 20),
  }
  if (Array.isArray(searchDomainFilter) && searchDomainFilter.length) {
    body.search_domain_filter = searchDomainFilter
  }

  const response = await fetch('https://api.perplexity.ai/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.error?.message || data.message || `Perplexity search failed (${response.status})`)
  }

  return Array.isArray(data.results) ? data.results : []
}

async function discoverLinkedinViaPerplexitySearch(contact, options = {}) {
  const queries = buildLinkedinDiscoveryQueries(contact, options)
  if (!queries.length) return []

  const contactCtx = {
    firstName: contact.firstName,
    lastName: contact.lastName,
    title: contact.title,
    company: contact.company,
    email: contact.email,
    city: contact.city,
    state: contact.state,
    phone: contact.phone,
  }

  let allUrls = []
  for (const query of queries) {
    try {
      const onLinkedin = await perplexityWebSearch(query, {
        maxResults: 10,
        searchDomainFilter: ['linkedin.com'],
      })
      allUrls.push(...extractLinkedinUrlsFromSearchResults(onLinkedin))
    } catch {
      // try next query
    }
  }

  if (!allUrls.length) {
    const broadQuery = buildLinkedinDiscoveryQueries(contact, options)[0]
    if (broadQuery) {
      try {
        const broad = await perplexityWebSearch(broadQuery, { maxResults: 12 })
        allUrls.push(...extractLinkedinUrlsFromSearchResults(broad))
      } catch {
        // ignore
      }
    }
  }

  return linkedinMatchesFromCitationUrls(allUrls, contactCtx, 8)
}

async function discoverLinkedinViaPerplexityChat(contact, { broadSearch = false } = {}) {
  const firstName = String(contact.firstName || '').trim()
  const lastName = String(contact.lastName || '').trim()
  const name = [firstName, lastName].filter(Boolean).join(' ')
  const company = String(contact.company || '').trim()
  const email = String(contact.email || '').trim()
  const title = String(contact.title || '').trim()
  const location = [contact.city, contact.state].filter(Boolean).join(', ')

  const prompt = `Find the LinkedIn profile URL (linkedin.com/in/...) for this person. Use live web search.

Name: ${name || 'unknown'}
Job title: ${title || 'unknown'}
Company: ${company || 'unknown'}
Email: ${email || 'unknown'}
Phone: ${contact.phone || 'unknown'}
Location: ${location || 'unknown'}
Website: ${contact.website || 'unknown'}

Return ONLY a JSON array (up to 5). Each object must include a real linkedin.com/in/ URL from search — do not guess URLs.
{
  "linkedin": "https://www.linkedin.com/in/username",
  "firstName": "",
  "lastName": "",
  "title": "",
  "company": "",
  "confidence": "high|medium|low",
  "reason": "short match reason"
}`

  const { text, model, citations = [] } = await chatCompletion(prompt, {
    system:
      'You find LinkedIn /in/ profile URLs for named professionals. Return ONLY a JSON array. Use URLs from search citations when possible.',
    temperature: 0.05,
    maxTokens: 2500,
    searchDomainFilter: broadSearch ? null : ['linkedin.com'],
  })

  const fromCitations = linkedinMatchesFromCitationUrls(citations, {
    firstName,
    lastName,
    title,
    company,
    email,
    city: contact.city,
    state: contact.state,
    phone: contact.phone,
  })
  const fromText = parseLinkedinMatchesFromText(text, 5)
  const matches = mergeLinkedinMatches(fromCitations, fromText, 5)

  return { matches, model }
}

async function loadApolloLinkedinProfiles(contact) {
  if (!isApolloConfigured()) return []
  try {
    const { searchApolloLinkedinProfiles } = await import('./apollo.js')
    return await searchApolloLinkedinProfiles(contact)
  } catch {
    return []
  }
}

/** Find LinkedIn profile candidates using Perplexity Search, Apollo, and Sonar. */
export async function discoverLinkedinForContact(contact = {}, options = {}) {
  const hasPerplexity = isPerplexityConfigured()
  const firstName = String(contact.firstName || '').trim()
  const lastName = String(contact.lastName || '').trim()
  const name = [firstName, lastName].filter(Boolean).join(' ')
  const company = String(contact.company || '').trim()
  const email = String(contact.email || '').trim()

  if (!name && !email && !company) {
    return {
      matches: [],
      error: 'Add at least a name, company, or work email before searching.',
    }
  }

  if (!hasPerplexity && !isApolloConfigured()) {
    return { matches: [], error: 'PERPLEXITY_API_KEY is not set on the server' }
  }

  const providers = []
  let model = null
  let matches = []

  try {
    if (hasPerplexity) {
      const fromSearch = await discoverLinkedinViaPerplexitySearch(contact, options)
      if (fromSearch.length) providers.push('perplexity-search')
      matches = mergeLinkedinMatches(matches, fromSearch, 8)
    }

    const fromApollo = await loadApolloLinkedinProfiles(contact)
    if (fromApollo.length) providers.push('apollo')
    matches = mergeLinkedinMatches(matches, fromApollo, 8)

    if (!matches.length && hasPerplexity) {
      const chat = await discoverLinkedinViaPerplexityChat(contact, { broadSearch: false })
      model = chat.model
      if (chat.matches.length) providers.push('perplexity-chat')
      matches = mergeLinkedinMatches(matches, chat.matches, 8)
    }

    if (!matches.length && hasPerplexity) {
      const chatBroad = await discoverLinkedinViaPerplexityChat(contact, { broadSearch: true })
      model = chatBroad.model
      if (chatBroad.matches.length) providers.push('perplexity-chat-broad')
      matches = mergeLinkedinMatches(matches, chatBroad.matches, 8)
    }

    matches = rankLinkedinMatches(matches, contact).filter(
      (row) =>
        (row._matchScore ?? scoreLinkedinProfileMatch(row.linkedin, contact, row)) >=
        MIN_LINKEDIN_MATCH_SCORE
    )

    const best = pickBestLinkedinMatch(matches, contact)
    if (best) {
      matches = [best, ...matches.filter((m) => m.linkedin !== best.linkedin)].slice(0, 5)
    } else {
      matches = []
    }

    if (!matches.length) {
      return {
        matches: [],
        provider: providers.join('+') || 'none',
        model,
        error:
          name && company
            ? 'No LinkedIn profiles found for this person. Try a different spelling of the company name, or paste the profile URL manually.'
            : 'No LinkedIn profiles found. Add company and job title, then try again.',
        notice: hasPerplexity
          ? 'We searched the web index and AI — LinkedIn may not list this person publicly under that name/company.'
          : 'Set PERPLEXITY_API_KEY on the server for AI LinkedIn search.',
      }
    }

    return {
      matches,
      provider: providers.join('+') || 'perplexity',
      model,
      aiGenerated: true,
      notice: 'Verify the profile photo and company before saving.',
    }
  } catch (error) {
    return {
      matches: [],
      error: error.message || 'AI LinkedIn search failed',
    }
  }
}

const WORKSPACE_QUESTION_IDS = [
  'last_60_days_revenue',
  'revenue_leader_weekly',
  'revenue_leader_monthly',
  'customer_last_trade',
  'top_customers_revenue',
  'inactive_60_days',
]

/** Read uploaded spreadsheet sample and propose workspace report questions (CRM stays separate). */
export async function analyzeWorkspaceUpload({
  industry = 'logistics_trading',
  columns = [],
  sampleRows = [],
  rowCount = 0,
} = {}) {
  if (!isPerplexityConfigured()) {
    return {
      configured: false,
      summary: 'AI is not configured. We used automatic column detection only.',
      columnMapping: {},
      suggestedQuestions: WORKSPACE_QUESTION_IDS.map((id) => ({
        id,
        label: id.replace(/_/g, ' '),
        recommended: ['customer_last_trade', 'last_60_days_revenue'].includes(id),
      })),
    }
  }

  const prompt = `Industry: ${industry}
Total rows in file: ${rowCount}
Column headers (normalized keys): ${JSON.stringify(columns)}
Sample rows (up to 8): ${JSON.stringify(sampleRows)}

This data is for a COMPANY WORKSPACE analytics page only — it must NOT update a CRM.

Respond with ONLY valid JSON:
{
  "summary": "2-3 sentences describing what this spreadsheet contains",
  "grain": "transaction" | "customer" | "mixed",
  "columnMapping": {
    "revenue": "column_key_or_null",
    "date": "column_key_or_null",
    "customer": "column_key_or_null",
    "leader": "column_key_or_null"
  },
  "suggestedQuestions": [
    { "id": "last_60_days_revenue", "label": "...", "description": "...", "recommended": true|false }
  ]
}

Only use question ids from this list: ${WORKSPACE_QUESTION_IDS.join(', ')}.
Include each question that the columns can support; set recommended false if columns are missing.
Do not invent columns not present in the headers.`

  try {
    const { text } = await chatCompletion(prompt, {
      system:
        'You analyze business spreadsheets for Indian B2B companies. Output JSON only, no markdown.',
      temperature: 0.1,
      maxTokens: 2500,
    })
    const jsonText = extractJsonObject(text)
    if (!jsonText) throw new Error('AI did not return JSON')
    const parsed = JSON.parse(jsonText)
    const suggested = (parsed.suggestedQuestions || []).filter((q) =>
      WORKSPACE_QUESTION_IDS.includes(q.id)
    )
    return {
      configured: true,
      summary: String(parsed.summary || '').slice(0, 800),
      grain: parsed.grain || 'mixed',
      columnMapping: parsed.columnMapping || {},
      suggestedQuestions: suggested.length
        ? suggested
        : WORKSPACE_QUESTION_IDS.map((id) => ({ id, recommended: false })),
    }
  } catch (error) {
    return {
      configured: true,
      error: error.message,
      summary: 'Automatic column detection was used; refine goals below.',
      columnMapping: {},
      suggestedQuestions: WORKSPACE_QUESTION_IDS.map((id) => ({
        id,
        recommended: id === 'customer_last_trade',
      })),
    }
  }
}

const CRM_RESEARCH_SYSTEM = `You are Connect Intel CRM AI — live web research for B2B sales teams.

Your job is to ANSWER the user's exact question with specific facts from the web — not to teach them how to search.

Output format (always use this structure):

**Answer:** One or two sentences that directly answer the question.

**Findings:**
- Bullet each concrete fact: person name, job title, company, product, price, date, metric, or URL.
- For people requests: list up to 8 real individuals with **Name — Title @ Company** and LinkedIn profile URL when found.
- For company requests: HQ, industry, size, funding, key products, recent news (with dates when known).
- For Amazon/market: specific products, ranks, prices, brands — not generic advice.

**Gaps:** (only if needed) One line on what could not be verified.

Rules:
- Lead with facts the user asked for. Never open with "Here's how to search LinkedIn" unless they asked for search tips.
- Prefer named entities over vague categories. Wrong: "look for supply chain managers". Right: "Priya Sharma — Head of Supply Chain @ Innovist (linkedin.com/in/...)".
- Include full https URLs inline for profiles, company pages, and news.
- B2B professional use only. No harassment or ToS bypass.
- Never mention Perplexity or internal providers.
- Stay compact: typically 8–15 lines total. No long essays.`

function isPeopleOrRoleQuery(query) {
  return /\b(manager|director|head of|lead|vp|people|employees|contacts?|profiles?|founder|ceo|cto|supply chain|logistics|procurement|sales rep|decision maker)\b/i.test(
    query
  )
}

function isCompanyIntelQuery(query) {
  return /\b(company|startup|funding|revenue|news|competitor|acquisition|about)\b/i.test(query)
}

function buildResearchUserPrompt(query, focus) {
  const q = String(query || '').trim()
  const lines = [`Question: ${q}`, '']

  if (focus === 'linkedin' || isPeopleOrRoleQuery(q)) {
    lines.push(
      'Task: Find specific named people matching this request. Return real names, titles, companies, and LinkedIn profile URLs.',
      'Do not explain how to use LinkedIn filters — return actual people found on the web.'
    )
  } else if (focus === 'amazon') {
    lines.push(
      'Task: Return specific Amazon listings, products, brands, prices, or bestseller ranks relevant to this question.'
    )
  } else if (isCompanyIntelQuery(q)) {
    lines.push(
      'Task: Return specific company facts: what they do, HQ, size, funding, leadership, and recent dated news.'
    )
  } else {
    lines.push('Task: Answer with the most specific facts available from current web sources.')
  }

  lines.push('', 'Follow the output format in your system instructions exactly.')
  return lines.join('\n')
}

function inferResearchFocus(query) {
  const q = String(query || '').toLowerCase()
  if (isPeopleOrRoleQuery(q) || /linkedin|linked in/i.test(q)) return 'linkedin'
  if (/amazon\.| on amazon|amazon seller|amazon product|bestseller/i.test(q)) return 'amazon'
  return 'general'
}

/** Live web research for CRM AI (Perplexity Sonar). */
export async function crmAssistantWebResearch(query, options = {}) {
  if (!isPerplexityConfigured()) {
    return {
      error:
        'Web research is not available yet. Your admin can enable PERPLEXITY_API_KEY — you can still ask CRM and Marketing how-to questions.',
      text: null,
      citations: [],
    }
  }

  const text = String(query || '').trim().slice(0, 1500)
  if (!text) return { error: 'Enter a research question.', text: null, citations: [] }

  const focus = options.focus || inferResearchFocus(text)
  const peopleSearch = focus === 'linkedin' || isPeopleOrRoleQuery(text)
  let searchDomainFilter = null
  // Broad web search finds named people better than linkedin.com-only filter
  if (focus === 'amazon') searchDomainFilter = ['amazon.in', 'amazon.com', 'amazon.co.uk']

  const userPrompt = buildResearchUserPrompt(text, focus)

  try {
    const { text: answer, model, citations } = await chatCompletion(userPrompt, {
      system: CRM_RESEARCH_SYSTEM,
      temperature: 0.1,
      maxTokens: 2800,
      searchDomainFilter,
      searchRecencyFilter: peopleSearch ? 'year' : 'month',
      returnCitations: true,
    })

    const body = preprocessAiText(answer)
    if (!body) {
      return { error: 'No results found. Try a more specific company, product, or LinkedIn name.', citations: [] }
    }

    return {
      text: body,
      citations: (citations || []).slice(0, 6),
      model,
      focus,
      source: 'web',
    }
  } catch (error) {
    return {
      error: error.message || 'Web research failed. Try again or rephrase your question.',
      citations: [],
    }
  }
}
