import { createId } from './store.js'
import {
  filterUsableLeads,
  normalizeLeadContact,
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
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced) raw = fenced[1].trim()
  const match = raw.match(/\[[\s\S]*\]/)
  return match ? match[0] : null
}

function extractJsonObject(text) {
  let raw = String(text || '').trim()
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced) raw = fenced[1].trim()
  const match = raw.match(/\{[\s\S]*\}/)
  return match ? match[0] : null
}

async function chatCompletion(prompt, { system, temperature = 0.15, maxTokens = 3072 } = {}) {
  const apiKey = process.env.PERPLEXITY_API_KEY
  const systemMessage =
    system ||
    'You are a B2B data assistant for India. Output ONLY a raw JSON array (no markdown). Include company name on every row; email and phone when known.'
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
    title: row.title || row.designation || 'Business Contact',
    company: row.company || row.company_name || row.business_name || '',
    companyDomain: row.companyDomain || row.website || row.domain || '',
    email: row.email || row.work_email || row.contact_email || '',
    phone: row.phone || row.mobile || row.phone_number || row.contact_phone || '',
    city: row.city || '',
    state: row.state || '',
    location: row.location || [row.city, row.state].filter(Boolean).join(', '),
    industry: row.industry || '',
    employees: row.employees || '',
    source: 'ai-discovery',
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

function buildDiscoveryPrompt(filters, limit, { focused = false, naturalQuery = '', intent = 'find_companies', targetCompany = null, targetRole = null } = {}) {
  const criteria = buildCriteria(filters)
  const userAsk = String(naturalQuery || filters.keywords || '').trim() || 'B2B prospects in India'
  const stateLine = filters.states?.length ? `States: ${filters.states.join(', ')}` : 'India (any state)'
  const cityLine = filters.cities?.length ? `Cities: ${filters.cities.slice(0, 8).join(', ')}` : ''

  if (intent === 'find_contact_at_company' && targetCompany) {
    const role = targetRole || 'decision maker'
    return `Find up to ${limit} real ${role} contacts at "${targetCompany}" in India (or the company's operating market).

User request: ${userAsk}

Return a JSON array only. Each object:
firstName, lastName, title, company (use "${targetCompany}" or official legal name), email, phone, city, state, industry, website.

Prioritize ${role} or senior sales/operations leaders. Include work email and phone when publicly listed.`
  }

  if (focused) {
    return `List ${limit} real Indian B2B companies and contacts.

User request: ${userAsk}
Location: ${stateLine}${cityLine ? ` · ${cityLine}` : ''}

Each JSON object: firstName, lastName, title, company (required), email, phone, city, state, industry, website.
Include email or phone when publicly available.`
  }

  return `Find ${limit} real Indian B2B companies and decision-maker contacts matching this request:

"${userAsk}"

${criteria ? `Structured filters:\n${criteria}` : ''}

Return a JSON array only. Each object keys:
firstName, lastName, title, company, email, phone, city, state, industry, website.

Requirements:
- Match the user's industry, product, role, or company type (not limited to exporters or ecommerce).
- Real organizations in the requested geography when specified; company name required on every row.
- Add email and phone when you find them.`
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

/** Web-informed discovery — Sonar with one retry; normalizes phones before validation. */
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
  const requestCount = Math.min(limit + 6, 55)
  const errors = []
  const promptOptions = {
    naturalQuery,
    intent: options.intent || 'find_companies',
    targetCompany: options.targetCompany || null,
    targetRole: options.targetRole || null,
  }

  for (const focused of [false, true]) {
    try {
      const prompt = buildDiscoveryPrompt(filters, requestCount, { focused, ...promptOptions })
      const { text, model } = await chatCompletion(prompt)
      const parsed = parseLeadsFromText(text, requestCount)
      const leads = filterUsableLeads(parsed).slice(0, limit)

      if (leads.length) {
        return {
          leads,
          allParsed: parsed,
          parsedCount: parsed.length,
          aiGenerated: true,
          provider: 'perplexity',
          method: `sonar:${model}${focused ? ':retry' : ''}`,
          notice:
            'AI discovery found matching companies and contacts. Verify details before outreach — saved to your database when search runs.',
        }
      }

      errors.push(
        focused
          ? 'Retry returned no companies with names'
          : `Parsed ${parsed.length} row(s) but none had a company or contact name`
      )
    } catch (error) {
      errors.push(error.message || 'Perplexity request failed')
    }
  }

  return {
    leads: [],
    error:
      'No matching companies were returned. Try a clearer sentence (product + city/state), or import data in Admin / Team.',
      notice: errors.join(' · '),
  }
}
