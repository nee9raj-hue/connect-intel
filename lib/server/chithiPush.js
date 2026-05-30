import { createId } from './store.js'
import { sendWebPushNotification, isWebPushConfigured, getVapidPublicKey } from './webPush.js'
import { stripMentionTokensForPreview } from './chithiMentions.js'
import { getAppBaseUrl } from './appUrl.js'

export { isWebPushConfigured, getVapidPublicKey }

function normalizeSubscriptionInput(raw, user) {
  const endpoint = String(raw?.endpoint || '').trim()
  const p256dh = raw?.keys?.p256dh
  const auth = raw?.keys?.auth
  if (!endpoint || !p256dh || !auth) {
    throw new Error('Invalid push subscription')
  }
  return {
    id: createId('psub'),
    userId: user.id,
    organizationId: user.organizationId || null,
    endpoint,
    keys: { p256dh, auth },
    userAgent: String(raw?.userAgent || '').slice(0, 240),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

export function upsertPushSubscription(store, user, raw) {
  const row = normalizeSubscriptionInput(raw, user)
  store.pushSubscriptions = store.pushSubscriptions || []

  const idx = store.pushSubscriptions.findIndex((s) => s.endpoint === row.endpoint)
  if (idx >= 0) {
    const prev = store.pushSubscriptions[idx]
    store.pushSubscriptions[idx] = {
      ...prev,
      ...row,
      id: prev.id,
      createdAt: prev.createdAt,
      updatedAt: new Date().toISOString(),
    }
    return store.pushSubscriptions[idx]
  }

  store.pushSubscriptions.push(row)
  return row
}

export function removePushSubscription(store, userId, endpoint) {
  const before = (store.pushSubscriptions || []).length
  store.pushSubscriptions = (store.pushSubscriptions || []).filter(
    (s) => !(s.userId === userId && s.endpoint === endpoint)
  )
  return before !== store.pushSubscriptions.length
}

export function listPushSubscriptionsForUser(store, userId) {
  return (store.pushSubscriptions || []).filter((s) => s.userId === userId)
}

export function userHasPushSubscription(store, userId) {
  return listPushSubscriptionsForUser(store, userId).length > 0
}

function absoluteAppUrl(path) {
  const base = getAppBaseUrl().replace(/\/$/, '')
  const p = String(path || '/?panel=chithi')
  if (p.startsWith('http')) return p
  return `${base}${p.startsWith('/') ? p : `/${p}`}`
}

/** Send Chithi push to one or more users; returns expired subscription ids to prune. */
export async function notifyChithiPushRecipients({
  store,
  recipientUserIds = [],
  actorUserId,
  title,
  body,
  url,
  tag,
}) {
  if (!isWebPushConfigured()) return { sent: 0, expiredIds: [] }

  const targets = [...new Set(recipientUserIds.filter((id) => id && id !== actorUserId))]
  if (!targets.length) return { sent: 0, expiredIds: [] }

  const preview = stripMentionTokensForPreview(body || '')
  const payload = {
    title: title || 'Chithi',
    body: preview || 'New message',
    url: absoluteAppUrl(url),
    tag: tag || 'chithi',
  }

  let sent = 0
  const expiredIds = []

  for (const userId of targets) {
    const subs = listPushSubscriptionsForUser(store, userId)
    for (const sub of subs) {
      const result = await sendWebPushNotification(sub, payload)
      if (result.ok) sent += 1
      else if (result.expired) expiredIds.push(sub.id)
    }
  }

  return { sent, expiredIds: [...new Set(expiredIds)] }
}

export async function pruneExpiredPushSubscriptions(expiredIds) {
  if (!expiredIds?.length) return
  const { updateStorePartial } = await import('./store.js')
  await updateStorePartial(['pushSubscriptions'], (draft) => {
    const drop = new Set(expiredIds)
    draft.pushSubscriptions = (draft.pushSubscriptions || []).filter((s) => !drop.has(s.id))
    return draft
  })
}
