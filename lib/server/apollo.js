import { shapeLeadForViewer } from './search.js'

const APOLLO_BASE = 'https://api.apollo.io/api/v1'

function getApolloApiKey() {
  return String(process.env.APOLLO_API_KEY || '').trim()
}

export function isApolloConfigured() {
  return Boolean(getApolloApiKey())
}

function formatApolloError(status, data) {
  const raw = data?.error || data?.message || (typeof data === 'string' ? data : '')
  if (status === 401) {
    return (
      'Apollo rejected your API key (401). In Apollo → Developer → API Keys: create a new key, turn on ' +
      '"Set as master key", enable People API Search, copy the full key into Vercel as APOLLO_API_KEY, then redeploy.'
    )
  }
  if (status === 403) {
    return (
      raw ||
      'Apollo denied access (403). Your plan may not include API access, or this key is not a master key.'
    )
  }
  return raw || `Apollo search failed (${status})`
}

/** Quick health check — used by integrations status. */
export async function verifyApolloApiKey() {
  const apiKey = getApolloApiKey()
  if (!apiKey) {
    return { ok: false, error: 'APOLLO_API_KEY is not set on the server' }
  }

  const healthUrls = [
    'https://api.apollo.io/v1/auth/health',
    'https://api.apollo.io/api/v1/auth/health',
  ]

  for (const url of healthUrls) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'X-Api-Key': apiKey,
        },
      })
      const data = await response.json().catch(() => ({}))
      if (response.ok) {
        return { ok: true, health: data, endpoint: url }
      }
      if (response.status === 401 || response.status === 403) {
        return { ok: false, error: formatApolloError(response.status, data), status: response.status }
      }
    } catch (error) {
      return { ok: false, error: error.message || 'Could not reach Apollo' }
    }
  }

  return { ok: false, error: 'Apollo health check failed' }
}

export function toApolloEmployeeRange(size) {
  const map = {
    '1-10': '1,10',
    '11-50': '11,50',
    '51-200': '51,200',
    '201-500': '201,500',
    '501-1000': '501,1000',
    '1000+': '1001,10000',
  }
  return map[size] || String(size || '').replace('-', ',')
}

function normalizeLocation(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/ncr/g, 'delhi')
    .replace(/\s+/g, ' ')
    .trim()
}

function buildApolloSearchParams(filters, perPage, page, mode = 'full') {
  const params = new URLSearchParams()
  const keywords = String(filters.keywords || '').trim()

  if (mode === 'keywords') {
    if (keywords) params.set('q_keywords', keywords)
    params.set('per_page', String(Math.min(Math.max(perPage, 1), 100)))
    params.set('page', String(Math.max(page, 1)))
    return params
  }

  if (keywords) {
    params.set('q_keywords', keywords)
  }

  if (mode !== 'relaxed') {
    filters.jobTitles?.forEach((title) => {
      const cleaned = String(title).split('/')[0].trim()
      if (cleaned) params.append('person_titles[]', cleaned)
    })

    filters.companySizes?.forEach((size) => {
      const range = toApolloEmployeeRange(size)
      if (range) params.append('organization_num_employees_ranges[]', range)
    })

    if (filters.industries?.length) {
      const industryKeywords = filters.industries.join(' ')
      const existing = params.get('q_keywords') || ''
      params.set('q_keywords', [existing, industryKeywords].filter(Boolean).join(' ').trim())
    }
  }

  filters.cities?.forEach((city) => {
    const location = normalizeLocation(city)
    if (location) {
      params.append('person_locations[]', location)
      params.append('organization_locations[]', location)
    }
  })

  filters.states?.forEach((state) => {
    const location = normalizeLocation(state)
    if (location) {
      params.append('organization_locations[]', location)
    }
  })

  if (!filters.cities?.length && !filters.states?.length && mode === 'full') {
    params.append('organization_locations[]', 'india')
  }

  params.set('per_page', String(Math.min(Math.max(perPage, 1), 100)))
  params.set('page', String(Math.max(page, 1)))
  params.set('include_similar_titles', 'true')

  return params
}

async function callApolloSearch(params) {
  const apiKey = getApolloApiKey()
  const url = `${APOLLO_BASE}/mixed_people/api_search?${params.toString()}`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey,
      'Cache-Control': 'no-cache',
    },
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(formatApolloError(response.status, data))
  }

  return data
}

function scoreApolloPerson(person) {
  let score = 62
  if (person.has_email) score += 12
  if (person.has_direct_phone === 'Yes' || person.has_direct_phone === true) score += 10
  if (person.title) score += 6
  if (person.organization?.name) score += 4
  return Math.min(score, 96)
}

function mapApolloPersonToLead(person) {
  const org = person.organization || {}
  const city = person.city || org.city || ''
  const state = person.state || org.state || ''
  const country = person.country || org.country || ''
  const location = [city, state, country].filter(Boolean).join(', ')
  const domain = org.primary_domain || org.website_url || ''

  return {
    id: `apollo-${person.id}`,
    apolloId: person.id,
    firstName: person.first_name || '',
    lastName: person.last_name || person.last_name_obfuscated || '',
    title: person.title || '',
    company: org.name || '',
    companyDomain: domain ? String(domain).replace(/^https?:\/\//, '').replace(/^www\./, '') : '',
    email: person.has_email ? 'available@apollo.locked' : '',
    phone: person.has_direct_phone === 'Yes' || person.has_direct_phone === true ? '+00-locked' : '',
    location,
    state,
    city,
    industry: org.industry || '',
    employees: org.estimated_num_employees ? String(org.estimated_num_employees) : '',
    emailStatus: person.has_email ? 'likely' : 'unverified',
    score: scoreApolloPerson(person),
    linkedin: person.linkedin_url || '',
    source: 'apollo',
    apolloHasEmail: Boolean(person.has_email),
    apolloHasPhone: person.has_direct_phone === 'Yes' || person.has_direct_phone === true,
  }
}

function mapApolloResponse(data, count, store, viewer) {
  const people = data.people || data.contacts || []
  if (!people.length) return null

  const leads = people
    .slice(0, count)
    .map((person) => mapApolloPersonToLead(person))
    .map((lead, index) => shapeLeadForViewer(lead, store, viewer, index))

  const total = data.total_entries ?? data.pagination?.total_entries ?? people.length

  return {
    leads,
    total,
    netNew: total,
    provider: 'apollo',
    notice: 'Partner data — unlock to reveal email and phone.',
  }
}

export async function searchApolloPeople(filters, count, store, viewer) {
  if (!isApolloConfigured()) return null

  const attempts = ['full', 'relaxed', 'keywords']
  let lastError = null

  for (const mode of attempts) {
    try {
      const params = buildApolloSearchParams(filters, count, 1, mode)
      const data = await callApolloSearch(params)
      const mapped = mapApolloResponse(data, count, store, viewer)
      if (mapped?.leads?.length) return mapped
    } catch (error) {
      lastError = error
      if (/master api key|invalid api key|unauthorized|401|403/i.test(error.message)) {
        throw error
      }
    }
  }

  if (lastError) {
    throw lastError
  }

  return null
}

export async function enrichApolloPerson(lead) {
  const apiKey = getApolloApiKey()
  if (!apiKey) {
    throw new Error('Apollo API key is not configured')
  }

  if (!lead.apolloId) {
    throw new Error('Missing Apollo person id')
  }

  const params = new URLSearchParams()
  params.set('id', lead.apolloId)
  if (lead.firstName) params.set('first_name', lead.firstName)
  if (lead.lastName && !String(lead.lastName).includes('*')) {
    params.set('last_name', lead.lastName)
  }
  if (lead.company) params.set('organization_name', lead.company)
  if (lead.companyDomain) {
    params.set(
      'domain',
      String(lead.companyDomain).replace(/^https?:\/\//, '').replace(/^www\./, '')
    )
  }
  params.set('reveal_personal_emails', 'true')

  const response = await fetch(`${APOLLO_BASE}/people/match?${params.toString()}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey,
    },
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.error || data.message || `Apollo enrichment failed (${response.status})`)
  }

  const person = data.person
  if (!person) {
    throw new Error('Apollo did not return contact details for this person')
  }

  const phone =
    person.phone_numbers?.find((entry) => entry.sanitized_number)?.sanitized_number ||
    person.mobile_phone ||
    person.corporate_phone ||
    ''

  return {
    ...lead,
    firstName: person.first_name || lead.firstName,
    lastName: person.last_name || lead.lastName,
    title: person.title || lead.title,
    company: person.organization?.name || lead.company,
    companyDomain: person.organization?.primary_domain || lead.companyDomain,
    email: person.email || person.corporate_email || person.work_email || '',
    phone,
    linkedin: person.linkedin_url || lead.linkedin,
    location: [person.city, person.state, person.country].filter(Boolean).join(', ') || lead.location,
    city: person.city || lead.city,
    state: person.state || lead.state,
    emailStatus: person.email ? 'verified' : lead.emailStatus,
    apolloEnriched: true,
    apolloHasEmail: Boolean(person.email || person.corporate_email),
    apolloHasPhone: Boolean(phone),
  }
}
