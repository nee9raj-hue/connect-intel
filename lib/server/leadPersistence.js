import { importRowsIntoStore } from './imports.js'
import { filterUsableLeads } from './leadQuality.js'

function leadToImportRow(lead, filters, source) {
  const city = lead.city || filters.cities?.[0] || ''
  const state = lead.state || filters.states?.[0] || ''
  const domain = String(lead.companyDomain || '')
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]

  return {
    company: lead.company || lead.company_name || 'Unknown Company',
    first_name: lead.firstName || lead.first_name || '',
    last_name: lead.lastName || lead.last_name || '',
    title: lead.title || 'Business Contact',
    email: lead.email || '',
    phone: lead.phone || '',
    city,
    state,
    industry: lead.industry || filters.industries?.[0] || 'B2B',
    website: domain,
    linkedin: lead.linkedin || lead.linkedinUrl || '',
    exporter: /export/i.test(`${lead.title || ''} ${lead.company || ''} ${filters.keywords || ''}`),
    source_confidence: source,
  }
}

function datasetTypeForSource(source) {
  if (source === 'perplexity' || source === 'ai-discovery') return 'ai-perplexity'
  if (source === 'claude') return 'ai-claude'
  if (source === 'apollo') return 'ai-apollo'
  if (source === 'gemini') return 'ai-gemini'
  return 'ai-discovery'
}

/**
 * Save paid AI results into companies/contacts so future searches hit the database first.
 */
export function persistDiscoveredLeads(store, leads, { source = 'ai-discovery', actor = null, filters = {} } = {}) {
  if (!leads?.length) {
    return { store, contactsCreated: 0, companiesCreated: 0 }
  }

  const rows = filterUsableLeads(leads)
    .filter((lead) => lead.company || lead.firstName || lead.lastName)
    .map((lead) => leadToImportRow(lead, filters, source))

  if (!rows.length) {
    return { store, contactsCreated: 0, companiesCreated: 0 }
  }

  const { store: next, importJob } = importRowsIntoStore(store, datasetTypeForSource(source), rows, {
    email: actor?.email || 'system@connectintel.app',
  })

  return {
    store: next,
    contactsCreated: importJob.contactsCreated,
    companiesCreated: importJob.companiesCreated,
    importJob,
  }
}
