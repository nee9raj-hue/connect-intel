import { isPwaStandalone } from './pwaInstall'

function isNativeAppShell() {
  if (typeof window === 'undefined') return false
  return Boolean(window.Capacitor?.isNativePlatform?.())
}

/** @deprecated use useShouldShowConnectAssistant — sync check for tests */
export function shouldShowConnectAssistant(isMobile) {
  if (typeof window === 'undefined') return false
  if (isMobile) return false
  if (isNativeAppShell()) return false
  if (isPwaStandalone()) return false
  return true
}
