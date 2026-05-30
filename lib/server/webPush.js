import webpush from 'web-push'

let configured = false

export function isWebPushConfigured() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)
}

export function getVapidPublicKey() {
  return String(process.env.VAPID_PUBLIC_KEY || '').trim()
}

function ensureConfigured() {
  if (configured || !isWebPushConfigured()) return false
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:invite@connectintel.net',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )
  configured = true
  return true
}

/**
 * @param {object} subscription row from store
 * @param {object} payload { title, body, url, tag, icon }
 */
export async function sendWebPushNotification(subscription, payload) {
  if (!ensureConfigured()) return { ok: false, expired: false }

  const pushSubscription = {
    endpoint: subscription.endpoint,
    keys: subscription.keys,
  }

  try {
    await webpush.sendNotification(
      pushSubscription,
      JSON.stringify({
        title: payload.title || 'Chithi',
        body: payload.body || '',
        url: payload.url || '/?panel=chithi',
        tag: payload.tag || 'chithi',
        icon: payload.icon || '/pwa-192.png',
      }),
      { TTL: 60 * 60 * 24 }
    )
    return { ok: true, expired: false }
  } catch (error) {
    const status = error?.statusCode || error?.status
    const expired = status === 404 || status === 410
    return { ok: false, expired, status }
  }
}
