import { Capacitor } from '@capacitor/core'
import { isPwaStandalone } from './pwaInstall'

/** Desktop browser only — hidden on mobile, installed PWA, and native app shells. */
export function shouldShowConnectAssistant(isMobile) {
  if (typeof window === 'undefined') return false
  if (isMobile) return false
  if (Capacitor.isNativePlatform()) return false
  if (isPwaStandalone()) return false
  return true
}
