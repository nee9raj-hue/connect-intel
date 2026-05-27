import { createId } from './store.js'
import { CRM_STATUSES, defaultCrm, normalizeCrm } from './crm.js'
import {
  importRowsIntoStore,
  normalizeImportRow,
  findCompanyIdForImportRow,
  findContactByCompanyAndIdentity,
  normalizePhoneDigits,
  getValue,
} from './imports.js'
import { hasCompleteContact, isDisplayableLead, normalizeLeadContact } from './leadQuality.js'
import { getMembership } from './organizations.js'
import { resolveAssigneeUserIdForOrg } from './importAssignee.js'
import {
  listOrgLeadTagDefinitions,
  normalizeLeadTagIds,
  parseTagNamesInput,
} from './orgLeadTags.js'

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

function tagIdsFromNamedColumns(row, store, organizationId) {
  const raw = getValue(row, ['lead_tags', 'tags', 'tag_names'])
  if (!raw) return []
  const names = parseTagNamesInput(raw.replace(/\|/g, ','))
  const defs = listOrgLeadTagDefinitions(store, organizationId)
  const byLower = new Map(defs.map((d) => [d.name.toLowerCase(), d.id]))
  const ids = []
  for (const n of names) {
    const id = byLower.get(String(n).trim().toLowerCase())
    if (id) ids.push(id)
  }
  return ids
}

function findExistingOrgSavedLead(store, organizationId, emailLower, phoneDigits) {
  const el = emailLower || ''
  for (const e of store.savedLeads) {
    if (e.organizationId !== organizationId) continue
    const le = e.lead?.email ? String(e.lead.email).trim().toLowerCase() : ''
    if (el && le && el === le) return e
    const lp = normalizePhoneDigits(e.lead?.phone)
    if (phoneDigits && lp && lp === phoneDigits) return e
  }
  return null
}

function resolveAssigneeId(store, organizationId, row, assignToActor, actorId) {
  if (assignToActor) return actorId
  let candidate = resolveAssigneeUserIdForOrg(store, organizationId, row, actorId)
  if (getMembership(store, candidate, organizationId)) return candidate
  return actorId
}

/** Import company pipeline CSV into contacts store + org CRM pipeline. */
export function importOrgPipeline(
  store,
  {
    rows,
    datasetType = 'general',
    actor,
    organizationId,
    addToPipeline = true,
    assignToActor = false,
    tagIds: bulkTagIds = [],
  }
) {
  const { store: nextStore, importJob } = importRowsIntoStore(store, datasetType, rows, actor, {
    organizationId,
    sourceLabel: 'org-pipeline',
  })

  const companyById = new Map(nextStore.companies.map((c) => [c.id, c]))

  const baseTagIds = organizationId
    ? normalizeLeadTagIds(bulkTagIds, nextStore, organizationId)
    : []

  let pipelineAdded = 0
  let pipelineUpdated = 0
  let pipelineSkipped = 0

  const searchableImportedContactIds = new Set()

  if (addToPipeline && organizationId) {
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

      const rowTagIds = tagIdsFromNamedColumns(row, nextStore, organizationId)
      const mergedAllowedTagIds = normalizeLeadTagIds(
        [...baseTagIds, ...rowTagIds],
        nextStore,
        organizationId
      )

      const assigneeId = resolveAssigneeId(nextStore, organizationId, row, assignToActor, actor.id)

      const existing = findExistingOrgSavedLead(nextStore, organizationId, emailLower, phoneDigits)
      const now = new Date().toISOString()

      if (existing) {
        const prevCrm = normalizeCrm(existing.crm || defaultCrm())
        const nextCrm = {
          ...prevCrm,
          status: pipelineStatusFromRow(row),
          tagIds: normalizeLeadTagIds(
            [...(prevCrm.tagIds || []), ...mergedAllowedTagIds],
            nextStore,
            organizationId
          ),
        }
        if (row?.notes !== undefined && String(row.notes).trim()) {
          nextCrm.notes = String(row.notes).trim()
        }

        existing.lead = {
          ...lead,
          savedAt: now,
          inPipeline: true,
        }
        existing.crm = nextCrm
        existing.assignedToUserId = assigneeId
        existing.savedAt = now
        pipelineUpdated += 1
      } else {
        const crm = defaultCrm()
        crm.status = pipelineStatusFromRow(row)
        if (row?.notes) crm.notes = String(row.notes).trim()
        crm.tagIds = mergedAllowedTagIds

        nextStore.savedLeads.push({
          id: createId('saved'),
          userId: actor.id,
          organizationId,
          savedByUserId: actor.id,
          assignedToUserId: assigneeId,
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
