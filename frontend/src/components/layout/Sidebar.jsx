import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useApp } from '../../context/AppContext'
import {
  buildCustomerNavSections,
  buildOperatorNavSections,
  pipelineCountsFromSummary,
  countUpcomingFromLeads,
  isNavTargetActive,
  navTargetToOptions,
  pipelineSidebarNavOptions,
} from '../../lib/navConfig'
import { BRAND_LOGO_ICON_TRANSPARENT, BRAND_LOGO_ICON_CLASS } from '../../lib/brandAssets'
import { isChithiPanel } from '../../lib/chithiNav'
import SidebarToggleButton from './SidebarToggleButton'
import ChithiMenuIcon from '../ui/ChithiMenuIcon'

/** Left nav uses intentional dark chrome (#2b2928) — not brand slate; do not swap for #64748B. */
import {
  BoltIcon,
  CalendarIcon,
  ChartIcon,
  ChevronRightIcon,
  DatabaseIcon,
  HomeIcon,
  ListIcon,
  LogIcon,
  MailIcon,
  NoteIcon,
  PeopleIcon,
  PipelineIcon,
  SignOutIcon,
  SettingsGearIcon,
  SparkIcon,
  SupportIcon,
  TaskIcon,
  TeamIcon,
  WhatsAppIcon,
  RouteIcon,
} from '../ui/icons'

const EXPAND_KEY = 'ci_nav_expanded'

function loadExpanded() {
  try {
    const raw = localStorage.getItem(EXPAND_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveExpanded(state) {
  try {
    localStorage.setItem(EXPAND_KEY, JSON.stringify(state))
  } catch {
    // ignore
  }
}

function NavIcon({ icon: Icon, active, className }) {
  if (Icon === ChithiMenuIcon) {
    return <ChithiMenuIcon className={className || 'w-4 h-4'} />
  }
  return <Icon className={className} />
}

const ICONS = {
  home: HomeIcon,
  people: PeopleIcon,
  list: ListIcon,
  pipeline: PipelineIcon,
  log: LogIcon,
  calendar: CalendarIcon,
  bolt: BoltIcon,
  mail: MailIcon,
  chart: ChartIcon,
  note: NoteIcon,
  chithi: ChithiMenuIcon,
  task: TaskIcon,
  spark: SparkIcon,
  team: TeamIcon,
  whatsapp: WhatsAppIcon,
  support: SupportIcon,
  database: DatabaseIcon,
  settings: SettingsGearIcon,
  route: RouteIcon,
}

export default function Sidebar({
  active,
  panelOptions,
  onNavigate,
  mobileOpen,
  onMobileClose,
  sidebarMode = 'expanded',
  onToggleSidebarCollapsed,
  chithiOpen = false,
  className: classNameProp = '',
}) {
  const { user, logout, savedLeads, pipelineSummary, chithiUnread } = useApp()
  const isOperator = Boolean(user?.isPlatformAdmin || user?.role === 'admin')
  const orgName = isOperator ? 'Connect Intel' : user?.organizationName || 'Connect Intel'
  const orgSubtitle = isOperator
    ? 'Platform operator'
    : user?.accountType === 'company'
      ? 'Team workspace'
      : null

  const pipelineCounts = useMemo(
    () => pipelineCountsFromSummary(pipelineSummary, savedLeads),
    [pipelineSummary, savedLeads]
  )
  const upcomingCount = useMemo(() => countUpcomingFromLeads(savedLeads), [savedLeads])

  const sections = useMemo(() => {
    if (isOperator) return buildOperatorNavSections()
    return buildCustomerNavSections(user, {
      pipelineCounts,
      upcomingCount,
      dealCounts: pipelineSummary?.openDealCounts,
      allDealCounts: pipelineSummary?.dealCounts,
    })
  }, [isOperator, user, pipelineCounts, upcomingCount])

  const [expanded, setExpanded] = useState(() => loadExpanded())
  const navScrollRef = useRef(null)
  const wasChithiOpenRef = useRef(false)

  const isTargetActive = useCallback(
    (target) => isNavTargetActive(active, panelOptions, target),
    [active, panelOptions]
  )

  useEffect(() => {
    setExpanded((prev) => {
      const next = { ...prev }
      for (const section of sections) {
        for (const group of section.groups) {
          if (group.panel && isTargetActive({ panel: group.panel, tab: group.tab })) {
            next[group.id] = true
          }
          if (group.children?.some((child) => navChildIsActive(child, isTargetActive))) {
            next[group.id] = true
          }
          for (const child of group.children || []) {
            if (child.children?.some((nested) => isTargetActive(nested))) {
              next[group.id] = true
              next[`stage:${child.id}`] = true
            }
          }
        }
      }
      return next
    })
  }, [active, panelOptions, sections, isTargetActive])

  useEffect(() => {
    const inChithi = isChithiPanel(active) || chithiOpen
    if (wasChithiOpenRef.current && !inChithi) {
      requestAnimationFrame(() => {
        const nav = navScrollRef.current
        if (!nav) return
        if (user?.isOrgAdmin && user?.accountType === 'company') {
          const teamEl = nav.querySelector('[data-nav-panel="team"]')
          if (teamEl) {
            teamEl.scrollIntoView({ block: 'nearest', behavior: 'instant' })
            return
          }
        }
        nav.scrollTop = 0
      })
    }
    wasChithiOpenRef.current = inChithi
  }, [active, chithiOpen, user?.isOrgAdmin, user?.accountType])

  const toggleGroup = (groupId) => {
    setExpanded((prev) => {
      const next = { ...prev, [groupId]: !prev[groupId] }
      saveExpanded(next)
      return next
    })
  }

  const go = (target) => {
    const options =
      target.panel === 'pipeline' ? pipelineSidebarNavOptions(target) : navTargetToOptions(target)
    onNavigate(target.panel, options)
    onMobileClose?.()
  }

  const resolveBadge = (item) => {
    if (item.badgeKey === 'saved') {
      const total = pipelineSummary.total || savedLeads.length
      if (total > 0) return total
    }
    if (item.badgeKey === 'chithi') {
      const n = chithiUnread?.total || 0
      if (n > 0) return n
    }
    if (item.badge != null && item.badge > 0) return item.badge
    return null
  }

  const railMode = sidebarMode === 'rail' && !mobileOpen
  const compactNav = railMode

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="md:hidden fixed inset-0 z-40 bg-black/45"
          onClick={onMobileClose}
        />
      )}
      <aside
        className={`ci-sidebar fixed md:static z-50 shrink-0 h-full bg-[#2b2928] border-r border-[#3a3836] flex flex-col overflow-hidden transition-[width] duration-200 ease-in-out max-md:transition-transform text-[12px] ${
          mobileOpen ? 'max-md:translate-x-0' : 'max-md:-translate-x-full'
        } w-[272px] ${railMode ? 'md:w-16' : 'md:w-[248px]'} ${classNameProp}`.trim()}
      >
        <div
          className={`min-h-[60px] flex items-center border-b border-[#3a3836] shrink-0 ${
            railMode ? 'justify-center px-2 md:px-0' : 'gap-2.5 px-4'
          }`}
        >
          {isOperator ? (
            <img
              src={BRAND_LOGO_ICON_TRANSPARENT}
              alt="Connect Intel"
              className={`w-8 h-8 shrink-0 ${BRAND_LOGO_ICON_CLASS}`}
            />
          ) : user?.organizationLogoUrl ? (
            <img
              src={user.organizationLogoUrl}
              alt=""
              className="w-8 h-8 rounded-xl object-cover border border-white/10 shrink-0"
            />
          ) : (
            <img
              src={BRAND_LOGO_ICON_TRANSPARENT}
              alt="Connect Intel"
              className={`w-8 h-8 shrink-0 ${BRAND_LOGO_ICON_CLASS}`}
            />
          )}
          {!railMode && (
            <div className="min-w-0 flex-1">
              <span className="font-semibold text-[13px] tracking-[-0.02em] text-white block truncate">
                {orgName}
              </span>
              {orgSubtitle && (
                <span className="text-[10px] text-[#9ea4aa] truncate block">{orgSubtitle}</span>
              )}
            </div>
          )}
        </div>

        <nav
          ref={navScrollRef}
          className={`flex-1 overflow-y-auto overflow-x-hidden py-3 ${railMode ? 'px-2 md:px-1.5' : 'px-3'}`}
        >
          {sections.map((section, sectionIndex) => (
            <div
              key={section.title}
              className={`${
                sectionIndex > 0
                  ? railMode
                    ? 'mt-2.5 pt-2.5 border-t border-white/8'
                    : 'mb-4.5'
                  : railMode
                    ? ''
                    : 'mb-4'
              }`}
            >
              {!railMode && (
                <p
                  className={`px-3 mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                    isOperator && section.title === 'Platform backend'
                      ? 'text-[#f3b562]'
                      : 'text-[#848b92]'
                  }`}
                >
                  {section.title}
                </p>
              )}
              {section.groups.map((group) => (
                <NavGroup
                  key={group.id}
                  group={group}
                  icons={ICONS}
                  compact={compactNav}
                  navExpanded={Boolean(expanded[group.id])}
                  stageExpanded={expanded}
                  onToggle={() => toggleGroup(group.id)}
                  onToggleStage={(stageId) => {
                    const key = `stage:${stageId}`
                    setExpanded((prev) => {
                      const next = { ...prev, [key]: !prev[key] }
                      saveExpanded(next)
                      return next
                    })
                  }}
                  isTargetActive={isTargetActive}
                  onGo={go}
                  resolveBadge={resolveBadge}
                  muted={group.muted}
                  dismissFlyouts={chithiOpen}
                />
              ))}
            </div>
          ))}

        </nav>

        <div className={`shrink-0 border-t border-[#3a3836] ${railMode ? 'p-2.5' : 'p-3'}`}>
          {railMode ? (
            <SidebarToggleButton
              mode={sidebarMode}
              onToggle={onToggleSidebarCollapsed}
              className="hidden md:flex mb-2 w-full !border-0"
            />
          ) : (
            <SidebarToggleButton mode={sidebarMode} onToggle={onToggleSidebarCollapsed} showLabel />
          )}

          <div className={`flex items-center ${railMode ? 'flex-col gap-2' : 'gap-2 px-1'}`}>
            {user?.picture ? (
              <img
                src={user.picture}
                alt=""
                className="w-8 h-8 rounded-full object-cover shrink-0"
                referrerPolicy="no-referrer"
                title={railMode ? user?.name : undefined}
              />
            ) : (
              <div
                className="w-8 h-8 rounded-full bg-white/12 flex items-center justify-center text-xs font-bold text-white shrink-0"
                title={railMode ? user?.name : undefined}
              >
                {user?.name?.[0] || 'U'}
              </div>
            )}
            {!railMode && (
              <div className="flex-1 min-w-0">
                <p className="truncate text-[12px] font-semibold tracking-[-0.02em] text-white">
                  {user?.name}
                </p>
                <p className="truncate text-[10px] text-[#a7b0b9]">{user?.email}</p>
                <p className="mt-0.5 truncate text-[10px] text-[#f3b562]">
                  {isOperator
                    ? 'Platform admin'
                    : user?.accountType === 'company'
                      ? `Company${user?.isOrgAdmin ? ' · Admin' : user?.pipelineRole === 'manager' ? ' · Manager' : ''}`
                      : 'Individual'}
                </p>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={logout}
            title="Sign out"
            className={`rounded-xl text-[#a7b0b9] transition-colors hover:bg-white/8 hover:text-white ${
              railMode
                ? 'mt-1 flex w-full justify-center p-2'
                : 'mt-2 w-full px-2 py-2 text-left text-xs'
            }`}
          >
            {railMode ? <SignOutIcon className="w-4 h-4" /> : 'Sign out'}
          </button>
        </div>
      </aside>
    </>
  )
}

function navChildIsActive(child, isTargetActive) {
  if (child.children?.length) return child.children.some((c) => isTargetActive(c))
  return isTargetActive(child)
}

function NavGroup({
  group,
  icons,
  compact,
  navExpanded,
  stageExpanded = {},
  onToggle,
  onToggleStage,
  isTargetActive,
  onGo,
  resolveBadge,
  muted = false,
  dismissFlyouts = false,
}) {
  const Icon = icons[group.icon] || HomeIcon
  const hasChildren = group.children?.length > 0
  const groupActive = hasChildren && group.children.some((child) => navChildIsActive(child, isTargetActive))
  const badge = resolveBadge(group)

  if (!hasChildren) {
    const target = { panel: group.panel, tab: group.tab, status: group.status, upcomingOnly: group.upcomingOnly }
    const active = isTargetActive(target)
    if (compact) {
      return (
        <RailFlyoutAnchor
          label={group.label}
          icon={Icon}
          active={active}
          muted={muted}
          badge={badge}
          leaf
          navPanel={group.panel}
          dismissFlyouts={dismissFlyouts}
          onNavigate={() => onGo(target)}
        />
      )
    }
    return (
      <NavBtn
        label={group.label}
        icon={Icon}
        active={active}
        onClick={() => onGo(target)}
        badge={badge}
        muted={muted}
        navPanel={group.panel}
      />
    )
  }

  if (compact) {
    return (
      <RailFlyoutAnchor label={group.label} active={groupActive} muted={muted} badge={badge} icon={Icon}>
        {group.children.map((child) =>
          child.children?.length ? (
            <RailFlyoutStageGroup
              key={child.id}
              stage={child}
              expanded={stageExpanded[`stage:${child.id}`] ?? true}
              onToggle={() => onToggleStage?.(child.id)}
              isTargetActive={isTargetActive}
              onGo={onGo}
              resolveBadge={resolveBadge}
            />
          ) : (
            <NavSubBtn
              key={child.id}
              label={child.label}
              active={isTargetActive(child)}
              badge={resolveBadge(child)}
              onClick={() => onGo(child)}
              inRailFlyout
            />
          )
        )}
      </RailFlyoutAnchor>
    )
  }

  return (
    <div className="mb-1">
      <button
        type="button"
        onClick={onToggle}
        className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-2xl text-[12px] font-medium tracking-[-0.015em] transition-colors ${
          groupActive
            ? 'bg-white text-[#17191c] shadow-[0_1px_2px_rgba(0,0,0,0.08)]'
            : muted
              ? 'text-[#7e8790] hover:bg-white/6'
              : 'text-[#d4d9de] hover:bg-white/6 hover:text-white'
        }`}
      >
        <NavIcon
          icon={Icon}
          active={groupActive}
          className={`w-4 h-4 shrink-0 ${groupActive ? 'text-[#17191c]' : 'text-[#aab3bb]'}`}
        />
        <span className="flex-1 text-left truncate">{group.label}</span>
        <ChevronRightIcon
          className={`w-3.5 h-3.5 shrink-0 transition-transform ${navExpanded ? 'rotate-90' : ''}`}
        />
      </button>
      {navExpanded && (
        <div className="ml-3 mt-1 mb-1 space-y-1 border-l border-white/10 pl-2">
          {group.children.map((child) =>
            child.children?.length ? (
              <NavStageGroup
                key={child.id}
                stage={child}
                expanded={Boolean(stageExpanded[`stage:${child.id}`])}
                onToggle={() => onToggleStage?.(child.id)}
                isTargetActive={isTargetActive}
                onGo={onGo}
                resolveBadge={resolveBadge}
              />
            ) : (
              <NavSubBtn
                key={child.id}
                label={child.label}
                active={isTargetActive(child)}
                badge={resolveBadge(child)}
                onClick={() => onGo(child)}
              />
            )
          )}
        </div>
      )}
    </div>
  )
}

function RailFlyoutAnchor({
  label,
  active: itemActive = false,
  muted,
  badge,
  icon: Icon,
  children,
  leaf = false,
  onNavigate,
  dismissFlyouts = false,
  navPanel,
}) {
  const [open, setOpen] = useState(false)
  const [flyoutPos, setFlyoutPos] = useState(null)
  const rootRef = useRef(null)
  const flyoutRef = useRef(null)
  const closeTimerRef = useRef(null)
  const hasMenu = !leaf && Boolean(children)

  const updateFlyoutPos = useCallback(() => {
    const anchor = rootRef.current
    if (!anchor) return
    const rect = anchor.getBoundingClientRect()
    const gap = 8
    const panelWidth = leaf ? 200 : 224
    const panelMaxHeight = leaf ? 120 : Math.min(window.innerHeight * 0.65, 360)
    let left = rect.right + gap
    let top = rect.top
    if (left + panelWidth > window.innerWidth - 8) {
      left = Math.max(8, rect.left - panelWidth - gap)
    }
    if (top + panelMaxHeight > window.innerHeight - 8) {
      top = Math.max(8, window.innerHeight - panelMaxHeight - 8)
    }
    setFlyoutPos({ top, left })
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

  useEffect(() => {
    if (dismissFlyouts) setOpen(false)
  }, [dismissFlyouts])

  const clearCloseTimer = () => {
    if (!closeTimerRef.current) return
    window.clearTimeout(closeTimerRef.current)
    closeTimerRef.current = null
  }

  const openNow = () => {
    clearCloseTimer()
    setOpen(true)
  }

  const closeNow = () => {
    clearCloseTimer()
    setOpen(false)
  }

  const closeSoon = () => {
    clearCloseTimer()
    closeTimerRef.current = window.setTimeout(() => {
      setOpen(false)
      closeTimerRef.current = null
    }, 120)
  }

  const handleIconClick = () => {
    clearCloseTimer()
    if (leaf && onNavigate) {
      onNavigate()
      closeNow()
      return
    }
    setOpen((v) => !v)
  }

  const popup =
    open &&
    flyoutPos &&
    createPortal(
      <div
        ref={flyoutRef}
        role={hasMenu ? 'menu' : 'dialog'}
        aria-label={label}
        className={`sidebar-rail-flyout fixed z-[250] rounded-2xl border border-[#3a3836] bg-[#2b2928] py-1 shadow-[0_16px_40px_rgba(0,0,0,0.45)] ${
          leaf ? 'min-w-[188px] max-w-[220px]' : 'min-w-[204px] max-w-[240px]'
        }`}
        style={{ top: flyoutPos.top, left: flyoutPos.left }}
        onMouseEnter={openNow}
        onMouseLeave={closeSoon}
        onClick={(e) => {
          if (e.target.closest('button')) closeNow()
        }}
      >
        <p className="sidebar-rail-flyout__title border-b border-[#3a3836] px-2.5 py-1.5 font-semibold tracking-[-0.02em] text-white">
          {label}
        </p>
        {leaf ? (
          <div className="sidebar-rail-flyout__items p-1">
            <button
              type="button"
              onClick={() => {
                onNavigate?.()
                closeNow()
              }}
              className={`sidebar-sub-item sidebar-rail-flyout__leaf w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors ${
                itemActive
                  ? 'nav-sub-active'
                  : muted
                    ? 'text-[#9aa3ac] hover:bg-white/8 hover:text-white'
                    : 'text-[#e8ecef] hover:bg-white/8 hover:text-white'
              }`}
            >
              <NavIcon
                icon={Icon}
                active={itemActive}
                className={`w-4 h-4 shrink-0 ${itemActive ? 'text-[#17191c]' : 'text-[#aab3bb]'}`}
              />
              <span className="flex-1 text-left truncate">{label}</span>
              {badge != null && (
                <span
                  className={`sidebar-sub-badge shrink-0 rounded-full px-1 py-0.5 font-bold tabular-nums ${
                    itemActive ? 'bg-[#17191c]/10 text-[#17191c]' : 'bg-white/14 text-white'
                  }`}
                >
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </button>
          </div>
        ) : (
          <div className="sidebar-rail-flyout__items max-h-[min(65vh,360px)] overflow-y-auto p-1.5 space-y-1">
            {children}
          </div>
        )}
      </div>,
      document.body
    )

  return (
    <div
      ref={rootRef}
      className="relative mb-1"
      onMouseEnter={openNow}
      onMouseLeave={closeSoon}
    >
      <button
        type="button"
        data-nav-panel={leaf && navPanel ? navPanel : undefined}
        aria-expanded={open}
        aria-haspopup={hasMenu ? 'menu' : 'true'}
        onFocus={openNow}
        onBlur={closeSoon}
        onClick={handleIconClick}
        className={`relative w-full flex justify-center items-center rounded-2xl p-2.5 transition-colors ${
          itemActive || open
            ? 'nav-item-active'
            : muted
              ? 'text-[#808892] hover:bg-white/6'
              : 'text-[#d4d9de] hover:bg-white/6 hover:text-white'
        }`}
      >
        <NavIcon
          icon={Icon}
          active={itemActive || open}
          className={`w-5 h-5 shrink-0 ${itemActive || open ? 'text-[#17191c]' : 'text-[#aab3bb]'}`}
        />
        {badge != null && (
          <span
            className={`absolute top-1 right-1 flex h-[14px] min-w-[14px] items-center justify-center rounded-full px-0.5 text-[8px] font-bold ${
              itemActive || open ? 'bg-[#17191c] text-white' : 'bg-white/20 text-white'
            }`}
          >
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </button>
      {popup}
    </div>
  )
}

function NavBtn({ label, icon: Icon, active, onClick, badge, muted = false, navPanel }) {
  return (
    <button
      type="button"
      data-nav-panel={navPanel || undefined}
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-2xl text-[12px] font-medium tracking-[-0.015em] mb-1 transition-colors ${
        active
          ? 'bg-white text-[#17191c]'
          : muted
            ? 'text-[#808892] hover:bg-white/6'
            : 'text-[#d4d9de] hover:bg-white/6 hover:text-white'
      }`}
    >
      <NavIcon
        icon={Icon}
        active={active}
        className={`w-4 h-4 shrink-0 ${active ? 'text-[#17191c]' : 'text-[#aab3bb]'}`}
      />
      <span className="flex-1 text-left truncate">{label}</span>
      {badge != null && (
        <span
          className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
            active ? 'bg-[#17191c]/8 text-[#17191c]' : 'bg-white/10 text-white'
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  )
}

function RailFlyoutStageGroup({ stage, expanded, onToggle, isTargetActive, onGo, resolveBadge }) {
  const stageActive = stage.children.some((c) => isTargetActive(c))
  return (
    <div className="mb-0.5">
      <button
        type="button"
        onClick={onToggle}
        className={`w-full flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
          stageActive ? 'text-white bg-white/10' : 'text-[#c8cfd6] hover:bg-white/8 hover:text-white'
        }`}
      >
        <ChevronRightIcon
          className={`w-3 h-3 shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`}
        />
        <span className="flex-1 text-left truncate">{stage.label}</span>
      </button>
      {expanded && (
        <div className="ml-2 mt-0.5 space-y-0.5 border-l border-white/10 pl-2">
          {stage.children.map((child) => (
            <NavSubBtn
              key={child.id}
              label={child.label}
              active={isTargetActive(child)}
              badge={resolveBadge(child)}
              onClick={() => onGo(child)}
              inRailFlyout
            />
          ))}
        </div>
      )}
    </div>
  )
}

function NavStageGroup({ stage, expanded, onToggle, isTargetActive, onGo, resolveBadge }) {
  const stageActive = stage.children.some((c) => isTargetActive(c))
  return (
    <div className="mb-0.5">
      <button
        type="button"
        onClick={onToggle}
        className={`w-full flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
          stageActive ? 'text-white bg-white/10' : 'text-[#bcc4cc] hover:bg-white/6 hover:text-white'
        }`}
      >
        <ChevronRightIcon
          className={`w-3 h-3 shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`}
        />
        <span className="flex-1 text-left truncate">{stage.label}</span>
      </button>
      {expanded && (
        <div className="ml-3 mt-0.5 space-y-0.5 border-l border-white/8 pl-2">
          {stage.children.map((child) => (
            <NavSubBtn
              key={child.id}
              label={child.label}
              active={isTargetActive(child)}
              badge={resolveBadge(child)}
              onClick={() => onGo(child)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function NavSubBtn({ label, active, badge, onClick, inRailFlyout = false }) {
  const inactiveClass = inRailFlyout
    ? 'text-[#c8cfd6] hover:bg-white/8 hover:text-white'
    : 'text-[#bcc4cc] hover:bg-white/6 hover:text-white'

  return (
    <button
      type="button"
      onClick={onClick}
      className={`sidebar-sub-item w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition-colors ${
        active ? 'nav-sub-active' : inactiveClass
      }`}
    >
      <span className="flex-1 text-left truncate">{label}</span>
      {badge != null && (
        <span
          className={`sidebar-sub-badge rounded-full px-1 py-0.5 font-bold tabular-nums ${
            active
              ? 'bg-[#17191c]/10 text-[#17191c]'
              : inRailFlyout
                ? 'bg-white/14 text-white'
                : 'bg-white/10 text-[#d4d9de]'
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  )
}
