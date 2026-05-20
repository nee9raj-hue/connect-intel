import { shapeLeadForViewer } from './search.js'

const APOLLO_BASE = 'https://api.apollo.io/api/v1'

function getApolloApiKey() {
  return process.env.APOLLO_API_KEY || ''
}

export function isApolloConfigured() {
  return Boolean(getApolloApiKey())
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
    .replace(/\s+/g, ' ')
    .trim()
}

function buildApolloSearchParams(filters, perPage, page) {
  const params = new URLSearchParams()

  if (filters.keywords) {
    params.set('q_keywords', String(filters.keywords).trim())
  }

  filters.jobTitles?.forEach((title) => {
    const cleaned = String(title).split('/')[0].trim()
    if (cleaned) params.append('person_titles[]', cleaned)
  })

  const locations = new Set()
  filters.cities?.forEach((city) => locations.add(normalizeLocation(city)))
  filters.states?.forEach((state) => {
    const normalized = normalizeLocation(state)
    locations.add(normalized)
    if (normalized.includes('delhi')) locations.add('delhi')
  })
  locations.add('india')

  locations.forEach((location) => {
    if (location) params.append('organization_locations[]', location)
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

  params.set('per_page', String(Math.min(Math.max(perPage, 1), 100)))
  params.set('page', String(Math.max(page, 1)))
  params.set('include_similar_titles', 'true')

  return params
}

function scoreApolloPerson(person) {
  let score = 62
  if (person.has_email) score += 12
  if (person.has_direct_phone === 'Yes' || person.has_direct_phone === true) score += 10
  if (person.title) score += 6
  if (person.organization?.name) score += 4
  return Math.min(score, 96)
}

function mapApolloPersonToLead(person, index) {
  const org = person.organization || {}
  const city = person.city || org.city || ''
  const state = person.state || org.state || ''
  const country = person.country || org.country || 'India'
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

export async function searchApolloPeople(filters, count, store, viewer) {
  const apiKey = getApolloApiKey()
  if (!apiKey) return null

  const params = buildApolloSearchParams(filters, count, 1)
  const url = `${APOLLO_BASE}/mixed_people/api_search?${params.toString()}`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'Cache-Control': 'no-cache',
    },
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = data.error || data.message || `Apollo search failed (${response.status})`
    throw new Error(message)
  }

  const people = data.people || []
  if (!people.length) return null

  const leads = people
    .slice(0, count)
    .map((person, index) => mapApolloPersonToLead(person, index))
    .map((lead, index) => shapeLeadForViewer(lead, store, viewer, index))

  const total = data.total_entries ?? people.length

  return {
    leads,
    total,
    netNew: total,
    provider: 'apollo',
    notice: 'Results from Apollo.io. Unlock to reveal verified email and phone via Apollo enrichment.',
  }
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
      'x-api-key': apiKey,
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
