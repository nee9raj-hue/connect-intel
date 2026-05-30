import { useEffect, useRef } from 'react'
import { playChithiMessageSound } from '../lib/chithiSound'

import { isChithiPanel } from '../lib/chithiNav'

export default function useChithiAlerts({ enabled, activePanel, chithiUnread, refreshChithiUnread }) {
  const prevTotalRef = useRef(null)
  const primedRef = useRef(false)

  useEffect(() => {
    if (!enabled) return undefined
    void refreshChithiUnread?.()
    const id = window.setInterval(() => {
      void refreshChithiUnread?.()
    }, 30_000)
    return () => window.clearInterval(id)
  }, [enabled, refreshChithiUnread])

  useEffect(() => {
    if (!enabled) return
    const total = chithiUnread?.total ?? 0
    if (!primedRef.current) {
      primedRef.current = true
      prevTotalRef.current = total
      return
    }
    const prev = prevTotalRef.current ?? 0
    prevTotalRef.current = total
    if (total <= prev) return
    if (isChithiPanel(activePanel)) return
    playChithiMessageSound()
  }, [enabled, activePanel, chithiUnread?.total])
}
