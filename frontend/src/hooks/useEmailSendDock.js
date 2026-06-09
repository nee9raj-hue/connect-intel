import { useCallback, useEffect, useRef, useState } from 'react'

const STORAGE_KEY = 'ci_email_send_dock_v1'
const MARGIN = 8
const DOCK_WIDTH = 228
const DOCK_HEIGHT = 40
const DOCK_BOTTOM = 132

function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (typeof data.x !== 'number' || typeof data.y !== 'number') return null
    return {
      x: data.x,
      y: data.y,
      userPlaced: Boolean(data.userPlaced),
      minimized: Boolean(data.minimized),
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

export function sidebarWidthPx(sidebarMode, isMobile) {
  if (isMobile) return 0
  return sidebarMode === 'rail' ? 64 : 248
}

export function dockedLeftPosition(sidebarMode, isMobile, pillWidth = 52) {
  const sidebarW = sidebarWidthPx(sidebarMode, isMobile)
  if (!sidebarW) return { left: MARGIN, bottom: DOCK_BOTTOM }
  return {
    left: Math.max(MARGIN, Math.round((sidebarW - pillWidth) / 2)),
    bottom: DOCK_BOTTOM,
  }
}

function clampFloating(pos) {
  const vw = window.innerWidth
  const vh = window.innerHeight
  return {
    x: Math.max(MARGIN, Math.min(pos.x, vw - DOCK_WIDTH - MARGIN)),
    y: Math.max(MARGIN, Math.min(pos.y, vh - DOCK_HEIGHT - MARGIN)),
  }
}

function defaultFloating(sidebarMode, isMobile) {
  const sidebarW = sidebarWidthPx(sidebarMode, isMobile)
  return clampFloating({
    x: sidebarW + MARGIN + 4,
    y: MARGIN + 56,
  })
}

export default function useEmailSendDock(enabled, { sidebarMode = 'rail', isMobile = false } = {}) {
  const stored = readStored()
  const [minimized, setMinimizedState] = useState(() => Boolean(stored?.minimized))
  const [pos, setPos] = useState(() => {
    if (stored?.userPlaced && !stored?.minimized) {
      return { x: stored.x, y: stored.y }
    }
    return defaultFloating(sidebarMode, isMobile)
  })
  const [userPlaced, setUserPlaced] = useState(() => Boolean(stored?.userPlaced && !stored?.minimized))
  const dragRef = useRef(null)

  const persist = useCallback(
    (nextPos, placed, nextMinimized) => {
      writeStored({
        x: nextPos.x,
        y: nextPos.y,
        userPlaced: placed,
        minimized: nextMinimized,
      })
    },
    []
  )

  const setMinimized = useCallback(
    (next) => {
      setMinimizedState(next)
      persist(pos, userPlaced, next)
    },
    [persist, pos, userPlaced]
  )

  useEffect(() => {
    if (!enabled || minimized || userPlaced) return undefined
    setPos(defaultFloating(sidebarMode, isMobile))
    return undefined
  }, [enabled, minimized, userPlaced, sidebarMode, isMobile])

  useEffect(() => {
    if (!enabled || minimized) return undefined
    const onResize = () => {
      setPos((prev) => (userPlaced ? clampFloating(prev) : defaultFloating(sidebarMode, isMobile)))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [enabled, minimized, userPlaced, sidebarMode, isMobile])

  const onDragHandlePointerDown = useCallback(
    (e) => {
      if (!enabled || minimized || e.button !== 0) return
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
          clampFloating({
            x: dragRef.current.origin.x + dx,
            y: dragRef.current.origin.y + dy,
          })
        )
      }

      const onUp = (ev) => {
        document.removeEventListener('pointermove', onMove)
        document.removeEventListener('pointerup', onUp)
        document.removeEventListener('pointercancel', onUp)
        if (!dragRef.current) return
        const dx = ev.clientX - dragRef.current.startX
        const dy = ev.clientY - dragRef.current.startY
        const next = clampFloating({
          x: dragRef.current.origin.x + dx,
          y: dragRef.current.origin.y + dy,
        })
        dragRef.current = null
        setUserPlaced(true)
        setPos(next)
        persist(next, true, false)
      }

      document.addEventListener('pointermove', onMove)
      document.addEventListener('pointerup', onUp)
      document.addEventListener('pointercancel', onUp)
    },
    [enabled, minimized, pos, persist]
  )

  const dockStyle = minimized
    ? dockedLeftPosition(sidebarMode, isMobile)
    : { left: pos.x, top: pos.y }

  return {
    minimized,
    setMinimized,
    dockStyle,
    onDragHandlePointerDown,
  }
}
