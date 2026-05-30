import { useEffect, useState } from 'react'
import useIsMobile from './useIsMobile'
import { isPwaStandalone } from '../lib/pwaInstall'

/** Mobile list filter sheet + compact pipeline chrome (viewport or installed PWA). */
export default function usePipelineFilterMobile(breakpointPx = 768) {
  const narrowViewport = useIsMobile(breakpointPx)
  const [standalone, setStandalone] = useState(false)

  useEffect(() => {
    setStandalone(isPwaStandalone())
    const mq = window.matchMedia('(display-mode: standalone), (display-mode: fullscreen)')
    const onChange = () => setStandalone(isPwaStandalone())
    mq.addEventListener?.('change', onChange)
    return () => mq.removeEventListener?.('change', onChange)
  }, [])

  return narrowViewport || standalone
}
