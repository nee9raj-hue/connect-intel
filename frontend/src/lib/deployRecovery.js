const RECOVERY_KEY = 'ci_deploy_recovery'

export function isStaleAssetError(message) {
  const m = String(message || '').toLowerCase()
  return (
    m.includes('importing a module script failed') ||
    m.includes('failed to fetch dynamically imported module') ||
    m.includes('error loading dynamically imported module') ||
    m.includes('unable to preload css') ||
    m.includes('dynamically imported module')
  )
}

export async function clearPwaCachesAndReload() {
  try {
    sessionStorage.removeItem(RECOVERY_KEY)
  } catch {
    // ignore
  }

  if ('serviceWorker' in navigator) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map((reg) => reg.unregister()))
    } catch {
      // ignore
    }
  }

  if ('caches' in window) {
    try {
      const keys = await caches.keys()
      await Promise.all(keys.map((key) => caches.delete(key)))
    } catch {
      // ignore
    }
  }

  window.location.reload()
}

function tryAutoRecover(message) {
  if (!isStaleAssetError(message)) return false
  if (sessionStorage.getItem(RECOVERY_KEY)) return false
  try {
    sessionStorage.setItem(RECOVERY_KEY, '1')
  } catch {
    return false
  }
  void clearPwaCachesAndReload()
  return true
}

/** Recover from stale PWA caches after production deploys. */
export function initDeployRecovery() {
  if (typeof window === 'undefined') return

  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault()
    tryAutoRecover('failed to fetch dynamically imported module')
  })

  window.addEventListener('error', (event) => {
    tryAutoRecover(event.message)
  })

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    tryAutoRecover(reason?.message || String(reason || ''))
  })

  window.addEventListener('load', () => {
    try {
      sessionStorage.removeItem(RECOVERY_KEY)
    } catch {
      // ignore
    }
  })
}
