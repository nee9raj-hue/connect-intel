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

async function chatCompletion(prompt, { strict = true } = {}) {
  const apiKey = process.env.PERPLEXITY_API_KEY
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
          temperature: 0.15,
          max_tokens: 3072,
          messages: [
            {
              role: 'system',
              content: strict
                ? 'You are a B2B data assistant for India. Output ONLY a raw JSON array (no markdown). Each object must include at least a business email OR Indian phone (+91).'
                : 'Output ONLY a raw JSON array (no markdown). Each contact needs at least email or phone.',
            },
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

function buildDiscoveryPrompt(filters, limit, { focused = false } = {}) {
  const criteria = buildCriteria(filters)
  const stateLine = filters.states?.length ? `State: ${filters.states[0]}` : 'India'
  const cityLine = filters.cities?.length ? `Cities: ${filters.cities.slice(0, 5).join(', ')}` : ''

  if (focused) {
    return `List ${limit} real Indian B2B contacts for ${stateLine}${cityLine ? `, ${cityLine}` : ''}, keyword "${filters.keywords || 'exporter'}".

Each JSON object: firstName, lastName, title, company, email (work), phone (+91-XX-XXXXXXX), city, state, industry, website.
Use publicly listed export/sales contacts. Every row must have at least email OR phone.`
  }

  return `Find ${limit} Indian B2B export or sales contacts:

${criteria}

Return a JSON array only. Each object keys:
firstName, lastName, title, company, email, phone, city, state, industry, website.

Requirements:
- Real companies in the requested geography.
- email = work email on company domain.
- phone = Indian number with +91 (mobile or office).
- Skip rows only if you have neither email nor phone.`
}

/** Web-informed discovery — Sonar with one retry; normalizes phones before validation. */
export async function discoverLeadsWithPerplexity(filters, count = 5) {
  if (!isPerplexityConfigured()) {
    return { leads: [], error: 'PERPLEXITY_API_KEY is not set' }
  }

  const criteria = buildCriteria(filters)
  if (!criteria) {
    return {
      leads: [],
      error: 'Add keywords or location filters before AI discovery runs.',
    }
  }

  const limit = Math.min(Math.max(count, 1), 8)
  const requestCount = Math.min(limit + 3, 10)
  const errors = []

  for (const focused of [false, true]) {
    try {
      const prompt = buildDiscoveryPrompt(filters, requestCount, { focused })
      const { text, model } = await chatCompletion(prompt, { strict: !focused })
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
            'AI discovery found contacts with email or phone. Verify before outreach — saved to your master database when search runs.',
        }
      }

      errors.push(
        focused
          ? 'Retry returned no contacts with email or phone'
          : `Parsed ${parsed.length} row(s) but none had email or phone`
      )
    } catch (error) {
      errors.push(error.message || 'Perplexity request failed')
    }
  }

  return {
    leads: [],
    error:
      'No contacts with email or phone were returned. Upload your pipeline CSV in Team → Import, or try one state + keyword "exporter".',
      notice: errors.join(' · '),
  }
}
