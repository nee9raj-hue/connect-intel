import { useApp } from '../../context/AppContext'
import NotificationBell from './NotificationBell'
import SidebarToggleButton from './SidebarToggleButton'
import { CREDITS_IN_CRM_UI_ENABLED } from '../../lib/crmProductFlags'

export default function AppHeader({
  onNavigate,
  onOpenCommandPalette,
  sidebarMode = 'expanded',
  onToggleSidebarCollapsed,
}) {
  const { user } = useApp()
  if (!user || user.isPlatformAdmin) return null

  const credits = user.prospectCredits ?? Math.floor((user.creditsPaise ?? 0) / 100)
  const subscriptionActive = Boolean(user.subscriptionActive)
  const crmFree = user.crmFreeMode !== false

  return (
    <header className="ci-app-header shrink-0 flex items-center justify-between gap-2 border-b border-[#e5e9ee] bg-white px-4 py-2.5">
      <SidebarToggleButton mode={sidebarMode} onToggle={onToggleSidebarCollapsed} className="shrink-0 hidden md:inline-flex" />
      <button
        type="button"
        onClick={() => onOpenCommandPalette?.()}
        className="ci-header-search-btn hidden md:inline-flex min-w-0"
        aria-label="Open command palette"
      >
        <span>Search CRM…</span>
        <kbd>⌘K</kbd>
      </button>
      <div className="ci-app-header-chips flex items-center justify-end gap-2 flex-1 min-w-0 md:flex-none">
        <NotificationBell />
        {CREDITS_IN_CRM_UI_ENABLED ? (
          <button
            type="button"
            onClick={() => onNavigate?.('search')}
            className="ci-app-header-chip ci-app-header-chip--secondary inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#d9dee5] bg-[#f7f9fb] px-2.5 py-1.5 md:px-3 text-sm font-semibold tracking-[-0.015em] text-[#202938] transition-colors hover:bg-[#eef2f6]"
            title={`AI credits: Rs ${credits}`}
            aria-label={`AI credits: Rs ${credits}`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#17191c]" />
            <span className="hidden sm:inline">AI credits: Rs {credits}</span>
            <span className="sm:hidden tabular-nums">Rs {credits}</span>
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => onNavigate?.('team')}
          className={`ci-app-header-chip ci-app-header-chip--secondary inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1.5 md:px-3 text-sm font-semibold tracking-[-0.015em] transition-colors ${
            subscriptionActive
              ? 'border-[#b8e3d2] bg-[#eefaf5] text-[#0f6a4c]'
              : 'border-[#d9dee5] bg-white text-[#536072] hover:bg-[#f7f9fb]'
          }`}
          title={
            subscriptionActive
              ? 'Paid subscription active'
              : 'Core CRM is free for your workspace'
          }
          aria-label={
            subscriptionActive
              ? 'Subscription active'
              : crmFree
                ? 'CRM free mode'
                : 'Subscription inactive'
          }
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${subscriptionActive ? 'bg-[#0f6a4c]' : 'bg-[#7f8b99]'}`}
          />
          <span className="hidden sm:inline">
            Subscription: {subscriptionActive ? 'Active' : crmFree ? 'CRM free mode' : 'Inactive'}
          </span>
          <span className="sm:hidden">{subscriptionActive ? 'Pro' : crmFree ? 'Free' : 'Off'}</span>
        </button>
      </div>
    </header>
  )
}
