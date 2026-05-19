import { useState } from 'react'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import PeopleSearch from '../search/PeopleSearch'
import SavedLeadsPanel from '../saved/SavedLeadsPanel'
import IntegrationsPanel from '../integrations/IntegrationsPanel'
import OverviewPanel from '../overview/OverviewPanel'

const PANELS = {
  overview: OverviewPanel,
  search: PeopleSearch,
  saved: SavedLeadsPanel,
  integrations: IntegrationsPanel,
}

export default function AppShell() {
  const [activePanel, setActivePanel] = useState('search')

  const Panel = PANELS[activePanel] || PeopleSearch

  return (
    <div className="flex min-h-screen bg-apollo-surface">
      <Sidebar active={activePanel} onNavigate={setActivePanel} />
      <div className="flex-1 ml-60 flex flex-col min-h-screen">
        <TopBar activePanel={activePanel} />
        <main className="flex-1 overflow-hidden">
          <Panel onNavigate={setActivePanel} />
        </main>
      </div>
    </div>
  )
}
