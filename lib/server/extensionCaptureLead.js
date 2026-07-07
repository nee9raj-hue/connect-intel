import { readStore } from './store.js'
import { buildOrgUserResponse } from './organizations.js'
import { persistManualPipelineLead } from './pipelineLeadMutations.js'
import { matchPipelineLeadsForExtension } from './extensionLeadMatch.js'
import { recordAuditEvent } from './auditEvents.js'
import { inferLeadCompanyDomain, normalizeCompanyDomain } from './companyDomain.js'
import { mergeLeadForTenantLight } from './tenantIsolation.js'
import { syncMeilisearchAfterSave } from './meilisearchSync.js'
import { parseLeadLocationFields } from '../pipelineLeadLocation.js'
import { findPipelineEntry } from './pipelineAccess.js'
import { updatePipelineContactDetails } from './pipelineContact.js'
import { appendActivity, normalizeExtendedCrm } from './crmWorkflow.js'
import {
  attachPipelineEntriesToStore,
  FAST_PIPELINE_WRITE,
  loadPipelineLeadForMutation,
  loadPipelineStoreContext,
  touchPipelineEntry,
  updatePipelineLeadViaTable,
  updatePipelineStore,
} from './pipelineShard.js'
import { findPipelineEntryAsync } from './pipelineVisibility.js'

const META_STORE_COLLECTIONS = ['users', 'organizations', 'organizationMemberships']

export const CAPTURE_FIELD_LABELS = {
  firstName: 'First name',
  lastName: 'Last name',
  title: 'Title',
  company: 'Company',
  email: 'Email',
  phone: 'Phone',
  city: 'City',
  state: 'State',
  linkedin: 'LinkedIn',
  industry: 'Industry',
  companyDomain: 'Website',
}

function isPipelineFieldEmpty(value, field = '') {
  if (value === undefined || value === null) return true
  const text = String(value).trim()
  if (!text) return true
  if (field === 'company' && /^unknown company$/i.test(text)) return true
  if (field === 'title' && /^business contact$/i.test(text)) return true
  return false
}

/** Only include captured values for fields missing on the existing pipeline lead. */
export function buildMissingCapturePatch(existingLead = {}, captured = {}) {
  const patch = {}
  const pairs = [
    ['firstName', 'firstName'],
    ['lastName', 'lastName'],
    ['title', 'title'],
    ['company', 'company'],
    ['email', 'email'],
    ['phone', 'phone'],
    ['city', 'city'],
    ['state', 'state'],
    ['linkedin', 'linkedin'],
    ['industry', 'industry'],
  ]

  for (const [captureKey, leadKey] of pairs) {
    const existing = existingLead[leadKey] ?? existingLead[captureKey]
    const next = captured[captureKey]
    if (isPipelineFieldEmpty(existing, leadKey) && !isPipelineFieldEmpty(next, leadKey)) {
      patch[captureKey] = String(next).trim()
    }
  }

  const website = captured.companyDomain || captured.website
  if (isPipelineFieldEmpty(existingLead.companyDomain) && !isPipelineFieldEmpty(website)) {
    patch.companyDomain = String(website).trim()
  }

  return patch
}

export function buildExtensionCaptureMessage({ duplicate, updated, updatedFields = [] } = {}) {
  if (!duplicate) return 'Lead added to pipeline'
  if (updated) {
    const labels = updatedFields.map((field) => CAPTURE_FIELD_LABELS[field] || field)
    return labels.length
      ? `Pipeline lead updated with ${labels.join(', ')}`
      : 'Pipeline lead updated'
  }
  return 'Lead already exists — no new fields to add'
}

function splitName(fullName = '') {
  const parts = String(fullName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (!parts.length) return { firstName: '', lastName: '' }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  }
}

function formatCapturedLead(store, user, entry, { created = true } = {}) {
  const merged = mergeLeadForTenantLight(store, user, entry)
  const lead = merged?.lead || merged
  const leadId = lead?.id || entry.lead?.id
  return {
    leadId,
    name: [lead?.firstName, lead?.lastName].filter(Boolean).join(' ') || lead?.company || 'Lead',
    company: lead?.company || '',
    title: lead?.title || '',
    email: lead?.email || '',
    phone: lead?.phone || '',
    city: lead?.city || '',
    state: lead?.state || '',
    linkedin: lead?.linkedin || '',
    status: entry.crm?.status || lead?.crm?.status || 'new',
    pipelineUrl: `https://connectintel.net/?panel=pipeline&lead=${encodeURIComponent(leadId || '')}`,
    created,
  }
}

function sanitizeCaptureFields(raw = {}) {
  const linkedin = String(raw.linkedin || raw.linkedinUrl || '').trim().split('?')[0]
  const sourcePage = String(raw.sourcePage || raw.pageUrl || '').trim().split('?')[0]
  const nameParts = splitName(raw.name)

  const firstName = String(raw.firstName || nameParts.firstName || '').trim().slice(0, 80)
  const lastName = String(raw.lastName || nameParts.lastName || '').trim().slice(0, 80)
  const company = String(raw.company || '').trim().slice(0, 160)
  const title = String(raw.title || raw.headline || '').trim().slice(0, 160)
  const email = String(raw.email || '').trim().toLowerCase().slice(0, 320)
  const phone = String(raw.phone || '').trim().slice(0, 40)
  const notes = String(raw.notes || '').trim().slice(0, 2000)
  const pageType = String(raw.pageType || 'extension').trim().slice(0, 40)
  const location = String(raw.location || '').trim().slice(0, 160)
  const industry = String(raw.industry || '').trim().slice(0, 80)

  const parsedLocation = parseLeadLocationFields({
    city: String(raw.city || '').trim().slice(0, 80),
    state: String(raw.state || '').trim().slice(0, 80),
    location,
  })

  const companyDomain =
    normalizeCompanyDomain(raw.companyDomain) ||
    normalizeCompanyDomain(raw.website) ||
    (email ? normalizeCompanyDomain(email) : null)

  return {
    firstName,
    lastName,
    company,
    title,
    email,
    phone,
    linkedin: linkedin.slice(0, 500),
    companyDomain: companyDomain || '',
    website: companyDomain || String(raw.website || '').trim().slice(0, 200),
    city: parsedLocation.city,
    state: parsedLocation.state,
    location: parsedLocation.city || parsedLocation.state ? [parsedLocation.city, parsedLocation.state].filter(Boolean).join(', ') : location,
    industry: industry || 'B2B',
    notes,
    sourcePage: sourcePage.slice(0, 500),
    pageType,
    source: 'extension',
  }
}

async function findExistingCaptureMatch(user, fields) {
  const emails = fields.email ? [fields.email] : []
  const searchParts = [fields.company, fields.firstName, fields.lastName, fields.linkedin]
    .map((v) => String(v || '').trim())
    .filter((v) => v.length >= 2)

  const result = await matchPipelineLeadsForExtension(user, {
    emails,
    search: searchParts.join(' '),
    domainHints: fields.companyDomain ? [fields.companyDomain] : [],
  })

  if (!result.matches?.length) return null

  if (fields.linkedin) {
    const linkedinNeedle = fields.linkedin.toLowerCase()
    const byLinkedin = result.matches.find((m) =>
      String(m.linkedin || '').toLowerCase().includes(linkedinNeedle.replace(/^https?:\/\//, ''))
    )
    if (byLinkedin) return { ...byLinkedin, created: false }
  }

  if (fields.email) {
    const byEmail = result.matches.find(
      (m) => String(m.email || '').toLowerCase() === fields.email.toLowerCase()
    )
    if (byEmail) return { ...byEmail, created: false }
  }

  return { ...result.matches[0], created: false }
}

async function loadPipelineEntryForCapture(user, leadId) {
  const tableLoad = await loadPipelineLeadForMutation(user, leadId)
  if (tableLoad?.entry) return tableLoad

  const metaStore = await readStore({ only: META_STORE_COLLECTIONS })
  const { pipelineStore } = await loadPipelineStoreContext(user, { shardOnly: false })
  const entry = await findPipelineEntryAsync(pipelineStore, user, leadId, metaStore)
  if (!entry) return null

  return {
    entry,
    pipelineStore,
    metaStore,
    source: 'shard',
  }
}

async function enrichExistingLeadFromExtensionCapture(user, organizationId, existingSummary, fields) {
  const leadId = existingSummary?.leadId
  if (!leadId) {
    return { lead: existingSummary, duplicate: true, updated: false, updatedFields: [] }
  }

  const loaded = await loadPipelineEntryForCapture(user, leadId)
  const entry = loaded?.entry
  if (!entry?.lead) {
    return { lead: existingSummary, duplicate: true, updated: false, updatedFields: [] }
  }

  const patch = buildMissingCapturePatch(entry.lead, fields)
  const updatedFields = Object.keys(patch)
  if (!updatedFields.length) {
    const store = attachPipelineEntriesToStore(loaded.metaStore || { savedLeads: [] }, [entry])
    return {
      lead: formatCapturedLead(store, user, entry, { created: false }),
      duplicate: true,
      updated: false,
      updatedFields: [],
    }
  }

  const applyPatch = async (draft) => {
    const target = findPipelineEntry(draft, user, leadId)
    if (!target) return draft

    updatePipelineContactDetails(draft, target, patch)

    if (organizationId) {
      const labels = updatedFields.map((field) => CAPTURE_FIELD_LABELS[field] || field)
      target.crm = appendActivity(normalizeExtendedCrm(target.crm), {
        type: 'note',
        summary: `Chrome extension added: ${labels.join(', ')}`,
        userId: user.id,
        userName: user.name || user.email,
      })
    }

    touchPipelineEntry(target)
    return draft
  }

  let store = null
  let updatedEntry = entry

  if (loaded.source !== 'shard' && loaded.entry) {
    const tableResult = await updatePipelineLeadViaTable(user, leadId, applyPatch, {
      preloadedEntry: loaded.entry,
      metaStore: loaded.metaStore,
    })
    if (tableResult?.store) {
      store = tableResult.store
      updatedEntry = tableResult.entry || updatedEntry
    }
  }

  if (!store) {
    store = await updatePipelineStore(user, applyPatch, { writeOptions: FAST_PIPELINE_WRITE })
    updatedEntry = findPipelineEntry(store, user, leadId) || updatedEntry
  }

  if (organizationId && updatedEntry) {
    syncMeilisearchAfterSave({ organizationId, entry: updatedEntry })
  }

  void recordAuditEvent({
    organizationId: user.organizationId,
    actorUserId: user.id,
    action: 'extension.lead_capture_enriched',
    resourceType: 'lead',
    resourceId: leadId,
    outcome: 'success',
    metadata: {
      source: 'chrome_extension',
      pageType: fields.pageType,
      sourcePage: fields.sourcePage || null,
      updatedFields,
    },
  }).catch(() => {})

  return {
    lead: formatCapturedLead(store, user, updatedEntry, { created: false }),
    duplicate: true,
    updated: true,
    updatedFields,
  }
}

/**
 * Capture a lead from the Chrome extension (LinkedIn / company site).
 * Constitution: server-side create only; workspace-scoped; audited.
 */
export async function captureLeadFromExtension(sessionUser, rawFields = {}) {
  const fields = sanitizeCaptureFields(rawFields)

  if (!fields.company && !fields.firstName && !fields.lastName) {
    throw new Error('Enter at least a company name or contact name')
  }
  if (!fields.email && !fields.phone && !fields.company && !fields.linkedin) {
    throw new Error('Add an email, phone, LinkedIn URL, or company name')
  }

  const metaStore = await readStore({ only: META_STORE_COLLECTIONS })
  const user = buildOrgUserResponse(
    metaStore.users.find((u) => u.id === sessionUser.id) || sessionUser,
    metaStore
  )
  const organizationId =
    user.accountType === 'company' && user.organizationId ? user.organizationId : null

  const existing = await findExistingCaptureMatch(user, fields)
  if (existing) {
    void recordAuditEvent({
      organizationId: user.organizationId,
      actorUserId: user.id,
      action: 'extension.lead_capture_existing',
      resourceType: 'lead',
      resourceId: existing.leadId,
      outcome: 'success',
      metadata: {
        source: 'chrome_extension',
        pageType: fields.pageType,
        sourcePage: fields.sourcePage || null,
      },
    }).catch(() => {})

    const enriched = await enrichExistingLeadFromExtensionCapture(
      user,
      organizationId,
      existing,
      fields
    )
    return enriched
  }

  const captureNotes = [
    fields.notes,
    fields.sourcePage ? `Captured from: ${fields.sourcePage}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  const { store, entry } = await persistManualPipelineLead(user, organizationId, {
    ...fields,
    notes: captureNotes || undefined,
    source: 'extension',
  })

  if (!entry?.lead?.id) {
    throw new Error('Could not create lead')
  }

  if (organizationId) {
    syncMeilisearchAfterSave({ organizationId, entry })
  }

  const lead = formatCapturedLead(store, user, entry, { created: true })
  const domain = inferLeadCompanyDomain(entry.lead)

  void recordAuditEvent({
    organizationId: user.organizationId,
    actorUserId: user.id,
    action: 'extension.lead_captured',
    resourceType: 'lead',
    resourceId: lead.leadId,
    outcome: 'success',
    metadata: {
      source: 'chrome_extension',
      pageType: fields.pageType,
      sourcePage: fields.sourcePage || null,
      companyDomain: domain,
    },
  }).catch(() => {})

  return { lead, duplicate: false }
}
