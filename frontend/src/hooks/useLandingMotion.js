import { useEffect, useState } from 'react'

/** Animate a number when `active` becomes true. */
export function useCountUp(target, { active = false, duration = 1800, decimals = 0 } = {}) {
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (!active) {
      setValue(0)
      return undefined
    }
    const start = performance.now()
    let frame = 0
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - (1 - t) ** 3
      setValue(target * eased)
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [active, target, duration])

  return decimals > 0 ? value.toFixed(decimals) : Math.round(value)
}

/** Cycle through steps when section is visible. */
export function useStepCycle(steps, { active = false, interval = 1400, loop = true } = {}) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (!active || steps.length === 0) return undefined
    const id = window.setInterval(() => {
      setIndex((i) => {
        if (i >= steps.length - 1) return loop ? 0 : i
        return i + 1
      })
    }, interval)
    return () => window.clearInterval(id)
  }, [active, steps.length, interval, loop])

  useEffect(() => {
    if (active) setIndex(0)
  }, [active])

  return { index, visibleSteps: steps.slice(0, index + 1), current: steps[index] }
}

/** Typewriter effect for demo query. */
export function useTypewriter(text, { active = false, speed = 38 } = {}) {
  const [out, setOut] = useState('')

  useEffect(() => {
    if (!active) {
      setOut('')
      return undefined
    }
    let i = 0
    setOut('')
    const id = window.setInterval(() => {
      i += 1
      setOut(text.slice(0, i))
      if (i >= text.length) window.clearInterval(id)
    }, speed)
    return () => window.clearInterval(id)
  }, [active, text, speed])

  return out
}
