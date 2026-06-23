import { lazy, Suspense, useRef } from 'react'
import useIsMobile from '../../hooks/useIsMobile'
import PeopleSearch from '../search/PeopleSearch'
import SavedLeadsPanel from '../saved/SavedLeadsPanel'
import TeamPanel from '../team/TeamPanel'
import OrgBillingPanel from '../team/OrgBillingPanel'
import MyEmailPanel from '../team/MyEmailPanel'
import WhatsAppSettingsPanel from '../team/WhatsAppSettingsPanel'
import IntegrationsPanel from '../integrations/IntegrationsPanel'
import OverviewPanel from '../overview/OverviewPanel'
import PlatformCustomersPanel from '../admin/PlatformCustomersPanel'
import AdminPanel from '../admin/AdminPanel'
import CrmActivityLogPanel from '../crm/CrmActivityLogPanel'
const CrmCalendarPanel = lazy(() => import('../crm/CrmCalendarPanel'))
import MarketingPanel from '../marketing/MarketingPanel'
import ChithiPanel from '../chithi/ChithiPanel'
import TeamNotesPanel from '../team/TeamNotesPanel'
import TeamTasksPanel from '../team/TeamTasksPanel'
import ContactsPanel from '../contacts/ContactsPanel'
import CompaniesPanel from '../companies/CompaniesPanel'
import CrmSequencesPanel from '../crm/CrmSequencesPanel'
import CrmAutomationPanel from '../crm/CrmAutomationPanel'
import ActiveCustomersPanel from '../crm/ActiveCustomersPanel'
import FieldExpensesPanel from '../crm/FieldExpensesPanel'
import PanelCustomizationPanel from '../settings/PanelCustomizationPanel'
import CompanyWorkspacePanel from '../workspace/CompanyWorkspacePanel'
import PlatformAdminHome from '../admin/PlatformAdminHome'
import LoadingExperience from '../ui/LoadingExperience'

const TeamDashboardPanel = lazy(() => import('../crm/TeamDashboardPanel'))
const RepReviewPanel = lazy(() => import('../overview/RepReviewPanel'))
const PipelinePanel = lazy(() => import('../crm/PipelinePanel'))

const PANELS = {
  overview: OverviewPanel,
  search: PeopleSearch,
  saved: SavedLeadsPanel,
  pipeline: PipelinePanel,
  'active-customers': ActiveCustomersPanel,
  'field-expenses': FieldExpensesPanel,
  contacts: ContactsPanel,
  companies: CompaniesPanel,
  chithi: ChithiPanel,
  'team-hub': ChithiPanel,
  'team-notes': ChithiPanel,
  'team-tasks': ChithiPanel,
  'crm-dashboard': TeamDashboardPanel,
  'crm-rep-review': RepReviewPanel,
  'crm-log': CrmActivityLogPanel,
  'crm-calendar': CrmCalendarPanel,
  marketing: MarketingPanel,
  'bulk-email': MarketingPanel,
  'crm-sequences': CrmSequencesPanel,
  'crm-automation': CrmAutomationPanel,
  team: TeamPanel,
  'org-billing': OrgBillingPanel,
  'my-email': MyEmailPanel,
  'whatsapp-settings': WhatsAppSettingsPanel,
  integrations: IntegrationsPanel,
  admin: AdminPanel,
  'admin-home': PlatformAdminHome,
  'admin-customers': PlatformCustomersPanel,
  'app-settings': PanelCustomizationPanel,
  'company-workspace': CompanyWorkspacePanel,
}

function resolvePanelId(activePanel) {
  return activePanel === 'bulk-email' ? 'marketing' : activePanel
}

function PanelLoader() {
  return (
    <LoadingExperience
      message="Loading…"
      fill={false}
      className="rounded-2xl border border-[#dde3ea] min-h-[200px] bg-white m-4"
    />
  )
}

function renderPanel(panelId, Panel, props) {
  if (panelId === 'crm-dashboard' || panelId === 'pipeline' || panelId === 'crm-calendar' || panelId === 'crm-rep-review') {
    return (
      <Suspense fallback={<PanelLoader />}>
        <Panel {...props} />
      </Suspense>
    )
  }
  return <Panel {...props} />
}

export default function PanelViewport({ activePanel, panelOptions, onNavigate, onOpenCrmMenu }) {
  const isMobile = useIsMobile()
  const panelId = resolvePanelId(activePanel)
  const Panel = PANELS[panelId] || PeopleSearch
  const visitedRef = useRef(new Set([panelId]))

  if (!isMobile) {
    return (
      <div className="flex-1 flex flex-col min-h-0 min-w-0 h-full overflow-hidden">
        {renderPanel(panelId, Panel, {
          onNavigate,
          activePanel,
          panelOptions,
          isActive: true,
          onOpenCrmMenu,
        })}
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
            {renderPanel(panelId, Panel, {
              onNavigate,
              activePanel,
              panelOptions,
              isActive,
              onOpenCrmMenu,
            })}
          </div>
        )
      })}
    </div>
  )
}
