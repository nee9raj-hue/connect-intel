import {
  FREE_FULL_LEAD_PREVIEW_COUNT,
  LEAD_FIELD_UNLOCK_PRICE_PAISE,
} from './config.js'
import { MOCK_LEADS } from '../../frontend/src/lib/mockLeads.js'
import { recordMatches } from '../filterMatch.js'
import { isDisplayableLead } from './leadQuality.js'

function scoreRecord(record) {
  let score = 58
  if (record.email) score += 14
  if (record.phone) score += 10
  if (record.title) score += 8
  if (record.linkedin) score += 4
  if (record.source === 'database') score += 6
  if (record.source === 'perplexity') score += 8
  return Math.min(score, 96)
}

function maskEmail(email) {
  const value = String(email || '').trim()
  if (!value || value.includes('•')) return value
  const [local, domain] = value.split('@')
  if (!domain) return 'Locked'
  const localPreview = local.slice(0, 2) || local.slice(0, 1) || ''
  return `${localPreview}•••@${domain}`
}

function maskPhone(phone) {
  const value = String(phone || '').trim()
  if (!value || value.includes('•')) return value
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

function getLeadUnlockRecord(store, userId, leadId) {
  if (!userId) return null
  return store.leadUnlocks.find((entry) => entry.userId === userId && entry.leadId === leadId) || null
}

export function getUnlockedFields(store, userId, leadId) {
  const record = getLeadUnlockRecord(store, userId, leadId)
  if (!record) return []
  if (Array.isArray(record.fields) && record.fields.length) return record.fields
  if (record.leadSnapshot) return ['email', 'phone', 'linkedin']
  return []
}

function fieldHasValue(lead, field) {
  const raw = field === 'email' ? lead.email : field === 'phone' ? lead.phone : lead.linkedin
  return Boolean(String(raw || '').trim() && !String(raw).includes('•'))
}

function applyLeadAccess(lead, store, viewer, rank, options = {}) {
  const { fullContactPreview = false } = options
  const unlockedFields = getUnlockedFields(store, viewer?.id, lead.id)
  const previewRow = fullContactPreview && rank < FREE_FULL_LEAD_PREVIEW_COUNT

  const emailRaw = String(lead.email || '').trim()
  const phoneRaw = String(lead.phone || '').trim()
  const hasEmail = fieldHasValue(lead, 'email')
  const hasPhone = fieldHasValue(lead, 'phone')

  const emailUnlocked =
    previewRow || unlockedFields.includes('email') || (!hasEmail && !lead.apolloHasEmail)
  const phoneUnlocked =
    previewRow || unlockedFields.includes('phone') || (!hasPhone && !lead.apolloHasPhone)
  const linkedinUnlocked = previewRow || unlockedFields.includes('linkedin')

  const emailDisplay = !hasEmail ? '' : emailUnlocked ? emailRaw : maskEmail(emailRaw)
  const phoneDisplay = !hasPhone ? '' : phoneUnlocked ? phoneRaw : maskPhone(phoneRaw)

  return {
    ...lead,
    email: emailDisplay,
    phone: phoneDisplay,
    linkedin: linkedinUnlocked ? lead.linkedin : maskLinkedin(lead.linkedin),
    access: {
      emailUnlocked,
      phoneUnlocked,
      emailLocked: hasEmail && !emailUnlocked,
      phoneLocked: hasPhone && !phoneUnlocked,
      emailUnlockPricePaise: hasEmail && !emailUnlocked ? LEAD_FIELD_UNLOCK_PRICE_PAISE : 0,
      phoneUnlockPricePaise: hasPhone && !phoneUnlocked ? LEAD_FIELD_UNLOCK_PRICE_PAISE : 0,
      previewUnlocked: previewRow,
      previouslyUnlocked: unlockedFields.length > 0,
      isUnlocked: (!hasEmail || emailUnlocked) && (!hasPhone || phoneUnlocked),
      unlockable: (hasEmail && !emailUnlocked) || (hasPhone && !phoneUnlocked),
      unlockPricePaise: LEAD_FIELD_UNLOCK_PRICE_PAISE,
      unlockableFields: getUnlockableFields(lead),
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

export function shapeLeadForViewer(lead, store, viewer, rank = 0, options = {}) {
  return applyLeadAccess(lead, store, viewer, rank, options)
}

function excludePipelineIds(records, excludeIds) {
  if (!excludeIds?.size) return records
  return records.filter((record) => !excludeIds.has(record.id))
}

export function searchStoredLeads(store, filters, count, viewer = null, excludeIds = null, shapeOptions = {}) {
  const companyById = new Map(store.companies.map((company) => [company.id, company]))
  const contactLeads = excludePipelineIds(
    store.contacts
      .map((contact) => mapContactLead(contact, companyById.get(contact.companyId)))
      .filter((record) => isDisplayableLead(record) && recordMatches(record, filters)),
    excludeIds
  )

  const companyOnlyLeads = excludePipelineIds(
    store.companies
      .filter((company) => !store.contacts.some((contact) => contact.companyId === company.id))
      .map(mapCompanyLead)
      .filter((record) => isDisplayableLead(record) && recordMatches(record, filters)),
    excludeIds
  )

  const leads = [...contactLeads, ...companyOnlyLeads]
    .sort((left, right) => right.score - left.score)
    .slice(0, count)
    .map((lead, index) => applyLeadAccess(lead, store, viewer, index, shapeOptions))

  if (!leads.length) return null

  return {
    leads,
    total: contactLeads.length + companyOnlyLeads.length,
    netNew: Math.max(
      leads.length,
      Math.floor((contactLeads.length + companyOnlyLeads.length) * 0.82)
    ),
    provider: 'database',
  }
}

export function getMockLeadsForViewer(store, viewer, filters, count, excludeIds = null, shapeOptions = {}) {
  const filtered = excludePipelineIds(
    MOCK_LEADS.filter((lead) => isDisplayableLead(lead) && recordMatches(lead, filters)),
    excludeIds
  )
  return filtered.slice(0, count).map((lead, index) => applyLeadAccess(lead, store, viewer, index, shapeOptions))
}
