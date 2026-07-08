import { leadCanReceiveCommercialEmail, leadHasSendableEmail } from '../../leadEmailSendable.js'
import { findPipelineEntry } from '../pipelineAccess.js'
import { isEmailSuppressed } from '../marketingUnsubscribe.js'
import { marketingScopeKey } from '../marketingAccess.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmailFormat(email) {
  const v = String(email || '').trim().toLowerCase()
  return v.length > 3 && v.length <= 254 && EMAIL_RE.test(v)
}

/**
 * Validate recipients before creating a messaging job.
 * Invalid rows are skipped — the job continues for valid recipients.
 */
export function validateMessagingRecipients(store, user, leadIds, { resolvedByLeadId = null } = {}) {
  const scope = marketingScopeKey(user)
  const skipped = []
  const valid = []
  const seenEmails = new Set()

  for (const leadId of leadIds) {
    const entry = findPipelineEntry(store, user, leadId)
    if (!entry) {
      skipped.push({ leadId, reason: 'not_in_pipeline' })
      continue
    }
    const base = entry.lead || entry
    const hit = resolvedByLeadId?.get?.(String(leadId))
    const lead = hit ? { ...base, ...hit, id: leadId } : base

    const email = String(lead.email || '').trim().toLowerCase()
    if (!leadHasSendableEmail(lead) || !isValidEmailFormat(email)) {
      skipped.push({ leadId, reason: 'no_email' })
      continue
    }
    if (seenEmails.has(email)) {
      skipped.push({ leadId, reason: 'duplicate' })
      continue
    }
    if (isEmailSuppressed(store, { ...scope, email })) {
      skipped.push({ leadId, reason: 'unsubscribed' })
      continue
    }
    if (!leadCanReceiveCommercialEmail(lead)) {
      skipped.push({ leadId, reason: 'no_consent' })
      continue
    }
    seenEmails.add(email)
    valid.push({ leadId, lead, entry })
  }

  return { valid, skipped, counts: { selected: leadIds.length, valid: valid.length, skipped: skipped.length } }
}
