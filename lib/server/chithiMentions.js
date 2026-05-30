import { getMembership } from './organizations.js'
import { stripMentionTokensForPreview as stripAllMentionTokens, USER_MENTION_RE } from '../mentionTokens.js'

export { USER_MENTION_RE }

export function parseUserMentions(body) {
  const userMentions = []
  const seen = new Set()
  for (const match of String(body || '').matchAll(USER_MENTION_RE)) {
    const userId = match[2]?.trim()
    if (!userId || seen.has(userId)) continue
    seen.add(userId)
    userMentions.push({ userId, label: match[1]?.trim() || 'Teammate' })
  }
  return userMentions
}

export function validateUserMentions(store, organizationId, userMentions = [], authorUserId) {
  for (const mention of userMentions) {
    if (mention.userId === authorUserId) continue
    const member = getMembership(store, mention.userId, organizationId)
    if (!member || member.status !== 'active') {
      throw new Error(`Teammate not in your organization: ${mention.label || mention.userId}`)
    }
  }
}

export function stripMentionTokensForPreview(body) {
  return stripAllMentionTokens(body)
}
