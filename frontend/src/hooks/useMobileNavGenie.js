import { useEffect, useState } from 'react'

const SCROLL_ROOTS =
  '.panel-body-scroll, .crm-content-scroll, .crm-page-body, .crm-drawer-body, .dashboard-page-body'
const THRESHOLD = 8
const TOP_SHOW_NAV = 16

function scrollRootFromTarget(target) {
  if (!(target instanceof Element)) return null
  if (target.matches(SCROLL_ROOTS)) return target
  return target.closest(SCROLL_ROOTS)
}

/**
 * Mobile bottom nav: hide while scrolling down (stays hidden), show when user scrolls up.
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

      if (y <= TOP_SHOW_NAV) {
        setVisible(true)
        return
      }

      if (y > lastY + THRESHOLD) {
        setVisible(false)
      } else if (y < lastY - THRESHOLD) {
        setVisible(true)
      }
    }

    document.addEventListener('scroll', onScroll, { capture: true, passive: true })
    return () => document.removeEventListener('scroll', onScroll, { capture: true })
  }, [enabled])

  return visible
}
