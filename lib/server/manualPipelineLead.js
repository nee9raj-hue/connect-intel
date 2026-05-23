import { createId } from './store.js'
import { defaultCrm } from './crm.js'
import { getMembership } from './organizations.js'
import { CRM_STATUSES } from './crm.js'
import { normalizeLeadContact, isDisplayableLead } from './leadQuality.js'
import { findPipelineEntry } from './pipelineAccess.js'

function pipelineStatusFromInput(raw) {
  const status = String(raw || 'new')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
  return CRM_STATUSES.includes(status) ? status : 'new'
}

function newLeadId() {
  return createId('lead')
}

export function addManualPipelineLead(store, { user, organizationId, fields }) {
  const company = String(fields.company || '').trim()
  const firstName = String(fields.firstName || '').trim()
  const lastName = String(fields.lastName || '').trim()

  if (!company && !firstName && !lastName) {
    throw new Error('Enter at least a company name or contact name')
  }

  const email = String(fields.email || '').trim().toLowerCase()
  const phone = String(fields.phone || '').trim()

  if (!email && !phone && !company) {
    throw new Error('Add an email, phone, or company name')
  }

  const normalized = normalizeLeadContact({
    id: newLeadId(),
    firstName,
    lastName,
    title: String(fields.title || '').trim() || 'Business Contact',
    company: company || 'Unknown Company',
    companyDomain: String(fields.website || fields.companyDomain || '').trim(),
    email,
    phone,
    city: String(fields.city || '').trim(),
    state: String(fields.state || '').trim(),
    location: [fields.city, fields.state].filter(Boolean).join(', '),
    industry: String(fields.industry || '').trim() || 'B2B',
    linkedin: String(fields.linkedin || '').trim(),
    emailStatus: email ? 'verified' : 'unverified',
    score: 75,
    source: 'manual',
  })

  if (!isDisplayableLead(normalized)) {
    throw new Error('Could not create lead — check company and contact details')
  }

  const duplicate = store.savedLeads.find((e) => {
    if (organizationId) {
      if (e.organizationId !== organizationId) return false
    } else if (e.userId !== user.id || e.organizationId) {
      return false
    }
    if (email && e.lead.email?.toLowerCase() === email) return true
    return e.lead.id === normalized.id
  })

  if (duplicate) {
    throw new Error(
      email
        ? `A lead with email ${email} is already in your pipeline`
        : 'This lead already exists in your pipeline'
    )
  }

  const isAdmin = user.isOrgAdmin || user.orgRole === 'org_admin'
  let assignee = user.id
  if (isAdmin && organizationId && fields.assignedToUserId) {
    const target = String(fields.assignedToUserId)
    const member = getMembership(store, target, organizationId)
    if (!member) throw new Error('Assignee is not on your team')
    assignee = target
  }

  const crm = defaultCrm()
  crm.status = pipelineStatusFromInput(fields.status)
  if (fields.notes) crm.notes = String(fields.notes).trim()

  store.savedLeads.push({
    id: createId('saved'),
    userId: user.id,
    organizationId: organizationId || null,
    savedByUserId: user.id,
    assignedToUserId: organizationId ? assignee : user.id,
    savedAt: new Date().toISOString(),
    crm,
    lead: {
      ...normalized,
      savedAt: new Date().toISOString(),
      inPipeline: true,
    },
  })

  const entry = findPipelineEntry(store, user, normalized.id)
  return entry?.lead || normalized
}
