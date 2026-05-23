import { createId } from './store.js'
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

function extractJsonArray(text) {
  let raw = String(text || '').trim()
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/gi)
  if (fenced?.length) {
    for (const block of fenced) {
      const inner = block.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim()
      const found = tryParseArray(inner)
      if (found) return found
    }
  }

  const objectMatch = raw.match(/\{[\s\S]*\}/)
  if (objectMatch) {
    try {
      const obj = JSON.parse(objectMatch[0])
      for (const key of ['leads', 'results', 'companies', 'contacts', 'data']) {
        if (Array.isArray(obj[key]) && obj[key].length) {
          return JSON.stringify(obj[key])
        }
      }
    } catch {
      // continue
    }
  }

  const arrays = []
  const re = /\[[\s\S]*?\]/g
  let m
  while ((m = re.exec(raw)) !== null) {
    arrays.push(m[0])
  }
  for (let i = arrays.length - 1; i >= 0; i -= 1) {
    const parsed = tryParseArray(arrays[i])
    if (parsed) return parsed
  }

  const match = raw.match(/\[[\s\S]*\]/)
  return match ? match[0] : null
}

function tryParseArray(jsonText) {
  try {
    const arr = JSON.parse(jsonText)
    return Array.isArray(arr) && arr.length ? jsonText : null
  } catch {
    return null
  }
}

function extractJsonObject(text) {
  let raw = String(text || '').trim()
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced) raw = fenced[1].trim()
  const match = raw.match(/\{[\s\S]*\}/)
  return match ? match[0] : null
}

async function chatCompletion(prompt, { system, temperature = 0.15, maxTokens = 4096 } = {}) {
  const apiKey = process.env.PERPLEXITY_API_KEY
  const systemMessage =
    system ||
    `You are a B2B lead research assistant for India. You MUST respond with ONLY a valid JSON array of objects.
Each object needs: firstName, lastName, title, company, email, phone, city, state, industry, website.
No markdown, no explanation — only the JSON array. Include real companies matching the user's request.`
  let lastError = null

  for (const model of perplexityModels()) {
    try {
      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature,
          max_tokens: maxTokens,
          messages: [
            { role: 'system', content: systemMessage },
            { role: 'user', content: prompt },
          ],
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        lastError = new Error(data.error?.message || `Perplexity error (${response.status}) model ${model}`)
        continue
      }

      const text = data.choices?.[0]?.message?.content || ''
      if (text) return { text, model }
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
  const jsonText = extractJsonArray(text)
  if (!jsonText) return []

  try {
    const arr = JSON.parse(jsonText)
    if (!Array.isArray(arr)) return []
    return arr.slice(0, max * 3).map((row, index) => shapeLeadRow(row, index))
  } catch {
    return []
  }
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

  if (simple && cityLine) {
    return `List ${limit} real companies and business contacts in ${cityLine}, India for: ${userAsk}.

Examples: exporters, manufacturers, wholesalers, traders in ${cityLine}.
Return ONLY a JSON array with keys: firstName, lastName, title, company, email, phone, city, state, industry, website.
Include real business names in ${cityLine}. Add email or phone when known.`
  }

  if (focused) {
    return `List ${limit} real Indian B2B companies and contacts.

Search: ${userAsk}
City: ${cityLine || 'as mentioned in search'}
State: ${stateLine}

Return ONLY a JSON array. Each object: firstName, lastName, title, company (required), email, phone, city, state, industry, website.`
  }

  return `Find ${limit} real Indian B2B companies and decision-maker contacts for this search:

"${userAsk}"

Location: ${cityLine ? `City: ${cityLine}. ` : ''}State: ${stateLine}.
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
      const leads = acceptParsedLeads(parsed, limit)

      if (leads.length) {
        return {
          leads,
          allParsed: parsed,
          parsedCount: parsed.length,
          aiGenerated: true,
          provider: 'perplexity',
          method: `sonar:${model}:${attempt.label}`,
          notice: 'Live AI discovery from Perplexity — verify contacts before outreach.',
        }
      }

      errors.push(
        `${attempt.label}: parsed ${parsed.length} row(s), ${leads.length} usable` +
          (parsed.length === 0 ? ` (response preview: ${lastRaw}…)` : '')
      )
    } catch (error) {
      errors.push(`${attempt.label}: ${error.message || 'request failed'}`)
    }
  }

  return {
    leads: [],
    error:
      'Perplexity could not return matching companies for this search. Try adding product type + city, e.g. "textile exporters in Ludhiana Punjab".',
    notice: errors.join(' · '),
  }
}
