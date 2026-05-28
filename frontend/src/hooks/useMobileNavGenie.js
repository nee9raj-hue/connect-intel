import { useEffect, useState } from 'react'

const SCROLL_ROOTS =
  '.panel-body-scroll, .crm-content-scroll, .crm-page-body, .crm-drawer-body, .dashboard-page-body'
const THRESHOLD = 8
const TOP_ALWAYS_SHOW = 20

function scrollRootFromTarget(target) {
  if (!(target instanceof Element)) return null
  if (target.matches(SCROLL_ROOTS)) return target
  return target.closest(SCROLL_ROOTS)
}

/**
 * Swiggy-style mobile bottom nav: show when user scrolls down, hide when scrolling up.
 */
export default function useMobileNavGenie(enabled) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    if (!enabled) {
      setVisible(true)
      return undefined
    }

    const lastYByRoot = new WeakMap()

    const onScroll = (event) => {
      const root = scrollRootFromTarget(event.target)
      if (!root) return

      const y = root.scrollTop
      const lastY = lastYByRoot.get(root) ?? y
      lastYByRoot.set(root, y)

      if (y <= TOP_ALWAYS_SHOW) {
        setVisible(true)
        return
      }

      if (y > lastY + THRESHOLD) {
        setVisible(true)
      } else if (y < lastY - THRESHOLD) {
        setVisible(false)
      }
    }

    document.addEventListener('scroll', onScroll, { capture: true, passive: true })
    return () => document.removeEventListener('scroll', onScroll, { capture: true })
  }, [enabled])

  return visible
}
