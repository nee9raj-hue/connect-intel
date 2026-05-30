const DISMISS_KEY = 'ci_chithi_push_dismissed'

export function isPushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    typeof Notification !== 'undefined'
  )
}

export function isChithiPushDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

export function dismissChithiPushPrompt() {
  try {
    localStorage.setItem(DISMISS_KEY, '1')
  } catch {
    // ignore
  }
}

export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) arr[i] = raw.charCodeAt(i)
  return arr
}

export async function getServiceWorkerRegistration() {
  if (!('serviceWorker' in navigator)) return null
  return navigator.serviceWorker.ready
}

export async function readLocalPushSubscription() {
  const reg = await getServiceWorkerRegistration()
  if (!reg?.pushManager) return null
  return reg.pushManager.getSubscription()
}

export function subscriptionToJson(subscription) {
  if (!subscription) return null
  const json = subscription.toJSON()
  return {
    endpoint: json.endpoint,
    keys: json.keys,
    expirationTime: json.expirationTime,
  }
}
