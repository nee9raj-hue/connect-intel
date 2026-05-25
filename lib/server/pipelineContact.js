import { importRowsIntoStore } from './imports.js'
import { normalizeLeadContact } from './leadQuality.js'
import { listPipelineSavedEntries } from './organizations.js'

function companyKeyFromParts(name, city, state, domain) {
  const d = String(domain || '')
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
    .trim()
    .toLowerCase()
  if (d) return `domain:${d}`
  return `name:${String(name || '').toLowerCase()}|${String(city || '').toLowerCase()}|${String(state || '').toLowerCase()}`
}

function companyKey(company) {
  return companyKeyFromParts(company.name, company.city, company.state, company.domain)
}

function fieldsToImportRow(fields) {
  const normalized = normalizeLeadContact({
    firstName: fields.firstName || '',
    lastName: fields.lastName || '',
    title: fields.title || 'Business Contact',
    company: fields.company || 'Unknown Company',
    companyDomain: fields.website || fields.companyDomain || '',
    email: fields.email || '',
    phone: fields.phone || '',
    city: fields.city || '',
    state: fields.state || '',
    industry: fields.industry || 'B2B',
    linkedin: fields.linkedin || '',
  })

  const domain = String(normalized.companyDomain || '')
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]

  return {
    company: normalized.company,
    first_name: normalized.firstName,
    last_name: normalized.lastName,
    title: normalized.title,
    email: normalized.email,
    phone: normalized.phone,
    city: normalized.city,
    state: normalized.state,
    industry: normalized.industry,
    website: domain,
    linkedin: normalized.linkedin,
    source_confidence: fields.source || 'pipeline',
  }
}

export function contactAndCompanyToLeadSnapshot(contact, company, extras = {}) {
  return normalizeLeadContact({
    id: contact.id,
    firstName: contact.firstName || '',
    lastName: contact.lastName || '',
    title: contact.title || 'Business Contact',
    company: company?.name || '',
    companyDomain: company?.domain || '',
    email: contact.email || '',
    phone: contact.phone || '',
    city: contact.city || company?.city || '',
    state: contact.state || company?.state || '',
    location: [contact.city || company?.city, contact.state || company?.state].filter(Boolean).join(', '),
    industry: company?.industry || 'B2B',
    linkedin: contact.linkedinUrl || '',
    emailStatus: contact.email ? 'likely' : 'unverified',
    score: extras.score ?? 75,
    source: extras.source || 'database',
    contactId: contact.id,
    companyId: company?.id || contact.companyId,
  })
}

function findCompany(store, row) {
  const key = companyKeyFromParts(row.company, row.city, row.state, row.website)
  const companyId = store.companies.find((entry) => companyKey(entry) === key)?.id
  if (companyId) return store.companies.find((entry) => entry.id === companyId) || null

  const target = String(row.company || '').trim().toLowerCase()
  if (!target) return null
  return (
    store.companies.find((entry) => String(entry.name || '').trim().toLowerCase() === target) || null
  )
}

function findContact(store, companyId, row) {
  const email = String(row.email || '').trim().toLowerCase()
  if (email && companyId) {
    const byEmail = store.contacts.find(
      (entry) => entry.companyId === companyId && entry.email?.toLowerCase() === email
    )
    if (byEmail) return byEmail
  }

  const firstName = String(row.first_name || '').trim().toLowerCase()
  const lastName = String(row.last_name || '').trim().toLowerCase()
  if (companyId && (firstName || lastName)) {
    return (
      store.contacts.find((entry) => {
        if (entry.companyId !== companyId) return false
        return (
          String(entry.firstName || '').trim().toLowerCase() === firstName &&
          String(entry.lastName || '').trim().toLowerCase() === lastName
        )
      }) || null
    )
  }

  return null
}

function mergeNonEmpty(target, patch, keys) {
  for (const key of keys) {
    const value = patch[key]
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      target[key] = typeof value === 'string' ? value.trim() : value
    }
  }
}

function applyContactPatch(contact, patch) {
  mergeNonEmpty(contact, patch, [
    'firstName',
    'lastName',
    'title',
    'email',
    'phone',
    'city',
    'state',
    'linkedinUrl',
  ])
  if (patch.linkedin !== undefined && String(patch.linkedin).trim()) {
    contact.linkedinUrl = String(patch.linkedin).trim()
  }
  contact.fullName = [contact.firstName, contact.lastName].filter(Boolean).join(' ')
  contact.lastVerifiedAt = new Date().toISOString()
}

function applyCompanyPatch(company, patch) {
  mergeNonEmpty(company, patch, ['name', 'city', 'state', 'industry'])
  if (patch.company !== undefined && String(patch.company).trim()) {
    company.name = String(patch.company).trim()
  }
  const website = patch.website || patch.companyDomain
  if (website !== undefined && String(website).trim()) {
    const domain = String(website)
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0]
    company.domain = domain
    company.website = domain.includes('://') ? domain : `https://${domain}`
  }
  company.lastVerifiedAt = new Date().toISOString()
}

/**
 * Create or link company + contact records for a pipeline lead (HubSpot-style).
 */
export function upsertMasterRecordFromLeadFields(store, fields, actor = null) {
  const row = fieldsToImportRow(fields)
  if (!row.company && !row.first_name && !row.last_name) {
    throw new Error('Company or contact name is required')
  }

  let company = findCompany(store, row)
  let contact = company ? findContact(store, company.id, row) : null

  if (!contact) {
    const before = store.contacts.length
    const { store: next } = importRowsIntoStore(store, 'pipeline-manual', [row], actor)
    Object.assign(store, {
      companies: next.companies,
      contacts: next.contacts,
      importJobs: next.importJobs,
    })
    company = findCompany(store, row)
    contact =
      (company && findContact(store, company.id, row)) ||
      store.contacts.slice(before).find((entry) => entry.companyId === company?.id) ||
      store.contacts[store.contacts.length - 1] ||
      null
  } else if (company) {
    applyCompanyPatch(company, {
      company: row.company,
      city: row.city,
      state: row.state,
      industry: row.industry,
      website: row.website,
    })
    applyContactPatch(contact, {
      firstName: row.first_name,
      lastName: row.last_name,
      title: row.title,
      email: row.email,
      phone: row.phone,
      city: row.city,
      state: row.state,
      linkedin: row.linkedin,
    })
  }

  if (!contact) {
    throw new Error('Could not create contact record')
  }

  if (!company && contact.companyId) {
    company = store.companies.find((entry) => entry.id === contact.companyId) || null
  }

  return {
    contactId: contact.id,
    companyId: company?.id || contact.companyId || null,
    contact,
    company,
    leadSnapshot: contactAndCompanyToLeadSnapshot(contact, company, {
      score: fields.score,
      source: fields.source || 'manual',
    }),
  }
}

export function resolvePipelineMasterIds(store, entry) {
  if (entry.contactId) {
    const contact = store.contacts.find((row) => row.id === entry.contactId)
    const company = contact
      ? store.companies.find((row) => row.id === (entry.companyId || contact.companyId))
      : null
    if (contact) return { contact, company, contactId: contact.id, companyId: company?.id || contact.companyId }
  }

  const leadId = entry.lead?.id
  if (leadId) {
    const contact = store.contacts.find((row) => row.id === leadId)
    if (contact) {
      const company = store.companies.find((row) => row.id === contact.companyId)
      return { contact, company, contactId: contact.id, companyId: company?.id || contact.companyId }
    }
  }

  return { contact: null, company: null, contactId: null, companyId: null }
}

/** Update master contact/company and keep pipeline lead snapshot in sync. */
export function updatePipelineContactDetails(store, entry, patch = {}) {
  let { contact, company, contactId, companyId } = resolvePipelineMasterIds(store, entry)

  if (!contact) {
    const linked = upsertMasterRecordFromLeadFields(
      store,
      {
        firstName: patch.firstName ?? entry.lead?.firstName,
        lastName: patch.lastName ?? entry.lead?.lastName,
        title: patch.title ?? entry.lead?.title,
        company: patch.company ?? entry.lead?.company,
        email: patch.email ?? entry.lead?.email,
        phone: patch.phone ?? entry.lead?.phone,
        city: patch.city ?? entry.lead?.city,
        state: patch.state ?? entry.lead?.state,
        industry: patch.industry ?? entry.lead?.industry,
        website: patch.website ?? patch.companyDomain ?? entry.lead?.companyDomain,
        linkedin: patch.linkedin ?? entry.lead?.linkedin,
        source: entry.lead?.source || 'pipeline',
      },
      null
    )
    contact = linked.contact
    company = linked.company
    contactId = linked.contactId
    companyId = linked.companyId
  } else {
    applyContactPatch(contact, patch)
    if (company) applyCompanyPatch(company, patch)
    else if (companyId) {
      company = store.companies.find((row) => row.id === companyId) || null
      if (company) applyCompanyPatch(company, patch)
    }
  }

  entry.contactId = contactId
  entry.companyId = companyId
  entry.lead = {
    ...entry.lead,
    ...contactAndCompanyToLeadSnapshot(contact, company, {
      score: entry.lead?.score,
      source: entry.lead?.source || 'database',
    }),
    savedAt: entry.lead?.savedAt || entry.savedAt,
    inPipeline: true,
  }

  return entry
}

/** Contact visibility matches pipeline: admins see org pipeline; members see assigned/owned leads only. */
function visibleContactIdsForUser(store, user) {
  const ids = new Set()
  for (const entry of listPipelineSavedEntries(store, user)) {
    if (entry.contactId) ids.add(entry.contactId)
    if (entry.lead?.id) ids.add(entry.lead.id)
  }
  return ids
}

export function userCanAccessContact(store, user, contactId) {
  if (!contactId) return false
  const contact = store.contacts.find((row) => row.id === contactId)
  if (!contact) return false
  return visibleContactIdsForUser(store, user).has(contactId)
}

export function shapeContactRecord(contact, company) {
  return {
    id: contact.id,
    contactId: contact.id,
    companyId: company?.id || contact.companyId || null,
    firstName: contact.firstName || '',
    lastName: contact.lastName || '',
    fullName: contact.fullName || [contact.firstName, contact.lastName].filter(Boolean).join(' '),
    title: contact.title || '',
    email: contact.email || '',
    phone: contact.phone || '',
    city: contact.city || company?.city || '',
    state: contact.state || company?.state || '',
    location: [contact.city || company?.city, contact.state || company?.state].filter(Boolean).join(', '),
    linkedin: contact.linkedinUrl || '',
    company: company?.name || '',
    companyDomain: company?.domain || '',
    industry: company?.industry || '',
    website: company?.website || company?.domain || '',
    source: contact.sourceConfidence || 'database',
    updatedAt: contact.lastVerifiedAt || contact.createdAt || null,
  }
}

export function listContactsForUser(store, user, { search = '', limit = 100, offset = 0 } = {}) {
  const visibleIds = visibleContactIdsForUser(store, user)
  const companyById = new Map(store.companies.map((company) => [company.id, company]))
  let rows = store.contacts.filter((contact) => visibleIds.has(contact.id))

  const q = String(search || '').trim().toLowerCase()
  if (q) {
    rows = rows.filter((contact) => {
      const company = companyById.get(contact.companyId)
      const haystack = [
        contact.firstName,
        contact.lastName,
        contact.fullName,
        contact.email,
        contact.phone,
        contact.title,
        company?.name,
        company?.city,
        company?.state,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }

  rows.sort((left, right) => {
    const ln = `${left.lastName || ''}${left.firstName || ''}`.toLowerCase()
    const rn = `${right.lastName || ''}${right.firstName || ''}`.toLowerCase()
    return ln.localeCompare(rn)
  })

  const total = rows.length
  const slice = rows.slice(offset, offset + limit).map((contact) =>
    shapeContactRecord(contact, companyById.get(contact.companyId))
  )

  return { contacts: slice, total }
}

function syncPipelineSnapshotsForContact(store, contact, company, entries) {
  const snapshot = contactAndCompanyToLeadSnapshot(contact, company, { source: 'database' })
  for (const entry of entries) {
    if (entry.contactId !== contact.id && entry.lead?.id !== contact.id) continue
    entry.contactId = contact.id
    entry.companyId = company?.id || contact.companyId || null
    entry.lead = {
      ...entry.lead,
      ...snapshot,
      id: contact.id,
      savedAt: entry.lead?.savedAt || entry.savedAt,
      inPipeline: true,
    }
  }
}

/** Update master contact from Contacts page; sync linked pipeline leads. */
export function updateMasterContactById(store, user, contactId, patch = {}) {
  if (!userCanAccessContact(store, user, contactId)) {
    throw new Error('Contact not found')
  }

  const contact = store.contacts.find((row) => row.id === contactId)
  if (!contact) throw new Error('Contact not found')

  let company = store.companies.find((row) => row.id === contact.companyId) || null
  applyContactPatch(contact, patch)
  if (company) applyCompanyPatch(company, patch)
  else if (patch.company) {
    const linked = upsertMasterRecordFromLeadFields(store, { ...patch, company: patch.company }, user)
    company = linked.company
    contact.companyId = linked.companyId
  }

  syncPipelineSnapshotsForContact(store, contact, company, listPipelineSavedEntries(store, user))
  return shapeContactRecord(contact, company)
}
