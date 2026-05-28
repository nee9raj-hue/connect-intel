import { createId } from './store.js'
import { isApolloConfigured } from './apollo.js'
import {
  filterUsableLeads,
  normalizeLeadContact,
  isDisplayableLead,
} from './leadQuality.js'

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

async function chatCompletion(
  prompt,
  { system, temperature = 0.15, maxTokens = 12000, searchDomainFilter = null } = {}
) {
  const apiKey = process.env.PERPLEXITY_API_KEY
  const systemMessage =
    system ||
    `You are a B2B lead research assistant for India. You MUST respond with ONLY a valid JSON array of objects.
Each object needs: firstName, lastName, title, company, email, phone, city, state, industry, website.
No markdown, no explanation — only the JSON array. Include real companies matching the user's request.`
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

function buildDiscoveryPrompt(
  filters,
  limit,
  { focused = false, naturalQuery = '', intent = 'find_companies', targetCompany = null, targetRole = null, simple = false } = {}
) {
  const criteria = buildCriteria(filters)
  const userAsk = String(naturalQuery || filters.keywords || '').trim() || 'B2B prospects in India'
  const stateLine = filters.states?.length ? filters.states.join(', ') : 'Punjab and all India as relevant'
  const cityLine = filters.cities?.length ? filters.cities.join(', ') : ''

  if (intent === 'find_contact_at_company' && targetCompany) {
    const role = targetRole || 'decision maker'
    return `Find ${limit} real ${role} contacts at "${targetCompany}" in India.

User request: ${userAsk}

Return ONLY a JSON array. Each object: firstName, lastName, title, company, email, phone, city, state, industry, website.`
  }

  const cityFromQuery =
    cityLine ||
    (/\bludhiana\b/i.test(userAsk) ? 'Ludhiana' : '') ||
    (/\b(amritsar|surat|jaipur|ahmedabad|mumbai|delhi|chennai|hyderabad|kolkata|bengaluru|bangalore)\b/i.exec(
      userAsk
    )?.[1] || '')

  if (simple && cityFromQuery) {
    return `List ${limit} real companies and business contacts in ${cityFromQuery}, India for: ${userAsk}.

Examples: exporters, manufacturers, wholesalers, traders in ${cityFromQuery}.
Return ONLY a JSON array with keys: firstName, lastName, title, company, email, phone, city, state, industry, website.
Include real business names in ${cityFromQuery}. Add email or phone when known.`
  }

  if (focused) {
    return `List ${limit} real Indian B2B companies and contacts.

Search: ${userAsk}
City: ${cityFromQuery || 'as mentioned in search'}
State: ${stateLine}

Return ONLY a JSON array. Each object: firstName, lastName, title, company (required), email, phone, city, state, industry, website.`
  }

  return `Find exactly ${limit} real Indian B2B companies and decision-maker contacts for this search (return all ${limit} in one JSON array):

"${userAsk}"

Location: ${cityFromQuery ? `City: ${cityFromQuery}. ` : ''}State: ${stateLine}.
${criteria ? `Also: ${criteria}` : ''}

Return ONLY a JSON array (no other text). Each object:
firstName, lastName, title, company, email, phone, city, state, industry, website.

Rules:
- Companies must match the search (e.g. exporters in Ludhiana for "exporters from ludhiana").
- Use real business names; company field is required on every row.
- Include email and Indian phone (+91) when you find them; do not fabricate.`
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

/** Web-informed discovery — Sonar with retries and robust JSON parsing. */
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
  const requestCount = Math.min(limit + 10, 55)
  const errors = []
  const promptOptions = {
    naturalQuery,
    intent: options.intent || 'find_companies',
    targetCompany: options.targetCompany || null,
    targetRole: options.targetRole || null,
  }

  const attempts = [
    { focused: false, simple: false, label: 'primary' },
    { focused: true, simple: false, label: 'focused' },
    { focused: true, simple: true, label: 'city-simple' },
  ]

  let lastRaw = ''

  for (const attempt of attempts) {
    try {
      const prompt = buildDiscoveryPrompt(filters, requestCount, { ...promptOptions, ...attempt })
      const { text, model } = await chatCompletion(prompt, {
        temperature: attempt.simple ? 0.25 : 0.12,
      })
      lastRaw = text.slice(0, 200)
      const parsed = parseLeadsFromText(text, requestCount)
      let leads = acceptParsedLeads(parsed, limit)
      if (!leads.length) {
        const fromObjects = extractJsonObjectsFromText(text).map((row, i) => shapeLeadRow(row, i))
        leads = acceptParsedLeads(fromObjects, limit)
      }
      if (!leads.length && parsed.length) {
        leads = parsed.filter(isDisplayableLead).slice(0, limit)
      }

      const finalLeads = leads

      if (finalLeads.length) {
        return {
          leads: finalLeads,
          allParsed: parsed.length ? parsed : finalLeads,
          parsedCount: Math.max(parsed.length, finalLeads.length),
          aiGenerated: true,
          provider: 'perplexity',
          method: `sonar:${model}:${attempt.label}`,
          notice: 'Live AI discovery — verify contacts before outreach.',
        }
      }

      const objCount = extractJsonObjectsFromText(text).length
      errors.push(
        `${attempt.label}: array=${parsed.length} objects=${objCount} usable=${finalLeads.length}` +
          (finalLeads.length === 0 ? ` preview=${lastRaw.replace(/\s+/g, ' ').slice(0, 120)}…` : '')
      )
    } catch (error) {
      errors.push(`${attempt.label}: ${error.message || 'request failed'}`)
    }
  }

  return {
    leads: [],
    error:
      'We could not find matching companies for this search. Try adding product type and city, e.g. "textile exporters in Ludhiana Punjab".',
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
  return /(?:^|\/\/)(?:[a-z]{2,3}\.)?(?:www\.)?linkedin\.com\/in\/[^/?#\s]+/i.test(String(url || ''))
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
      confidence: matches.length === 0 ? 'high' : 'medium',
      reason: 'LinkedIn profile URL from live web search',
    })
    if (matches.length >= cap) break
  }

  return matches
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
  const fn = String(contact.firstName || '').toLowerCase()
  const ln = String(contact.lastName || '').toLowerCase()
  const co = String(contact.company || '').toLowerCase()

  const score = (row) => {
    let points = 0
    const slug = String(row.linkedin || '')
      .split('/in/')[1]
      ?.split(/[/?#]/)[0]
      ?.toLowerCase() || ''
    const blob = `${row.fullName} ${row.title} ${row.company} ${row.reason}`.toLowerCase()

    if (fn && slug.includes(fn.replace(/\s+/g, '-'))) points += 12
    else if (fn && slug.includes(fn)) points += 10
    if (ln && slug.includes(ln.replace(/\s+/g, '-'))) points += 8
    else if (ln && slug.includes(ln)) points += 6
    if (co.length > 2 && blob.includes(co.slice(0, Math.min(co.length, 12)))) points += 5
    if (row.confidence === 'high') points += 2
    return points
  }

  return [...matches].sort((a, b) => score(b) - score(a))
}

function buildLinkedinDiscoveryQueries(contact) {
  const firstName = String(contact.firstName || '').trim()
  const lastName = String(contact.lastName || '').trim()
  const name = [firstName, lastName].filter(Boolean).join(' ')
  const company = String(contact.company || '').trim()
  const title = String(contact.title || '').trim()
  const email = String(contact.email || '').trim()
  const queries = new Set()

  if (name) {
    queries.add(`${name} ${company} ${title} linkedin.com/in`.trim())
    queries.add(`site:linkedin.com/in ${name} ${company}`.trim())
    if (firstName && lastName) {
      queries.add(`"${firstName} ${lastName}" ${company} linkedin profile`)
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

  return [...queries].filter((q) => q.length > 4).slice(0, 5)
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

async function discoverLinkedinViaPerplexitySearch(contact) {
  const queries = buildLinkedinDiscoveryQueries(contact)
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
    const broadQuery = buildLinkedinDiscoveryQueries(contact)[0]
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
export async function discoverLinkedinForContact(contact = {}) {
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
      const fromSearch = await discoverLinkedinViaPerplexitySearch(contact)
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

    matches = rankLinkedinMatches(matches, contact).slice(0, 5)

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
