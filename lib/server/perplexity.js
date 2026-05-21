import { createId } from './store.js'

export function isPerplexityConfigured() {
  return Boolean(process.env.PERPLEXITY_API_KEY)
}

function perplexityModel() {
  return process.env.PERPLEXITY_MODEL || 'sonar'
}

async function chat(prompt) {
  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
    },
    body: JSON.stringify({
      model: perplexityModel(),
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
    throw new Error(data.error?.message || `Perplexity API error (${response.status})`)
  }

  return data.choices?.[0]?.message?.content || ''
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

function parseLeadsFromText(text, max) {
  const match = String(text).match(/\[[\s\S]*\]/)
  if (!match) return []

  try {
    const arr = JSON.parse(match[0])
    return arr.slice(0, max).map((row, index) => ({
      id: row.id || `pplx-${createId('lead')}-${index}`,
      firstName: row.firstName || row.first_name || '',
      lastName: row.lastName || row.last_name || '',
      title: row.title || 'Business Contact',
      company: row.company || row.company_name || '',
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
    }))
  } catch {
    return []
  }
}

/** Web-informed lead discovery — admin research or empty-search fallback. */
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

  try {
    const text = await chat(prompt)
    const leads = parseLeadsFromText(text, count)
    return {
      leads,
      aiGenerated: true,
      provider: 'perplexity',
      notice:
        leads.length > 0
          ? 'AI discovery (Perplexity) — verify contacts before outreach. Import via Admin to add to your database.'
          : 'Perplexity returned no parseable leads.',
    }
  } catch (error) {
    return { leads: [], error: error.message, aiGenerated: false }
  }
}
