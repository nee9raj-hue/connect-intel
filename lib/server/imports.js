import { createId } from './store.js'

/** Match frontend parseUpload — lowercase keys, common spreadsheet header variants. */
function normalizeImportRow(row) {
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

function getValue(row, aliases) {
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

function getCompanyKey(company) {
  if (company.domain) return `domain:${company.domain.toLowerCase()}`
  return `name:${company.name.toLowerCase()}|${company.city.toLowerCase()}|${company.state.toLowerCase()}`
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

export function importRowsIntoStore(store, datasetType, rows, actor, options = {}) {
  const now = new Date().toISOString()
  const importJobId = createId('import')
  const organizationId = options.organizationId || null
  const companyKeyToId = new Map(store.companies.map((company) => [getCompanyKey(company), company.id]))
  let companiesCreated = 0
  let contactsCreated = 0
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
      const duplicate = store.contacts.find(
        (entry) =>
          entry.companyId === companyId &&
          entry.email &&
          contact.email &&
          entry.email.toLowerCase() === contact.email.toLowerCase()
      )

      if (!duplicate) {
        store.contacts.push(contact)
        contactsCreated += 1
      }
    }
  }

  const importJob = {
    id: importJobId,
    name: options.name || `${datasetType} import ${new Date(now).toLocaleString('en-IN')}`,
    datasetType,
    organizationId,
    sourceLabel: options.sourceLabel || (organizationId ? 'org-pipeline' : 'platform'),
    rowCount: rows.length,
    companiesCreated,
    contactsCreated,
    rejectedRows,
    createdAt: now,
    createdBy: actor?.email || 'system',
    status: 'completed',
  }

  store.importJobs.unshift(importJob)
  store.importJobs = store.importJobs.slice(0, 100)

  return {
    store,
    importJob,
  }
}

export function listAdminOverview(store) {
  return {
    imports: store.importJobs,
    counts: {
      companies: store.companies.length,
      contacts: store.contacts.length,
      imports: store.importJobs.length,
    },
    recentCompanies: store.companies.slice(-10).reverse(),
    recentContacts: store.contacts.slice(-10).reverse(),
  }
}

