const RECOVERY_KEY = 'ci_deploy_recovery'

export function isStaleAssetError(message) {
  const m = String(message || '').toLowerCase()
  return (
    m.includes('importing a module script failed') ||
    m.includes('failed to fetch dynamically imported module') ||
    m.includes('error loading dynamically imported module') ||
    m.includes('unable to preload css') ||
    m.includes('dynamically imported module') ||
    m.includes('pipelinedealsview is not defined') ||
    m.includes('networkerror') ||
    m.includes('failed to fetch') ||
    m.includes('fetch resource')
  )
}

export function canAutoRecover() {
  return false
}

export async function uninstallServiceWorkers() {
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
}

export async function clearPwaCachesAndReload() {
  await uninstallServiceWorkers()
  try {
    sessionStorage.removeItem(RECOVERY_KEY)
  } catch {
    // ignore
  }
  const url = new URL(window.location.href)
  url.searchParams.delete('_ci')
  window.location.replace(url.pathname + url.search + url.hash)
}

export function tryAutoRecover() {
  return false
}

/** Unregister leftover service workers without reloading the tab. */
export function initDeployRecovery() {
  if (typeof window === 'undefined') return
  void uninstallServiceWorkers()
}
