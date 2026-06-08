import { createId } from './store.js'
import { defaultCrm } from './crm.js'
import { getMembership } from './organizations.js'
import { CRM_STATUSES } from './crm.js'
import { normalizeLeadContact, isDisplayableLead } from './leadQuality.js'
import { findPipelineEntry } from './pipelineAccess.js'
import { upsertMasterRecordFromLeadFields } from './pipelineContact.js'
import { maybeAutoAssignLead } from './crmWorkflowRules.js'
import { computeCrmLeadScore } from './crmLeadScore.js'
import { applyWorkflowRules } from './crmWorkflowRules.js'
import { getDefaultPipelineId } from './crmPipelines.js'
import { appendActivity, normalizeExtendedCrm } from './crmWorkflow.js'

function pipelineStatusFromInput(raw) {
  const status = String(raw || 'new')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
  return CRM_STATUSES.includes(status) ? status : 'new'
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

  const { contactId, companyId, leadSnapshot } = upsertMasterRecordFromLeadFields(
    store,
    {
      ...fields,
      company: company || 'Unknown Company',
      email,
      phone,
      source: 'manual',
    },
    user
  )

  const normalized = normalizeLeadContact({
    ...leadSnapshot,
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
    if (contactId && (e.contactId === contactId || e.lead.id === contactId)) return true
    return false
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

  const entry = {
    id: createId('saved'),
    userId: user.id,
    organizationId: organizationId || null,
    savedByUserId: user.id,
    assignedToUserId: organizationId ? assignee : user.id,
    savedAt: new Date().toISOString(),
    contactId,
    companyId,
    crm,
    lead: {
      ...normalized,
      id: contactId,
      savedAt: new Date().toISOString(),
      inPipeline: true,
    },
  }

  store.savedLeads.push(entry)

  if (organizationId && !fields.assignedToUserId) {
    maybeAutoAssignLead(store, entry, organizationId, user)
  }

  entry.crm = normalizeExtendedCrm(entry.crm)
  if (organizationId) {
    entry.crm.pipelineId = entry.crm.pipelineId || getDefaultPipelineId(store, organizationId)
    applyWorkflowRules(store, entry, {
      trigger: 'lead_created',
      actor: user,
      organizationId,
    })
    entry.crm = normalizeExtendedCrm(entry.crm)
  }
  entry.crm.leadScore = computeCrmLeadScore(entry, {
    store,
    organizationId,
    marketingEvents: store.marketingEvents,
  })
  if (organizationId) {
    entry.crm = appendActivity(entry.crm, {
      type: 'note',
      summary: 'Lead added to pipeline',
      userId: user.id,
      userName: user.name || user.email,
    })
  }

  const saved = findPipelineEntry(store, user, contactId)
  return saved?.lead || normalized
}
