let pending = 0
const listeners = new Set()

function notify() {
  listeners.forEach((cb) => cb(pending > 0))
}

export function subscribeApiLoading(listener) {
  listeners.add(listener)
  listener(pending > 0)
  return () => listeners.delete(listener)
}

export function isApiLoading() {
  return pending > 0
}

export function trackApiLoading(promise) {
  pending += 1
  notify()
  return Promise.resolve(promise).finally(() => {
    pending = Math.max(0, pending - 1)
    notify()
  })
}
