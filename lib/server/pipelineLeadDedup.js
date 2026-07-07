/**
 * Pipeline lead identity dedup — one person per workspace.
 * Used by extension capture, manual add, and imports.
 */

import { normalizePhoneDigits } from './phoneUtils.js'

export function normalizeLinkedinKey(url = '') {
  return String(url || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '')
    .replace(/^linkedin\.com\/in\//, '')
    .replace(/\/$/, '')
}

export function normalizeCompanyKey(name = '') {
  const text = String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\b(pvt\.?|ltd\.?|limited|llp|inc\.?|corp\.?|corporation|co\.?)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
  if (!text || text === 'unknowncompany') return ''
  return text
}

function entryInWorkspace(entry, { user, organizationId }) {
  if (organizationId) return entry.organizationId === organizationId
  return entry.userId === user.id && !entry.organizationId
}

/** True when an incoming lead matches an existing pipeline row by identity. */
export function pipelineEntryMatchesIdentity(entry, fields = {}, scope = {}) {
  if (!entry?.lead) return false
  if (!entryInWorkspace(entry, scope)) return false

  const lead = entry.lead
  const email = String(fields.email || '').trim().toLowerCase()
  const linkedinKey = fields.linkedin ? normalizeLinkedinKey(fields.linkedin) : ''
  const phoneDigits = fields.phone ? normalizePhoneDigits(fields.phone) : null
  const contactId = fields.contactId || fields.leadId

  if (contactId && (entry.contactId === contactId || lead.id === contactId)) return true
  if (email && String(lead.email || '').trim().toLowerCase() === email) return true

  if (linkedinKey) {
    const stored = normalizeLinkedinKey(lead.linkedin)
    if (
      stored &&
      (stored === linkedinKey || stored.includes(linkedinKey) || linkedinKey.includes(stored))
    ) {
      return true
    }
  }

  if (phoneDigits) {
    const stored = normalizePhoneDigits(lead.phone)
    if (stored && stored === phoneDigits) return true
  }

  const first = String(fields.firstName || '').trim().toLowerCase()
  const last = String(fields.lastName || '').trim().toLowerCase()
  const companyKey = normalizeCompanyKey(fields.company)

  if (first && last && companyKey) {
    const leadFirst = String(lead.firstName || '').trim().toLowerCase()
    const leadLast = String(lead.lastName || '').trim().toLowerCase()
    const leadCompanyKey = normalizeCompanyKey(lead.company)
    if (leadFirst === first && leadLast === last && leadCompanyKey === companyKey) return true
  }

  return false
}

export function findExistingPipelineEntry(store, user, fields = {}, { organizationId } = {}) {
  const scope = { user, organizationId }
  return (store.savedLeads || []).find((entry) => pipelineEntryMatchesIdentity(entry, fields, scope)) || null
}

export function leadSummaryToIdentityFields(summary = {}) {
  const nameParts = String(summary.name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  return {
    firstName: nameParts[0] || '',
    lastName: nameParts.slice(1).join(' '),
    company: summary.company || '',
    email: summary.email || '',
    phone: summary.phone || '',
    linkedin: summary.linkedin || '',
    leadId: summary.leadId || '',
  }
}

export function leadSummaryMatchesIdentity(summary, fields, scope) {
  const leadId = summary?.leadId
  if (!leadId) return false
  return pipelineEntryMatchesIdentity(
    {
      organizationId: scope.organizationId || null,
      userId: scope.user?.id,
      contactId: leadId,
      lead: {
        id: leadId,
        firstName: leadSummaryToIdentityFields(summary).firstName,
        lastName: leadSummaryToIdentityFields(summary).lastName,
        company: summary.company || '',
        email: summary.email || '',
        phone: summary.phone || '',
        linkedin: summary.linkedin || '',
      },
    },
    fields,
    scope
  )
}
