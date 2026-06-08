import { createId } from './store.js'

/** Digits-only phone for duplicate matching (min length 7). */
export function normalizePhoneDigits(phone) {
  const d = String(phone || '').replace(/\D/g, '')
  return d.length >= 7 ? d : ''
}

/** Match frontend parseUpload — lowercase keys, common spreadsheet header variants. */
export function normalizeImportRow(row) {
  if (!row || typeof row !== 'object') return {}
  const out = {}
  for (const [key, value] of Object.entries(row)) {
    const normalizedKey = String(key || '')
      .replace(/^\uFEFF/, '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_')
    if (!normalizedKey || normalizedKey.startsWith('__empty')) continue
    out[normalizedKey] = value
  }
  if (!out.company && out.company_name) out.company = out.company_name
  if (!out.company && out.business_name) out.company = out.business_name
  if (!out.first_name && out.firstname) out.first_name = out.firstname
  if (!out.last_name && out.lastname) out.last_name = out.lastname
  if (!out.email && out.work_email) out.email = out.work_email
  if (!out.phone && out.mobile) out.phone = out.mobile
  return out
}

export function getValue(row, aliases) {
  for (const key of aliases) {
    if (row[key] == null) continue
    const value = String(row[key]).trim()
    if (value) return value
  }
  return ''
}

function getBoolean(row, aliases) {
  const value = getValue(row, aliases).toLowerCase()
  if (!value) return false
  return ['true', 'yes', '1', 'y'].includes(value)
}

export function getCompanyKey(company) {
  if (company.domain) return `domain:${company.domain.toLowerCase()}`
  return `name:${company.name.toLowerCase()}|${company.city.toLowerCase()}|${company.state.toLowerCase()}`
}

/** Resolve existing company id from a normalized import row (same key rules as import). */
export function findCompanyIdForImportRow(store, datasetType, rawRow) {
  const row = normalizeImportRow(rawRow)
  const company = normalizeCompany(row, datasetType, 'preview')
  if (!company) return null
  const key = getCompanyKey(company)
  const hit = store.companies.find((c) => getCompanyKey(c) === key)
  return hit?.id || null
}

export function findContactByCompanyAndIdentity(store, companyId, row) {
  const email = getValue(row, ['email', 'work_email'])
  const emailLower = email ? String(email).trim().toLowerCase() : ''
  const phoneDigits = normalizePhoneDigits(getValue(row, ['phone', 'mobile', 'direct_dial']))
  for (const c of store.contacts) {
    if (c.companyId !== companyId) continue
    if (emailLower && c.email && String(c.email).trim().toLowerCase() === emailLower) return c
    const pd = normalizePhoneDigits(c.phone)
    if (phoneDigits && pd && pd === phoneDigits) return c
  }
  return null
}

/** Per-company email/phone maps for O(1) dedupe during large imports. */
export function buildContactIndex(store) {
  const byCompany = new Map()
  for (const contact of store.contacts || []) {
    if (!contact.companyId) continue
    let idx = byCompany.get(contact.companyId)
    if (!idx) {
      idx = { byEmail: new Map(), byPhone: new Map() }
      byCompany.set(contact.companyId, idx)
    }
    const emailLower = contact.email ? String(contact.email).trim().toLowerCase() : ''
    if (emailLower) idx.byEmail.set(emailLower, contact)
    const phoneDigits = normalizePhoneDigits(contact.phone)
    if (phoneDigits) idx.byPhone.set(phoneDigits, contact)
  }
  return byCompany
}

function findContactInIndex(contactIndex, companyId, contact) {
  const idx = contactIndex.get(companyId)
  if (!idx) return null
  const emailLower = contact.email ? String(contact.email).trim().toLowerCase() : ''
  if (emailLower && idx.byEmail.has(emailLower)) return idx.byEmail.get(emailLower)
  const phoneDigits = normalizePhoneDigits(contact.phone)
  if (phoneDigits && idx.byPhone.has(phoneDigits)) return idx.byPhone.get(phoneDigits)
  return null
}

function registerContactInIndex(contactIndex, contact) {
  if (!contact.companyId) return
  let idx = contactIndex.get(contact.companyId)
  if (!idx) {
    idx = { byEmail: new Map(), byPhone: new Map() }
    contactIndex.set(contact.companyId, idx)
  }
  const emailLower = contact.email ? String(contact.email).trim().toLowerCase() : ''
  if (emailLower) idx.byEmail.set(emailLower, contact)
  const phoneDigits = normalizePhoneDigits(contact.phone)
  if (phoneDigits) idx.byPhone.set(phoneDigits, contact)
}

function mergeImportContact(existing, incoming) {
  const use = (v) => v != null && String(v).trim() !== ''
  if (use(incoming.firstName)) existing.firstName = incoming.firstName
  if (use(incoming.lastName)) existing.lastName = incoming.lastName
  if (use(incoming.fullName)) existing.fullName = incoming.fullName
  if (use(incoming.title)) existing.title = incoming.title
  if (use(incoming.seniority)) existing.seniority = incoming.seniority
  if (use(incoming.email)) existing.email = incoming.email
  if (use(incoming.phone)) existing.phone = incoming.phone
  if (use(incoming.linkedinUrl)) existing.linkedinUrl = incoming.linkedinUrl
  if (use(incoming.city)) existing.city = incoming.city
  if (use(incoming.state)) existing.state = incoming.state
  if (use(incoming.country)) existing.country = incoming.country
  if (use(incoming.sourceConfidence)) existing.sourceConfidence = incoming.sourceConfidence
  existing.importJobId = incoming.importJobId
  existing.lastVerifiedAt = incoming.lastVerifiedAt
}

function normalizeCompany(row, datasetType, importJobId) {
  const name = getValue(row, [
    'company',
    'company_name',
    'companyname',
    'companyName',
    'business_name',
    'businessname',
    'name',
  ])
  if (!name) return null

  const city = getValue(row, ['city', 'location_city'])
  const state = getValue(row, ['state', 'province', 'location_state'])
  const country = getValue(row, ['country']) || 'India'
  const industry = getValue(row, ['industry', 'sector', 'vertical'])
  const domain = getValue(row, ['website', 'domain', 'companyDomain', 'company_domain'])

  return {
    id: createId('company'),
    importJobId,
    name,
    legalName: getValue(row, ['legal_name', 'legalName']) || name,
    domain,
    website: domain ? (domain.startsWith('http') ? domain : `https://${domain}`) : '',
    city,
    state,
    country,
    industry,
    companyType: getValue(row, ['company_type', 'companyType']),
    employeeRange: getValue(row, ['employees', 'employee_range', 'employeeRange', 'company_size']),
    revenueRange: getValue(row, ['revenue_range', 'revenueRange']),
    postalCode: getValue(row, ['postal_code', 'postalCode', 'pincode']),
    exporterFlag:
      datasetType === 'exporters' ||
      getBoolean(row, ['exporter_flag', 'exporter', 'is_exporter']),
    shippingFlag:
      datasetType === 'shipping' ||
      getBoolean(row, ['shipping_flag', 'shipping', 'is_shipping']),
    sourceType: datasetType,
    sourceConfidence: getValue(row, ['source_confidence']) || 'imported',
    lastVerifiedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  }
}

function splitName(fullName) {
  const cleaned = String(fullName || '').trim()
  if (!cleaned) return { firstName: '', lastName: '' }
  const parts = cleaned.split(/\s+/)
  if (parts.length === 1) return { firstName: parts[0], lastName: '' }
  return {
    firstName: parts.slice(0, -1).join(' '),
    lastName: parts.slice(-1).join(' '),
  }
}

function normalizeContact(row, companyId, importJobId, company) {
  const fullName = getValue(row, ['contact_name', 'contactName', 'full_name', 'fullName', 'name'])
  const firstName = getValue(row, ['first_name', 'firstName'])
  const lastName = getValue(row, ['last_name', 'lastName'])
  const title = getValue(row, ['title', 'job_title', 'designation'])
  const email = getValue(row, ['email', 'work_email'])
  const phone = getValue(row, ['phone', 'mobile', 'direct_dial'])
  const linkedinUrl = getValue(row, ['linkedin', 'linkedin_url', 'linkedinUrl'])

  const parts =
    firstName || lastName
      ? { firstName, lastName }
      : splitName(fullName)

  if (!parts.firstName && !parts.lastName && !title && !email && !phone) return null

  return {
    id: createId('contact'),
    importJobId,
    companyId,
    firstName: parts.firstName,
    lastName: parts.lastName,
    fullName: fullName || [parts.firstName, parts.lastName].filter(Boolean).join(' '),
    title,
    seniority: getValue(row, ['seniority', 'level']),
    email,
    phone,
    linkedinUrl,
    city: getValue(row, ['city', 'location_city']) || company.city,
    state: getValue(row, ['state', 'province', 'location_state']) || company.state,
    country: getValue(row, ['country']) || company.country || 'India',
    sourceConfidence: getValue(row, ['source_confidence']) || 'imported',
    lastVerifiedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  }
}

function processImportRows(store, datasetType, rows, importJobId, companyKeyToId, contactIndex) {
  let companiesCreated = 0
  let contactsCreated = 0
  let contactsUpdated = 0
  let rejectedRows = 0

  for (const rawRow of rows) {
    const row = normalizeImportRow(rawRow)
    const company = normalizeCompany(row, datasetType, importJobId)
    if (!company) {
      rejectedRows += 1
      continue
    }

    const companyKey = getCompanyKey(company)
    let companyId = companyKeyToId.get(companyKey)
    let targetCompany = null

    if (!companyId) {
      store.companies.push(company)
      companyKeyToId.set(companyKey, company.id)
      companyId = company.id
      targetCompany = company
      companiesCreated += 1
    } else {
      targetCompany = store.companies.find((entry) => entry.id === companyId) || company
    }

    const contact = normalizeContact(row, companyId, importJobId, targetCompany)
    if (contact) {
      const duplicate = findContactInIndex(contactIndex, companyId, contact)
      if (duplicate) {
        mergeImportContact(duplicate, contact)
        contactsUpdated += 1
      } else {
        store.contacts.push(contact)
        registerContactInIndex(contactIndex, contact)
        contactsCreated += 1
      }
    }
  }

  return { companiesCreated, contactsCreated, contactsUpdated, rejectedRows }
}

/** Import rows in one or more chunks (platform master data). */
export function importRowsChunkIntoStore(store, datasetType, rows, actor, options = {}) {
  const now = new Date().toISOString()
  const organizationId = options.organizationId || null
  const isFirst = options.isFirst !== false && !options.importJobId
  const isLast = options.isLast !== false

  let importJob
  if (isFirst) {
    const importJobId = createId('import')
    importJob = {
      id: importJobId,
      name: options.name || `${datasetType} import ${new Date(now).toLocaleString('en-IN')}`,
      datasetType,
      organizationId,
      createdByUserId: actor?.id || null,
      sourceLabel: options.sourceLabel || (organizationId ? 'org-pipeline' : 'platform'),
      rowCount: 0,
      companiesCreated: 0,
      contactsCreated: 0,
      contactsUpdated: 0,
      rejectedRows: 0,
      createdAt: now,
      createdBy: actor?.email || 'system',
      status: isLast ? 'completed' : 'processing',
      completedAt: isLast ? now : null,
    }
    store.importJobs.unshift(importJob)
  } else {
    importJob = (store.importJobs || []).find((job) => job.id === options.importJobId)
    if (!importJob) {
      throw new Error('Import session expired — please restart the upload')
    }
    if (importJob.status === 'completed') {
      throw new Error('Import already finished — please start a new upload')
    }
  }

  const companyKeyToId = new Map(store.companies.map((company) => [getCompanyKey(company), company.id]))
  const contactIndex = buildContactIndex(store)
  const stats = processImportRows(store, datasetType, rows, importJob.id, companyKeyToId, contactIndex)

  importJob.rowCount += rows.length
  importJob.companiesCreated += stats.companiesCreated
  importJob.contactsCreated += stats.contactsCreated
  importJob.contactsUpdated += stats.contactsUpdated
  importJob.rejectedRows += stats.rejectedRows
  importJob.updatedAt = now

  if (isLast) {
    importJob.status = 'completed'
    importJob.completedAt = now
  }

  store.importJobs = store.importJobs.slice(0, 100)

  return { store, importJob }
}

export function importRowsIntoStore(store, datasetType, rows, actor, options = {}) {
  return importRowsChunkIntoStore(store, datasetType, rows, actor, {
    ...options,
    isFirst: true,
    isLast: true,
  })
}

export const MASTER_DATA_COLLECTIONS = ['companies', 'contacts', 'importJobs']

function mergeCompanyFields(target, source) {
  const fields = [
    'legalName',
    'domain',
    'website',
    'city',
    'state',
    'country',
    'industry',
    'companyType',
    'employeeRange',
    'revenueRange',
    'postalCode',
    'exporterFlag',
    'shippingFlag',
    'sourceType',
    'sourceConfidence',
  ]
  for (const field of fields) {
    const next = source[field]
    if (next == null || next === '') continue
    const cur = target[field]
    if (cur == null || cur === '' || String(next).length > String(cur).length) {
      target[field] = next
    }
  }
  if (source.lastVerifiedAt) target.lastVerifiedAt = source.lastVerifiedAt
}

/** Collapse duplicate companies (same domain or name+city+state) and merge contacts. */
export function dedupeMasterDatabase(store) {
  const companiesBefore = (store.companies || []).length
  const contactsBefore = (store.contacts || []).length

  const idRemap = new Map()
  const keyToCanonical = new Map()

  for (const company of store.companies || []) {
    if (!company?.name) continue
    const key = getCompanyKey(company)
    if (keyToCanonical.has(key)) {
      idRemap.set(company.id, keyToCanonical.get(key))
    } else {
      keyToCanonical.set(key, company.id)
    }
  }

  const canonicalById = new Map()
  for (const company of store.companies || []) {
    if (!company?.name) continue
    const canonicalId = idRemap.get(company.id) || company.id
    if (!canonicalById.has(canonicalId)) {
      canonicalById.set(canonicalId, { ...company, id: canonicalId })
    } else {
      mergeCompanyFields(canonicalById.get(canonicalId), company)
    }
  }

  store.companies = Array.from(canonicalById.values())

  const contactIndex = new Map()
  const kept = []
  let contactsMerged = 0

  for (const contact of store.contacts || []) {
    const companyId = idRemap.get(contact.companyId) || contact.companyId
    if (!canonicalById.has(companyId)) {
      contactsMerged += 1
      continue
    }
    const normalized = { ...contact, companyId }
    const duplicate = findContactInIndex(contactIndex, companyId, normalized)
    if (duplicate) {
      mergeImportContact(duplicate, normalized)
      contactsMerged += 1
    } else {
      kept.push(normalized)
      registerContactInIndex(contactIndex, normalized)
    }
  }

  store.contacts = kept

  return {
    companiesBefore,
    contactsBefore,
    companiesRemoved: companiesBefore - store.companies.length,
    contactsRemoved: contactsBefore - store.contacts.length,
    contactsMerged,
    companiesLeft: store.companies.length,
    contactsLeft: store.contacts.length,
  }
}

export function listAdminOverview(store) {
  const companies = store.companies || []
  const contacts = store.contacts || []
  const importJobs = store.importJobs || []
  return {
    imports: importJobs,
    counts: {
      companies: companies.length,
      contacts: contacts.length,
      imports: importJobs.length,
    },
    recentCompanies: companies.slice(-10).reverse(),
    recentContacts: contacts.slice(-10).reverse(),
  }
}

