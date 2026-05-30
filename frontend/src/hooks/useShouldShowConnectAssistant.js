import { useEffect, useState } from 'react'
import useFullPageFilterMenus from './useFullPageFilterMenus'

function isNativeAppShell() {
  if (typeof window === 'undefined') return false
  return Boolean(window.Capacitor?.isNativePlatform?.())
}

/**
 * CRM assistant FAB — desktop browser tab only.
 * Hidden on mobile, installed PWA (any screen size), and native shells.
 */
export default function useShouldShowConnectAssistant() {
  const compactAppChrome = useFullPageFilterMenus()
  const [nativeShell, setNativeShell] = useState(false)

  useEffect(() => {
    setNativeShell(isNativeAppShell())
  }, [])

  if (typeof window === 'undefined') return false
  return !compactAppChrome && !nativeShell
}
