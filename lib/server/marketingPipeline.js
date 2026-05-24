import { createId } from './store.js'
import { defaultCrm } from './crm.js'
import { resolveOrgRole } from './organizations.js'
import { upsertMasterRecordFromLeadFields } from './pipelineContact.js'

/** Add search/API leads to pipeline; returns pipeline lead ids (lead.id). */
export function ensureLeadsInPipeline(store, user, leads = []) {
  const { accountType } = resolveOrgRole(user, store)
  const organizationId =
    accountType === 'company' && user.organizationId ? user.organizationId : null

  const leadIds = []

  for (const lead of leads) {
    if (!lead?.id) continue

    const existing = store.savedLeads.find((e) => {
      if (organizationId) return e.organizationId === organizationId && e.lead?.id === lead.id
      return e.userId === user.id && !e.organizationId && e.lead?.id === lead.id
    })

    if (existing) {
      leadIds.push(existing.lead.id)
      continue
    }

    let contactId = null
    let companyId = null
    let leadPayload = { ...lead }

    const existingContact = store.contacts.find((row) => row.id === lead.id)
    if (existingContact) {
      contactId = existingContact.id
      companyId = existingContact.companyId
    } else {
      try {
        const linked = upsertMasterRecordFromLeadFields(
          store,
          {
            firstName: lead.firstName,
            lastName: lead.lastName,
            title: lead.title,
            company: lead.company,
            email: lead.email,
            phone: lead.phone,
            city: lead.city,
            state: lead.state,
            industry: lead.industry,
            website: lead.companyDomain || lead.website,
            linkedin: lead.linkedin,
            source: lead.source || 'search',
          },
          user
        )
        contactId = linked.contactId
        companyId = linked.companyId
        leadPayload = {
          ...linked.leadSnapshot,
          score: lead.score,
          source: lead.source || linked.leadSnapshot.source,
        }
      } catch {
        // keep search snapshot
      }
    }

    const pipelineLeadId = contactId || leadPayload.id || lead.id
    store.savedLeads.push({
      id: createId('saved'),
      userId: user.id,
      organizationId,
      savedByUserId: user.id,
      assignedToUserId: user.isOrgAdmin ? null : user.id,
      savedAt: new Date().toISOString(),
      contactId,
      companyId,
      crm: defaultCrm(),
      lead: {
        ...leadPayload,
        id: pipelineLeadId,
        savedAt: new Date().toISOString(),
        inPipeline: true,
      },
    })
    leadIds.push(pipelineLeadId)
  }

  return [...new Set(leadIds)]
}
