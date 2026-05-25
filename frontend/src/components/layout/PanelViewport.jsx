import { useRef } from 'react'
import useIsMobile from '../../hooks/useIsMobile'
import TeamDashboardPanel from '../crm/TeamDashboardPanel'
import PeopleSearch from '../search/PeopleSearch'
import SavedLeadsPanel from '../saved/SavedLeadsPanel'
import PipelinePanel from '../crm/PipelinePanel'
import TeamPanel from '../team/TeamPanel'
import WhatsAppSettingsPanel from '../team/WhatsAppSettingsPanel'
import IntegrationsPanel from '../integrations/IntegrationsPanel'
import OverviewPanel from '../overview/OverviewPanel'
import PlatformCustomersPanel from '../admin/PlatformCustomersPanel'
import AdminPanel from '../admin/AdminPanel'
import CrmActivityLogPanel from '../crm/CrmActivityLogPanel'
import CrmCalendarPanel from '../crm/CrmCalendarPanel'
import MarketingPanel from '../marketing/MarketingPanel'
import TeamNotesPanel from '../team/TeamNotesPanel'
import TeamTasksPanel from '../team/TeamTasksPanel'
import ContactsPanel from '../contacts/ContactsPanel'
import CrmSequencesPanel from '../crm/CrmSequencesPanel'
import CrmAutomationPanel from '../crm/CrmAutomationPanel'
import ActiveCustomersPanel from '../crm/ActiveCustomersPanel'

const PANELS = {
  overview: OverviewPanel,
  search: PeopleSearch,
  saved: SavedLeadsPanel,
  pipeline: PipelinePanel,
  'active-customers': ActiveCustomersPanel,
  contacts: ContactsPanel,
  'team-notes': TeamNotesPanel,
  'team-tasks': TeamTasksPanel,
  'crm-dashboard': TeamDashboardPanel,
  'crm-log': CrmActivityLogPanel,
  'crm-calendar': CrmCalendarPanel,
  marketing: MarketingPanel,
  'bulk-email': MarketingPanel,
  'crm-sequences': CrmSequencesPanel,
  'crm-automation': CrmAutomationPanel,
  team: TeamPanel,
  'whatsapp-settings': WhatsAppSettingsPanel,
  integrations: IntegrationsPanel,
  admin: AdminPanel,
  'admin-customers': PlatformCustomersPanel,
}

function resolvePanelId(activePanel) {
  return activePanel === 'bulk-email' ? 'marketing' : activePanel
}

export default function PanelViewport({ activePanel, panelOptions, onNavigate }) {
  const isMobile = useIsMobile()
  const panelId = resolvePanelId(activePanel)
  const Panel = PANELS[panelId] || PeopleSearch
  const visitedRef = useRef(new Set([panelId]))

  if (!isMobile) {
    return (
      <div className="flex-1 flex flex-col min-h-0 min-w-0 h-full overflow-hidden">
        <Panel
          onNavigate={onNavigate}
          activePanel={activePanel}
          panelOptions={panelOptions}
          isActive
        />
      </div>
    )
  }

  visitedRef.current.add(panelId)

  return (
    <div className="relative flex-1 min-h-0 h-full overflow-hidden">
      {[...visitedRef.current].map((panelId) => {
        const Panel = PANELS[panelId] || PeopleSearch
        const isActive = resolvePanelId(activePanel) === panelId
        return (
          <div
            key={panelId}
            className={`absolute inset-0 flex flex-col min-h-0 min-w-0 ${isActive ? 'z-10' : 'z-0 hidden'}`}
            aria-hidden={!isActive}
          >
            <Panel
              onNavigate={onNavigate}
              activePanel={activePanel}
              panelOptions={panelOptions}
              isActive={isActive}
            />
          </div>
        )
      })}
    </div>
  )
}
