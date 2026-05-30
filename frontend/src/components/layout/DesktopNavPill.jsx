import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { useApp } from '../../context/AppContext'
import useDesktopNavDock from '../../hooks/useDesktopNavDock'
import useIsMobile from '../../hooks/useIsMobile'
import {
  buildCustomerNavSections,
  countUpcomingFromLeads,
  getDesktopPillSubmenuTargets,
  isNavTargetActive,
  MOBILE_NAV_PILL_ITEMS,
  navTargetToOptions,
  pipelineCountsFromSummary,
} from '../../lib/navConfig'
import { isChithiPanel } from '../../lib/chithiNav'
import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  GripIcon,
  HomeIcon,
  MailIcon,
  PeopleIcon,
  PipelineIcon,
  SidebarCollapseIcon,
  SparkIcon,
  TaskIcon,
  WhatsAppIcon,
} from '../ui/icons'

const ICONS = {
  home: HomeIcon,
  pipeline: PipelineIcon,
  people: PeopleIcon,
  spark: SparkIcon,
  mail: MailIcon,
  whatsapp: WhatsAppIcon,
  calendar: CalendarIcon,
  task: TaskIcon,
}

function pillItemActive(activePanel, panelOptions, item) {
  if (item.matchPanelOnly) return activePanel === item.panel
  return isNavTargetActive(activePanel, panelOptions, item)
}

function PillItemFlyout({
  item,
  Icon,
  active,
  submenuTargets,
  isTargetActive,
  resolveBadge,
  onNavigate,
}) {
  const [open, setOpen] = useState(false)
  const [flyoutPos, setFlyoutPos] = useState(null)
  const rootRef = useRef(null)
  const flyoutRef = useRef(null)
  const closeTimerRef = useRef(null)
  const hasMenu = submenuTargets.length > 0

  const updateFlyoutPos = useCallback(() => {
    const anchor = rootRef.current
    if (!anchor) return
    const rect = anchor.getBoundingClientRect()
    const gap = 6
    const panelWidth = 220
    const panelMaxHeight = Math.min(window.innerHeight * 0.55, 320)
    let left = rect.left + rect.width / 2 - panelWidth / 2
    let top = rect.bottom + gap
    left = Math.max(8, Math.min(left, window.innerWidth - panelWidth - 8))
    if (top + panelMaxHeight > window.innerHeight - 8) {
      top = Math.max(8, rect.top - panelMaxHeight - gap)
    }
    setFlyoutPos({ top, left, width: panelWidth })
  }, [])

  useLayoutEffect(() => {
    if (!open) {
      setFlyoutPos(null)
      return undefined
    }
    updateFlyoutPos()
    const onDoc = (e) => {
      if (rootRef.current?.contains(e.target) || flyoutRef.current?.contains(e.target)) return
      setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('resize', updateFlyoutPos)
    window.addEventListener('scroll', updateFlyoutPos, true)
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('resize', updateFlyoutPos)
      window.removeEventListener('scroll', updateFlyoutPos, true)
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, updateFlyoutPos])

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current)
    }
  }, [])

  const clearCloseTimer = () => {
    if (!closeTimerRef.current) return
    window.clearTimeout(closeTimerRef.current)
    closeTimerRef.current = null
  }

  const openNow = () => {
    clearCloseTimer()
    if (hasMenu) setOpen(true)
  }

  const closeSoon = () => {
    clearCloseTimer()
    closeTimerRef.current = window.setTimeout(() => {
      setOpen(false)
      closeTimerRef.current = null
    }, 120)
  }

  const closeNow = () => {
    clearCloseTimer()
    setOpen(false)
  }

  const goTarget = (target) => {
    onNavigate(target.panel, navTargetToOptions(target))
    closeNow()
  }

  const popup =
    open &&
    hasMenu &&
    flyoutPos &&
    createPortal(
      <div
        ref={flyoutRef}
        role="menu"
        aria-label={item.label}
        className="desktop-nav-pill-flyout"
        style={{ top: flyoutPos.top, left: flyoutPos.left, width: flyoutPos.width }}
        onMouseEnter={openNow}
        onMouseLeave={closeSoon}
      >
        <p className="desktop-nav-pill-flyout__title">{item.label}</p>
        <div className="desktop-nav-pill-flyout__items">
          {submenuTargets.map((target) => {
            const subActive = isTargetActive(target)
            const badge = resolveBadge(target)
            return (
              <button
                key={target.id}
                type="button"
                role="menuitem"
                className={`desktop-nav-pill-flyout__item ${subActive ? 'is-active' : ''}`}
                onClick={() => goTarget(target)}
              >
                <span className="desktop-nav-pill-flyout__item-label">{target.label}</span>
                {badge != null && (
                  <span className="desktop-nav-pill-flyout__badge">
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>,
      document.body
    )

  return (
    <div
      ref={rootRef}
      className="desktop-nav-pill__item-wrap"
      onMouseEnter={openNow}
      onMouseLeave={closeSoon}
    >
      <button
        type="button"
        className={`desktop-nav-pill__item ${active ? 'is-active' : ''} ${open ? 'is-flyout-open' : ''}`}
        onClick={() => {
          if (submenuTargets.length === 1) {
            goTarget(submenuTargets[0])
            return
          }
          if (submenuTargets.length > 1) {
            setOpen((v) => !v)
            return
          }
          onNavigate(item.panel, navTargetToOptions(item))
        }}
        aria-current={active ? 'page' : undefined}
        aria-haspopup={hasMenu ? 'menu' : undefined}
        aria-expanded={open || undefined}
        title={item.label}
      >
        <Icon className="desktop-nav-pill__item-icon" />
        <span className="desktop-nav-pill__label">{item.label}</span>
      </button>
      {popup}
    </div>
  )
}

export default function DesktopNavPill({ activePanel, panelOptions, onNavigate }) {
  const { user, pipelineLeadId, savedLeads, pipelineSummary, chithiUnread } = useApp()
  const isMobile = useIsMobile()
  const enabled = Boolean(
    user && !user.isPlatformAdmin && !isMobile && !pipelineLeadId && !isChithiPanel(activePanel)
  )
  const {
    dockRef,
    pos,
    width,
    minimized,
    setMinimized,
    onDragHandlePointerDown,
    onResizeHandlePointerDown,
  } = useDesktopNavDock(enabled)

  const scrollRef = useRef(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const pipelineCounts = useMemo(
    () => pipelineCountsFromSummary(pipelineSummary, savedLeads),
    [pipelineSummary, savedLeads]
  )
  const upcomingCount = useMemo(() => countUpcomingFromLeads(savedLeads), [savedLeads])
  const sections = useMemo(
    () => buildCustomerNavSections(user, { pipelineCounts, upcomingCount }),
    [user, pipelineCounts, upcomingCount]
  )

  const items = MOBILE_NAV_PILL_ITEMS
  const submenuByPillId = useMemo(() => {
    const map = {}
    for (const item of items) {
      map[item.id] = getDesktopPillSubmenuTargets(item, sections, user)
    }
    return map
  }, [items, sections, user])

  const isTargetActive = useCallback(
    (target) => isNavTargetActive(activePanel, panelOptions, target),
    [activePanel, panelOptions]
  )

  const resolveBadge = useCallback(
    (target) => {
      if (target.badgeKey === 'saved') {
        const total = pipelineSummary.total || savedLeads.length
        if (total > 0) return total
      }
      if (target.badgeKey === 'chithi') {
        const n = chithiUnread?.total || 0
        if (n > 0) return n
      }
      if (target.badge != null && target.badge > 0) return target.badge
      return null
    },
    [pipelineSummary.total, savedLeads.length, chithiUnread?.total]
  )

  const updateScrollEdges = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    setCanScrollLeft(el.scrollLeft > 2)
    setCanScrollRight(max > 2 && el.scrollLeft < max - 2)
  }, [])

  useEffect(() => {
    if (!enabled || minimized) return undefined
    const el = scrollRef.current
    if (!el) return undefined
    updateScrollEdges()
    const ro = new ResizeObserver(updateScrollEdges)
    ro.observe(el)
    el.addEventListener('scroll', updateScrollEdges, { passive: true })
    return () => {
      ro.disconnect()
      el.removeEventListener('scroll', updateScrollEdges)
    }
  }, [enabled, minimized, width, items.length, updateScrollEdges])

  useEffect(() => {
    if (!enabled || minimized) return undefined
    const el = scrollRef.current
    if (!el) return undefined
    const onWheel = (e) => {
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
      if (!delta) return
      const max = el.scrollWidth - el.clientWidth
      if (max <= 0) return
      const next = el.scrollLeft + delta
      if (next <= 0 || next >= max) {
        if ((delta > 0 && el.scrollLeft < max) || (delta < 0 && el.scrollLeft > 0)) {
          e.preventDefault()
          el.scrollLeft = Math.max(0, Math.min(max, next))
        }
        return
      }
      e.preventDefault()
      el.scrollLeft = next
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [enabled, minimized, width])

  const scrollBy = (dir) => {
    scrollRef.current?.scrollBy({ left: dir * 140, behavior: 'smooth' })
  }

  if (!enabled) return null

  if (minimized) {
    return (
      <button
        type="button"
        className="desktop-nav-pill-minimized"
        onClick={() => setMinimized(false)}
        aria-label="Expand quick navigation"
        title="Expand navigation"
      >
        <GripIcon className="desktop-nav-pill-minimized__icon" />
        <span className="desktop-nav-pill-minimized__label">Nav</span>
      </button>
    )
  }

  const showArrows = canScrollLeft || canScrollRight

  return (
    <nav
      ref={dockRef}
      className="desktop-nav-pill"
      style={{ left: pos.x, top: pos.y, width }}
      aria-label="Quick navigation"
    >
      <div
        className="desktop-nav-pill__drag"
        onPointerDown={onDragHandlePointerDown}
        role="presentation"
        aria-hidden
        title="Drag to move"
      >
        <GripIcon className="desktop-nav-pill__grip" />
      </div>

      <div className="desktop-nav-pill__body">
        <div className="desktop-nav-pill__row">
          {showArrows && (
            <button
              type="button"
              className="desktop-nav-pill__arrow"
              disabled={!canScrollLeft}
              onClick={() => scrollBy(-1)}
              aria-label="Scroll shortcuts left"
            >
              <ChevronLeftIcon className="w-4 h-4" />
            </button>
          )}

          <div ref={scrollRef} className="desktop-nav-pill__icons-scroll">
            <div className="desktop-nav-pill__icons">
              {items.map((item) => {
                const Icon = ICONS[item.icon] || HomeIcon
                const active = pillItemActive(activePanel, panelOptions, item)
                return (
                  <PillItemFlyout
                    key={item.id}
                    item={item}
                    Icon={Icon}
                    active={active}
                    submenuTargets={submenuByPillId[item.id] || []}
                    isTargetActive={isTargetActive}
                    resolveBadge={resolveBadge}
                    onNavigate={onNavigate}
                  />
                )
              })}
            </div>
          </div>

          {showArrows && (
            <button
              type="button"
              className="desktop-nav-pill__arrow"
              disabled={!canScrollRight}
              onClick={() => scrollBy(1)}
              aria-label="Scroll shortcuts right"
            >
              <ChevronRightIcon className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            className="desktop-nav-pill__minimize"
            onClick={() => setMinimized(true)}
            aria-label="Minimize navigation bar"
            title="Minimize"
          >
            <SidebarCollapseIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div
        className="desktop-nav-pill__resize"
        onPointerDown={onResizeHandlePointerDown}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize navigation bar"
        title="Drag to resize"
      />
    </nav>
  )
}
