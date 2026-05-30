import { isPwaStandalone } from './pwaInstall'

function isNativeAppShell() {
  if (typeof window === 'undefined') return false
  return Boolean(window.Capacitor?.isNativePlatform?.())
}

/** Desktop browser only — hidden on mobile, installed PWA, and native app shells. */
export function shouldShowConnectAssistant(isMobile) {
  if (typeof window === 'undefined') return false
  if (isMobile) return false
  if (isNativeAppShell()) return false
  if (isPwaStandalone()) return false
  return true
}
