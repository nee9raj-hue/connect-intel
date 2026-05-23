import { createId } from './store.js'
import { defaultCrm } from './crm.js'
import { importRowsIntoStore } from './imports.js'
import { hasCompleteContact, isDisplayableLead, normalizeLeadContact } from './leadQuality.js'
import { CRM_STATUSES } from './crm.js'

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

/** Personal pipeline import (individual account or scoped to user). */
export function importUserPipeline(store, { rows, datasetType = 'general', actor, addToPipeline = true }) {
  const { store: nextStore, importJob } = importRowsIntoStore(store, datasetType, rows, actor, {
    organizationId: null,
    sourceLabel: 'user-pipeline',
  })

  const companyById = new Map(nextStore.companies.map((c) => [c.id, c]))
  const newContacts = nextStore.contacts.filter((c) => c.importJobId === importJob.id)
  let pipelineAdded = 0
  let pipelineSkipped = 0

  if (addToPipeline) {
    const rowByEmail = new Map()
    for (const row of rows) {
      const email = String(row.email || row.work_email || '')
        .trim()
        .toLowerCase()
      if (email) rowByEmail.set(email, row)
    }

    for (const contact of newContacts) {
      const company = companyById.get(contact.companyId)
      const lead = contactToLead(contact, company)
      const exists = nextStore.savedLeads.some(
        (e) => !e.organizationId && e.userId === actor.id && e.lead.id === lead.id
      )
      if (exists) {
        pipelineSkipped += 1
        continue
      }

      const row = contact.email ? rowByEmail.get(contact.email.toLowerCase()) : null
      const crm = defaultCrm()
      if (row) crm.status = pipelineStatusFromRow(row)
      if (row?.notes) crm.notes = String(row.notes).trim()

      nextStore.savedLeads.push({
        id: createId('saved'),
        userId: actor.id,
        organizationId: null,
        savedByUserId: actor.id,
        assignedToUserId: actor.id,
        savedAt: new Date().toISOString(),
        crm,
        lead: {
          ...lead,
          savedAt: new Date().toISOString(),
          inPipeline: true,
        },
      })
      pipelineAdded += 1
    }
  }

  return {
    store: nextStore,
    importJob,
    stats: {
      companiesCreated: importJob.companiesCreated,
      contactsCreated: importJob.contactsCreated,
      rejectedRows: importJob.rejectedRows,
      pipelineAdded,
      pipelineSkipped,
      searchableContacts: newContacts.filter((c) =>
        isDisplayableLead({ email: c.email, phone: c.phone, company: companyById.get(c.companyId)?.name })
      ).length,
    },
  }
}

export function listUserImportOverview(store, userId) {
  const imports = store.importJobs.filter((job) => job.userId === userId && !job.organizationId).slice(0, 20)
  const pipelineCount = store.savedLeads.filter((e) => e.userId === userId && !e.organizationId).length
  return { imports, pipelineCount }
}
