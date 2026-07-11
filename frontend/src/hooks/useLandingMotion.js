import { useEffect, useRef, useState } from 'react'

/** Animate a number once when `active` becomes true — no reset jitter. */
export function useCountUp(target, { active = false, duration = 1800, decimals = 0 } = {}) {
  const [value, setValue] = useState(0)
  const finished = useRef(false)

  useEffect(() => {
    if (!active || finished.current) return undefined
    const start = performance.now()
    let frame = 0
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - (1 - t) ** 3
      setValue(target * eased)
      if (t < 1) {
        frame = requestAnimationFrame(tick)
      } else {
        finished.current = true
        setValue(target)
      }
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [active, target, duration])

  return decimals > 0 ? value.toFixed(decimals) : Math.round(value)
}

/**
 * Advance through steps without shrinking the list (prevents layout jump).
 * Does not loop — runs once per visibility.
 */
export function useStepIndex(steps, { active = false, interval = 1400 } = {}) {
  const [index, setIndex] = useState(-1)
  const started = useRef(false)

  useEffect(() => {
    if (!active) return undefined
    if (started.current) return undefined
    started.current = true
    setIndex(0)
    const id = window.setInterval(() => {
      setIndex((i) => {
        if (i >= steps.length - 1) {
          window.clearInterval(id)
          return i
        }
        return i + 1
      })
    }, interval)
    return () => window.clearInterval(id)
  }, [active, steps.length, interval])

  return index
}

/** Typewriter — fixed width container recommended. Runs once. */
export function useTypewriter(text, { active = false, speed = 38 } = {}) {
  const [out, setOut] = useState('')
  const started = useRef(false)

  useEffect(() => {
    if (!active || started.current) return undefined
    started.current = true
    let i = 0
    const id = window.setInterval(() => {
      i += 1
      setOut(text.slice(0, i))
      if (i >= text.length) window.clearInterval(id)
    }, speed)
    return () => window.clearInterval(id)
  }, [active, text, speed])

  return out
}
