const READ_KEY = 'connect_intel_notifications_read'

export function loadReadNotificationIds() {
  try {
    const raw = sessionStorage.getItem(READ_KEY)
    const list = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(list) ? list : [])
  } catch {
    return new Set()
  }
}

export function saveReadNotificationIds(set) {
  try {
    sessionStorage.setItem(READ_KEY, JSON.stringify([...set].slice(-200)))
  } catch {
    // ignore
  }
}
