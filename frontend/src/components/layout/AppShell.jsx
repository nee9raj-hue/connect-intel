import { useEffect, useState } from 'react'
import { useApp } from '../../context/AppContext'
import OnboardingModal from '../onboarding/OnboardingModal'
import Sidebar from './Sidebar'
import AppHeader from './AppHeader'
import TeamDashboardPanel from '../crm/TeamDashboardPanel'
import PeopleSearch from '../search/PeopleSearch'
import SavedLeadsPanel from '../saved/SavedLeadsPanel'
import PipelinePanel from '../crm/PipelinePanel'
import TeamPanel from '../team/TeamPanel'
import IntegrationsPanel from '../integrations/IntegrationsPanel'
import OverviewPanel from '../overview/OverviewPanel'
import AdminPanel from '../admin/AdminPanel'
import EmailOAuthNotice from './EmailOAuthNotice'
import MobileRequiredModal from '../profile/MobileRequiredModal'
import CrmActivityLogPanel from '../crm/CrmActivityLogPanel'
import CrmCalendarPanel from '../crm/CrmCalendarPanel'
import BulkEmailPanel from '../crm/BulkEmailPanel'
import { useCrmReminders } from '../../hooks/useCrmReminders'

const PANELS = {
  overview: OverviewPanel,
  search: PeopleSearch,
  saved: SavedLeadsPanel,
  pipeline: PipelinePanel,
  'crm-dashboard': TeamDashboardPanel,
  'crm-log': CrmActivityLogPanel,
  'crm-calendar': CrmCalendarPanel,
  'bulk-email': BulkEmailPanel,
  team: TeamPanel,
  integrations: IntegrationsPanel,
  admin: AdminPanel,
}

export default function AppShell() {
  const { user } = useApp()
  const [activePanel, setActivePanel] = useState('pipeline')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const Panel = PANELS[activePanel] || PeopleSearch
  const needsOnboarding = user && !user.onboardingComplete && !user.isPlatformAdmin

  useCrmReminders(Boolean(user?.onboardingComplete || user?.isPlatformAdmin))

  useEffect(() => {
    if (user?.isPlatformAdmin) {
      setActivePanel('admin')
    }
  }, [user?.isPlatformAdmin, user?.id])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const oauth = params.get('email_oauth')
    if (!oauth) return
    if (oauth === 'connected' || oauth === 'error') {
      setActivePanel(user?.isPlatformAdmin ? 'integrations' : 'team')
    }
  }, [user?.isPlatformAdmin])

  const navigate = (id) => {
    setActivePanel(id)
    setMobileNavOpen(false)
  }

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-[#f6f7f9]">
      <Sidebar
        active={activePanel}
        onNavigate={navigate}
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
      />
      <main className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        <div className="md:hidden shrink-0 flex items-center gap-2 px-3 py-2 bg-white border-b border-gray-200">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="p-2 rounded-lg border border-gray-200 text-gray-700"
            aria-label="Open menu"
          >
            ☰
          </button>
          <span className="text-sm font-semibold text-gray-900 truncate">Connect Intel</span>
        </div>
        {user?.isPlatformAdmin && (
          <EmailOAuthNotice onOpenSystemStatus={() => navigate('integrations')} />
        )}
        <MobileRequiredModal />
        {!user?.isPlatformAdmin && <AppHeader onNavigate={navigate} />}
        <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">
          <Panel onNavigate={navigate} activePanel={activePanel} />
        </div>
      </main>
      {needsOnboarding && <OnboardingModal />}
    </div>
  )
}
