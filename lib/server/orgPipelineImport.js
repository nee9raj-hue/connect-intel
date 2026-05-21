import { createId } from './store.js'
import { CRM_STATUSES, defaultCrm } from './crm.js'
import { importRowsIntoStore } from './imports.js'
import { hasCompleteContact, normalizeLeadContact } from './leadQuality.js'

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
    source: 'org-import',
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

/**
 * Import company pipeline CSV into master DB + org CRM pipeline.
 */
export function importOrgPipeline(store, { rows, datasetType = 'general', actor, organizationId, addToPipeline = true }) {
  const { store: nextStore, importJob } = importRowsIntoStore(store, datasetType, rows, actor, {
    organizationId,
    sourceLabel: 'org-pipeline',
  })

  const companyById = new Map(nextStore.companies.map((c) => [c.id, c]))
  const newContacts = nextStore.contacts.filter((c) => c.importJobId === importJob.id)
  let pipelineAdded = 0
  let pipelineSkipped = 0

  if (addToPipeline && organizationId) {
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
        (e) => e.organizationId === organizationId && e.lead.id === lead.id
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
        organizationId,
        savedByUserId: actor.id,
        assignedToUserId: row?.assigned_to || row?.assignedTo ? String(row.assigned_to || row.assignedTo) : null,
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
        hasCompleteContact({ email: c.email, phone: c.phone })
      ).length,
    },
  }
}

export function listOrgImportOverview(store, organizationId) {
  const imports = store.importJobs.filter((job) => job.organizationId === organizationId).slice(0, 20)
  const pipelineCount = store.savedLeads.filter((e) => e.organizationId === organizationId).length

  return {
    imports,
    pipelineCount,
    counts: {
      companies: store.companies.length,
      contacts: store.contacts.length,
    },
  }
}
