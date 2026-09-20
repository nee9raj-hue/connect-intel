const RECOVERY_KEY = 'ci_deploy_recovery'
const MAX_AUTO_RECOVERIES = 2

export function isStaleAssetError(message) {
  const m = String(message || '').toLowerCase()
  return (
    m.includes('importing a module script failed') ||
    m.includes('failed to fetch dynamically imported module') ||
    m.includes('error loading dynamically imported module') ||
    m.includes('unable to preload css') ||
    m.includes('dynamically imported module') ||
    m.includes('pipelinedealsview is not defined') ||
    (m.includes(' is not defined') && m.includes('pipeline'))
  )
}

function recoveryCount() {
  try {
    return Number(sessionStorage.getItem(RECOVERY_KEY) || 0) || 0
  } catch {
    return MAX_AUTO_RECOVERIES
  }
}

export function canAutoRecover() {
  return recoveryCount() < MAX_AUTO_RECOVERIES
}

export async function clearPwaCachesAndReload() {
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

  const url = new URL(window.location.href)
  url.searchParams.set('_ci', String(Date.now()))
  window.location.replace(url.href)
}

export function tryAutoRecover(message) {
  if (!isStaleAssetError(message)) return false
  if (!canAutoRecover()) return false
  try {
    sessionStorage.setItem(RECOVERY_KEY, String(recoveryCount() + 1))
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
    window.setTimeout(() => {
      try {
        sessionStorage.removeItem(RECOVERY_KEY)
      } catch {
        // ignore
      }
    }, 8_000)
  })
}
