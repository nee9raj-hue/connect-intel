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
  const hasEmail = lead.access?.hasEmail || lead.apolloHasEmail || fieldHasValue(lead, 'email')
  const hasPhone = lead.access?.hasPhone || lead.apolloHasPhone || fieldHasValue(lead, 'phone')
  if (hasEmail) fields.push('email')
  if (hasPhone) fields.push('phone')
  if (lead.linkedin && !String(lead.linkedin).includes('•')) fields.push('linkedin')
  return fields
}

function normalizeCompanyName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Full contact record from database (unmasked) for credit unlock. */
export function findLeadRecordById(store, leadId, hint = {}) {
  if (!leadId && !hint.company) return null
  const companyById = new Map(store.companies.map((company) => [company.id, company]))
  let contact = leadId ? store.contacts.find((entry) => entry.id === leadId) : null

  if (!contact && hint.company) {
    const target = normalizeCompanyName(hint.company)
    const company = store.companies.find((entry) => normalizeCompanyName(entry.name) === target)
    if (company) {
      contact =
        store.contacts.find((entry) => entry.companyId === company.id && entry.email) ||
        store.contacts.find((entry) => entry.companyId === company.id)
    }
  }

  if (contact) {
    return mapContactLead(contact, companyById.get(contact.companyId))
  }

  if (String(leadId).startsWith('company-lead-')) {
    const companyId = String(leadId).replace('company-lead-', '')
    const company = store.companies.find((entry) => entry.id === companyId)
    if (company) return mapCompanyLead(company)
  }

  const unlock = store.leadUnlocks.find((entry) => entry.leadId === leadId)
  if (unlock?.leadSnapshot?.id) return unlock.leadSnapshot
  return null
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
  const unlockedFields = getUnlockedFields(store, viewer?.id, lead.id)
  const stored = findLeadRecordById(store, lead.id)
  const previewFree =
    Boolean(options.fullContactPreview) && Number(rank) < FREE_FULL_LEAD_PREVIEW_COUNT

  const emailRaw = String(stored?.email || lead.email || '').trim()
  const phoneRaw = String(stored?.phone || lead.phone || '').trim()
  const hasEmail = fieldHasValue({ email: emailRaw }, 'email') || Boolean(lead.apolloHasEmail)
  const hasPhone = fieldHasValue({ phone: phoneRaw }, 'phone') || Boolean(lead.apolloHasPhone)

  const emailUnlocked = previewFree || unlockedFields.includes('email')
  const phoneUnlocked = previewFree || unlockedFields.includes('phone')
  const linkedinUnlocked = previewFree || unlockedFields.includes('linkedin')

  const emailDisplay = !hasEmail ? '' : emailUnlocked ? emailRaw : maskEmail(emailRaw)
  const phoneDisplay = !hasPhone ? '' : phoneUnlocked ? phoneRaw : maskPhone(phoneRaw)

  return {
    ...lead,
    email: emailDisplay,
    phone: phoneDisplay,
    linkedin: linkedinUnlocked ? lead.linkedin : maskLinkedin(lead.linkedin),
    access: {
      hasEmail,
      hasPhone,
      previewUnlocked: previewFree,
      emailUnlocked,
      phoneUnlocked,
      emailLocked: hasEmail && !emailUnlocked,
      phoneLocked: hasPhone && !phoneUnlocked,
      emailUnlockPricePaise: hasEmail && !emailUnlocked ? LEAD_FIELD_UNLOCK_PRICE_PAISE : 0,
      phoneUnlockPricePaise: hasPhone && !phoneUnlocked ? LEAD_FIELD_UNLOCK_PRICE_PAISE : 0,
      creditCost: 1,
      previouslyUnlocked: unlockedFields.length > 0,
      isUnlocked: (!hasEmail || emailUnlocked) && (!hasPhone || phoneUnlocked),
      unlockable: (hasEmail && !emailUnlocked) || (hasPhone && !phoneUnlocked),
      unlockPricePaise: LEAD_FIELD_UNLOCK_PRICE_PAISE,
      unlockableFields: getUnlockableFields({
        ...lead,
        email: emailRaw,
        phone: phoneRaw,
        access: { hasEmail, hasPhone },
      }),
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

/** One row per person/company in search results — drops import duplicates. */
export function dedupeSearchLeads(leads) {
  const seen = new Set()
  const out = []
  for (const lead of leads || []) {
    const email = String(lead.email || '')
      .trim()
      .toLowerCase()
    const emailKey = email && !email.includes('•') ? email : ''
    const company = normalizeCompanyName(lead.company)
    const phone = String(lead.phone || '').replace(/\D/g, '').slice(-10)
    const name = `${String(lead.firstName || '').trim()}|${String(lead.lastName || '').trim()}`.toLowerCase()
    const key = emailKey
      ? `email:${emailKey}`
      : phone.length >= 7
        ? `phone:${phone}|${company}`
        : `person:${name}|${company}|${normalizeText(lead.city)}|${normalizeText(lead.state)}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(lead)
  }
  return out
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function searchStoredLeads(store, filters, count, viewer = null, excludeIds = null, shapeOptions = {}) {
  const companyById = new Map((store.companies || []).map((company) => [company.id, company]))
  const companiesWithContacts = new Set((store.contacts || []).map((c) => c.companyId))

  const contactLeads = []
  for (const contact of store.contacts || []) {
    if (excludeIds?.size && excludeIds.has(contact.id)) continue
    const company = companyById.get(contact.companyId)
    const record = mapContactLead(contact, company)
    if (!isDisplayableLead(record) || !recordMatches(record, filters)) continue
    contactLeads.push(record)
  }

  const companyOnlyLeads = []
  for (const company of store.companies || []) {
    if (companiesWithContacts.has(company.id)) continue
    const record = mapCompanyLead(company)
    if (excludeIds?.size && excludeIds.has(record.id)) continue
    if (!isDisplayableLead(record) || !recordMatches(record, filters)) continue
    companyOnlyLeads.push(record)
  }

  const merged = dedupeSearchLeads([...dedupeSearchLeads(contactLeads), ...dedupeSearchLeads(companyOnlyLeads)])

  const leads = merged
    .sort((left, right) => right.score - left.score)
    .slice(0, count)
    .map((lead, index) => applyLeadAccess(lead, store, viewer, index, shapeOptions))

  if (!leads.length) return null

  const matchTotal = merged.length

  return {
    leads,
    total: matchTotal,
    netNew: Math.max(leads.length, Math.floor(matchTotal * 0.82)),
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
