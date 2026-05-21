import { createId } from './store.js'

export function isPerplexityConfigured() {
  return Boolean(process.env.PERPLEXITY_API_KEY)
}

function perplexityModels() {
  const preferred = process.env.PERPLEXITY_MODEL
  const list = preferred ? [preferred] : []
  return [...new Set([...list, 'sonar', 'sonar-pro'])]
}

function buildSearchQuery(filters) {
  const parts = []
  if (filters.keywords) parts.push(filters.keywords)
  if (filters.jobTitles?.length) parts.push(filters.jobTitles.join(' '))
  if (filters.cities?.length) parts.push(filters.cities.join(' '))
  if (filters.states?.length) parts.push(filters.states.join(' '))
  if (filters.industries?.length) parts.push(filters.industries.join(' '))
  parts.push('India', 'B2B', 'exporter', 'company', 'contact')
  return parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
}

function buildCriteria(filters) {
  const parts = []
  if (filters.keywords) parts.push(`Keywords: ${filters.keywords}`)
  if (filters.jobTitles?.length) parts.push(`Roles: ${filters.jobTitles.join(', ')}`)
  if (filters.states?.length) parts.push(`States: ${filters.states.join(', ')}`)
  if (filters.cities?.length) parts.push(`Cities: ${filters.cities.join(', ')}`)
  if (filters.industries?.length) parts.push(`Industries: ${filters.industries.join(', ')}`)
  return parts.length ? parts.join('\n') : 'Indian B2B exporters'
}

async function chatCompletion(prompt) {
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
          temperature: 0.2,
          max_tokens: 4096,
          messages: [
            {
              role: 'system',
              content:
                'You return only valid JSON. Never invent direct personal emails; use empty string for email if unknown.',
            },
            { role: 'user', content: prompt },
          ],
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        lastError = new Error(data.error?.message || `Perplexity chat error (${response.status}) for model ${model}`)
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

async function searchApi(query, maxResults) {
  const response = await fetch('https://api.perplexity.ai/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
    },
    body: JSON.stringify({
      query,
      max_results: Math.min(Math.max(maxResults, 1), 20),
      max_tokens_per_page: 512,
      country: 'IN',
    }),
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.error?.message || data.message || `Perplexity Search API error (${response.status})`)
  }

  return data.results || []
}

function parseLeadsFromText(text, max) {
  const match = String(text).match(/\[[\s\S]*\]/)
  if (!match) return []

  try {
    const arr = JSON.parse(match[0])
    return arr.slice(0, max).map((row, index) => shapeLeadRow(row, index))
  } catch {
    return []
  }
}

function shapeLeadRow(row, index) {
  return {
    id: row.id || `pplx-${createId('lead')}-${index}`,
    firstName: row.firstName || row.first_name || '',
    lastName: row.lastName || row.last_name || '',
    title: row.title || 'Business Contact',
    company: row.company || row.company_name || row.name || '',
    companyDomain: row.companyDomain || row.website || '',
    email: row.email || '',
    phone: row.phone || '',
    city: row.city || '',
    state: row.state || '',
    location: row.location || [row.city, row.state].filter(Boolean).join(', '),
    industry: row.industry || '',
    employees: row.employees || '',
    emailStatus: row.email ? 'likely' : 'unverified',
    score: Math.max(62, 88 - index * 3),
    source: 'ai-discovery',
    linkedin: row.linkedin || '',
  }
}

function leadsFromSearchResults(results, filters, max) {
  const stateHint = filters.states?.[0] || 'Rajasthan'
  const cityHint = filters.cities?.[0] || ''

  return results.slice(0, max).map((row, index) => {
    const title = String(row.title || '').trim()
    const snippet = String(row.snippet || '').slice(0, 200)
    const company = title.split('|')[0].split(' - ')[0].trim() || `Company ${index + 1}`

    return {
      id: `pplx-search-${index}-${Date.now()}`,
      firstName: '',
      lastName: '',
      title: 'Export / Sales contact',
      company,
      companyDomain: (() => {
        try {
          return row.url ? new URL(row.url).hostname.replace(/^www\./, '') : ''
        } catch {
          return ''
        }
      })(),
      email: '',
      phone: '',
      city: cityHint,
      state: stateHint,
      location: [cityHint, stateHint].filter(Boolean).join(', '),
      industry: filters.industries?.[0] || 'B2B',
      employees: '',
      emailStatus: 'unverified',
      score: Math.max(60, 80 - index * 4),
      source: 'ai-discovery',
      linkedin: '',
      snippet,
      sourceUrl: row.url || '',
    }
  })
}

/** Web-informed lead discovery — Sonar chat, then Search API fallback. */
export async function discoverLeadsWithPerplexity(filters, count = 6) {
  if (!isPerplexityConfigured()) {
    return { leads: [], error: 'PERPLEXITY_API_KEY is not set' }
  }

  const criteria = buildCriteria(filters)
  const prompt = `List up to ${count} real Indian B2B companies and one export/sales contact each matching:

${criteria}

Return ONLY a JSON array. Each object:
firstName, lastName, title, company, email (empty if unknown), phone (optional), city, state, industry, website.

Focus on verified-sounding businesses in the requested states/cities.`

  const errors = []

  try {
    const { text, model } = await chatCompletion(prompt)
    const leads = parseLeadsFromText(text, count)
    if (leads.length) {
      return {
        leads,
        aiGenerated: true,
        provider: 'perplexity',
        method: `sonar:${model}`,
        notice:
          'AI discovery (Perplexity) — verify contacts before outreach. Import via Admin to add to your database.',
      }
    }
    errors.push('Sonar returned no parseable JSON leads')
  } catch (error) {
    errors.push(error.message || 'Sonar chat failed')
  }

  try {
    const query = buildSearchQuery(filters)
    const results = await searchApi(query, count)
    const leads = leadsFromSearchResults(results, filters, count)
    if (leads.length) {
      return {
        leads,
        aiGenerated: true,
        provider: 'perplexity',
        method: 'search-api',
        notice:
          'AI discovery via Perplexity Search — company names from the web. Verify contacts, then import in Admin.',
      }
    }
    errors.push('Search API returned no results')
  } catch (error) {
    errors.push(error.message || 'Search API failed')
  }

  return {
    leads: [],
    aiGenerated: false,
    error: errors.join(' · '),
    notice: `Perplexity could not find leads. ${errors.join(' · ')}`,
  }
}
