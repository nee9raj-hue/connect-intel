/** @mention tokens for team chat, notes, and tasks. */

export const USER_MENTION_RE = /@\[([^\]]+)\]\(user:([^)]+)\)/g
export const LEAD_MENTION_RE = /#\[([^\]]+)\]\(lead:([^)]+)\)/g
/** Older messages used @ for pipeline customers. */
export const LEGACY_LEAD_MENTION_RE = /@\[([^\]]+)\]\(lead:([^)]+)\)/g

export function formatLeadMentionLabel(lead) {
  const name = [lead?.firstName, lead?.lastName].filter(Boolean).join(' ').trim()
  const company = String(lead?.company || '').trim()
  const phone = String(lead?.phone || lead?.mobile || '').trim()
  const parts = []
  if (name) parts.push(name)
  if (company) parts.push(company)
  if (phone) parts.push(phone)
  return parts.join(' · ') || 'Customer'
}

export function formatLeadMentionToken(lead) {
  const label = lead?.label || formatLeadMentionLabel(lead)
  const id = lead?.id
  if (!id) return ''
  return `#[${label}](lead:${id}) `
}

export function formatUserMentionToken(member) {
  const label = member?.name || member?.email || 'Teammate'
  const userId = member?.userId || member?.id
  if (!userId) return ''
  return `@[${label}](user:${userId}) `
}

export function parseLeadMentions(body) {
  const leadMentions = []
  const seen = new Set()
  const text = String(body || '')
  for (const re of [LEAD_MENTION_RE, LEGACY_LEAD_MENTION_RE]) {
    for (const match of text.matchAll(re)) {
      const leadId = match[2]?.trim()
      if (!leadId || seen.has(leadId)) continue
      seen.add(leadId)
      leadMentions.push({ leadId, label: match[1]?.trim() || 'Customer' })
    }
  }
  return leadMentions
}

export function stripMentionTokensForPreview(body) {
  return String(body || '')
    .replace(USER_MENTION_RE, (_, label) => `@${label}`)
    .replace(LEAD_MENTION_RE, (_, label) => `#${label}`)
    .replace(LEGACY_LEAD_MENTION_RE, (_, label) => `#${label}`)
}
