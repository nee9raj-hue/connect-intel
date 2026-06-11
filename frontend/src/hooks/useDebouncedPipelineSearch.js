import { useEffect, useRef } from 'react'

/** Debounce pipeline search — 300ms, applies when empty or ≥2 characters. */
export function useDebouncedPipelineSearch(search, onApply, { delayMs = 300, minChars = 2 } = {}) {
  const onApplyRef = useRef(onApply)
  onApplyRef.current = onApply

  useEffect(() => {
    const q = String(search || '').trim()
    if (q.length === 1) return undefined
    const timer = window.setTimeout(() => {
      onApplyRef.current?.(q)
    }, delayMs)
    return () => window.clearTimeout(timer)
  }, [search, delayMs, minChars])
}
