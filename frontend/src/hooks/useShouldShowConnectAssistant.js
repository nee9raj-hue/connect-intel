import { useEffect, useState } from 'react'
import { isPwaStandalone } from '../lib/pwaInstall'
import useIsMobile from './useIsMobile'

function isNativeAppShell() {
  if (typeof window === 'undefined') return false
  return Boolean(window.Capacitor?.isNativePlatform?.())
}

/**
 * CRM assistant FAB — desktop browser tab only.
 * Hidden on mobile, installed PWA (any screen size), and native shells.
 */
export default function useShouldShowConnectAssistant() {
  const isMobile = useIsMobile()
  const [standalone, setStandalone] = useState(() =>
    typeof window !== 'undefined' ? isPwaStandalone() : false
  )
  const [nativeShell, setNativeShell] = useState(false)

  useEffect(() => {
    const sync = () => setStandalone(isPwaStandalone())
    sync()
    setNativeShell(isNativeAppShell())
    const modes = ['standalone', 'fullscreen', 'minimal-ui'].map((m) =>
      window.matchMedia(`(display-mode: ${m})`)
    )
    modes.forEach((mq) => mq.addEventListener('change', sync))
    return () => modes.forEach((mq) => mq.removeEventListener('change', sync))
  }, [])

  if (typeof window === 'undefined') return false
  if (isMobile || standalone || nativeShell) return false
  return true
}
