import { createId } from './store.js'
import { CRM_STATUSES, defaultCrm, normalizeCrm } from './crm.js'
import {
  importRowsIntoStore,
  normalizeImportRow,
  findCompanyIdForImportRow,
  findContactByCompanyAndIdentity,
  normalizePhoneDigits,
} from './imports.js'
import { hasCompleteContact, isDisplayableLead, normalizeLeadContact } from './leadQuality.js'

function contactToLead(contact, company) {
  const normalized = normalizeLeadContact({
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
    industry: company?.industry || '',
    employees: company?.employeeRange || '',
    linkedin: contact.linkedinUrl || '',
    emailStatus: contact.email ? 'verified' : 'unverified',
    score: hasCompleteContact({ email: contact.email, phone: contact.phone }) ? 88 : 70,
    source: 'user-import',
  })
  return normalized
}

function pipelineStatusFromRow(row) {
  const raw = String(row.pipeline_status || row.pipelineStatus || row.crm_status || row.status || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
  return CRM_STATUSES.includes(raw) ? raw : 'new'
}

function findExistingUserSavedLead(store, actorId, emailLower, phoneDigits) {
  const el = emailLower || ''
  for (const e of store.savedLeads) {
    if (e.organizationId || e.userId !== actorId) continue
    const le = e.lead?.email ? String(e.lead.email).trim().toLowerCase() : ''
    if (el && le && el === le) return e
    const lp = normalizePhoneDigits(e.lead?.phone)
    if (phoneDigits && lp && lp === phoneDigits) return e
  }
  return null
}

/** Personal pipeline import (individual account or scoped to user). */
export function importUserPipeline(store, { rows, datasetType = 'general', actor, addToPipeline = true }) {
  const { store: nextStore, importJob } = importRowsIntoStore(store, datasetType, rows, actor, {
    organizationId: null,
    sourceLabel: 'user-pipeline',
  })

  const companyById = new Map(nextStore.companies.map((c) => [c.id, c]))

  let pipelineAdded = 0
  let pipelineUpdated = 0
  let pipelineSkipped = 0
  const searchableImportedContactIds = new Set()

  if (addToPipeline) {
    for (const rawRow of rows) {
      const row = normalizeImportRow(rawRow)
      const companyId = findCompanyIdForImportRow(nextStore, datasetType, rawRow)
      if (!companyId) {
        pipelineSkipped += 1
        continue
      }

      const contact = findContactByCompanyAndIdentity(nextStore, companyId, row)
      if (!contact) {
        pipelineSkipped += 1
        continue
      }

      const company = companyById.get(contact.companyId)
      const lead = contactToLead(contact, company)
      const emailLower = lead.email ? String(lead.email).trim().toLowerCase() : ''
      const phoneDigits = normalizePhoneDigits(lead.phone)

      if (!emailLower && !phoneDigits) {
        pipelineSkipped += 1
        continue
      }

      if (isDisplayableLead({ email: contact.email, phone: contact.phone, company: company?.name })) {
        searchableImportedContactIds.add(contact.id)
      }

      const existing = findExistingUserSavedLead(nextStore, actor.id, emailLower, phoneDigits)
      const now = new Date().toISOString()

      if (existing) {
        const prevCrm = normalizeCrm(existing.crm || defaultCrm())
        existing.lead = { ...lead, savedAt: now, inPipeline: true }
        existing.crm = {
          ...prevCrm,
          status: pipelineStatusFromRow(row),
          notes:
            row?.notes !== undefined && String(row.notes).trim()
              ? String(row.notes).trim()
              : prevCrm.notes,
        }
        existing.assignedToUserId = actor.id
        existing.savedAt = now
        pipelineUpdated += 1
      } else {
        const crm = defaultCrm()
        crm.status = pipelineStatusFromRow(row)
        if (row?.notes) crm.notes = String(row.notes).trim()

        nextStore.savedLeads.push({
          id: createId('saved'),
          userId: actor.id,
          organizationId: null,
          savedByUserId: actor.id,
          assignedToUserId: actor.id,
          savedAt: now,
          crm,
          lead: {
            ...lead,
            savedAt: now,
            inPipeline: true,
          },
        })
        pipelineAdded += 1
      }
    }
  }

  return {
    store: nextStore,
    importJob,
    stats: {
      companiesCreated: importJob.companiesCreated,
      contactsCreated: importJob.contactsCreated,
      contactsUpdated: importJob.contactsUpdated ?? 0,
      rejectedRows: importJob.rejectedRows,
      pipelineAdded,
      pipelineUpdated,
      pipelineSkipped,
      searchableContacts: searchableImportedContactIds.size,
    },
  }
}

export function listUserImportOverview(store, userId) {
  const imports = store.importJobs
    .filter((job) => !job.organizationId && job.createdByUserId === userId)
    .slice(0, 20)
  const pipelineCount = store.savedLeads.filter((e) => e.userId === userId && !e.organizationId).length
  return { imports, pipelineCount }
}
