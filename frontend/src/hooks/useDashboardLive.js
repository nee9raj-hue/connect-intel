import { useEffect, useRef } from 'react'
import { api } from '../lib/api'

/** Poll dashboard snapshot version; call onStale when backend data changes. */
export function useDashboardLive({ enabled = true, onStale, intervalMs = 25_000 } = {}) {
  const versionRef = useRef(null)
  const onStaleRef = useRef(onStale)
  onStaleRef.current = onStale

  useEffect(() => {
    if (!enabled) return undefined

    let cancelled = false

    const poll = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      try {
        const res = await api.getDashboardPulse()
        if (cancelled) return
        const next = res?.version
        if (versionRef.current && next && versionRef.current !== next) {
          onStaleRef.current?.()
        }
        if (next) versionRef.current = next
      } catch {
        /* ignore pulse errors */
      }
    }

    poll()
    const timer = setInterval(poll, intervalMs)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [enabled, intervalMs])
}
