import { useApp } from '../../context/AppContext'
import NotificationBell from './NotificationBell'

export default function AppHeader({ onNavigate }) {
  const { user } = useApp()
  if (!user || user.isPlatformAdmin) return null

  const credits = user.prospectCredits ?? Math.floor((user.creditsPaise ?? 0) / 100)
  const subscriptionActive = Boolean(user.subscriptionActive)
  const crmFree = user.crmFreeMode !== false

  return (
    <header className="shrink-0 flex items-center justify-end gap-2 px-4 py-2 bg-white border-b border-gray-200">
      <NotificationBell />
      <button
        type="button"
        onClick={() => onNavigate?.('search')}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5b4a00] bg-[#fff6d6] px-3 py-1.5 rounded-full border border-[#ffe48a] hover:bg-[#fff0b8] transition-colors"
        title="Credits are used for AI prospect search and lead unlocks"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-[#ffcb2b]" />
        AI credits: Rs {credits}
      </button>
      <button
        type="button"
        onClick={() => onNavigate?.('team')}
        className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
          subscriptionActive
            ? 'text-emerald-800 bg-emerald-50 border-emerald-200'
            : 'text-gray-700 bg-gray-50 border-gray-200 hover:bg-gray-100'
        }`}
        title={
          subscriptionActive
            ? 'Paid subscription — full prospect access'
            : 'CRM is free. Subscribe to unlock full AI prospect details.'
        }
      >
        <span
          className={`w-1.5 h-1.5 rounded-full ${subscriptionActive ? 'bg-emerald-500' : 'bg-gray-400'}`}
        />
        Subscription: {subscriptionActive ? 'Active' : crmFree ? 'CRM free mode' : 'Inactive'}
      </button>
    </header>
  )
}
