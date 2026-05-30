import { useCallback, useEffect, useRef, useState } from 'react'

function cloneBuilderValue(v) {
  return JSON.parse(JSON.stringify(v))
}

/**
 * Undo/redo stack for marketing email builder value snapshots.
 */
export default function useMarketingBuilderHistory(value, onChange, enabled, resetKey = '') {
  const stackRef = useRef([])
  const indexRef = useRef(-1)
  const lastResetKey = useRef(resetKey)
  const [, setTick] = useState(0)

  const bump = () => setTick((t) => t + 1)

  useEffect(() => {
    if (!enabled) return
    if (lastResetKey.current === resetKey && stackRef.current.length > 0) return
    lastResetKey.current = resetKey
    stackRef.current = [cloneBuilderValue(value)]
    indexRef.current = 0
    bump()
    // Only re-seed when resetKey changes (campaign step, template id, etc.)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, resetKey])

  const applyChange = useCallback(
    (next, { record = true } = {}) => {
      if (!enabled) {
        onChange(next)
        return
      }
      if (record) {
        const stack = stackRef.current.slice(0, indexRef.current + 1)
        stack.push(cloneBuilderValue(next))
        if (stack.length > 60) stack.shift()
        stackRef.current = stack
        indexRef.current = stack.length - 1
        bump()
      }
      onChange(next)
    },
    [enabled, onChange]
  )

  const undo = useCallback(() => {
    if (!enabled || indexRef.current <= 0) return
    indexRef.current -= 1
    onChange(cloneBuilderValue(stackRef.current[indexRef.current]))
    bump()
  }, [enabled, onChange])

  const redo = useCallback(() => {
    if (!enabled || indexRef.current >= stackRef.current.length - 1) return
    indexRef.current += 1
    onChange(cloneBuilderValue(stackRef.current[indexRef.current]))
    bump()
  }, [enabled, onChange])

  const canUndo = enabled && indexRef.current > 0
  const canRedo = enabled && indexRef.current < stackRef.current.length - 1

  return { applyChange, undo, redo, canUndo, canRedo }
}
