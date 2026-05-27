import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useApp } from '../../context/AppContext'
import {
  buildCustomerNavSections,
  buildOperatorNavSections,
  countPipelineByStatus,
  countUpcomingFromLeads,
  isNavTargetActive,
  navTargetToOptions,
} from '../../lib/navConfig'

import SidebarToggleButton from './SidebarToggleButton'

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
  task: TaskIcon,
  spark: SparkIcon,
  team: TeamIcon,
  whatsapp: WhatsAppIcon,
  support: SupportIcon,
  database: DatabaseIcon,
}

export default function Sidebar({
  active,
  panelOptions,
  onNavigate,
  mobileOpen,
  onMobileClose,
  sidebarMode = 'expanded',
  onToggleSidebarCollapsed,
}) {
  const { user, logout, savedLeads } = useApp()
  const isOperator = Boolean(user?.isPlatformAdmin)
  const orgName = isOperator ? 'Connect Intel' : user?.organizationName || 'Connect Intel'
  const orgSubtitle = isOperator
    ? 'Platform operator'
    : user?.accountType === 'company'
      ? 'Team workspace'
      : null

  const pipelineCounts = useMemo(() => countPipelineByStatus(savedLeads), [savedLeads])
  const upcomingCount = useMemo(() => countUpcomingFromLeads(savedLeads), [savedLeads])

  const sections = useMemo(() => {
    if (isOperator) return buildOperatorNavSections()
    return buildCustomerNavSections(user, {
      pipelineCounts,
      upcomingCount,
    })
  }, [isOperator, user, pipelineCounts, upcomingCount])

  const [expanded, setExpanded] = useState(() => loadExpanded())

  const isTargetActive = useCallback(
    (target) => isNavTargetActive(active, panelOptions, target),
    [active, panelOptions]
  )

  useEffect(() => {
    setExpanded((prev) => {
      const next = { ...prev }
      for (const section of sections) {
        for (const group of section.groups) {
          if (group.children?.some((child) => isTargetActive(child))) {
            next[group.id] = true
          }
        }
      }
      return next
    })
  }, [active, panelOptions, sections, isTargetActive])

  const toggleGroup = (groupId) => {
    setExpanded((prev) => {
      const next = { ...prev, [groupId]: !prev[groupId] }
      saveExpanded(next)
      return next
    })
  }

  const go = (target) => {
    onNavigate(target.panel, navTargetToOptions(target))
    onMobileClose?.()
  }

  const resolveBadge = (item) => {
    if (item.badgeKey === 'saved' && savedLeads.length > 0) return savedLeads.length
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
          className="md:hidden fixed inset-0 z-40 bg-black/40"
          onClick={onMobileClose}
        />
      )}
      <aside
        className={`fixed md:static z-50 shrink-0 h-full bg-white border-r border-gray-200 flex flex-col overflow-hidden transition-[width] duration-200 ease-in-out max-md:transition-transform ${
          mobileOpen ? 'max-md:translate-x-0' : 'max-md:-translate-x-full'
        } w-[260px] ${railMode ? 'md:w-14' : 'md:w-60'}`}
      >
        <div
          className={`h-14 flex items-center border-b border-gray-100 shrink-0 ${
            railMode ? 'justify-center px-2 md:px-0' : 'gap-2.5 px-4'
          }`}
        >
          {isOperator ? (
            <img
              src="/connect-intel-logo-icon.png"
              alt="Connect Intel"
              className="w-8 h-8 rounded-lg object-cover shrink-0"
            />
          ) : user?.organizationLogoUrl ? (
            <img
              src={user.organizationLogoUrl}
              alt=""
              className="w-8 h-8 rounded-lg object-cover border border-gray-200 shrink-0"
            />
          ) : (
            <img
              src="/connect-intel-logo-icon.png"
              alt="Connect Intel"
              className="w-8 h-8 rounded-lg object-cover shrink-0"
            />
          )}
          {!railMode && (
            <div className="min-w-0 flex-1">
              <span className="font-semibold text-[14px] text-gray-900 block truncate">{orgName}</span>
              {orgSubtitle && (
                <span className="text-[10px] text-gray-500 truncate block">{orgSubtitle}</span>
              )}
            </div>
          )}
        </div>

        <nav className={`flex-1 overflow-y-auto overflow-x-hidden py-2 ${railMode ? 'px-1.5 md:px-1' : 'px-2'}`}>
          {sections.map((section, sectionIndex) => (
            <div
              key={section.title}
              className={`${sectionIndex > 0 ? (railMode ? 'mt-2 pt-2 border-t border-gray-100' : 'mb-4') : railMode ? '' : 'mb-4'}`}
            >
              {!railMode && (
                <p
                  className={`px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider ${
                    isOperator && section.title === 'Platform backend'
                      ? 'text-[#8a6600]'
                      : 'text-gray-400'
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
                  onToggle={() => toggleGroup(group.id)}
                  isTargetActive={isTargetActive}
                  onGo={go}
                  resolveBadge={resolveBadge}
                  muted={group.muted}
                />
              ))}
            </div>
          ))}

          {!railMode && (
            <div
              className={`mx-2 mt-2 p-3 rounded-lg border ${
                isOperator ? 'bg-gray-900 border-gray-800 text-white' : 'bg-[#fffbeb] border-[#fde68a]'
              }`}
            >
              <p className={`text-xs font-semibold ${isOperator ? 'text-[#ffcb2b]' : 'text-gray-800'}`}>
                {isOperator ? 'Master database' : 'CRM first, then AI'}
              </p>
              <p className={`text-[10px] mt-1 leading-snug ${isOperator ? 'text-gray-300' : 'text-gray-600'}`}>
                {isOperator
                  ? 'Upload sheets here. All customers search this shared data.'
                  : 'Build your pipeline first. Use AI prospect search when you need new leads.'}
              </p>
            </div>
          )}
        </nav>

        <div className={`shrink-0 border-t border-gray-100 ${railMode ? 'p-2' : 'p-3'}`}>
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
                className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600 shrink-0"
                title={railMode ? user?.name : undefined}
              >
                {user?.name?.[0] || 'U'}
              </div>
            )}
            {!railMode && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-900 truncate">{user?.name}</p>
                <p className="text-[10px] text-gray-500 truncate">{user?.email}</p>
                <p className="text-[10px] text-[#8a6600] truncate mt-0.5">
                  {isOperator
                    ? 'Platform admin'
                    : `${user?.accountType === 'company' ? 'Company' : 'Individual'} · Searches: ${user?.searchesLeft ?? 0}`}
                </p>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={logout}
            title="Sign out"
            className={`text-gray-500 hover:text-gray-800 hover:bg-gray-50 rounded-md transition-colors ${
              railMode
                ? 'mt-1 w-full flex justify-center p-2'
                : 'mt-2 w-full text-left text-xs px-1 py-1'
            }`}
          >
            {railMode ? <SignOutIcon className="w-4 h-4" /> : 'Sign out'}
          </button>
        </div>
      </aside>
    </>
  )
}

function NavGroup({
  group,
  icons,
  compact,
  navExpanded,
  onToggle,
  isTargetActive,
  onGo,
  resolveBadge,
  muted = false,
}) {
  const Icon = icons[group.icon] || HomeIcon
  const hasChildren = group.children?.length > 0
  const groupActive = hasChildren && group.children.some((child) => isTargetActive(child))
  const badge = resolveBadge(group)

  if (!hasChildren) {
    const target = { panel: group.panel, tab: group.tab, status: group.status, upcomingOnly: group.upcomingOnly }
    return (
      <NavBtn
        label={group.label}
        icon={Icon}
        active={isTargetActive(target)}
        onClick={() => onGo(target)}
        badge={badge}
        muted={muted}
        compact={compact}
      />
    )
  }

  if (compact) {
    return (
      <RailNavPopup label={group.label} groupActive={groupActive} muted={muted} badge={badge} icon={Icon}>
        {group.children.map((child) => (
          <NavSubBtn
            key={child.id}
            label={child.label}
            active={isTargetActive(child)}
            badge={resolveBadge(child)}
            onClick={() => onGo(child)}
          />
        ))}
      </RailNavPopup>
    )
  }

  return (
    <div className="mb-0.5">
      <button
        type="button"
        onClick={onToggle}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-[13px] font-medium transition-colors ${
          groupActive ? 'bg-gray-100 text-gray-900' : muted ? 'text-gray-500 hover:bg-gray-50' : 'text-gray-600 hover:bg-gray-100'
        }`}
      >
        <Icon className={`w-4 h-4 shrink-0 ${groupActive ? 'text-gray-700' : 'text-gray-500'}`} />
        <span className="flex-1 text-left truncate">{group.label}</span>
        <ChevronIcon className={`w-3.5 h-3.5 shrink-0 transition-transform ${navExpanded ? 'rotate-90' : ''}`} />
      </button>
      {navExpanded && (
        <div className="ml-3 pl-2 border-l border-gray-100 mt-0.5 mb-1 space-y-0.5">
          {group.children.map((child) => (
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

/** Popup submenu for icon-rail mode (portaled so it is not clipped by sidebar overflow/transform). */
function RailNavPopup({ label, groupActive, muted, badge, icon: Icon, children }) {
  const [open, setOpen] = useState(false)
  const [flyoutPos, setFlyoutPos] = useState(null)
  const rootRef = useRef(null)
  const flyoutRef = useRef(null)

  const updateFlyoutPos = useCallback(() => {
    const anchor = rootRef.current
    if (!anchor) return
    const rect = anchor.getBoundingClientRect()
    const gap = 6
    const panelWidth = 224
    const panelMaxHeight = Math.min(window.innerHeight * 0.65, 360)
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

  const popup =
    open &&
    flyoutPos &&
    createPortal(
      <div
        ref={flyoutRef}
        role="menu"
        aria-label={label}
        className="fixed z-[250] min-w-[200px] max-w-[240px] rounded-lg border border-gray-200 bg-white shadow-2xl py-1"
        style={{ top: flyoutPos.top, left: flyoutPos.left }}
        onClick={(e) => {
          if (e.target.closest('button')) setOpen(false)
        }}
      >
        <p className="px-3 py-2 text-xs font-semibold text-gray-900 border-b border-gray-100">{label}</p>
        <div className="max-h-[min(65vh,360px)] overflow-y-auto p-1 space-y-0.5">{children}</div>
      </div>,
      document.body
    )

  return (
    <div ref={rootRef} className="relative mb-0.5">
      <button
        type="button"
        title={label}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className={`relative w-full flex justify-center items-center p-2.5 rounded-md transition-colors ${
          groupActive || open
            ? 'nav-item-active'
            : muted
              ? 'text-gray-500 hover:bg-gray-100'
              : 'text-gray-600 hover:bg-gray-100'
        }`}
      >
        <Icon className={`w-5 h-5 shrink-0 ${groupActive || open ? 'text-white' : 'text-gray-500'}`} />
        {badge != null && (
          <span
            className={`absolute top-1 right-1 min-w-[14px] h-[14px] px-0.5 flex items-center justify-center text-[8px] font-bold rounded-full ${
              groupActive || open ? 'bg-white text-gray-900' : 'bg-gray-900 text-white'
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

function ChevronIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  )
}

function NavBtn({ label, icon: Icon, active, onClick, badge, muted = false, compact = false }) {
  if (compact) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={label}
        className={`relative w-full flex justify-center items-center p-2.5 rounded-md mb-0.5 transition-colors ${
          active
            ? 'nav-item-active'
            : muted
              ? 'text-gray-500 hover:bg-gray-50'
              : 'text-gray-600 hover:bg-gray-100'
        }`}
      >
        <Icon className={`w-5 h-5 shrink-0 ${active ? 'text-[#0f766e]' : 'text-gray-500'}`} />
        {badge != null && (
          <span
            className={`absolute top-1 right-1 min-w-[14px] h-[14px] px-0.5 flex items-center justify-center text-[8px] font-bold rounded-full ${
              active ? 'bg-[#0d9488] text-white' : 'bg-gray-200 text-gray-700'
            }`}
          >
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-medium mb-0.5 transition-colors ${
        active
          ? 'bg-gray-900 text-white'
          : muted
            ? 'text-gray-500 hover:bg-gray-50'
            : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-[#0f766e]' : 'text-gray-500'}`} />
      <span className="flex-1 text-left truncate">{label}</span>
      {badge != null && (
        <span
          className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
            active ? 'bg-[#0d9488] text-white' : 'bg-gray-200 text-gray-700'
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  )
}

function NavSubBtn({ label, active, badge, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-colors ${
        active ? 'nav-sub-active' : 'text-gray-600 hover:bg-gray-50'
      }`}
    >
      <span className="flex-1 text-left truncate">{label}</span>
      {badge != null && (
        <span
          className={`text-[9px] font-bold px-1.5 py-0.5 rounded tabular-nums ${
            active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  )
}

function SignOutIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
      />
    </svg>
  )
}

function SupportIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.09 9.09 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.06 6.06 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74-.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
    </svg>
  )
}

function DatabaseIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"
      />
    </svg>
  )
}

function TeamIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  )
}

function WhatsAppIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

function HomeIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  )
}

function PeopleIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function ListIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
    </svg>
  )
}

function PipelineIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
    </svg>
  )
}

function LogIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  )
}

function CalendarIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )
}

function BoltIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  )
}

function MailIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
      />
    </svg>
  )
}

function ChartIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  )
}

function NoteIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  )
}

function TaskIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  )
}

function SparkIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  )
}
