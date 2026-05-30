import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const DOCK_EXPAND_KEY = 'ci_marketing_dock_expanded'

export function loadDockExpanded() {
  try {
    return localStorage.getItem(DOCK_EXPAND_KEY) === '1'
  } catch {
    return false
  }
}

export function saveDockExpanded(expanded) {
  try {
    localStorage.setItem(DOCK_EXPAND_KEY, expanded ? '1' : '0')
  } catch {
    // ignore
  }
}

export function MarketingStudioDockBtn({
  label,
  icon: Icon,
  active = false,
  disabled = false,
  accent = false,
  expanded = false,
  onClick,
}) {
  const rootRef = useRef(null)
  const [flyoutOpen, setFlyoutOpen] = useState(false)
  const [flyoutPos, setFlyoutPos] = useState(null)

  useLayoutEffect(() => {
    if (expanded || !flyoutOpen || !rootRef.current) {
      setFlyoutPos(null)
      return undefined
    }
    const rect = rootRef.current.getBoundingClientRect()
    setFlyoutPos({
      top: rect.top + rect.height / 2,
      left: rect.right + 8,
    })
    const onResize = () => {
      const r = rootRef.current?.getBoundingClientRect()
      if (!r) return
      setFlyoutPos({ top: r.top + r.height / 2, left: r.right + 8 })
    }
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onResize, true)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onResize, true)
    }
  }, [expanded, flyoutOpen])

  const flyout =
    !expanded &&
    flyoutOpen &&
    flyoutPos &&
    createPortal(
      <div
        className="marketing-dock-flyout"
        style={{ top: flyoutPos.top, left: flyoutPos.left }}
        role="tooltip"
      >
        {label}
      </div>,
      document.body
    )

  return (
    <div
      ref={rootRef}
      className="marketing-studio-dock-btn-wrap"
      onMouseEnter={() => !expanded && setFlyoutOpen(true)}
      onMouseLeave={() => setFlyoutOpen(false)}
      onFocus={() => !expanded && setFlyoutOpen(true)}
      onBlur={() => setFlyoutOpen(false)}
    >
      <button
        type="button"
        className={`marketing-studio-float-dock__btn ${active ? 'is-active' : ''} ${
          accent ? 'marketing-studio-float-dock__btn--accent' : ''
        }`}
        disabled={disabled}
        aria-label={label}
        onClick={onClick}
      >
        <Icon className="h-[18px] w-[18px] shrink-0" />
        {expanded ? <span className="marketing-studio-float-dock__label">{label}</span> : null}
      </button>
      {flyout}
    </div>
  )
}
