import { parseSearchQueryFallback, enrichSearchFiltersFromQuery } from '../lib/server/searchQueryParser.js'
import { recordMatches } from '../lib/filterMatch.js'
import { searchStoredLeads } from '../lib/server/search.js'
import { BUILT_IN_LEAD_ROWS } from '../lib/server/built-in-leads.js'

const query = 'textile exporters from ludhiana Punjab india'
const parsed = parseSearchQueryFallback(query, { jobTitles: [] })
const filters = enrichSearchFiltersFromQuery(
  { ...parsed.filters, jobTitles: [] },
  query
)

if (filters.keywords.includes('india')) {
  console.error('Keywords should not contain "india", got:', filters.keywords)
  process.exit(1)
}

const ludhianaRecord = {
  company: 'Ludhiana Wool & Textile Exports',
  city: 'Ludhiana',
  state: 'Punjab',
  industry: 'Textiles & Garments',
  title: 'Export Manager',
  firstName: 'Harpreet',
  lastName: 'Singh',
  location: 'Ludhiana, Punjab',
}

if (!recordMatches(ludhianaRecord, filters)) {
  console.error('Ludhiana textile record should match filters', filters)
  process.exit(1)
}

const store = {
  companies: [],
  contacts: BUILT_IN_LEAD_ROWS.filter((r) => r.city === 'Ludhiana').map((row, i) => ({
    id: `contact_ludhiana_${i}`,
    companyId: `company_ludhiana_${i}`,
    firstName: row.first_name,
    lastName: row.last_name,
    title: row.title,
    email: row.email,
    phone: row.phone,
    city: row.city,
    state: row.state,
  })),
  leadUnlocks: [],
}

store.companies = BUILT_IN_LEAD_ROWS.filter((r) => r.city === 'Ludhiana').map((row, i) => ({
  id: `company_ludhiana_${i}`,
  name: row.company,
  industry: row.industry,
  city: row.city,
  state: row.state,
  domain: row.website,
  employeeRange: row.employees,
  exporterFlag: true,
}))

const result = searchStoredLeads(store, filters, 10, null, new Set(), { fullContactPreview: true })
if (!result?.leads?.length) {
  console.error('Expected Ludhiana textile hits in store search')
  process.exit(1)
}

console.log('✓ Ludhiana textile search regression passed')
