import { useApp } from '../../context/AppContext'
import NotificationBell from './NotificationBell'
import SidebarToggleButton from './SidebarToggleButton'

export default function AppHeader({ onNavigate, sidebarMode = 'expanded', onToggleSidebarCollapsed }) {
  const { user } = useApp()
  if (!user || user.isPlatformAdmin) return null

  const credits = user.prospectCredits ?? Math.floor((user.creditsPaise ?? 0) / 100)
  const subscriptionActive = Boolean(user.subscriptionActive)
  const crmFree = user.crmFreeMode !== false

  return (
    <header className="shrink-0 flex items-center justify-between gap-2 border-b border-[#e5e9ee] bg-white px-4 py-2.5">
      <SidebarToggleButton
        mode={sidebarMode}
        onToggle={onToggleSidebarCollapsed}
        className="hidden md:inline-flex shrink-0"
      />
      <div className="flex items-center justify-end gap-2 flex-1 min-w-0">
      <NotificationBell />
      <button
        type="button"
        onClick={() => onNavigate?.('search')}
        className="inline-flex items-center gap-1.5 rounded-full border border-[#d9dee5] bg-[#f7f9fb] px-3 py-1.5 text-[11px] font-semibold tracking-[-0.015em] text-[#202938] transition-colors hover:bg-[#eef2f6]"
        title="Credits are used for AI prospect search and lead unlocks"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-[#17191c]" />
        AI credits: Rs {credits}
      </button>
      <button
        type="button"
        onClick={() => onNavigate?.('team')}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold tracking-[-0.015em] transition-colors ${
          subscriptionActive
            ? 'border-[#b8e3d2] bg-[#eefaf5] text-[#0f6a4c]'
            : 'border-[#d9dee5] bg-white text-[#536072] hover:bg-[#f7f9fb]'
        }`}
        title={
          subscriptionActive
            ? 'Paid subscription — full prospect access'
            : 'CRM is free. Subscribe to unlock full AI prospect details.'
        }
      >
        <span
          className={`w-1.5 h-1.5 rounded-full ${subscriptionActive ? 'bg-[#0f6a4c]' : 'bg-[#7f8b99]'}`}
        />
        Subscription: {subscriptionActive ? 'Active' : crmFree ? 'CRM free mode' : 'Inactive'}
      </button>
      </div>
    </header>
  )
}
