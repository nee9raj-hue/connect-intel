import { useEffect, useRef } from 'react'

/** Debounce pipeline search — 300ms for ≥2 chars; longer idle before clearing to unfiltered. */
export function useDebouncedPipelineSearch(
  search,
  onApply,
  { delayMs = 300, minChars = 2, clearDelayMs = 700 } = {}
) {
  const onApplyRef = useRef(onApply)
  onApplyRef.current = onApply

  useEffect(() => {
    const q = String(search || '').trim()
    if (q.length > 0 && q.length < minChars) return undefined
    const wait = q.length === 0 ? Math.max(delayMs, clearDelayMs) : delayMs
    const timer = window.setTimeout(() => {
      onApplyRef.current?.(q)
    }, wait)
    return () => window.clearTimeout(timer)
  }, [search, delayMs, minChars, clearDelayMs])
}
