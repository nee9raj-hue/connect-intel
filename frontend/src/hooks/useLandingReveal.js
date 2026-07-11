import { useEffect, useRef, useState } from 'react'

/** Lightweight scroll reveal — CSS handles motion; observer toggles `.is-visible`. */
export function useLandingReveal({ threshold = 0.12, rootMargin = '0px 0px -6% 0px', once = true } = {}) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return undefined

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        setVisible(true)
        if (once) observer.disconnect()
      },
      { threshold, rootMargin },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold, rootMargin, once])

  return [ref, visible]
}

/** Hero dashboard morph phases while scrolling the first viewport. */
export function useHeroScrollPhase() {
  const [phase, setPhase] = useState(0)

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY
      const unit = Math.max(window.innerHeight * 0.22, 120)
      const next = Math.min(3, Math.floor(y / unit))
      setPhase(next)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return phase
}
