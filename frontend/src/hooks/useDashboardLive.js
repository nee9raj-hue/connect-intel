import { useEffect, useRef } from 'react'
import { api } from '../lib/api'

/** Live dashboard updates via SSE (fetch stream) with poll fallback. */
export function useDashboardLive({ enabled = true, onStale, intervalMs = 25_000 } = {}) {
  const versionRef = useRef(null)
  const onStaleRef = useRef(onStale)
  onStaleRef.current = onStale

  useEffect(() => {
    if (!enabled) return undefined

    let cancelled = false
    let reconnectTimer = null
    const abort = new AbortController()

    const handlePulse = (pulse) => {
      const next = pulse?.version
      if (versionRef.current && next && versionRef.current !== next) {
        onStaleRef.current?.()
      }
      if (next) versionRef.current = next
    }

    const poll = async () => {
      if (cancelled || (typeof document !== 'undefined' && document.visibilityState === 'hidden')) return
      try {
        const res = await api.getDashboardPulse()
        if (!cancelled) handlePulse(res)
      } catch {
        /* ignore */
      }
    }

    const scheduleReconnect = () => {
      if (cancelled) return
      reconnectTimer = setTimeout(connectStream, 2000)
    }

    const connectStream = async () => {
      if (cancelled || (typeof document !== 'undefined' && document.visibilityState === 'hidden')) {
        scheduleReconnect()
        return
      }
      try {
        await api.subscribeDashboardPulse({
          signal: abort.signal,
          onPulse: (pulse) => {
            if (!cancelled) handlePulse(pulse)
          },
        })
      } catch {
        /* stream ended — poll fallback continues */
      }
      if (!cancelled) scheduleReconnect()
    }

    poll()
    connectStream()
    const timer = setInterval(poll, intervalMs)

    return () => {
      cancelled = true
      abort.abort()
      clearInterval(timer)
      if (reconnectTimer) clearTimeout(reconnectTimer)
    }
  }, [enabled, intervalMs])
}
