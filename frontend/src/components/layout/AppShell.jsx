import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import OnboardingModal from '../onboarding/OnboardingModal'
import Sidebar from './Sidebar'
import PeopleSearch from '../search/PeopleSearch'
import SavedLeadsPanel from '../saved/SavedLeadsPanel'
import PipelinePanel from '../crm/PipelinePanel'
import TeamPanel from '../team/TeamPanel'
import IntegrationsPanel from '../integrations/IntegrationsPanel'
import OverviewPanel from '../overview/OverviewPanel'
import AdminPanel from '../admin/AdminPanel'

const PANELS = {
  overview: OverviewPanel,
  search: PeopleSearch,
  saved: SavedLeadsPanel,
  pipeline: PipelinePanel,
  team: TeamPanel,
  integrations: IntegrationsPanel,
  admin: AdminPanel,
}

export default function AppShell() {
  const { user } = useApp()
  const [activePanel, setActivePanel] = useState('search')
  const Panel = PANELS[activePanel] || PeopleSearch
  const needsOnboarding = user && !user.onboardingComplete

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#f6f7f9]">
      <Sidebar active={activePanel} onNavigate={setActivePanel} />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Panel onNavigate={setActivePanel} />
      </main>
      {needsOnboarding && <OnboardingModal />}
    </div>
  )
}
