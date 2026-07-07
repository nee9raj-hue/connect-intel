import { useEffect, useState } from 'react'

const FAB = 56
const GAP = 12
const MARGIN = 16

function safeBottomInset() {
  if (typeof window === 'undefined') return 0
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue('env(safe-area-inset-bottom)')
    const n = parseFloat(v)
    return Number.isFinite(n) ? n : 0
  } catch {
    return 0
  }
}

/**
 * Keeps the CRM AI FAB clear of mobile nav pill, pipeline bulk bar, and safe areas.
 */
export default function useCrmAiFabLayout({
  enabled = true,
  isMobile = false,
  mobilePillVisible = false,
} = {}) {
  const [layout, setLayout] = useState(() => ({
    bottom: 24,
    right: 20,
    shiftUp: false,
  }))

  useEffect(() => {
    if (!enabled) return undefined

    const compute = () => {
      const inset = safeBottomInset()
      let bottom = MARGIN + inset
      let right = MARGIN
      let shiftUp = false

      if (isMobile) {
        right = 14
        bottom = 14 + inset
        if (mobilePillVisible) {
          bottom = 78 + inset
        }
      } else {
        bottom = 22 + inset
        right = 22
      }

      const bulk = document.querySelector('.pipeline-bulk-floating')
      if (bulk) {
        const rect = bulk.getBoundingClientRect()
        const clearance = window.innerHeight - rect.top + GAP
        if (clearance > bottom) {
          bottom = clearance
          shiftUp = true
        }
      }

      const emailDock = document.querySelector('.email-send-dock:not(.is-minimized)')
      if (emailDock && !isMobile) {
        const rect = emailDock.getBoundingClientRect()
        if (rect.right > window.innerWidth - FAB - right - GAP) {
          bottom = Math.max(bottom, window.innerHeight - rect.top + GAP)
          shiftUp = true
        }
      }

      const maxBottom = window.innerHeight - FAB - MARGIN
      bottom = Math.min(Math.max(bottom, MARGIN + inset), maxBottom)

      setLayout({ bottom, right, shiftUp })
    }

    compute()
    window.addEventListener('resize', compute)
    const observer = new MutationObserver(() => compute())
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style'],
    })
    const interval = setInterval(compute, 1200)

    return () => {
      window.removeEventListener('resize', compute)
      observer.disconnect()
      clearInterval(interval)
    }
  }, [enabled, isMobile, mobilePillVisible])

  return layout
}
