import { useCallback, useEffect, useRef, useState } from 'react'

const STORAGE_KEY = 'ci_desktop_nav_pill_v2'
const MARGIN = 12
export const DOCK_MIN_WIDTH = 300
export const DOCK_DEFAULT_WIDTH = 520
export const DOCK_MAX_WIDTH = 960
const DOCK_HEIGHT_ESTIMATE = 72

/** Horizontal chrome: arrows, padding, resize handle (px). */
const WIDTH_CHROME = 98
/** Min width per icon + label slot (px). */
const SLOT_WIDTH = 80

function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return readLegacyPos()
    const data = JSON.parse(raw)
    if (typeof data.x !== 'number' || typeof data.y !== 'number') return readLegacyPos()
    return {
      x: data.x,
      y: data.y,
      width:
        typeof data.width === 'number'
          ? clampWidth(data.width)
          : DOCK_DEFAULT_WIDTH,
      userPlaced: Boolean(data.userPlaced),
      userSized: Boolean(data.userSized),
      minimized: Boolean(data.minimized),
    }
  } catch {
    return readLegacyPos()
  }
}

function readLegacyPos() {
  try {
    const raw = localStorage.getItem('ci_desktop_nav_pill_pos_v1')
    if (!raw) return null
    const data = JSON.parse(raw)
    if (typeof data.x !== 'number' || typeof data.y !== 'number') return null
    return {
      x: data.x,
      y: data.y,
      width: DOCK_DEFAULT_WIDTH,
      userPlaced: Boolean(data.userPlaced),
      userSized: false,
      minimized: false,
    }
  } catch {
    return null
  }
}

function writeStored(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // ignore
  }
}

export function clampWidth(w) {
  return Math.max(DOCK_MIN_WIDTH, Math.min(DOCK_MAX_WIDTH, Math.round(w)))
}

export function slotsForWidth(width, totalItems) {
  const inner = clampWidth(width) - WIDTH_CHROME
  const slots = Math.max(1, Math.floor(inner / SLOT_WIDTH))
  return Math.min(totalItems, slots)
}

function defaultTopCenter(width) {
  const vw = window.innerWidth
  return {
    x: Math.max(MARGIN, Math.round((vw - width) / 2)),
    y: MARGIN + 4,
  }
}

function clampPosition(pos, width) {
  const vw = window.innerWidth
  const vh = window.innerHeight
  return {
    x: Math.max(MARGIN, Math.min(pos.x, vw - width - MARGIN)),
    y: Math.max(MARGIN, Math.min(pos.y, vh - DOCK_HEIGHT_ESTIMATE - MARGIN)),
  }
}

/**
 * Draggable + resizable desktop quick-nav dock.
 */
export default function useDesktopNavDock(enabled = true) {
  const dockRef = useRef(null)
  const stored = readStored()
  const [width, setWidth] = useState(stored?.width ?? DOCK_DEFAULT_WIDTH)
  const [pos, setPos] = useState(() => {
    const w = stored?.width ?? DOCK_DEFAULT_WIDTH
    if (stored?.userPlaced) return { x: stored.x, y: stored.y }
    return defaultTopCenter(w)
  })
  const [userPlaced, setUserPlaced] = useState(() => Boolean(stored?.userPlaced))
  const [userSized, setUserSized] = useState(() => Boolean(stored?.userSized))
  const [minimized, setMinimized] = useState(() => Boolean(stored?.minimized))
  const dragRef = useRef(null)
  const resizeRef = useRef(null)

  const persist = useCallback(
    (nextPos, nextWidth, placed = userPlaced, sized = userSized, nextMinimized = minimized) => {
      writeStored({
        x: nextPos.x,
        y: nextPos.y,
        width: nextWidth,
        userPlaced: placed,
        userSized: sized,
        minimized: nextMinimized,
      })
    },
    [userPlaced, userSized, minimized]
  )

  const setMinimizedPersisted = useCallback(
    (next) => {
      setMinimized(next)
      persist(pos, width, userPlaced, userSized, next)
    },
    [persist, pos, width, userPlaced, userSized]
  )

  useEffect(() => {
    if (!enabled) return undefined
    const onResize = () => {
      setPos((prev) => {
        if (userPlaced) return clampPosition(prev, width)
        return defaultTopCenter(width)
      })
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [enabled, userPlaced, width])

  useEffect(() => {
    if (!enabled) return
    setPos((prev) => (userPlaced ? clampPosition(prev, width) : defaultTopCenter(width)))
  }, [enabled, width, userPlaced])

  const onDragHandlePointerDown = useCallback(
    (e) => {
      if (!enabled || e.button !== 0) return
      e.preventDefault()
      const startX = e.clientX
      const startY = e.clientY
      const origin = { ...pos }
      dragRef.current = { startX, startY, origin }

      const onMove = (ev) => {
        if (!dragRef.current) return
        const dx = ev.clientX - dragRef.current.startX
        const dy = ev.clientY - dragRef.current.startY
        setPos(
          clampPosition(
            { x: dragRef.current.origin.x + dx, y: dragRef.current.origin.y + dy },
            width
          )
        )
      }

      const onUp = (ev) => {
        document.removeEventListener('pointermove', onMove)
        document.removeEventListener('pointerup', onUp)
        document.removeEventListener('pointercancel', onUp)
        if (!dragRef.current) return
        const dx = ev.clientX - dragRef.current.startX
        const dy = ev.clientY - dragRef.current.startY
        const next = clampPosition(
          { x: dragRef.current.origin.x + dx, y: dragRef.current.origin.y + dy },
          width
        )
        dragRef.current = null
        setUserPlaced(true)
        setPos(next)
        persist(next, width, true, userSized, minimized)
      }

      document.addEventListener('pointermove', onMove)
      document.addEventListener('pointerup', onUp)
      document.addEventListener('pointercancel', onUp)
    },
    [enabled, pos, width, persist, userSized, minimized]
  )

  const onResizeHandlePointerDown = useCallback(
    (e) => {
      if (!enabled || e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()
      const startX = e.clientX
      const startW = width
      resizeRef.current = { startX, startW }

      const onMove = (ev) => {
        if (!resizeRef.current) return
        const nextW = clampWidth(resizeRef.current.startW + (ev.clientX - resizeRef.current.startX))
        setWidth(nextW)
        setPos((prev) => (userPlaced ? clampPosition(prev, nextW) : defaultTopCenter(nextW)))
      }

      const onUp = (ev) => {
        document.removeEventListener('pointermove', onMove)
        document.removeEventListener('pointerup', onUp)
        document.removeEventListener('pointercancel', onUp)
        if (!resizeRef.current) return
        const nextW = clampWidth(resizeRef.current.startW + (ev.clientX - resizeRef.current.startX))
        resizeRef.current = null
        setUserSized(true)
        setWidth(nextW)
        setPos((prev) => {
          const next = userPlaced ? clampPosition(prev, nextW) : defaultTopCenter(nextW)
          persist(next, nextW, userPlaced, true, minimized)
          return next
        })
      }

      document.addEventListener('pointermove', onMove)
      document.addEventListener('pointerup', onUp)
      document.addEventListener('pointercancel', onUp)
    },
    [enabled, width, userPlaced, persist, minimized]
  )

  return {
    dockRef,
    pos,
    width,
    minimized,
    setMinimized: setMinimizedPersisted,
    onDragHandlePointerDown,
    onResizeHandlePointerDown,
  }
}
