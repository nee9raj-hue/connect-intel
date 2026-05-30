import { useEffect, useState } from 'react'
import { isPwaStandalone } from '../lib/pwaInstall'
import useIsMobile from './useIsMobile'

/** Pipeline filter icon menus use a full page on phone viewports and installed PWA. */
export default function useFullPageFilterMenus() {
  const isMobile = useIsMobile()
  const [standalone, setStandalone] = useState(() =>
    typeof window !== 'undefined' ? isPwaStandalone() : false
  )

  useEffect(() => {
    const sync = () => setStandalone(isPwaStandalone())
    sync()
    const modes = ['standalone', 'fullscreen'].map((m) => window.matchMedia(`(display-mode: ${m})`))
    modes.forEach((mq) => mq.addEventListener('change', sync))
    return () => modes.forEach((mq) => mq.removeEventListener('change', sync))
  }, [])

  return isMobile || standalone
}
