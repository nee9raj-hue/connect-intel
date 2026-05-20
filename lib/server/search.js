import {
  FREE_FULL_LEAD_PREVIEW_COUNT,
  LEAD_UNLOCK_PRICE_PAISE,
} from './config.js'
import { MOCK_LEADS } from '../../frontend/src/lib/mockLeads.js'

function includesAny(value, options) {
  return options.some((option) => String(value || '').toLowerCase().includes(String(option).toLowerCase()))
}

function matchesKeywords(texts, keywords) {
  const query = String(keywords || '').trim().toLowerCase()
  if (!query) return true
  return texts.some((value) => String(value || '').toLowerCase().includes(query))
}

function scoreRecord(record) {
  let score = 58
  if (record.email) score += 14
  if (record.phone) score += 10
  if (record.title) score += 8
  if (record.linkedin) score += 4
  if (record.source === 'database') score += 6
  return Math.min(score, 96)
}

function maskEmail(email) {
  const value = String(email || '').trim()
  if (!value) return ''
  const [local, domain] = value.split('@')
  if (!domain) return 'Locked'
  const localPreview = local.slice(0, 2) || local.slice(0, 1) || ''
  return `${localPreview}•••@${domain}`
}

function maskPhone(phone) {
  const value = String(phone || '').trim()
  if (!value) return ''
  const visible = value.replace(/\s+/g, '')
  if (visible.length <= 4) return '••••'
  return `${visible.slice(0, 3)}••••${visible.slice(-2)}`
}

function maskLinkedin(linkedin) {
  const value = String(linkedin || '').trim()
  if (!value) return ''
  return 'linkedin.com/in/••••'
}

export function getUnlockableFields(lead) {
  const fields = []
  if (lead.email || lead.apolloHasEmail) fields.push('email')
  if (lead.phone || lead.apolloHasPhone) fields.push('phone')
  if (lead.linkedin) fields.push('linkedin')
  return fields
}

function hasUnlockedLead(store, userId, leadId) {
  if (!userId) return false
  return store.leadUnlocks.some((entry) => entry.userId === userId && entry.leadId === leadId)
}

function applyLeadAccess(lead, store, viewer, rank) {
  const unlockableFields = getUnlockableFields(lead)
  const unlockable = unlockableFields.length > 0
  const previouslyUnlocked = hasUnlockedLead(store, viewer?.id, lead.id)
  const previewUnlocked = rank < FREE_FULL_LEAD_PREVIEW_COUNT
  const isUnlocked = unlockable ? previouslyUnlocked || previewUnlocked : true

  return {
    ...lead,
    email: isUnlocked ? lead.email : maskEmail(lead.email),
    phone: isUnlocked ? lead.phone : maskPhone(lead.phone),
    linkedin: isUnlocked ? lead.linkedin : maskLinkedin(lead.linkedin),
    access: {
      isUnlocked,
      previewUnlocked,
      previouslyUnlocked,
      unlockable,
      unlockPricePaise: unlockable && !isUnlocked ? LEAD_UNLOCK_PRICE_PAISE : 0,
      unlockableFields,
    },
  }
}

function mapCompanyLead(company) {
  return {
    id: `company-lead-${company.id}`,
    firstName: '',
    lastName: '',
    title: company.exporterFlag ? 'Export Team' : company.shippingFlag ? 'Logistics Team' : 'Business Team',
    company: company.name,
    companyDomain: company.domain || '',
    email: '',
    phone: '',
    location: [company.city, company.state].filter(Boolean).join(', '),
    state: company.state || '',
    city: company.city || '',
    industry: company.industry || '',
    employees: company.employeeRange || '',
    emailStatus: 'unverified',
    score: scoreRecord({ source: 'database' }),
    linkedin: '',
    source: 'database',
  }
}

function mapContactLead(contact, company) {
  return {
    id: contact.id,
    firstName: contact.firstName || '',
    lastName: contact.lastName || '',
    title: contact.title || 'Business Contact',
    company: company?.name || '',
    companyDomain: company?.domain || '',
    email: contact.email || '',
    phone: contact.phone || '',
    location: [contact.city || company?.city, contact.state || company?.state].filter(Boolean).join(', '),
    state: contact.state || company?.state || '',
    city: contact.city || company?.city || '',
    industry: company?.industry || '',
    employees: company?.employeeRange || '',
    emailStatus: contact.email ? 'likely' : 'unverified',
    score: scoreRecord({
      email: contact.email,
      phone: contact.phone,
      title: contact.title,
      linkedin: contact.linkedinUrl,
      source: 'database',
    }),
    linkedin: contact.linkedinUrl || '',
    source: 'database',
  }
}

function recordMatches(record, filters) {
  if (
    !matchesKeywords(
      [
        record.firstName,
        record.lastName,
        record.title,
        record.company,
        record.industry,
        record.city,
        record.state,
        record.location,
      ],
      filters.keywords
    )
  ) {
    return false
  }

  if (filters.jobTitles?.length && !includesAny(record.title, filters.jobTitles)) return false
  if (filters.states?.length && !includesAny(record.state || record.location, filters.states)) return false
  if (filters.cities?.length && !includesAny(record.city || record.location, filters.cities)) return false
  if (filters.industries?.length && !filters.industries.includes(record.industry)) return false
  if (filters.companySizes?.length && !filters.companySizes.includes(record.employees)) return false

  return true
}

export function shapeLeadForViewer(lead, store, viewer, rank = 0) {
  return applyLeadAccess(lead, store, viewer, rank)
}

export function searchStoredLeads(store, filters, count, viewer = null) {
  const companyById = new Map(store.companies.map((company) => [company.id, company]))
  const contactLeads = store.contacts
    .map((contact) => mapContactLead(contact, companyById.get(contact.companyId)))
    .filter((record) => recordMatches(record, filters))

  const companyOnlyLeads = store.companies
    .filter((company) => !store.contacts.some((contact) => contact.companyId === company.id))
    .map(mapCompanyLead)
    .filter((record) => recordMatches(record, filters))

  const leads = [...contactLeads, ...companyOnlyLeads]
    .sort((left, right) => right.score - left.score)
    .slice(0, count)
    .map((lead, index) => applyLeadAccess(lead, store, viewer, index))

  if (!leads.length) return null

  return {
    leads,
    total: contactLeads.length + companyOnlyLeads.length,
    netNew: Math.max(leads.length, Math.floor((contactLeads.length + companyOnlyLeads.length) * 0.82)),
    provider: 'database',
  }
}

export function getMockLeadsForViewer(store, viewer, filters, count) {
  const query = String(filters.keywords || '').trim().toLowerCase()
  const filtered = MOCK_LEADS.filter((lead) =>
    recordMatches(
      {
        ...lead,
        company: lead.company,
        title: lead.title,
        industry: lead.industry,
        city: lead.city,
        state: lead.state,
        location: lead.location,
        firstName: lead.firstName,
        lastName: lead.lastName,
      },
      { ...filters, keywords: query }
    )
  )

  return filtered.slice(0, count).map((lead, index) => applyLeadAccess(lead, store, viewer, index))
}

