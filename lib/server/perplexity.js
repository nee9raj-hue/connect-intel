import { createId } from './store.js'
import { filterUsableLeads, hasValidEmail, hasValidPhone } from './leadQuality.js'

export function isPerplexityConfigured() {
  return Boolean(process.env.PERPLEXITY_API_KEY)
}

function perplexityModels() {
  const preferred = process.env.PERPLEXITY_MODEL
  const list = preferred ? [preferred] : []
  return [...new Set([...list, 'sonar'])]
}

function buildCriteria(filters) {
  const parts = []
  if (filters.keywords) parts.push(`Business focus: ${filters.keywords}`)
  if (filters.states?.length) parts.push(`States: ${filters.states.join(', ')}`)
  if (filters.cities?.length) parts.push(`Cities: ${filters.cities.join(', ')}`)
  if (filters.industries?.length) parts.push(`Industries: ${filters.industries.join(', ')}`)
  return parts.length ? parts.join('\n') : ''
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
          temperature: 0.1,
          max_tokens: 2048,
          messages: [
            {
              role: 'system',
              content:
                'Return only a JSON array. Every contact MUST include a real business email and India phone (+91). Omit any row missing either field.',
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

function parseLeadsFromText(text, max) {
  const match = String(text).match(/\[[\s\S]*\]/)
  if (!match) return []

  try {
    const arr = JSON.parse(match[0])
    return filterUsableLeads(arr.slice(0, max * 2).map((row, index) => shapeLeadRow(row, index))).slice(0, max)
  } catch {
    return []
  }
}

function shapeLeadRow(row, index) {
  const email = String(row.email || row.work_email || '').trim()
  const phone = String(row.phone || row.mobile || row.phone_number || '').trim()

  return {
    id: row.id || `pplx-${createId('lead')}-${index}`,
    firstName: row.firstName || row.first_name || '',
    lastName: row.lastName || row.last_name || '',
    title: row.title || 'Business Contact',
    company: row.company || row.company_name || row.name || '',
    companyDomain: row.companyDomain || row.website || '',
    email,
    phone,
    city: row.city || '',
    state: row.state || '',
    location: row.location || [row.city, row.state].filter(Boolean).join(', '),
    industry: row.industry || '',
    employees: row.employees || '',
    emailStatus: hasValidEmail(email) ? 'likely' : 'unverified',
    score: Math.max(72, 92 - index * 2),
    source: 'ai-discovery',
    linkedin: row.linkedin || '',
  }
}

/** Precise web-informed discovery — one Sonar call, only contacts with email + phone. */
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

  const limit = Math.min(Math.max(count, 1), 5)
  const prompt = `Find exactly ${limit} Indian B2B export/sales contacts matching:

${criteria}

Rules:
- India only. Real companies in the listed states/cities when provided.
- Each row MUST have: firstName, lastName, title, company, email (company domain), phone (+91 mobile or landline with STD).
- Do NOT include rows without both email and phone.
- Prefer export managers, founders, or sales heads.

Return ONLY a JSON array of objects with keys:
firstName, lastName, title, company, email, phone, city, state, industry, website.`

  try {
    const { text, model } = await chatCompletion(prompt)
    const leads = parseLeadsFromText(text, limit)
    if (leads.length) {
      return {
        leads,
        aiGenerated: true,
        provider: 'perplexity',
        method: `sonar:${model}`,
        notice:
          'AI discovery found contacts with email and phone. Verify before outreach — results are saved to your database.',
      }
    }
    return {
      leads: [],
      error: 'No contacts with both email and phone were returned. Try narrower keywords or a single state.',
      notice: 'Perplexity returned no usable contacts (email + phone required).',
    }
  } catch (error) {
    return {
      leads: [],
      error: error.message || 'Perplexity discovery failed',
      notice: 'Perplexity could not complete discovery.',
    }
  }
}
