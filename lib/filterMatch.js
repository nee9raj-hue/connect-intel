/** Shared lead filter matching — used by API search and client fallback */

const STOP_WORDS = new Set(['from', 'in', 'the', 'and', 'for', 'of', 'a', 'an', 'at', 'to'])

const STATE_ALIASES = {
  'Delhi NCR': ['delhi', 'new delhi', 'ncr', 'noida', 'gurugram', 'gurgaon', 'faridabad', 'ghaziabad'],
  Maharashtra: ['maharashtra', 'mumbai', 'pune', 'nagpur'],
  Karnataka: ['karnataka', 'bengaluru', 'bangalore', 'mysuru'],
  'Tamil Nadu': ['tamil nadu', 'chennai', 'coimbatore'],
  Gujarat: ['gujarat', 'ahmedabad', 'surat', 'vadodara'],
  Rajasthan: ['rajasthan', 'jaipur', 'jodhpur', 'udaipur'],
  'West Bengal': ['west bengal', 'kolkata', 'howrah'],
  Telangana: ['telangana', 'hyderabad'],
  'Uttar Pradesh': ['uttar pradesh', 'lucknow', 'kanpur', 'noida'],
  Kerala: ['kerala', 'kochi', 'thiruvananthapuram'],
  Punjab: ['punjab', 'ludhiana', 'amritsar', 'chandigarh'],
  Haryana: ['haryana', 'gurugram', 'faridabad'],
  'Madhya Pradesh': ['madhya pradesh', 'indore', 'bhopal'],
  Bihar: ['bihar', 'patna'],
  Odisha: ['odisha', 'bhubaneswar'],
  'Andhra Pradesh': ['andhra pradesh', 'visakhapatnam', 'vijayawada'],
  Assam: ['assam', 'guwahati'],
  Chhattisgarh: ['chhattisgarh', 'raipur'],
  Jharkhand: ['jharkhand', 'ranchi', 'jamshedpur'],
  Goa: ['goa', 'panaji'],
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function matchesKeywords(record, keywords) {
  const query = normalizeText(keywords)
  if (!query) return true

  const haystack = normalizeText(
    [
      record.firstName,
      record.lastName,
      record.title,
      record.company,
      record.industry,
      record.city,
      record.state,
      record.location,
    ].join(' ')
  )

  if (haystack.includes(query)) return true

  const tokens = query.split(' ').filter((token) => token.length >= 3 && !STOP_WORDS.has(token))
  if (!tokens.length) return true

  return tokens.every((token) => {
    const stem = token.replace(/ers$/, 'er').replace(/ies$/, 'y').replace(/s$/, '')
    return haystack.includes(token) || (stem.length >= 3 && haystack.includes(stem))
  })
}

export function matchesJobTitles(title, jobTitles) {
  if (!jobTitles?.length) return true
  const hay = normalizeText(title)
  if (!hay) return false

  return jobTitles.some((jobTitle) => {
    const parts = String(jobTitle)
      .split('/')
      .map((part) => normalizeText(part))
      .filter(Boolean)
    return parts.some((part) => hay.includes(part) || part.split(' ').some((word) => word.length >= 4 && hay.includes(word)))
  })
}

export function matchesStates(record, states) {
  if (!states?.length) return true
  const hay = normalizeText([record.state, record.city, record.location].join(' '))
  if (!hay) return false

  return states.some((state) => {
    const key = normalizeText(state)
    if (hay.includes(key)) return true
    const aliases = STATE_ALIASES[state] || []
    return aliases.some((alias) => hay.includes(alias))
  })
}

export function matchesCities(record, cities) {
  if (!cities?.length) return true
  const hay = normalizeText([record.city, record.location, record.state].join(' '))
  if (!hay) return false

  return cities.some((city) => {
    const key = normalizeText(city)
    return hay.includes(key) || hay.split(' ').includes(key)
  })
}

export function matchesIndustries(record, industries) {
  if (!industries?.length) return true
  return industries.includes(record.industry)
}

export function matchesCompanySizes(record, sizes) {
  if (!sizes?.length) return true
  return sizes.includes(record.employees)
}

export function recordMatches(record, filters) {
  if (
    !matchesKeywords(
      {
        firstName: record.firstName,
        lastName: record.lastName,
        title: record.title,
        company: record.company,
        industry: record.industry,
        city: record.city,
        state: record.state,
        location: record.location,
      },
      filters.keywords
    )
  ) {
    return false
  }

  if (!matchesJobTitles(record.title, filters.jobTitles)) return false
  if (!matchesStates(record, filters.states)) return false
  if (!matchesCities(record, filters.cities)) return false
  if (!matchesIndustries(record, filters.industries)) return false
  if (!matchesCompanySizes(record, filters.companySizes)) return false

  return true
}
