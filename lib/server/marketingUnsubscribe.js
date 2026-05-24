import crypto from 'node:crypto'
import { readStore, updateStore, createId } from './store.js'

function unsubSecret() {
  return (
    process.env.MARKETING_UNSUB_SECRET ||
    process.env.SESSION_JWT_SECRET ||
    process.env.JWT_SECRET ||
    'connect-intel-marketing-unsub-dev'
  )
}

export function createUnsubscribeToken(scope, email) {
  const normalized = String(email || '').trim().toLowerCase()
  const orgKey = scope.organizationId || `user:${scope.createdByUserId || 'unknown'}`
  const payload = `${orgKey}:${normalized}`
  const sig = crypto.createHmac('sha256', unsubSecret()).update(payload).digest('base64url')
  return Buffer.from(`${payload}:${sig}`).toString('base64url')
}

export function parseUnsubscribeToken(token) {
  if (!token) return null
  try {
    const decoded = Buffer.from(String(token), 'base64url').toString('utf8')
    const lastColon = decoded.lastIndexOf(':')
    if (lastColon <= 0) return null
    const payload = decoded.slice(0, lastColon)
    const sig = decoded.slice(lastColon + 1)
    const expected = crypto.createHmac('sha256', unsubSecret()).update(payload).digest('base64url')
    if (sig !== expected) return null
    const sep = payload.indexOf(':')
    if (sep <= 0) return null
    const orgKey = payload.slice(0, sep)
    const email = payload.slice(sep + 1)
    if (orgKey.startsWith('user:')) {
      return { organizationId: null, createdByUserId: orgKey.slice(5), email }
    }
    return { organizationId: orgKey, createdByUserId: null, email }
  } catch {
    return null
  }
}

export function isEmailSuppressed(store, { organizationId, createdByUserId, email }) {
  const normalized = String(email || '').trim().toLowerCase()
  if (!normalized.includes('@')) return false
  return (store.marketingSuppressions || []).some((row) => {
    if (row.email !== normalized) return false
    if (organizationId) return row.organizationId === organizationId
    return row.createdByUserId === createdByUserId && !row.organizationId
  })
}

export async function recordUnsubscribe({ organizationId, createdByUserId, email }) {
  const normalized = String(email || '').trim().toLowerCase()
  if (!normalized.includes('@')) return { ok: false, error: 'Invalid email' }

  await updateStore((draft) => {
    const exists = (draft.marketingSuppressions || []).some((row) => {
      if (row.email !== normalized) return false
      if (organizationId) return row.organizationId === organizationId
      return row.createdByUserId === createdByUserId && !row.organizationId
    })
    if (exists) return draft
    draft.marketingSuppressions = draft.marketingSuppressions || []
    draft.marketingSuppressions.push({
      id: createId('msup'),
      organizationId: organizationId || null,
      createdByUserId: createdByUserId || null,
      email: normalized,
      reason: 'unsubscribe',
      createdAt: new Date().toISOString(),
    })
    return draft
  })

  return { ok: true }
}

export function unsubscribeUrl(scope, email) {
  const token = createUnsubscribeToken(scope, email)
  const base = process.env.APP_URL || 'https://connectintel.net'
  return `${base}/api/marketing/unsubscribe?token=${encodeURIComponent(token)}`
}
