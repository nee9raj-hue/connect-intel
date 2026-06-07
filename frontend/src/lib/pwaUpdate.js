let applyUpdateFn = null
let updatePending = false

export function bindPwaUpdate(applyUpdate) {
  applyUpdateFn = applyUpdate
}

export function isPwaUpdatePending() {
  return updatePending
}

export function markPwaUpdatePending() {
  updatePending = true
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ci-pwa-update'))
  }
}

export function applyPwaUpdate() {
  if (applyUpdateFn) applyUpdateFn(true)
}
