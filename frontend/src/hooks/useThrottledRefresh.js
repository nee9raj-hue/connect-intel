import { useCallback, useEffect, useRef, useState } from 'react'
import { useUsagePolicies } from './useUsagePolicies.js'

function formatMomentsAgo(ms) {
  if (ms < 5000) return 'Updated moments ago'
  const sec = Math.floor(ms / 1000)
  if (sec < 60) return `Updated ${sec}s ago`
  const min = Math.floor(sec / 60)
  return min === 1 ? 'Updated 1 min ago' : `Updated ${min} min ago`
}

/**
 * Throttle dashboard-style refetches; surfaces friendly "Updated moments ago" copy.
 */
export function useThrottledRefresh(fetcher, { enabled = true, deps = [] } = {}) {
  const policies = useUsagePolicies()
  const minMs = policies.dashboardRefreshMinMs ?? 60_000
  const lastFetchRef = useRef(0)
  const [freshnessLabel, setFreshnessLabel] = useState(null)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(
    async (force = false) => {
      if (!enabled) return undefined
      const now = Date.now()
      const elapsed = now - lastFetchRef.current
      if (!force && lastFetchRef.current && elapsed < minMs) {
        setFreshnessLabel(formatMomentsAgo(elapsed))
        return undefined
      }
      setLoading(true)
      setFreshnessLabel(null)
      try {
        const result = await fetcher()
        lastFetchRef.current = Date.now()
        setFreshnessLabel('Updated moments ago')
        return result
      } finally {
        setLoading(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enabled, minMs, fetcher, ...deps]
  )

  useEffect(() => {
    if (!enabled) return undefined
    void refresh(true)
  }, [enabled, refresh])

  useEffect(() => {
    if (!freshnessLabel || !lastFetchRef.current) return undefined
    const tick = setInterval(() => {
      const elapsed = Date.now() - lastFetchRef.current
      if (elapsed < minMs) setFreshnessLabel(formatMomentsAgo(elapsed))
    }, 15_000)
    return () => clearInterval(tick)
  }, [freshnessLabel, minMs])

  return { refresh, loading, freshnessLabel }
}
