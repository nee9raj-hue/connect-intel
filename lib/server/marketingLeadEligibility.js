import { findPipelineEntry } from './pipelineAccess.js'
import { normalizePhoneDigits } from './phoneUtils.js'

export function normalizeMarketingChannel(channel) {
  return channel === 'whatsapp' ? 'whatsapp' : 'email'
}

export function leadHasMarketingEmail(lead) {
  const email = String(lead?.email || '').trim().toLowerCase()
  return email.includes('@') && !email.includes('•')
}

export function leadHasMarketingWhatsAppPhone(lead) {
  const phone = String(lead?.phone || '').trim()
  if (!phone || phone.includes('•') || /locked/i.test(phone)) return false
  return Boolean(normalizePhoneDigits(phone))
}

export function leadEligibleForMarketingChannel(lead, channel) {
  const ch = normalizeMarketingChannel(channel)
  if (ch === 'whatsapp') return leadHasMarketingWhatsAppPhone(lead)
  return leadHasMarketingEmail(lead)
}

export function filterLeadIdsForMarketingChannel(store, user, leadIds, channel) {
  const unique = [...new Set(leadIds || [])]
  const eligible = []
  for (const leadId of unique) {
    const entry = findPipelineEntry(store, user, leadId)
    if (!entry) continue
    const lead = entry.lead || entry
    if (leadEligibleForMarketingChannel(lead, channel)) eligible.push(leadId)
  }
  return eligible
}
