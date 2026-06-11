import { useEffect, useRef } from 'react'

/**
 * Intersection-observer sentinel for pipeline infinite scroll.
 */
export default function PipelineInfiniteSentinel({
  enabled = true,
  hasMore = false,
  loading = false,
  onLoadMore,
  total = null,
  rootMargin = '200px',
}) {
  const ref = useRef(null)

  useEffect(() => {
    if (!enabled || !hasMore || loading) return undefined
    const node = ref.current
    if (!node) return undefined
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) onLoadMore?.()
      },
      { rootMargin }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [enabled, hasMore, loading, onLoadMore, rootMargin])

  if (!enabled) return null

  return (
    <div ref={ref} className="pipeline-infinite-sentinel" aria-hidden>
      {loading || hasMore ? (
        <p className="pipeline-infinite-hint">{loading ? 'Loading more leads…' : 'Scroll for more leads…'}</p>
      ) : (
        <p className="pipeline-infinite-done">
          {total != null ? `All ${total.toLocaleString()} leads loaded` : 'All leads loaded'}
        </p>
      )}
    </div>
  )
}
